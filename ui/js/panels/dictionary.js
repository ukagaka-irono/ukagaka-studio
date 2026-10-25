/* 伺かスタジオ - 「辞書」の画面（プロジェクトの YAYA の辞書と、そのテキストエディタとブロック。段階 8-3・8-5）
 *
 * 左にプロジェクトの辞書（project.dics。model/dics.js）、まんなかにえらんだ辞書のテキスト、右に同じ辞書のブロックを出します。
 * テキストは打つたびに辞書に入れ、色分け（model/yayatext.js の highlightYaya）と行番号を付けなおし、
 * 少し待ってから読みなおして（parseYaya）、YAYA として読めない行を行番号の横と下の一覧に出します。
 * 「元にもどす」の記録は、テキストから離れたときに 1 つだけ積みます（打つたびに積まない。editor/notes.js と同じ）。
 * テキストの中の Ctrl+Z は、プロジェクトの「元にもどす」ではなく、テキストの元にもどすです。
 *
 * ブロック（model/yblocks.js）は、プロジェクトの外（このファイルの view）に持ちます。辞書のテキストがもとで、
 *   テキストが変わったら … 読みなおしたときに、ブロックを作りなおす（読めない関数は「読めない YAYA」のブロックに）
 *   ブロックが変わったら … テキストに書く（整えた形で。Model.act・pushUndo が「元にもどす」に積む前に。Model.onCommit）
 * ブロックが変わっていなければ、テキストは書いたままの形で残します。
 */

import { Model } from '../model/model.js';
import { dicNameOk } from '../model/dics.js';
import { parseYaya, highlightYaya, printYaya } from '../model/yayatext.js';
import { astToView, viewToAst, goesIntoText, YPALETTE, YBlockError } from '../model/yblocks.js';
import { Drag } from '../editor/drag.js';
import { $, escapeHtml } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { updateTitle } from '../core/title.js';
import { Session } from '../core/session.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Pages } from './pages.js';

// 書きまちがいのコード（model/yayatext.js）を、画面の言葉に
const ERRORS = {
  unexpected: (d) => t('「{at}」は、ここには書けません', { at: d }),
  expected: (d) => t('「{at}」が要ります', { at: d }),
  expected_end: (d) => t('「{at}」のところで、文が終わっていません', { at: d }),
  unclosed_block: () => t('{ に対応する } がありません'),
  unterminated_string: () => t('文字列が、閉じないまま行が終わっています'),
  unterminated_heredoc: () => t('ヒアドキュメントが閉じていません'),
  case_without_brace: () => t('case のうしろに { がありません'),
  expected_when: (d) => t('case の中には when か others を書きます（「{at}」）', { at: d }),
  bad_label: (d) => t('when のうしろには、数か文字列だけを書けます（「{at}」）', { at: d }),
  expected_var: (d) => t('foreach のうしろには、変数の名前を書きます（「{at}」）', { at: d }),
  expected_function: (d) => t('関数の名前がありません（「{at}」）', { at: d }),
  expected_mode: (d) => t('「:」のうしろに、選択方式（nonoverlap など）を書きます（「{at}」）', { at: d }),
  bad_char: (d) => t('「{at}」は、ここでは使えない文字です', { at: d }),
};
export function errorText(e) {
  const f = ERRORS[e.code];
  return f ? f(e.detail || '') : e.code;
}

// ブロックを YAYA にできないときのコード（model/yblocks.js）を、画面の言葉に
const BLOCK_ERRORS = {
  empty_slot: () => t('空の欄があります'),
  bad_expr: (d) => t('「{at}」は、YAYA の式として読めません', { at: d }),
  bad_name: (d) => t('「{at}」は、関数の名前に使えません', { at: d }),
  orphan_else: () => t('「そうでなくて」「そうでなければ」は、「もし」のすぐ下につなげます'),
  bad_labels: (d) => t('when のうしろの「{at}」が読めません（数か文字列を , で区切ります）', { at: d }),
  bad_vars: (d) => t('foreach の「{at}」が読めません（変数の名前を 1 つか 2 つ）', { at: d }),
  not_in_case: () => t('case の中には、when・others・コメントだけを入れます'),
  outside_case: () => t('when・others は、case の中に入れます'),
  bad_op: (d) => t('演算子「{at}」が読めません', { at: d }),
};
const blockErrorText = (e) => (BLOCK_ERRORS[e.code] ? BLOCK_ERRORS[e.code](e.detail || '') : t('このブロックは、ここには置けません'));

let editing = null;     // テキストを打ちはじめる前のプロジェクト（離れたときに「元にもどす」の記録にする）
let parseTimer = 0;
let blockTimer = 0;
// ブロックの側。name・text … どの辞書のどのテキストから作ったか、printed … そのときのブロックを書いたテキスト、
// error … YAYA にできないブロック（YBlockError）、loose … 関数の外にはみ出したブロックの数
let view = null;

const dics = () => Model.project.dics || [];
function current() {
  const list = dics();
  return list.find((d) => d.name === Session.dicName) || list[0] || null;
}

/** 色分けと行番号を、いまのテキストで描きなおす（errors は 1 から数える行番号の集まり） */
function paint(text, errorLines) {
  const html = highlightYaya(text).map((spans, k) => {
    const line = spans.map(([cls, s]) => (cls ? `<span class="syn-${cls}">${escapeHtml(s)}</span>` : escapeHtml(s))).join('');
    return errorLines && errorLines.has(k + 1) ? `<span class="dic-err-line">${line || ' '}</span>` : line;
  }).join('\n');
  $('#dic-highlight').innerHTML = html + '\n';
  const count = text.split('\n').length;
  const gutter = $('#dic-gutter');
  let g = '';
  for (let i = 1; i <= count; i++) g += errorLines && errorLines.has(i) ? `<div class="is-error">${i}</div>` : `<div>${i}</div>`;
  gutter.innerHTML = g;
  syncScroll();
}

function syncScroll() {
  const area = $('#dic-text');
  $('#dic-highlight').style.transform = `translate(${-area.scrollLeft}px, ${-area.scrollTop}px)`;
  $('#dic-gutter').style.transform = `translateY(${-area.scrollTop}px)`;
}

/**
 * 読みなおして、読めない行を出す。テキストがブロックを作ったときから変わっていれば、ブロックを作りなおします
 * （作りなおしたら true。キャンバスを描きなおすのは、よんだ側）
 */
function check(d) {
  const r = parseYaya(d.text);
  let rebuilt = false;
  if (!view || view.name !== d.name || view.text !== d.text) {
    view = { name: d.name, text: d.text, scripts: astToView(r.dic).scripts, error: null, loose: 0 };
    try { view.printed = printView(view); } catch { view.printed = null; }
    rebuilt = true;
  }
  const lines = new Set(r.errors.map((e) => e.line));
  paint(d.text, lines);
  const box = $('#dic-errors');
  box.textContent = '';
  const funcs = r.dic.items.filter((x) => x.type === 'func').length;
  if (!r.errors.length && !view.error && !view.loose) {
    box.appendChild(Render.div('status-line status-ok', t('YAYA として読めます（関数 {n} こ）', { n: funcs })));
  }
  // チェックタブと同じ「押すとその場所へ動く」並び（search.js の .check-item）
  for (const e of r.errors) {
    const row = Render.el('button', 'check-item is-error');
    row.appendChild(Render.el('span', 'mark', '⛔'));
    row.appendChild(Render.div('msg', t('{line} 行目: {message}', { line: e.line, message: errorText(e) })));
    row.title = t('クリックでその場所へ移動します');
    row.addEventListener('click', () => goLine(e.line));
    box.appendChild(row);
  }
  // ブロックの側（YAYA にできないブロックは、テキストに書かずに、ここで知らせる）
  if (view.error) {
    const row = Render.el('button', 'check-item is-error');
    row.appendChild(Render.el('span', 'mark', '⛔'));
    row.appendChild(Render.div('msg', t('ブロック: {message}（直すまで、テキストは書きかえません）', { message: blockErrorText(view.error) })));
    if (view.error.block) {
      row.title = t('クリックでその場所へ移動します');
      row.addEventListener('click', showErrorBlock);
    } else {
      row.style.cursor = 'default';   // 動く先の無い行（チェックタブと同じ）
    }
    box.appendChild(row);
  }
  if (view.loose) {
    const row = Render.el('button', 'check-item is-warn');
    row.style.cursor = 'default';   // 押しても動かない行（チェックタブと同じ）
    row.appendChild(Render.el('span', 'mark', '⚠'));
    row.appendChild(Render.div('msg', t('関数の外にあるブロック {n} こは、辞書に入りません。関数の帽子の下につなげてください。', { n: view.loose })));
    box.appendChild(row);
  }
  return rebuilt;
}

// ------------------------------------------------------------------ ブロック
/** ブロックを辞書のテキストにする（YAYA にできないブロックがあれば YBlockError を投げる） */
function printView(v) {
  const r = viewToAst(v);
  v.loose = r.loose;
  return printYaya(r.dic);
}

/**
 * ブロックが変わっていたら、テキストに書く（変わっていたら true）。
 * Model.act・pushUndo が「元にもどす」に積む前（Model.onCommit）と、ブロックの欄を打っているあいだによびます
 */
function syncFromBlocks() {
  const d = current();
  if (!view || !d || view.name !== d.name || view.text !== d.text) return false;
  let text;
  try {
    text = printView(view);
    view.error = null;
  } catch (e) {
    if (!(e instanceof YBlockError)) throw e;
    view.error = e;
    return false;
  }
  if (text === view.printed) return false;   // ブロックは変わっていない（テキストは書いたままの形で残す）
  d.text = text;
  view.text = text;
  view.printed = text;
  Model.dirty = true;
  return true;
}

/** テキストの欄に、いまの辞書のテキストを入れる（打っている最中は、テキストとカーソルをさわらない） */
function fillText(d) {
  const area = $('#dic-text');
  if (document.activeElement === area && area.dataset.dic === d.name) return;
  if (area.value !== d.text) {
    const top = area.scrollTop;
    area.value = d.text;
    area.scrollTop = top;
  }
  area.dataset.dic = d.name;
}

const viewFunctionNames = () => (view ? view.scripts.filter((s) => s.kind === 'yfunc').map((s) => s.name) : []);

// かたまりの道具（たたむ・複製・削除）。ブロックはプロジェクトの外にあるので、editor/scripts.js のかわりにこちらで
const HOST = {
  toggleFold(s) {
    if (s.folded) delete s.folded;
    else s.folded = true;
    renderBlocks();
  },
  duplicateScript(s) {
    Model.act(() => {
      const copy = Model.clone(s);
      copy.id = Model.uid('s');
      copy.y = (s.y || 0) + 1;   // すぐ下（テキストでは、すぐうしろ）に
      if (copy.kind === 'yfunc') copy.name = Drag.uniqueIn(viewFunctionNames(), copy.name);
      view.scripts.push(copy);
    });
  },
  deleteScript(s) {
    const title = s.kind === 'yfunc' ? s.name : t('関数の外のコメント');
    if ((s.blocks || []).length && !confirm(t('「{title}」を削除しますか？', { title }))) return;
    Model.act(() => { removeViewScript(s); });
    toast(t('削除しました'));
  },
};

function removeViewScript(s) {
  const i = view ? view.scripts.indexOf(s) : -1;
  if (i >= 0) view.scripts.splice(i, 1);
}

/** ブロックのキャンバスを描きなおす */
function renderBlocks() {
  const canvas = $('#dic-canvas');
  canvas.textContent = '';
  const scripts = view ? view.scripts : [];
  for (const s of scripts) canvas.appendChild(Render.buildScriptEl(s, Model.project, { host: HOST }));
  layout();
  $('#dic-canvas-hint').style.display = scripts.length ? 'none' : '';
  markErrorBlock();
  Drag.reselect();
}

/** テキストに入るかたまりを、テキストと同じ順に、上から 1 列に並べる（はみ出したブロックは、置いたところのまま） */
function layout() {
  const els = Array.from($('#dic-canvas').children).filter((el) => el._script && goesIntoText(el._script));
  els.sort((a, b) => (a._script.y || 0) - (b._script.y || 0) || (a._script.x || 0) - (b._script.x || 0));
  let y = 32;
  for (const el of els) {
    const h = el.offsetHeight;
    if (!h) return;   // 画面が見えていない（見えたときに並べなおす）
    el._script.x = 24;
    el._script.y = y;
    el.style.left = '24px';
    el.style.top = y + 'px';
    y += h + 32;
  }
}

function errorBlockEl() {
  const b = view && view.error && view.error.block;
  if (!b) return null;
  // 関数の名前のまちがいは、帽子（b はかたまり）に
  return Array.from($('#dic-canvas').querySelectorAll('.blk')).find((el) => el._blk === b || (el._isHat && el._script === b)) || null;
}
function markErrorBlock() {
  const el = errorBlockEl();
  if (el) el.classList.add('has-error');
}
/** YAYA にできないブロックへ動いて、光らせる（チェックタブの「押すとその場所へ動く」と同じ。panels/search.js の jumpTo） */
function showErrorBlock() {
  const b = view && view.error && view.error.block;
  if (!b) return;
  // たたんだかたまりの中なら、ひろげてから
  const holder = view.scripts.find((s) => contains(s.blocks, b));
  if (holder && holder.folded) { delete holder.folded; renderBlocks(); }
  const el = errorBlockEl();
  if (!el) return;
  const ws = $('#dic-workspace');
  const box = el.getBoundingClientRect();
  const area = ws.getBoundingClientRect();
  ws.scrollLeft += box.left - area.left - Math.max(40, (area.width - box.width) / 2);
  ws.scrollTop += box.top - area.top - Math.max(40, (area.height - box.height) / 2);
  el.classList.remove('flash');
  void el.offsetWidth;          // アニメーションをやり直させる
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 2600);
}

/** x の中に、ブロック b がある */
function contains(x, b) {
  if (x === b) return true;
  if (Array.isArray(x)) return x.some((y) => contains(y, b));
  if (x && typeof x === 'object') return Object.values(x).some((y) => y && typeof y === 'object' && contains(y, b));
  return false;
}

/** ブロックの欄を打っているあいだ、テキストを書きかえる（キャンバスは描きなおさない。打っている欄が消えないように） */
function blocksTyped() {
  const d = current();
  if (!d || Pages.current !== 'dics') return;
  const before = view && view.error;
  syncFromBlocks();
  fillText(d);
  check(d);
  const err = $('#dic-canvas .has-error');
  if (err && !(view && view.error)) err.classList.remove('has-error');
  if (view && view.error && view.error !== before) markErrorBlock();
}

/** パレット（トークの画面のパレットと同じ形。カテゴリは model/yblocks.js の YPALETTE） */
function renderPalette() {
  const list = $('#dic-cat-list');
  list.textContent = '';
  for (const cat of YPALETTE) {
    const b = Render.el('button', 'cat-btn' + (cat.id === Session.dicCategory ? ' is-active' : ''));
    const dot = Render.el('span', 'cat-dot');
    dot.style.background = `var(--cat-${cat.cat})`;
    b.appendChild(dot);
    b.appendChild(Render.el('span', null, cat.name));
    b.addEventListener('click', () => { Session.dicCategory = cat.id; renderPalette(); });
    list.appendChild(b);
  }
  const cat = YPALETTE.find((c) => c.id === Session.dicCategory) || YPALETTE[0];
  Render.renderPaletteEntries($('#dic-palette-blocks'), cat.entries, Model.project);
}

/** テキストの n 行目にカーソルを置く */
function goLine(n) {
  const area = $('#dic-text');
  const lines = area.value.split('\n');
  let pos = 0;
  for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  area.focus();
  area.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
  const lineH = parseFloat(getComputedStyle(area).lineHeight) || 19;
  area.scrollTop = Math.max(0, (n - 4) * lineH);
  syncScroll();
}

function render() {
  const list = $('#dic-list');
  if (!list) return;
  const d = current();
  Session.dicName = d ? d.name : null;
  list.textContent = '';
  if (!dics().length) list.appendChild(Render.div('hint', t('まだ辞書がありません。下の「＋ 辞書をつくる」で作れます。')));
  for (const x of dics()) {
    const b = Render.el('button', 'dic-item' + (x === d ? ' is-active' : ''), x.name);
    if (!dicNameOk(x.name)) {
      b.classList.add('is-bad');
      // 名前の決まりは、チェックタブ（model/dics.js）と同じ文で
      b.title = t('「.dic」で終わる名前にしてください（フォルダの区切りや \\ / : * ? " < > | は使えません。studio_runtime.dic など、スタジオのファイルの名前も使えません）。');
    }
    b.addEventListener('click', () => { Session.dicName = x.name; render(); });
    list.appendChild(b);
  }
  const has = !!d;
  $('#dic-main').classList.toggle('is-empty', !has);
  $('#btn-dic-rename').disabled = !has;
  $('#btn-dic-delete').disabled = !has;
  $('#dic-name').textContent = has ? d.name : '';
  if (!has) { view = null; return; }
  syncFromBlocks();   // ドラッグをはじめたときなど、「元にもどす」に積まずに描きなおすときの分
  fillText(d);
  check(d);
  if (!$('#dic-palette-blocks').childElementCount) renderPalette();
  renderBlocks();
}

/** 名前をたずねる（使えない名前・もうある名前なら null） */
function askName(question, suggested, except) {
  const name = prompt(question, suggested);
  if (name == null) return null;
  const s = name.trim();
  if (!dicNameOk(s)) { toast(t('「.dic」で終わる、フォルダの区切りなどの無い名前にしてください'), true); return null; }
  if (dics().some((x) => x !== except && x.name.toLowerCase() === s.toLowerCase())) { toast(t('その名前の辞書はもうあります'), true); return null; }
  return s;
}

function create() {
  let n = dics().length + 1;
  let base = 'dic' + n + '.dic';
  while (dics().some((x) => x.name.toLowerCase() === base)) base = 'dic' + (++n) + '.dic';
  const name = askName(t('あたらしい辞書の名前は？（.dic で終わる名前）'), base, null);
  if (!name) return;
  Model.act(() => {
    if (!Array.isArray(Model.project.dics)) Model.project.dics = [];
    Model.project.dics.push({ name, text: t('// {name}（YAYA の辞書）\n// ここに YAYA の関数を書きます。書き出すと、ゴーストに入ります。\n', { name }) });
  });
  Session.dicName = name;
  toast(t('辞書「{name}」を作りました', { name }));
}

function rename() {
  const d = current();
  if (!d) return;
  const name = askName(t('辞書の新しい名前は？'), d.name, d);
  if (!name || name === d.name) return;
  Model.act(() => { d.name = name; });
  Session.dicName = name;
}

function remove() {
  const d = current();
  if (!d) return;
  if (!confirm(t('辞書「{name}」を消しますか？（元にもどすで戻せます）', { name: d.name }))) return;
  Model.act(() => { Model.project.dics = dics().filter((x) => x !== d); });
  Session.dicName = null;
  toast(t('辞書「{name}」を消しました', { name: d.name }));
}

function init() {
  const area = $('#dic-text');
  if (!area) return;
  $('#btn-dic-new').addEventListener('click', create);
  $('#btn-dic-rename').addEventListener('click', rename);
  $('#btn-dic-delete').addEventListener('click', remove);
  // 打ちはじめる前のプロジェクトを覚える（focus が来ないこともあるので、打つ直前にも）
  const remember = () => { if (!editing) editing = Model.clone(Model.project); };
  area.addEventListener('focus', remember);
  area.addEventListener('beforeinput', remember);
  area.addEventListener('input', () => {
    const d = current();
    if (!d) return;
    d.text = area.value;
    Model.dirty = true;     // 保存していないしるし（「元にもどす」の記録は、離れたときに積む）
    updateTitle();
    paint(d.text, null);
    clearTimeout(parseTimer);
    parseTimer = setTimeout(() => { if (check(d)) renderBlocks(); }, 250);
  });
  area.addEventListener('blur', () => {
    const before = editing;
    editing = null;
    if (before && JSON.stringify(before.dics) !== JSON.stringify(Model.project.dics)) Model.pushUndo(before);
  });
  area.addEventListener('scroll', syncScroll);
  area.addEventListener('keydown', (e) => {
    if (e.isComposing) return;   // 日本語の変換中の Esc・Tab は、変換のほうに
    // Esc でテキストから離れる（キーボードだけで外へ出られるように。editor/notes.js と同じ）
    if (e.key === 'Escape') { area.blur(); return; }
    // Tab は字下げ（Shift+Tab は、ふつうどおり前の欄へ移る）
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      remember();
      area.setRangeText('\t', area.selectionStart, area.selectionEnd, 'end');
      area.dispatchEvent(new Event('input'));
      return;
    }
    // Ctrl+Z・Ctrl+Y はテキストの元にもどす（プロジェクトの「元にもどす」にわたさない）
    const k = e.key.toLowerCase();
    if (e.ctrlKey && (k === 'z' || k === 'y')) e.stopPropagation();
  });

  // ブロックの側
  Drag.addRoot({
    ws: $('#dic-workspace'), canvas: $('#dic-canvas'), palette: $('#dic-palette'), trash: $('#dic-trash'),
    scripts: () => (view ? view.scripts : []),
    removeScript: removeViewScript,
    uniqueName: (name) => Drag.uniqueIn(viewFunctionNames(), name),
  });
  Model.onCommit(() => { if (Pages.current === 'dics') syncFromBlocks(); });
  $('#dic-canvas').addEventListener('input', () => {
    clearTimeout(blockTimer);
    blockTimer = setTimeout(blocksTyped, 120);
  });
  renderPalette();
}

/** 辞書の画面を開いて、その辞書の line 行目へ動く（チェックタブの「辞書の何行目が読めません」から。panels/search.js） */
function open(name, line) {
  Session.dicName = name;
  Pages.show('dics');
  render();
  if (line) setTimeout(() => goLine(line), 0);
}

export const Dictionary = { init, render, open };
