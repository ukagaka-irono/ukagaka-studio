/* 伺かスタジオ - はじめてガイド（お手本をひらく → ▶ で動かす → SSP に入れる）
 *
 * はじめて起動したとき、トークの画面のキャンバスの右上に小さなカードを出します。
 * 3 つの手順は、その操作が済んだら（core/events.js で知らせが来たら）✓ になります。
 * 順番どおりでなくてもかまいません。
 * 「もう出さない」・✕ を押すか、3 つとも済んで「とじる」を押すと、もう出しません。
 * ヘルプの画面の「はじめてガイドをもう一度」で、また出せます。
 * どこまで済んだかは、この PC の WebView2 の保存場所（localStorage）に覚えます。
 */

import { $ } from '../core/dom.js';
import { Events } from '../core/events.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Pages } from './pages.js';
import { Tabs } from './tabs.js';
import { Run } from './run.js';
import { Dialog } from './dialog.js';

const KEY = 'ikaga.guide';

const STEPS = [
  {
    id: 'sample', events: ['sample-opened'],
    title: t('お手本をひらく'),
    text: t('動くゴーストを読みこんで、中のブロックを見てみましょう。'),
    button: t('お手本をえらぶ'),
    run: () => Dialog.openSampleDialog(),
  },
  {
    id: 'run', events: ['ran'],
    title: t('▶ で動かしてみる'),
    text: t('右の「ためす」で、しゃべるようすとさくらスクリプトを見られます。'),
    button: t('▶ ためす'),
    run: () => {
      Tabs.switchTab('run');
      const s = Run.currentScript();
      if (s) Run.runScript(s);
    },
  },
  {
    id: 'export', events: ['exported', 'installed'],
    title: t('SSP に入れて動かす'),
    text: t('「書き出し」の画面から、SSP にそのまま入れたり、配るための .nar を作ったりできます。'),
    button: t('書き出しへ'),
    run: () => Pages.show('export'),
  },
];

let state = { done: {}, closed: false };
let box = null;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object') return { done: v.done || {}, closed: !!v.closed };
  } catch { /* 読めなければ、はじめてとみなす */ }
  return null;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 覚えられなくても、いまは動く */ }
}

function render() {
  if (!box) return;
  box.hidden = state.closed;
  if (state.closed) return;
  box.textContent = '';

  const head = Render.div('guide-head');
  head.appendChild(Render.el('b', null, t('はじめての方へ')));
  const x = Render.el('button', 'guide-x', '✕');
  x.title = t('閉じる（ヘルプの画面から、また出せます）');
  x.addEventListener('click', closeGuide);
  head.appendChild(x);
  box.appendChild(head);

  STEPS.forEach((s, i) => {
    const done = !!state.done[s.id];
    const row = Render.div('guide-step' + (done ? ' is-done' : ''));
    row.appendChild(Render.el('span', 'guide-no', done ? '✓' : String(i + 1)));
    const body = Render.div('guide-body');
    body.appendChild(Render.div('guide-title', s.title));
    if (!done) body.appendChild(Render.div('guide-text', s.text));
    const b = Render.el('button', 'btn small' + (done ? '' : ' primary'), s.button);
    b.addEventListener('click', s.run);
    body.appendChild(b);
    row.appendChild(body);
    box.appendChild(row);
  });

  const foot = Render.div('guide-foot');
  if (STEPS.every((s) => state.done[s.id])) {
    foot.appendChild(Render.el('span', 'guide-done', t('これで一通りできました！')));
    const b = Render.el('button', 'btn small', t('とじる'));
    b.addEventListener('click', closeGuide);
    foot.appendChild(b);
  } else {
    const b = Render.el('button', 'btn tiny ghost-btn', t('もう出さない'));
    b.addEventListener('click', closeGuide);
    foot.appendChild(b);
  }
  box.appendChild(foot);
}

function mark(id) {
  if (state.done[id]) return;
  state.done[id] = true;
  save();
  render();
}

function closeGuide() {
  state.closed = true;
  save();
  render();
}

/** もう一度はじめから出す（ヘルプの画面のボタン） */
function reopen() {
  state = { done: {}, closed: false };
  save();
  Pages.show('talk');
  render();
}

function init() {
  box = Render.div('guide');
  box.setAttribute('role', 'complementary');
  box.setAttribute('aria-label', t('はじめてガイド'));
  $('#workspace-wrap').appendChild(box);
  state = load() || { done: {}, closed: false };
  for (const s of STEPS) for (const name of s.events) Events.on(name, () => mark(s.id));
  const again = $('#btn-guide-again');
  if (again) again.addEventListener('click', reopen);
  render();
}

export const Guide = { init, reopen };
