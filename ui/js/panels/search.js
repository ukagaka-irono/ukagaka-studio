/* 伺かスタジオ - 「チェック」タブと「さがす」タブ
 *
 * チェックは lint.js が出した注意をならべ、さがすはブロックの中身を字で引きます。
 */

import { getDef } from '../model/blocks.js';
import { countText, replaceText } from '../model/replace.js';
import { Model } from '../model/model.js';
import { Lint } from '../model/lint.js';
import { $ } from '../core/dom.js';
import { Session } from '../core/session.js';
import { toast } from '../core/toast.js';
import { Render } from '../editor/render.js';
import { Scripts } from '../editor/scripts.js';
import { Dictionary } from './dictionary.js';
import { EVENTS } from '../model/blocks.js';
import { Tabs } from './tabs.js';
import { Pages } from './pages.js';
import { t } from '../i18n/i18n.js';

// ------------------------------------------------------------- チェック
function renderCheck() {
  const list = $('#check-list');
  const badge = $('#check-badge');
  const issues = Lint.run(Model.project, { handwritten: (Session.yayaGhost || {}).functions || [] });
  const errors = Lint.countErrors(issues);

  badge.textContent = issues.length ? String(issues.length) : '';
  badge.classList.toggle('is-on', issues.length > 0);
  badge.classList.toggle('warn-only', issues.length > 0 && errors === 0);

  list.textContent = '';
  if (!issues.length) list.appendChild(Render.div('check-ok', t('✓ 気になるところはありません')));
  for (const it of issues) {
    const item = Render.el('button', 'check-item ' + (it.level === 'error' ? 'is-error' : 'is-warn'));
    item.appendChild(Render.el('span', 'mark', it.level === 'error' ? '⛔' : '⚠'));
    const msg = Render.div('msg');
    msg.appendChild(document.createTextNode(it.message));
    if (it.hint) msg.appendChild(Render.el('span', 'why', it.hint));
    item.appendChild(msg);
    if (it.script) {
      item.title = t('クリックでその場所へ移動します');
      item.addEventListener('click', () => jumpTo(it));
    } else if (it.dic) {
      // 辞書の注意は、辞書の画面のその行へ（段階 8-3）
      item.title = t('クリックでその場所へ移動します');
      item.addEventListener('click', () => Dictionary.open(it.dic, it.line));
    } else {
      item.style.cursor = 'default';
    }
    list.appendChild(item);
  }
  renderMissing(list);
}

/** まだ反応していない、よく使うイベント（段階 6-3）。「置く」で、その帽子をキャンバスに置く */
function renderMissing(list) {
  const missing = Lint.missingEvents(Model.project, (Session.yayaGhost || {}).functions || []);
  if (!missing.length) return;
  list.appendChild(Render.div('missing-head', t('まだ反応していないイベント')));
  for (const m of missing) {
    const row = Render.div('missing-row');
    const label = m.kind === 'talk'
      ? t('ランダムトーク')
      : ((EVENTS.find((e) => e[1] === m.event) || [])[0] || m.event);
    const text = Render.div('msg', label);
    text.appendChild(Render.el('span', 'why', m.kind === 'talk'
      ? t('ひとつも無いので、自動ではしゃべりません')
      : (m.builtin ? t('いまは、おまかせの反応をします') : t('いまは、なにもしません'))));
    row.appendChild(text);
    const put = Render.el('button', 'btn small', t('置く'));
    put.addEventListener('click', () => placeHat(m));
    row.appendChild(put);
    list.appendChild(row);
  }
}

function placeHat(m) {
  const at = Scripts.freeSpot();
  let script = null;
  Model.act(() => {
    script = m.kind === 'talk'
      ? Model.addScript('talk', { x: at.x, y: at.y })
      : Model.addScript('event', { event: m.event, x: at.x, y: at.y });
  });
  // すぐ描いて、置いたところへ動かす
  Render.renderWorkspace($('#canvas'), Model.project);
  jumpTo({ script });
  toast(t('「{title}」を置きました。ブロックをつなげてください', { title: Model.scriptTitle(script) }));
}

// --------------------------------------------------------------- さがす
/** ブロック 1 つを、画面に出ているのと同じ言葉にする（検索と一覧の見出し用） */
function blockSummary(b, depth) {
  if (!b || typeof b !== 'object') return '';
  if ((depth || 0) > 6) return '…';
  const d = getDef(b);
  if (!d) return String(b.type || '');
  let s = '';
  for (const part of d.parts) {
    if (part.lbl != null) { s += part.lbl; continue; }
    const v = b[part.arg];
    if (v == null || v === '') { s += '◯'; continue; }
    if (typeof v === 'object') {
      s += v.type ? '（' + blockSummary(v, (depth || 0) + 1) + '）' : '…';
      continue;
    }
    const a = (d.args || {})[part.arg];
    if (a && a.kind === 'dropdown' && Array.isArray(a.options)) {
      const hit = a.options.find((o) => String(o[1]) === String(v));
      s += hit ? hit[0] : String(v);
    } else {
      s += String(v);
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** かたまりの中のブロックを、入れ子もふくめて順に見る */
function walkBlocks(script, visit) {
  const stack = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const b of arr) {
      if (!b || typeof b !== 'object') continue;
      visit(b);
      inner(b);
    }
  };
  const inner = (b) => {
    const d = getDef(b);
    if (!d) return;
    for (const s of d.subs || []) stack(b[s.key]);
    if (d.dynamic && Array.isArray(b[d.dynamic])) b[d.dynamic].forEach(stack);
    for (const name in (d.args || {})) {
      const v = b[name];
      if (v && typeof v === 'object' && v.type) { visit(v); inner(v); }
    }
  };
  stack(script.blocks);
}

/** メモ（block.note・script.note）に、さがす言葉があるか */
function noteHit(owner, q) {
  return typeof owner.note === 'string' && owner.note.toLowerCase().includes(q);
}

function renderSearch() {
  updateReplaceButton();
  const list = $('#search-list');
  if (!list) return;
  const q = ($('#search-input').value || '').trim().toLowerCase();
  list.textContent = '';
  if (!q) {
    list.appendChild(Render.div('hint', t('さがす言葉を入れてください。')));
    return;
  }

  const hits = [];
  for (const s of Model.project.scripts) {
    const title = Model.scriptTitle(s);
    if (title.toLowerCase().includes(q)) hits.push({ script: s, block: null, text: title });
    if (noteHit(s, q)) hits.push({ script: s, block: null, text: s.note, title, note: true });
    walkBlocks(s, (b) => {
      if (hits.length > 200) return;
      const text = blockSummary(b);
      if (text.toLowerCase().includes(q)) hits.push({ script: s, block: b, text, title });
      if (noteHit(b, q)) hits.push({ script: s, block: b, text: b.note, title, note: true });
    });
  }

  // プロジェクトの辞書の行（段階 9-3。押すと辞書の画面のその行へ）
  for (const d of Model.project.dics || []) {
    d.text.split('\n').forEach((line, k) => {
      if (hits.length > 200 || !line.toLowerCase().includes(q)) return;
      hits.push({ dic: d.name, line: k + 1, text: line.trim(), title: t('辞書「{dic}」の {line} 行目', { dic: d.name, line: k + 1 }) });
    });
  }

  if (!hits.length) {
    list.appendChild(Render.div('check-ok', t('見つかりませんでした')));
    return;
  }
  for (const h of hits) {
    const item = Render.el('button', 'check-item');
    item.appendChild(Render.el('span', 'mark', h.dic ? '📖' : h.note ? '📝' : h.block ? '🔎' : '📄'));
    const msg = Render.div('msg');
    msg.appendChild(document.createTextNode(h.text));
    if (h.block || h.note || h.dic) msg.appendChild(Render.el('span', 'why', h.title));
    item.appendChild(msg);
    item.title = t('クリックでその場所へ移動します');
    item.addEventListener('click', () => (h.dic ? Dictionary.open(h.dic, h.line) : jumpTo(h)));
    list.appendChild(item);
  }
}

/** チェックで見つけた場所までキャンバスを動かして、光らせる */
function jumpTo(it) {
  if (!it.script) return;
  // たたんだかたまりの中のブロックなら、ひろげてから（すぐ描きなおして、光らせる先を作る）
  if (it.block && it.script.folded) {
    delete it.script.folded;
    Render.renderWorkspace($('#canvas'), Model.project);
    Model.emit();
  }
  let target = null;
  let scriptEl = null;
  for (const el of document.querySelectorAll('#canvas .script')) {
    if (el._script === it.script) { scriptEl = el; break; }
  }
  if (!scriptEl) return;
  if (it.block) {
    for (const el of scriptEl.querySelectorAll('.blk')) {
      if (el._blk === it.block) { target = el; break; }
    }
  }

  const ws = $('#workspace');
  const box = (target || scriptEl).getBoundingClientRect();
  const view = ws.getBoundingClientRect();
  ws.scrollLeft += box.left - view.left - Math.max(40, (view.width - box.width) / 2);
  ws.scrollTop += box.top - view.top - Math.max(40, (view.height - box.height) / 2);

  const flashEl = target || scriptEl;
  flashEl.classList.remove('flash');
  void flashEl.offsetWidth;          // アニメーションをやり直させる
  flashEl.classList.add('flash');
  setTimeout(() => flashEl.classList.remove('flash'), 2600);
}

/** さがす言葉を、ブロックの文字の欄の中でまとめて置きかえる（model/replace.js） */
function replaceAll() {
  const from = $('#search-input').value;
  const to = $('#replace-input').value;
  const n = countText(Model.project, from);
  if (!n) { toast(t('置きかえるところがありません'), true); return; }
  if (!confirm(t('「{from}」を「{to}」に、{n} か所まとめて置きかえますか？', { from, to, n }))) return;
  let done = 0;
  Model.act(() => { done = replaceText(Model.project, from, to); });
  toast(t('{n} か所置きかえました（元にもどすで、まとめて戻せます）', { n: done }));
}

function updateReplaceButton() {
  const btn = $('#btn-replace-all');
  if (!btn) return;
  const n = countText(Model.project, $('#search-input').value);
  btn.disabled = !n;
  btn.textContent = n ? t('すべて置きかえる（{n}）', { n }) : t('すべて置きかえる');
}

function init() {
  const searchInput = $('#search-input');
  if (!searchInput) return;
  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('input', updateReplaceButton);
  $('#btn-replace-all').addEventListener('click', replaceAll);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') searchInput.blur(); });
}

/** さがすタブを開いて、入力欄にすぐ打てるようにする（Ctrl+F） */
function focus() {
  Pages.show('talk');
  Tabs.switchTab('search');
  const searchInput = $('#search-input');
  if (searchInput) { searchInput.focus(); searchInput.select(); }
}

export const Search = { init, focus, renderCheck, renderSearch, jumpTo };
