/* 伺かスタジオ - キーボードのショートカット
 *
 * 保存・さがす・元にもどす・ブロックのコピーと貼りつけ。
 * いろいろな層のものを呼ぶので、main.js と同じく「組み立て」の側に置いています。
 */

import { Model } from './model/model.js';
import { toast } from './core/toast.js';
import { Session } from './core/session.js';
import { Drag } from './editor/drag.js';
import { ContextMenu } from './editor/contextmenu.js';
import { Search } from './panels/search.js';
import { Dialog } from './panels/dialog.js';
import { t } from './i18n/i18n.js';

function onKeyDown(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); Dialog.saveProject(false); return; }
  if (e.ctrlKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    Search.focus();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); Model.undo(); return; }
  if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault(); Model.redo(); return;
  }
  if (typing) return;

  // ---- ブロックのコピー＆はりつけ
  //   コピーしたものは Model.clone で切り離して持つので、あとから元を消しても平気です。
  const sel = Drag.getSelected();
  const key = e.key.toLowerCase();
  if (e.ctrlKey && (key === 'c' || key === 'x')) {
    if (!sel || !sel.block) return;
    e.preventDefault();
    Session.clipboard = Model.clone(sel.block);
    if (key === 'x' && Array.isArray(sel.stack)) {
      Model.act(() => { sel.stack.splice(sel.index, 1); });
      Drag.select(null);
    }
    toast(key === 'x' ? t('ブロックを切り取りました') : t('ブロックをコピーしました'));
    return;
  }
  if (e.ctrlKey && key === 'v') {
    if (!Session.clipboard) { toast(t('コピーしたブロックがありません'), true); return; }
    if (!sel || !Array.isArray(sel.stack)) {
      toast(t('はりつける場所のブロックを、先にクリックしてください'), true);
      return;
    }
    e.preventDefault();
    Model.act(() => { sel.stack.splice(sel.index + 1, 0, Model.clone(Session.clipboard)); });
    toast(t('はりつけました'));
    return;
  }
  if (e.ctrlKey && key === 'd') {
    if (!sel || !sel.block || !Array.isArray(sel.stack)) return;
    e.preventDefault();
    Model.act(() => { sel.stack.splice(sel.index + 1, 0, Model.clone(sel.block)); });
    toast(t('ブロックを複製しました'));
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (sel && Array.isArray(sel.stack)) {
      e.preventDefault();
      Model.act(() => { sel.stack.splice(sel.index, 1); });
      Drag.select(null);
    }
  }
  if (e.key === 'Escape') ContextMenu.close();
}

export const Shortcuts = {
  init() { document.addEventListener('keydown', onKeyDown); },
};
