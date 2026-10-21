/* 伺かスタジオ - 画面の言葉（日本語・英語）
 *
 * 画面に出す言葉は、すべて t('日本語の文') を通します。**日本語の文そのものが鍵**です。
 *
 *   t('保存しました')
 *   t('「{name}」を保存しました', { name })      … {name} のところに値を入れる
 *
 * 日本語のときは、渡した文をそのまま返します。英語のときは en.js の辞書を引き、
 * 辞書に無ければ日本語のまま返します（日本語が正です）。
 *
 * 言語は起動したときに 1 度だけ決めます（設定 → Windows の表示言語）。切りかえたら画面を
 * 読みなおします。おかげで、ブロックの定義のようにファイルの外側で作る文も t() で書けます。
 *
 * index.html に直に書いた文は、起動したときに translateDom() が置きかえます。
 *
 * 文を書きかえたら、en.js の古い訳が残ります。ui\test\i18n.js が、t() で包み忘れた日本語と、
 * どこにも使われていない訳を見つけます（docs/maintenance.md の「画面の言葉」）。
 */

import { en } from './en.js';

const KEY = 'ikaga.lang';
export const LANGS = ['ja', 'en'];
const DICTS = { en };

/** 使う言語を決める。テストは globalThis.IKAGA_LANG で決めうちにします */
function detect() {
  if (LANGS.indexOf(globalThis.IKAGA_LANG) >= 0) return globalThis.IKAGA_LANG;
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.indexOf(saved) >= 0) return saved;
  } catch { /* 覚えていなければ Windows に合わせる */ }
  const nav = (globalThis.navigator && globalThis.navigator.language) || 'ja';
  return /^ja\b/i.test(nav) ? 'ja' : 'en';
}

const lang = detect();

/** 画面の言葉を引く。vars を渡すと {名前} を置きかえます */
export function t(text, vars) {
  let s = text;
  if (lang !== 'ja') {
    const hit = DICTS[lang][text];
    if (typeof hit === 'string' && hit !== '') s = hit;
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

export function getLang() { return lang; }

/** 言語を変えて、画面を読みなおす */
export function setLang(next) {
  if (LANGS.indexOf(next) < 0 || next === lang) return;
  try { localStorage.setItem(KEY, next); } catch { /* 覚えられなければ、次も Windows に合わせる */ }
  location.reload();
}

// 文字の中に日本語（かな・カタカナ・漢字）があるか
const JP = /[぀-ヿ㐀-鿿]/;
const ATTRS = ['title', 'placeholder', 'alt', 'aria-label'];

/** index.html の文を辞書の鍵にする形。改行と字下げは 1 つの空白にまとめます（ui\test\i18n.js も同じ） */
export function domKey(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

/**
 * index.html に直に書いた文を、いまの言語に置きかえる（日本語のときは何もしない）。
 * 文字のかたまりごとに辞書を引くので、<b> などではさまれた文は、はさまれた単位で訳します。
 */
export function translateDom(root) {
  if (lang === 'ja' || !root) return;
  const doc = root.ownerDocument || root;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const texts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n);
  for (const n of texts) {
    const raw = n.nodeValue;
    const key = domKey(raw);
    if (!key || !JP.test(key)) continue;
    const out = t(key);
    if (out === key) continue;
    // まわりの空白（改行や字下げ）は残して、中身だけ置きかえる
    const lead = /^\s*/.exec(raw)[0];
    const tail = /\s*$/.exec(raw)[0];
    n.nodeValue = lead + out + tail;
  }
  for (const el of root.querySelectorAll('*')) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && JP.test(v)) el.setAttribute(a, t(domKey(v)));
    }
  }
  if (doc.title && JP.test(doc.title)) doc.title = t(domKey(doc.title));
  doc.documentElement.setAttribute('lang', lang);
}
