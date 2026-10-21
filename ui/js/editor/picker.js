/* 伺かスタジオ - ブロックを探して置く（/ キー、キャンバスの「＋ ブロック」、右クリック）
 *
 * 名前の一部を打つと、パレットのブロックとイベントをさがします。↑↓ でえらんで Enter で置きます。
 *   ・ブロックをえらんでいれば、そのすぐ下に（帽子なら、かたまりのいちばん上に）つなげます。
 *   ・えらんでいなければ、見えているところのあいた場所に、新しいかたまりとして置きます。
 *   ・置いたブロックをえらんだ状態にするので、続けて / → Enter で、下へ下へとつなげていけます。
 *     文字を入れる欄があれば、そこにすぐ打てるようにします（Enter で決まります）。
 * イベント（帽子）は、いつも新しいかたまりになります。
 */

import { BLOCKS, createBlock, getDef, isReporter } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { buildBlockIndex, searchBlocks } from '../model/blockindex.js';
import { $ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { t } from '../i18n/i18n.js';
import { Drag } from './drag.js';
import { Scripts } from './scripts.js';
import { Render } from './render.js';

const MAX = 60;   // いちどに並べる数
const P = { box: null, input: null, list: null, foot: null, results: [], active: 0, at: null };

function isOpen() { return !!(P.box && !P.box.hidden); }

/** 開く。at（キャンバスの位置 {x, y}）をわたすと、選択に関係なくそこへ置きます（右クリックから） */
function open(at) {
  build();
  P.at = at || null;
  P.box.hidden = false;
  P.input.value = '';
  refresh();
  P.input.focus();
}

function close() {
  if (!isOpen()) return;
  P.box.hidden = true;
  P.at = null;
}

function refresh() {
  P.results = searchBlocks(buildBlockIndex(Model.variableNames()), P.input.value).slice(0, MAX);
  P.active = 0;
  renderList();
  P.foot.textContent = P.at ? t('右クリックした場所に置きます')
    : Drag.insertTarget() ? t('えらんでいるブロックのすぐ下につなげます（イベントは新しいかたまりに）')
    : t('見えているところのあいた場所に、新しいかたまりとして置きます');
}

function renderList() {
  P.list.textContent = '';
  if (!P.results.length) {
    P.list.appendChild(Render.div('picker-empty', t('見つかりません')));
    return;
  }
  P.results.forEach((e, i) => {
    const row = Render.div('picker-item' + (i === P.active ? ' is-active' : ''));
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', i === P.active ? 'true' : 'false');
    const dot = Render.el('span', 'picker-dot');
    dot.style.background = `var(--cat-${e.cat})`;
    row.appendChild(dot);
    row.appendChild(Render.el('span', 'picker-label', e.label));
    row.appendChild(Render.el('span', 'picker-cat', e.catName));
    // mousedown で止めておかないと、クリックより先に入力欄から離れてしまう
    row.addEventListener('mousedown', (ev) => ev.preventDefault());
    row.addEventListener('click', () => place(e));
    P.list.appendChild(row);
  });
}

function move(delta) {
  if (!P.results.length) return;
  P.active = (P.active + delta + P.results.length) % P.results.length;
  renderList();
  const el = P.list.children[P.active];
  if (el) el.scrollIntoView({ block: 'nearest' });
}

/** 帽子のかたまり。パレットからドラッグしたときと同じ既定値にします */
function hatScript(e) {
  const kind = e.kind;
  const key = kind === 'event' ? Render.hatKeyFor({ kind, event: e.event }) : (kind === 'talk' ? '@talk' : '@function');
  const def = BLOCKS[key];
  const script = {
    kind, blocks: [], event: 'OnBoot', weight: 1, area: '', who: -1,
    name: kind === 'talk' ? t('トーク') : t('あたらしいトーク'),
  };
  for (const argName in (def && def.args) || {}) {
    const a = def.args[argName];
    if (a && a.def !== undefined) script[argName] = typeof a.def === 'function' ? a.def() : a.def;
  }
  if (kind === 'event') script.event = e.event;
  return script;
}

/** えらんでいるブロックの下につなげてよいか。よければ { stack, index } */
function attachTarget(block) {
  if (isReporter(block)) return null;                       // 丸や六角のブロックは、欄に入れるもの
  const target = Drag.insertTarget();
  if (!target) return null;
  const prev = target.stack[target.index - 1];
  if (prev && (getDef(prev) || {}).shape === 'cap') return null;                              // 「おわる」の下にはつなげない
  if ((getDef(block) || {}).shape === 'cap' && target.index < target.stack.length) return null;  // 「おわる」を途中には置かない
  return target;
}

function place(e) {
  const at = P.at;
  close();

  if (e.kind === 'event' || e.kind === 'talk' || e.kind === 'function') {
    const script = hatScript(e);
    script.id = Model.uid('s');
    if (script.kind !== 'event') script.name = Drag.uniqueName(script.name);
    moveTo(script, at || spotFor(script));
    Model.act(() => { Model.project.scripts.push(script); });
    afterRender(() => selectWhere((el) => el._isHat && el._script === script, false));
    return;
  }

  const block = e.kind === 'var' ? { type: 'var', name: e.name } : createBlock(e.key);
  if (!block) return;
  const target = at ? null : attachTarget(block);
  if (target) {
    Model.act(() => { target.stack.splice(target.index, 0, block); });
  } else {
    const script = { id: Model.uid('s'), kind: 'loose', blocks: [block] };
    moveTo(script, at || spotFor(script));
    Model.act(() => { Model.project.scripts.push(script); });
    if (isReporter(block)) toast(t('空いている欄までドラッグすると、ブロックの中に入れられます'));
    else if (!at && Drag.insertTarget()) toast(t('そこにはつなげられないので、新しいかたまりにしました'));
  }
  afterRender(() => selectWhere((el) => el._blk === block, true));
}

function moveTo(script, pos) {
  script.x = Math.max(0, Math.round(pos.x));
  script.y = Math.max(0, Math.round(pos.y));
}

/**
 * 新しいかたまりを置く、あいた場所。大きさは、見えないようにキャンバスに入れてはかります
 * （帽子は横に長いものがあり、決めうちの大きさだと、はみ出してほかのものに重なるため）。
 * 帽子の下にはブロックをつなげていくので、高さは少し多めに見ておきます。
 */
function spotFor(script) {
  const el = Render.buildScriptEl(script, Model.project, { noPosition: true, noTools: true });
  el.style.visibility = 'hidden';
  $('#canvas').appendChild(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  el.remove();
  return Scripts.freeSpot(w, Math.max(h, 160));
}

/** 描きなおし（requestAnimationFrame で 1 回分あと）が済んでから呼ぶ */
function afterRender(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/** 置いたものをえらび、見えるところまで動かす。focusInput なら、そのブロック自身の最初の欄に打てるようにする */
function selectWhere(test, focusInput) {
  const el = [...document.querySelectorAll('#canvas .blk')].find(test);
  if (!el) return;
  Drag.select(el);
  // はみ出していたら、まんなかまで動かす（はしに寄せるだけだと、右下のボタンにかくれることがある）
  const r = el.getBoundingClientRect();
  const view = $('#workspace').getBoundingClientRect();
  if (r.top < view.top || r.bottom > view.bottom || r.left < view.left || r.right > view.right) {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  if (focusInput) {
    const input = el.querySelector(':scope > .row > .slot > input');
    if (input) input.focus();
  }
}

function build() {
  if (P.box) return;
  const box = Render.div('picker');
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', t('ブロックを探して置く'));
  const input = Render.el('input', 'picker-input');
  input.type = 'text';
  input.spellcheck = false;
  input.placeholder = t('ブロックの名前で探す（例: 話す、なでられた）');
  const list = Render.div('picker-list');
  list.setAttribute('role', 'listbox');
  const foot = Render.div('picker-foot');
  const keys = Render.div('picker-keys', t('↑↓ でえらぶ ・ Enter で置く ・ Esc で閉じる'));
  box.append(input, list, foot, keys);
  $('#workspace-wrap').appendChild(box);

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();                                  // 打っている間は、ほかのショートカットを動かさない
    if (e.isComposing || e.keyCode === 229) return;       // 日本語の変換中の Enter は、変換を決めるためのもの
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (P.results[P.active]) place(P.results[P.active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !(e.target.closest && e.target.closest('.picker'))) close();
  }, true);
  P.box = box; P.input = input; P.list = list; P.foot = foot;
}

function init() {
  const btn = $('#btn-picker');
  if (btn) btn.addEventListener('click', () => open());
}

export const Picker = { init, open, close, isOpen };
