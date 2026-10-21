/* 伺かスタジオ - ブロックのコピー・切り取り・はりつけ・複製・削除
 *
 * キーボード（shortcuts.js）と右クリックメニュー（contextmenu.js）の両方から使います。
 * どれも「どの列（stack）の何番目（index）か」を受けとります。
 * コピーしたものは Model.clone で切り離して持つので、あとから元を消しても平気です。
 */

import { Model } from '../model/model.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { t } from '../i18n/i18n.js';

function copy(block) {
  if (!block) return false;
  Session.clipboard = Model.clone(block);
  toast(t('ブロックをコピーしました'));
  return true;
}

function cut(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  Session.clipboard = Model.clone(stack[index]);
  Model.act(() => { stack.splice(index, 1); });
  toast(t('ブロックを切り取りました'));
  return true;
}

/** stack の index の位置に、コピーしたものをはりつける */
function paste(stack, index) {
  if (!Session.clipboard) { toast(t('コピーしたブロックがありません'), true); return false; }
  if (!Array.isArray(stack)) {
    toast(t('はりつける場所のブロックを、先にクリックしてください'), true);
    return false;
  }
  Model.act(() => { stack.splice(index, 0, Model.clone(Session.clipboard)); });
  toast(t('はりつけました'));
  return true;
}

/** キャンバスの x, y に、コピーしたものを新しいかたまりとしてはりつける */
function pasteAt(x, y) {
  if (!Session.clipboard) { toast(t('コピーしたブロックがありません'), true); return false; }
  Model.act(() => {
    Model.project.scripts.push({
      id: Model.uid('s'), kind: 'loose', blocks: [Model.clone(Session.clipboard)],
      x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)),
    });
  });
  toast(t('はりつけました'));
  return true;
}

function duplicate(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  Model.act(() => { stack.splice(index + 1, 0, Model.clone(stack[index])); });
  toast(t('ブロックを複製しました'));
  return true;
}

function remove(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  Model.act(() => { stack.splice(index, 1); });
  return true;
}

/** index から下を全部消す */
function removeFrom(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  Model.act(() => { stack.splice(index); });
  return true;
}

function toggleDisabled(block) {
  if (!block) return false;
  Model.act(() => {
    if (block.disabled) delete block.disabled;
    else block.disabled = true;
  });
  return true;
}

export const Clipboard = { copy, cut, paste, pasteAt, duplicate, remove, removeFrom, toggleDisabled };
