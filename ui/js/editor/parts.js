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
import { partsToFile, partsFromFile } from '../model/partsfile.js';
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

/** 部品をファイルに書き出す（段階 7-4。WebView2 のダウンロードで保存します） */
function exportFile(parts) {
  if (!parts || !parts.length) { toast(t('書き出す部品がありません'), true); return; }
  const url = URL.createObjectURL(new Blob([partsToFile(parts)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  const base = parts.length === 1 ? String(parts[0].name).replace(/[\\/:*?"<>|]/g, '_') : t('部品');
  a.download = `${base}.parts.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t('部品を {n} こ、ファイルに書き出しました', { n: parts.length }));
}

/** 部品のファイルをえらんで、部品に足す */
function importFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    let added;
    try {
      added = partsFromFile(await file.text(), list.map((p) => p.name));
    } catch (e) {
      toast(e.message === 'not_parts' ? t('伺かスタジオの部品のファイルではありません') : e.message, true);
      return;
    }
    if (!added.length) { toast(t('読みこめる部品がありませんでした'), true); return; }
    await store(list.concat(added), t('部品を {n} こ読みこみました（{names}）', { n: added.length, names: added.map((p) => p.name).join('、') }));
  });
  input.click();
}

export const Parts = {
  get list() { return list; },
  make, load, save, rename, remove, exportFile, importFile,
};
