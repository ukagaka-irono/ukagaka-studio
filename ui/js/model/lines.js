/* 伺かスタジオ - セリフの一覧（「セリフ」の画面と、CSV の出し入れ）
 *
 * プロジェクトの「話す」ブロック（say）を、かたまりの順・上から順に集めます。
 * それぞれに「どのかたまりの、どこのブロックか」を表す key を付けるので（例: s1/0/then/2）、
 * 書き出した CSV を表計算などで直して読みこむと、変わったセリフだけを書きもどせます。
 * セリフの欄にブロック（演算など）がはめこんであるものは、文字ではないので直せません（readonly）。
 *
 * DOM を触らないので、node のテスト（ui\test\editor.js）からそのまま使えます。
 */

import { getDef } from './blocks.js';

/** 「話す」ブロックを集める。[{ key, scriptId, script, who, text, readonly, block }] */
export function collectLines(project) {
  const out = [];
  for (const s of (project && project.scripts) || []) {
    if (!s || !s.id || s.kind === 'loose') continue;     // 帽子の無いかたまりは書き出さないので外す
    (function walk(blocks, path) {
      if (!Array.isArray(blocks)) return;
      blocks.forEach((b, i) => {
        if (!b || typeof b !== 'object') return;
        const here = `${path}/${i}`;
        if (b.type === 'say') {
          const readonly = typeof b.text === 'object' && b.text !== null;
          out.push({
            key: here, scriptId: s.id, script: s, who: Number(b.who) || 0,
            text: readonly ? '' : String(b.text == null ? '' : b.text), readonly, block: b,
          });
        }
        // 「もし」「くりかえす」などの口の中も見る（ブロックの定義の subs と、えらび先の dynamic）
        const def = getDef(b);
        if (!def) return;
        for (const sub of def.subs || []) walk(b[sub.key], `${here}/${sub.key}`);
        if (def.dynamic && Array.isArray(b[def.dynamic])) {
          b[def.dynamic].forEach((arr, k) => walk(arr, `${here}/${def.dynamic}.${k}`));
        }
      });
    })(s.blocks, s.id);
  }
  return out;
}

// ------------------------------------------------------------------ CSV
const HEAD = ['key', 'script', 'who', 'text'];

function cell(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** セリフの一覧を CSV にする（Excel でも文字化けしないように BOM を付ける）。titleOf(script) で 2 列目の名前 */
export function linesToCsv(lines, titleOf) {
  const rows = [HEAD.join(',')];
  for (const l of lines) {
    if (l.readonly) continue;
    rows.push([l.key, titleOf ? titleOf(l.script) : l.scriptId, l.who, l.text].map(cell).join(','));
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

/** CSV を読む（引用符の中のカンマ・改行・"" をふくめて）。[[セル, …], …] */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cur); cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else {
      cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] || '') !== '');
}

/**
 * 読みこんだ CSV のセリフを、プロジェクトに書きもどす（変わったものだけ）。
 * 返すのは { changed, same, unknown }。unknown は、もう無いブロックの key（かたまりを消した・動かしたなど）
 */
export function applyCsv(project, rows) {
  const head = rows[0] || [];
  const ki = head.indexOf('key');
  const ti = head.indexOf('text');
  const result = { changed: 0, same: 0, unknown: [] };
  if (ki < 0 || ti < 0) { result.error = 'no_columns'; return result; }
  const byKey = new Map(collectLines(project).filter((l) => !l.readonly).map((l) => [l.key, l]));
  for (const r of rows.slice(1)) {
    const key = r[ki];
    if (!key) continue;
    const line = byKey.get(key);
    if (!line) { result.unknown.push(key); continue; }
    const text = r[ti] == null ? '' : r[ti];
    if (text === line.text) { result.same++; continue; }
    line.block.text = text;
    result.changed++;
  }
  return result;
}
