/* 伺かスタジオ - セリフなどの文字を、まとめて置きかえる（「さがす」タブの「置きかえる」）
 *
 * ブロックの文字の欄（kind: 'input' で、文字のもの）の中だけを置きかえます。はめこんだブロックの中もふくみます。
 * 「YAYA の関数 F」「YAYA の式 C」のように、書いた文字をコードとして使う欄（literal: true）は置きかえません
 * （まとめて置きかえて、手書きの YAYA をこわさないため）。変数の名前は、変数タブの「名前を変える」を使います。
 * プロジェクトの YAYA の辞書は、文字列（"…"・'…'・ヒアドキュメント）の中だけを置きかえます（段階 9-3。セリフはそこにあるので）。
 *
 * DOM を触らないので、node のテスト（ui\test\editor.js）からそのまま使えます。
 */

import { getDef } from './blocks.js';
import { highlightYaya } from './yayatext.js';

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 置きかえる欄を、ひとつずつ visit(owner, key, value) に渡す */
function eachTextField(project, visit) {
  (function walk(v) {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    const def = typeof v.type === 'string' ? getDef(v) : null;
    for (const k of Object.keys(v)) {
      const arg = def && def.args ? def.args[k] : null;
      if (arg && arg.kind === 'input' && !arg.literal && arg.mode !== 'number' && typeof v[k] === 'string') visit(v, k, v[k]);
      walk(v[k]);
    }
  })(((project && project.scripts) || []).map((s) => s.blocks));
}

/**
 * 辞書のテキストの、文字列の中だけを fn(文字) で書きかえたテキスト。
 * 色分け（highlightYaya）で文字列になったところの、かこむ引用符をのぞいた中身を渡します（引用符・コード・コメントはそのまま）
 */
function mapStrings(text, fn) {
  return highlightYaya(text).map((spans) => spans.map(([cls, s]) => {
    if (cls !== 'str') return s;
    const q = s[0];
    if ((q === '"' || q === "'") && s.length >= 2 && s[s.length - 1] === q) return q + fn(s.slice(1, -1)) + q;
    if (q === '"' || q === "'") return q + fn(s.slice(1));   // 行の終わりまで閉じていない文字列
    if (/^<<["']$/.test(s) || /^["']>>$/.test(s)) return s;   // ヒアドキュメントのはじめと終わりの印
    return fn(s);                                              // ヒアドキュメントの中の行
  }).join('')).join('\n');
}

/** いくつ見つかるか（置きかえる前に、数を見せるため） */
export function countText(project, from, opts = {}) {
  if (!from) return 0;
  const re = new RegExp(escapeRe(from), opts.ignoreCase ? 'gi' : 'g');
  let n = 0;
  eachTextField(project, (owner, key, value) => { n += (value.match(re) || []).length; });
  for (const d of (project && project.dics) || []) mapStrings(d.text, (s) => { n += (s.match(re) || []).length; return s; });
  return n;
}

/** from を to に置きかえて、置きかえた数を返す */
export function replaceText(project, from, to, opts = {}) {
  if (!from) return 0;
  const re = new RegExp(escapeRe(from), opts.ignoreCase ? 'gi' : 'g');
  let n = 0;
  eachTextField(project, (owner, key, value) => {
    const hits = (value.match(re) || []).length;
    if (!hits) return;
    owner[key] = value.replace(re, () => to);   // to の $& などを、そのままの文字として入れる
    n += hits;
  });
  for (const d of (project && project.dics) || []) {
    const text = mapStrings(d.text, (s) => {
      const hits = (s.match(re) || []).length;
      n += hits;
      return hits ? s.replace(re, () => to) : s;
    });
    if (text !== d.text) d.text = text;
  }
  return n;
}
