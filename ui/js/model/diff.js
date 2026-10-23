/* 伺かスタジオ - 前の版と、いまのプロジェクトのちがい（段階 7-6。「開く」の「前の版」の「いまとくらべる」）
 *
 * かたまりは id で、変数は名前で見くらべます。かたまりの置き場所（x・y）とたたんだ印（folded）だけのちがいは数えません。
 * どちらのプロジェクトも Model.normalize を通したものを渡してください（足りない欄のせいで、ちがって見えないように）。
 * DOM を触らないので、node のテスト（ui\test\editor.js）からそのまま使えます。
 */

export const META_KEYS = ['name', 'sakuraName', 'keroName', 'craftman', 'craftmanUrl', 'homeUrl', 'version', 'description', 'lang', 'readme'];
export const SETTING_KEYS = ['randomTalkEnabled', 'randomTalkInterval', 'noRepeatCount'];

const LAYOUT = new Set(['x', 'y', 'folded']);

function stripLayout(script) {
  const out = {};
  for (const k of Object.keys(script || {}).sort()) if (!LAYOUT.has(k)) out[k] = script[k];
  return JSON.stringify(out);
}

/** ブロックの数（入れ子と、欄にはめたものもふくむ） */
export function countBlocks(blocks) {
  let n = 0;
  (function walk(v) {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    if (typeof v.type === 'string') n++;
    for (const k of Object.keys(v)) if (v[k] && typeof v[k] === 'object') walk(v[k]);
  })(blocks);
  return n;
}

const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

/**
 * before（前の版）から after（いま）へのちがい。
 *   scripts:   [{ kind: 'added' | 'removed' | 'changed', before, after }]（並びは、いまのかたまりの順、消したものはそのあと）
 *   variables: [{ kind, name, before, after }]（before・after は、はじめの値）
 *   meta / settings: [{ key, before, after }]
 */
export function diffProjects(before, after) {
  const b = before || {};
  const a = after || {};
  const oldScripts = new Map((b.scripts || []).map((s) => [s.id, s]));
  const newIds = new Set((a.scripts || []).map((s) => s.id));
  const scripts = [];
  for (const s of a.scripts || []) {
    const old = oldScripts.get(s.id);
    if (!old) scripts.push({ kind: 'added', before: null, after: s });
    else if (stripLayout(old) !== stripLayout(s)) scripts.push({ kind: 'changed', before: old, after: s });
  }
  for (const s of b.scripts || []) if (!newIds.has(s.id)) scripts.push({ kind: 'removed', before: s, after: null });

  const oldVars = new Map((b.variables || []).map((v) => [v.name, v.value]));
  const newVars = new Map((a.variables || []).map((v) => [v.name, v.value]));
  const variables = [];
  for (const [name, value] of newVars) {
    if (!oldVars.has(name)) variables.push({ kind: 'added', name, before: undefined, after: value });
    else if (!same(oldVars.get(name), value)) variables.push({ kind: 'changed', name, before: oldVars.get(name), after: value });
  }
  for (const [name, value] of oldVars) if (!newVars.has(name)) variables.push({ kind: 'removed', name, before: value, after: undefined });

  const pick = (keys, x, y) => keys.filter((k) => !same((x || {})[k], (y || {})[k])).map((k) => ({ key: k, before: (x || {})[k], after: (y || {})[k] }));
  return {
    scripts,
    variables,
    meta: pick(META_KEYS, b.meta, a.meta),
    settings: pick(SETTING_KEYS, b.settings, a.settings),
  };
}

/** ちがいが 1 つも無いか */
export function diffIsEmpty(d) {
  return !d.scripts.length && !d.variables.length && !d.meta.length && !d.settings.length;
}
