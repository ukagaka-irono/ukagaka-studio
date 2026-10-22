/* 伺かスタジオ - キャンバスの右クリックメニュー
 *
 * 3 つあります。どれも、キーボードで同じことができるものは右にキーを出します。
 *   ・かたまり（帽子）の上 … 実行・複製・メモ・削除
 *   ・ブロックの上         … コピー・切り取り・複製・無効にする・メモ・削除
 *   ・何もないところ       … ブロックを探して置く・はりつけ・整列
 */

import { $ } from '../core/dom.js';
import { Session } from '../core/session.js';
import { toast } from '../core/toast.js';
import { Commands } from '../core/commands.js';
import { t } from '../i18n/i18n.js';
import { Render } from './render.js';
import { Scripts } from './scripts.js';
import { Clipboard } from './clipboard.js';
import { Picker } from './picker.js';
import { Notes } from './notes.js';

function close() {
  $('#ctx-menu').classList.remove('open');
}

/** items は { label, key?, danger?, run } か、しきりの '-' */
function open(x, y, items) {
  const menu = $('#ctx-menu');
  menu.textContent = '';
  for (const item of items) {
    if (item === '-') { menu.appendChild(Render.div('ctx-sep')); continue; }
    const b = Render.el('button', 'ctx-item' + (item.danger ? ' danger' : ''));
    b.appendChild(Render.el('span', 'ctx-label', item.label));
    if (item.key) b.appendChild(Render.el('span', 'ctx-key', item.key));
    b.addEventListener('click', () => { close(); item.run(); });
    menu.appendChild(b);
  }
  menu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - menu.childElementCount * 34 - 20) + 'px';
  menu.classList.add('open');
}

/** メモを付ける・消す（owner はブロックかかたまり） */
function noteItems(owner) {
  if (typeof owner.note !== 'string') return [{ label: t('メモを付ける'), run: () => Notes.add(owner) }];
  return [
    { label: t('メモを書きなおす'), run: () => Notes.add(owner) },
    { label: t('メモを消す'), run: () => Notes.remove(owner) },
  ];
}

/** 画面の位置を、キャンバスの位置に（拡大・縮小とスクロールの分をもどす） */
function toCanvas(clientX, clientY) {
  const ws = $('#workspace');
  const r = ws.getBoundingClientRect();
  return {
    x: (clientX - r.left + ws.scrollLeft) / Session.zoom,
    y: (clientY - r.top + ws.scrollTop) / Session.zoom,
  };
}

function init() {
  document.addEventListener('contextmenu', (e) => {
    const inWorkspace = e.target.closest('#workspace');
    const scriptEl = e.target.closest('#canvas .script');
    if (!inWorkspace) { close(); return; }
    e.preventDefault();

    // 何もないところ
    if (!scriptEl) {
      const at = toCanvas(e.clientX, e.clientY);
      open(e.clientX, e.clientY, [
        { label: t('ここにブロックを探して置く'), key: '/', run: () => Picker.open(at) },
        { label: t('ここにはりつけ'), key: 'Ctrl+V', run: () => Clipboard.pasteAt(at.x, at.y) },
        '-',
        { label: t('整列'), run: () => { Scripts.tidy(); toast(t('整列しました')); } },
      ]);
      return;
    }

    const hat = e.target.closest('#canvas .blk.hat');
    const blk = e.target.closest('#canvas .blk');
    if (hat || !blk) {
      const script = scriptEl._script;
      open(e.clientX, e.clientY, [
        { label: t('▶ 実行してみる'), run: () => Commands.runScript(script) },
        { label: t('複製する'), run: () => Scripts.duplicateScript(script) },
        ...noteItems(script),
        '-',
        { label: t('削除する'), danger: true, run: () => Scripts.deleteScript(script) },
      ]);
      return;
    }

    const block = blk._blk;
    const stack = blk._stack;
    const index = blk._index;
    const inStack = Array.isArray(stack);
    const items = [{ label: t('コピー'), key: 'Ctrl+C', run: () => Clipboard.copy(block) }];
    if (inStack) {
      items.push(
        { label: t('切り取り'), key: 'Ctrl+X', run: () => Clipboard.cut(stack, index) },
        { label: t('すぐ下にはりつけ'), key: 'Ctrl+V', run: () => Clipboard.paste(stack, index + 1) },
        { label: t('複製する'), key: 'Ctrl+D', run: () => Clipboard.duplicate(stack, index) },
      );
    }
    items.push({ label: block.disabled ? t('有効にする') : t('一時的に無効にする'), run: () => Clipboard.toggleDisabled(block) });
    items.push(...noteItems(block));
    if (inStack) {
      items.push(
        '-',
        { label: t('このブロックを削除'), key: 'Delete', danger: true, run: () => Clipboard.remove(stack, index) },
        { label: t('ここから下をすべて削除'), danger: true, run: () => Clipboard.removeFrom(stack, index) },
      );
    }
    open(e.clientX, e.clientY, items);
  });
  // メニューの外を押したら閉じる（ドラッグをはじめたときも）
  document.addEventListener('pointerdown', (e) => {
    if (!(e.target.closest && e.target.closest('#ctx-menu'))) close();
  }, true);
}

export const ContextMenu = { init, close };
