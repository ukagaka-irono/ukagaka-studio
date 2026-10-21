/* 伺かスタジオ - キャンバスの右クリックメニュー */

import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';
import { Commands } from '../core/commands.js';
import { Render } from './render.js';
import { Scripts } from './scripts.js';
import { t } from '../i18n/i18n.js';

function close() {
  $('#ctx-menu').classList.remove('open');
}

function open(x, y, items) {
  const menu = $('#ctx-menu');
  menu.textContent = '';
  for (const item of items) {
    if (item === '-') { menu.appendChild(Render.div('ctx-sep')); continue; }
    const b = Render.el('button', 'ctx-item' + (item.danger ? ' danger' : ''), item.label);
    b.addEventListener('click', () => { close(); item.run(); });
    menu.appendChild(b);
  }
  menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - menu.childElementCount * 34 - 20) + 'px';
  menu.classList.add('open');
}

function init() {
  document.addEventListener('contextmenu', (e) => {
    const hat = e.target.closest('#canvas .blk.hat');
    const blk = e.target.closest('#canvas .blk');
    const scriptEl = e.target.closest('#canvas .script');
    if (!scriptEl) { close(); return; }
    e.preventDefault();

    if (hat || !blk) {
      const script = scriptEl._script;
      open(e.clientX, e.clientY, [
        { label: t('▶ 実行してみる'), run: () => Commands.runScript(script) },
        { label: t('複製する'), run: () => Scripts.duplicateScript(script) },
        '-',
        { label: t('削除する'), danger: true, run: () => Scripts.deleteScript(script) },
      ]);
      return;
    }

    const block = blk._blk;
    open(e.clientX, e.clientY, [
      {
        label: t('複製する'),
        run: () => Model.act(() => {
          if (!Array.isArray(blk._stack)) return false;
          blk._stack.splice(blk._index + 1, 0, Model.clone(block));
        }),
      },
      {
        label: block.disabled ? t('有効にする') : t('一時的に無効にする'),
        run: () => Model.act(() => {
          if (block.disabled) delete block.disabled;
          else block.disabled = true;
        }),
      },
      '-',
      {
        label: t('このブロックを削除'),
        danger: true,
        run: () => Model.act(() => {
          if (!Array.isArray(blk._stack)) return false;
          blk._stack.splice(blk._index, 1);
        }),
      },
      {
        label: t('ここから下をすべて削除'),
        danger: true,
        run: () => Model.act(() => {
          if (!Array.isArray(blk._stack)) return false;
          blk._stack.splice(blk._index);
        }),
      },
    ]);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#ctx-menu')) close();
  });
}

export const ContextMenu = { init, close };
