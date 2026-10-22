/* 伺かスタジオ - 部品（よく使う組みかた）
 *
 * ブロックの並びに名前を付けて「部品」として保存し、パレットの「部品」から、どのプロジェクトにも置けるようにします。
 * 保存先は exe のとなりの parts.json（/api/parts）で、プロジェクトには入りません。
 *
 *   { id, name, blocks: [ … ], variables: [{ name, value }] }
 *
 * variables は、部品のブロックが使っている変数とその初期値です。置いた先のプロジェクトに無ければ足します
 * （editor/drag.js。コピーとはりつけと同じ決まり。editor/clipboard.js）。
 */

import { Model } from '../model/model.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Events } from '../core/events.js';
import { t } from '../i18n/i18n.js';
import { Clipboard } from './clipboard.js';

let list = [];

/** blocks（ブロックの並び）から部品を作る。変数の初期値は、いまのプロジェクトから添える */
function make(name, blocks) {
  const copied = Model.clone(blocks);
  const used = [];
  for (const b of copied) {
    for (const n of Clipboard.usedVariables(b)) if (!used.includes(n)) used.push(n);
  }
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(name).trim(),
    blocks: copied,
    variables: used
      .map((n) => Model.project.variables.find((v) => v.name === n))
      .filter(Boolean)
      .map((v) => ({ name: v.name, value: v.value })),
  };
}

async function load() {
  try {
    const r = await api('/api/parts');
    list = (Array.isArray(r.parts) ? r.parts : []).filter((p) => p && p.name && Array.isArray(p.blocks) && p.blocks.length);
  } catch { list = []; }   // exe の外（ブラウザでじかに開いたとき）は、部品なし
  Events.emit('parts-changed');
}

async function store(next, message) {
  try {
    const r = await api('/api/parts', { method: 'POST', body: { parts: next } });
    list = r.parts;
    Events.emit('parts-changed');
    if (message) toast(message);
    return true;
  } catch (e) {
    toast(e.message, true);
    return false;
  }
}

/** blocks を部品として保存する（名前をたずねる） */
async function save(blocks, suggested) {
  if (!Array.isArray(blocks) || !blocks.length) return false;
  const name = prompt(t('部品の名前は？'), suggested || t('あたらしい部品'));
  if (!name || !name.trim()) return false;
  const part = make(name, blocks);
  return store(list.concat([part]), t('部品「{name}」を保存しました。パレットの「部品」から、どのプロジェクトにも置けます', { name: part.name }));
}

async function rename(part) {
  const name = prompt(t('部品の名前は？'), part.name);
  if (!name || !name.trim() || name.trim() === part.name) return false;
  return store(list.map((p) => (p.id === part.id ? Object.assign({}, p, { name: name.trim() }) : p)));
}

async function remove(part) {
  if (!confirm(t('部品「{name}」を消しますか？', { name: part.name }))) return false;
  return store(list.filter((p) => p.id !== part.id), t('部品「{name}」を消しました', { name: part.name }));
}

export const Parts = {
  get list() { return list; },
  make, load, save, rename, remove,
};
