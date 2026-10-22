/* 伺かスタジオ - パレットのカテゴリ（左の列の色つきボタン） */

import { CATEGORIES } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';
import { Session } from '../core/session.js';
import { Events } from '../core/events.js';
import { Render } from './render.js';

function renderCategories() {
  const list = $('#cat-list');
  list.textContent = '';
  for (const cat of CATEGORIES) {
    const b = Render.el('button', 'cat-btn' + (cat.id === Session.category ? ' is-active' : ''));
    const dot = Render.el('span', 'cat-dot');
    dot.style.background = `var(--cat-${cat.id})`;
    b.appendChild(dot);
    b.appendChild(Render.el('span', null, cat.name));
    b.addEventListener('click', () => {
      Session.category = cat.id;
      renderCategories();
      Render.renderPalette($('#palette-blocks'), Session.category, Model.project);
    });
    list.appendChild(b);
  }
  const help = $('#help-cats');
  if (help && !help.childElementCount) {
    for (const cat of CATEGORIES) {
      const row = Render.div('help-cat');
      const i = Render.el('i');
      i.style.background = `var(--cat-${cat.id})`;
      row.appendChild(i);
      row.appendChild(Render.el('span', null, cat.name));
      help.appendChild(row);
    }
  }
}

function render() {
  Render.renderPalette($('#palette-blocks'), Session.category, Model.project);
}

function init() {
  renderCategories();
  Events.on('parts-changed', () => { if (Session.category === 'parts') render(); });   // editor/parts.js
}

export const Palette = { init, render };
