/* 伺かスタジオ - セリフなどの文字を、まとめて置きかえる（「さがす」タブの「置きかえる」）
 *
 * ブロックの文字の欄（kind: 'input' で、文字のもの）の中だけを置きかえます。はめこんだブロックの中もふくみます。
 * 「YAYA の関数 F」「YAYA の式 C」のように、書いた文字をコードとして使う欄（literal: true）は置きかえません
 * （まとめて置きかえて、手書きの YAYA をこわさないため）。変数の名前は、変数タブの「名前を変える」を使います。
 *
 * DOM を触らないので、node のテスト（ui\test\editor.js）からそのまま使えます。
 */

import { getDef } from './blocks.js';

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

/** いくつ見つかるか（置きかえる前に、数を見せるため） */
export function countText(project, from, opts = {}) {
  if (!from) return 0;
  const re = new RegExp(escapeRe(from), opts.ignoreCase ? 'gi' : 'g');
  let n = 0;
  eachTextField(project, (owner, key, value) => { n += (value.match(re) || []).length; });
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
  return n;
}
