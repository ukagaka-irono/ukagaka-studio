/* 伺かスタジオ - 「変数」タブ */

import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { provide } from '../core/commands.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';

function render() {
  const list = $('#var-list');
  list.textContent = '';
  if (!Model.project.variables.length) {
    list.appendChild(Render.div('hint', t('まだ変数がありません。')));
    return;
  }
  for (const v of Model.project.variables) {
    const row = Render.div('var-item');
    row.appendChild(Render.div('dot'));

    const name = Render.el('input', 'vname');
    name.value = v.name;
    let before = v.name;
    name.addEventListener('focus', () => { before = name.value; });
    name.addEventListener('change', () => {
      const ok = Model.act(() => Model.renameVariable(before, name.value.trim()));
      if (!ok) { name.value = before; toast(t('その名前は使えません'), true); }
    });
    row.appendChild(name);

    const val = Render.el('input', 'vval');
    val.value = v.value;
    val.title = t('はじめの値');
    val.addEventListener('change', () => {
      Model.act(() => {
        v.value = val.value !== '' && !isNaN(Number(val.value)) ? Number(val.value) : val.value;
      });
    });
    row.appendChild(val);

    const del = Render.el('button', 'del', '✕');
    del.title = t('削除');
    del.addEventListener('click', () => {
      if (!confirm(t('変数「{name}」を削除しますか？', { name: v.name }))) return;
      Model.act(() => Model.removeVariable(v.name));
    });
    row.appendChild(del);
    list.appendChild(row);
  }
}

/** 名前を聞いて変数を作る。作った名前か null を返す */
function promptNewVariable() {
  const name = prompt(t('あたらしい変数の名前は？'), t('好感度'));
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  let created = null;
  Model.act(() => { created = Model.addVariable(trimmed, 0); });
  if (!created) { toast(t('その名前の変数はもうあります'), true); return null; }
  toast(t('変数「{name}」を作りました', { name: trimmed }));
  return trimmed;
}

function init() {
  provide({ promptNewVariable });
  $('#btn-add-var').addEventListener('click', () => promptNewVariable());
}

export const Vars = { init, render, promptNewVariable };
