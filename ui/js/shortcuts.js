/* 伺かスタジオ - キーボードのショートカット
 *
 * 保存・さがす・元にもどす・ブロックのコピーと貼りつけ・ブロックを探して置く・つかいかた。
 * いろいろな層のものを呼ぶので、main.js と同じく「組み立て」の側に置いています。
 * 一覧はヘルプの画面（index.html の「キーボードとマウス」）にあります。足したら、そちらにも足してください。
 */

import { Model } from './model/model.js';
import { Drag } from './editor/drag.js';
import { ContextMenu } from './editor/contextmenu.js';
import { Clipboard } from './editor/clipboard.js';
import { Picker } from './editor/picker.js';
import { Search } from './panels/search.js';
import { Dialog } from './panels/dialog.js';
import { Pages } from './panels/pages.js';

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
  if (e.key === 'F1') { e.preventDefault(); Pages.show('help'); return; }
  if (typing) return;
  if (e.key === '?') { e.preventDefault(); Pages.show('help'); return; }
  if (e.key === 'Escape') { ContextMenu.close(); Picker.close(); return; }

  // ここから下はキャンバスのブロックの操作。キャンバスが見えていないときは何もしない
  // （ほかの画面で Delete を押して、見えないブロックが消えないように）。えらんでいるのが、その画面のキャンバスのブロックのときだけ
  const inCanvas = (id) => { const s = Drag.getSelected(); return s && s.el && document.getElementById(id).contains(s.el) ? s : null; };
  if (Pages.current === 'dics') {
    // 辞書の画面のブロックは、消す・複製するだけ（コピー・はりつけは、トークのブロックどうし）
    const sel = inCanvas('dic-canvas');
    if (!sel || !Array.isArray(sel.stack)) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); Clipboard.duplicate(sel.stack, sel.index); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (Clipboard.remove(sel.stack, sel.index)) Drag.select(null);
    }
    return;
  }
  if (Pages.current !== 'talk') return;

  if (e.key === '/' && !e.ctrlKey && !e.altKey) { e.preventDefault(); Picker.open(); return; }

  const sel = inCanvas('canvas');
  const key = e.key.toLowerCase();
  if (e.ctrlKey && key === 'c') {
    if (sel && sel.block) { e.preventDefault(); Clipboard.copy(sel.block); }
    return;
  }
  if (e.ctrlKey && key === 'x') {
    if (sel && Array.isArray(sel.stack)) {
      e.preventDefault();
      if (Clipboard.cut(sel.stack, sel.index)) Drag.select(null);
    }
    return;
  }
  if (e.ctrlKey && key === 'v') {
    // えらんでいるもののすぐ下に（帽子なら、かたまりのいちばん上に）
    const target = Drag.insertTarget();
    e.preventDefault();
    if (target) Clipboard.paste(target.stack, target.index);
    else Clipboard.paste(null, 0);   // 「先にクリックしてください」と言う
    return;
  }
  if (e.ctrlKey && key === 'd') {
    if (sel && Array.isArray(sel.stack)) { e.preventDefault(); Clipboard.duplicate(sel.stack, sel.index); }
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (sel && Array.isArray(sel.stack)) {
      e.preventDefault();
      if (Clipboard.remove(sel.stack, sel.index)) Drag.select(null);
    }
  }
}

export const Shortcuts = {
  init() { document.addEventListener('keydown', onKeyDown); },
};
