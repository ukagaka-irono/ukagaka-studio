/* 伺かスタジオ - 部品をファイルにして、人と分けあう（段階 7-4）
 *
 *   { "format": "ikaga-parts/1", "parts": [ { name, blocks: [ … ], variables: [{ name, value }] } ] }
 *
 * 書き出すときは id を落とし、読みこむときは id を付けなおします。読みこむ部品の名前が、もうある部品とかぶったら
 * 「名前 (2)」のように変えます。DOM を触らないので、node のテスト（ui\test\editor.js）からそのまま使えます。
 */

export const PARTS_FORMAT = 'ikaga-parts/1';

/** 部品の一覧を、ファイルの中身（JSON の文字）にする */
export function partsToFile(parts) {
  const out = (Array.isArray(parts) ? parts : []).map((p) => ({
    name: String(p.name || ''),
    blocks: Array.isArray(p.blocks) ? p.blocks : [],
    variables: Array.isArray(p.variables) ? p.variables : [],
  }));
  return JSON.stringify({ format: PARTS_FORMAT, parts: out }, null, 2) + '\n';
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * ファイルの中身から、読みこむ部品を作る。taken はもうある部品の名前（かぶったら名前を変える）。
 * 部品のファイルでなければ Error（message は 'not_parts'）を投げます。形のおかしい部品は読みとばします
 */
export function partsFromFile(text, taken = []) {
  let data;
  try { data = JSON.parse(String(text).replace(/^﻿/, '')); } catch { throw new Error('not_parts'); }
  if (!isObj(data) || data.format !== PARTS_FORMAT || !Array.isArray(data.parts)) throw new Error('not_parts');
  const names = new Set(taken);
  const out = [];
  data.parts.forEach((p, i) => {
    if (!isObj(p)) return;
    const blocks = Array.isArray(p.blocks) ? p.blocks.filter((b) => isObj(b) && typeof b.type === 'string') : [];
    const base = String(p.name || '').trim();
    if (!base || !blocks.length) return;
    let name = base;
    for (let n = 2; names.has(name); n++) name = `${base} (${n})`;
    names.add(name);
    const variables = (Array.isArray(p.variables) ? p.variables : [])
      .filter((v) => isObj(v) && typeof v.name === 'string' && v.name.trim())
      .map((v) => ({ name: v.name.trim(), value: v.value === undefined ? 0 : v.value }));
    out.push({ id: 'p' + Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 6), name, blocks, variables });
  });
  return out;
}
