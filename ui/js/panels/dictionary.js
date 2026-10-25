/* 伺かスタジオ - 「辞書」の画面（プロジェクトの YAYA の辞書と、そのテキストエディタ。段階 8-3）
 *
 * 左にプロジェクトの辞書（project.dics。model/dics.js）、右にえらんだ辞書のテキストを出します。
 * テキストは打つたびに辞書に入れ、色分け（model/yayatext.js の highlightYaya）と行番号を付けなおし、
 * 少し待ってから読みなおして（parseYaya）、YAYA として読めない行を行番号の横と下の一覧に出します。
 * 「元にもどす」の記録は、テキストから離れたときに 1 つだけ積みます（打つたびに積まない。editor/notes.js と同じ）。
 * テキストの中の Ctrl+Z は、プロジェクトの「元にもどす」ではなく、テキストの元にもどすです。
 */

import { Model } from '../model/model.js';
import { dicNameOk } from '../model/dics.js';
import { parseYaya, highlightYaya } from '../model/yayatext.js';
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

let editing = null;     // テキストを打ちはじめる前のプロジェクト（離れたときに「元にもどす」の記録にする）
let parseTimer = 0;

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

/** 読みなおして、読めない行を出す */
function check(d) {
  const r = parseYaya(d.text);
  const lines = new Set(r.errors.map((e) => e.line));
  paint(d.text, lines);
  const box = $('#dic-errors');
  box.textContent = '';
  const funcs = r.dic.items.filter((x) => x.type === 'func').length;
  if (!r.errors.length) {
    box.appendChild(Render.div('status-line status-ok', t('YAYA として読めます（関数 {n} こ）', { n: funcs })));
    return;
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
  if (!has) return;
  const area = $('#dic-text');
  // 打っている最中は、テキストとカーソルをさわらない
  if (document.activeElement !== area || area.dataset.dic !== d.name) {
    area.value = d.text;
    area.dataset.dic = d.name;
  }
  check(d);
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
    parseTimer = setTimeout(() => check(d), 250);
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
}

/** 辞書の画面を開いて、その辞書の line 行目へ動く（チェックタブの「辞書の何行目が読めません」から。panels/search.js） */
function open(name, line) {
  Session.dicName = name;
  Pages.show('dics');
  render();
  if (line) setTimeout(() => goLine(line), 0);
}

export const Dictionary = { init, render, open };
