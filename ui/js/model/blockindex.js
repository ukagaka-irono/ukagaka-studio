/* 伺かスタジオ - ブロックを字でさがすための一覧（「ブロックを探して置く」）
 *
 * パレットに並ぶものを、1 行の文にして並べます。イベントは「起動したとき」「なでられたとき」の
 * ように 1 つずつ別の行にします（字でさがすときは、そのほうが見つけやすいため）。
 * DOM を触らないので、node のテスト（ui\test\editor.js）からそのまま使えます。
 */

import { BLOCKS, PALETTE, CATEGORIES, EVENTS } from './blocks.js';
import { t } from '../i18n/i18n.js';

/** さがすときの字のそろえかた（全角半角・大文字小文字・カタカナとひらがなを同じに見る） */
export function normalizeQuery(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || id;

/** 欄の中身を、文の中でどう見せるか（既定値か、空なら □ ◇） */
function argText(argDef) {
  if (!argDef) return '□';
  const def = typeof argDef.def === 'function' ? argDef.def() : argDef.def;
  switch (argDef.kind) {
    case 'dropdown':
    case 'areaname': {
      const opt = (argDef.options || []).find((o) => o[1] === def) || (argDef.options || [])[0];
      return opt ? opt[0] : '□';
    }
    case 'eventname': {
      const ev = EVENTS.find((e) => e[1] === def);
      return ev ? ev[0] : '□';
    }
    case 'varname': return t('（変数）');
    case 'funcname': return t('（トーク）');
    default:
      if (argDef.mode === 'bool') return '◇';
      return def == null || def === '' ? '□' : String(def);
  }
}

/**
 * ブロックの文を、欄に既定値を入れた 1 行にする（「さくら が □ と話す 改行する」）。
 * 中に入れる口に名前があれば、うしろに付けます（「もし ◇ なら … そうでなければ」）。
 */
export function specText(def) {
  return withSubs((def.parts || []).map((p) => (p.lbl != null ? p.lbl : argText((def.args || {})[p.arg]))).join(''), def);
}

/** ブロックの文のうち、決まった字だけ（欄は空ける。「が と話す」） */
function fixedText(def) {
  return withSubs((def.parts || []).map((p) => (p.lbl != null ? p.lbl : ' ')).join(''), def);
}

function withSubs(text, def) {
  const subs = (def.subs || []).filter((s) => s.label).map((s) => ' … ' + s.label).join('');
  return (text + subs).replace(/\s+/g, ' ').trim();
}

/**
 * さがせるものの一覧。並びはパレットと同じ（カテゴリ順、イベントが先）。
 *   { kind: 'event', event, label, cat }                 イベントの帽子
 *   { kind: 'talk' | 'function', label, cat }             トークの帽子
 *   { kind: 'block', key, label, cat, shape }             ふつうのブロック
 *   { kind: 'var', name, label, cat, shape }              変数（いまのプロジェクトのもの）
 * どれにも、カテゴリの名前 catName と、さがすための字（そろえたもの）が付きます。
 *   fixed  … 決まった字だけ（欄の既定値はふくまない）
 *   search … 見せる文・カテゴリの名前・中の名前（say・OnBoot など）を全部
 */
export function buildBlockIndex(variableNames) {
  const out = [];
  const push = (e, fixed) => {
    e.catName = catName(e.cat);
    e.fixed = normalizeQuery(fixed);
    e.search = normalizeQuery([e.label, e.catName, e.key || '', e.event || ''].join(' '));
    out.push(e);
  };
  for (const cat of CATEGORIES) {
    for (const entry of PALETTE[cat.id] || []) {
      if (typeof entry !== 'string') continue;                 // 説明やボタン
      if (entry === '@vars') {
        for (const name of variableNames || []) push({ kind: 'var', name, label: name, cat: 'variables', shape: 'reporter' }, name);
        continue;
      }
      if (entry === '@event') {
        for (const [label, event] of EVENTS) {
          if (event === '__custom__') continue;
          push({ kind: 'event', event, label, cat: 'events' }, label);
        }
        continue;
      }
      if (entry.indexOf('@event.') === 0) continue;            // 上でイベントごとに並べたので
      const def = BLOCKS[entry];
      if (!def) continue;
      if (def.hat) {
        push({ kind: def.kind, label: specText(def), cat: def.cat }, fixedText(def));
        continue;
      }
      push({ kind: 'block', key: entry, label: specText(def), cat: def.cat, shape: def.shape }, fixedText(def));
    }
  }
  return out;
}

/**
 * 字でさがす。空白で区切った言葉が全部ふくまれているものを、近い順に返します。
 * 言葉ごとに、どこに出てきたかで近さを見ます。
 *   決まった字のはじめ ＞ 決まった字のどこか ＞ 欄の既定値（「さくら」「改行する」など）
 *   ＞ カテゴリの名前や中の名前
 * 同じ近さなら、カテゴリの名前にも出てくるもの（「変数」なら変数のブロック）を先にして、
 * あとはパレットの並び順です（「話す」なら、見た目のブロックより先にセリフのブロック）。
 * 空なら、一覧をそのまま返します。
 */
export function searchBlocks(index, query) {
  const words = normalizeQuery(query).split(/\s+/).filter(Boolean);
  if (!words.length) return index.slice();
  const scored = [];
  index.forEach((e, order) => {
    const label = normalizeQuery(e.label);
    const cat = normalizeQuery(e.catName);
    let score = 0;
    for (const w of words) {
      if (e.search.indexOf(w) < 0) return;                     // 言葉が 1 つでも無ければ外す
      const at = e.fixed.indexOf(w);
      score += at === 0 ? 0 : at > 0 ? 1 : label.indexOf(w) >= 0 ? 2 : 3;
      if (cat.indexOf(w) >= 0) score -= 0.5;
    }
    scored.push({ e, score, order });
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.map((s) => s.e);
}
