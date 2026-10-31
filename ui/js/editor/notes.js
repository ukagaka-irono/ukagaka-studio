/* 伺かスタジオ - ブロックとかたまりのメモ
 *
 * ブロックには block.note、かたまり（帽子）には script.note に文字で持ちます。
 * キャンバスでは、かたまりの右に付せんのように出して、その場で書きなおせます。
 * 書いた文字を全部消すと、メモも消えます。
 *
 * メモは動きには関係しません。書き出す ghost.json（ブロックの写し）にはそのまま入り、
 * YAYA の辞書（studio_program.dic）には、そのブロックの前に // のコメントとして入ります（model/yaya.js）。
 */

import { Model } from '../model/model.js';
import { updateTitle } from '../core/title.js';
import { t } from '../i18n/i18n.js';

let pendingFocus = null;   // 付けたばかりで、描いたらすぐ書きはじめたいメモの持ち主
let addSnapshot = null;    // メモを付ける前のプロジェクト（何も書かずに閉じたら、元にもどす記録を残さない）

function fit(area) {
  area.style.height = 'auto';
  area.style.height = area.scrollHeight + 'px';
}

/** owner（ブロックかかたまり）にメモがあれば、付せんを作って返す */
function build(owner) {
  if (typeof owner.note !== 'string') return null;
  const box = document.createElement('div');
  box.className = 'blk-note';
  box.title = t('メモ（動きには関係しません）');
  box.addEventListener('pointerdown', (e) => e.stopPropagation());   // ブロックをつかまない

  const area = document.createElement('textarea');
  area.rows = 1;
  area.value = owner.note;
  area.placeholder = t('メモを書く');
  let snapshot = null;
  area.addEventListener('focus', () => {
    snapshot = addSnapshot || Model.clone(Model.project);
    addSnapshot = null;
  });
  area.addEventListener('input', () => {
    owner.note = area.value;
    fit(area);
    Model.dirty = true;   // 打っている間も、保存していない印を付けておく
    updateTitle();
  });
  area.addEventListener('blur', () => {
    if (area.value.trim() === '') delete owner.note;
    const before = snapshot;
    snapshot = null;
    if (before && JSON.stringify(before) !== JSON.stringify(Model.project)) Model.pushUndo(before);
    else Model.emit();   // 何も変わっていなくても、空のメモは描きなおして消す
  });
  area.addEventListener('keydown', (e) => {
    e.stopPropagation();   // Delete などで、ブロックのほうを消さない
    if (e.key === 'Escape' || (e.key === 'Enter' && e.ctrlKey)) area.blur();
  });
  box.appendChild(area);

  requestAnimationFrame(() => {
    fit(area);
    if (pendingFocus === owner) {
      pendingFocus = null;
      area.focus();
    }
  });
  return box;
}

/** メモを付けて、書きはじめる（もうあれば、そこへ） */
function add(owner) {
  if (!owner) return;
  if (typeof owner.note !== 'string') {
    addSnapshot = Model.clone(Model.project);
    owner.note = '';
  }
  pendingFocus = owner;
  Model.emit();
}

function remove(owner) {
  if (!owner || typeof owner.note !== 'string') return;
  Model.act(() => { delete owner.note; });
}

export const Notes = { build, add, remove };
