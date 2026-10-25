/* 伺かスタジオ - 手書きの YAYA ゴーストにつなぐ（段階 3-5b）
 *
 * YAYA で手書きしたゴーストのフォルダを、プロジェクトにつなぎます（プロジェクトの meta.ghostDir）。
 * つないでいるあいだは、書き出すとそのゴーストに書きこみ、スタジオのファイル（studio_runtime.dic・
 * studio_program.dic）と yaya.txt の印の行のほかには触りません（studio/src/yaya_ghost.cpp）。
 *
 * 手書きの辞書にある関数の一覧は Session.yayaGhost に置きます。書き出すときは、その中にある
 * イベントの入り口を訳さず（手書きを優先。model/yaya.js の toYaya）、チェックタブもそれを知らせます。
 */

import { Model } from '../model/model.js';
import { dicFunctionNames } from '../model/dics.js';
import { $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';

// 書き出す前に直してもらうこと（exe の InspectYayaGhost が返すコード）
const PROBLEMS = {
  yaya_dll_missing: () => t('ゴーストに yaya.dll がありません'),
  yaya_dll_old: () => t('ゴーストの yaya.dll が古いので、スタジオのしくみが動きません（YAYA 6 系にしてください）'),
  yaya_base_missing: () => t('ゴーストが YAYA のシステム辞書 yaya_base を使っていません'),
  yaya_base_old: () => t('ゴーストの yaya_base が古いので、スタジオのしくみが動きません'),
  not_studio_file: (d) => t('{file} は人が書いたファイルのようなので、上書きしません', { file: d }),
};

/** つないだゴーストのフォルダ（つないでいなければ ''）。辞書の画面の「読みこむ」の最初の値にも使います（panels/dictionary.js） */
export const linkedPath = () => String((Model.project.meta || {}).ghostDir || '');

let pending = null;   // 調べている最中のパス（同じものを何度もたずねない）

async function inspect(path) {
  return api('/api/yaya/inspect', { method: 'POST', body: { path } });
}

/** つないだゴーストを（まだなら）調べて、Session.yayaGhost に置く */
async function ensureInspected() {
  const path = linkedPath();
  if (!path) { Session.yayaGhost = null; return null; }
  if (Session.yayaGhost && Session.yayaGhost.path === path) return Session.yayaGhost;
  if (pending === path) return null;
  pending = path;
  try {
    Session.yayaGhost = await inspect(path);
  } catch (e) {
    Session.yayaGhost = { path, error: e.message, functions: [], problems: [] };
  } finally {
    pending = null;
  }
  renderStatus();
  Model.emit();   // 描きなおして、「YAYA の関数をよぶ」ブロックに関数のえらびを出す（調べ終わったものは、もうたずねない）
  return Session.yayaGhost;
}

function renderStatus() {
  const box = $('#yaya-link-status');
  if (!box) return;
  const path = linkedPath();
  const info = Session.yayaGhost;
  box.textContent = '';
  box.className = 'status-line';
  $('#btn-yaya-unlink').disabled = !path;
  if (!path) {
    box.textContent = t('つないでいません（ふつうに書き出します）');
    return;
  }
  if ($('#yaya-link-path') !== document.activeElement) $('#yaya-link-path').value = path;
  if (!info || info.path !== path) {
    box.textContent = t('調べています…');
    return;
  }
  if (info.error) {
    box.classList.add('status-ng');
    box.textContent = t('つないだゴーストを読めません: {message}', { message: info.error });
    return;
  }
  const problems = (info.problems || []).map((p) => (PROBLEMS[p] ? PROBLEMS[p](info.problemDetail) : p));
  box.classList.add(problems.length ? 'status-ng' : 'status-ok');
  box.appendChild(Render.div('', t('「{name}」につないでいます（手書きの辞書 {dics} こ・関数 {fns} こ）',
    { name: info.name || path, dics: (info.dics || []).length, fns: (info.functions || []).length })));
  for (const p of problems) box.appendChild(Render.div('', `• ${p}`));
}

async function link() {
  const path = $('#yaya-link-path').value.trim();
  if (!path) { toast(t('ゴーストのフォルダを入れてください'), true); return; }
  let info;
  try {
    info = await inspect(path);
  } catch (e) {
    toast(e.message, true);
    return;
  }
  // 名前は descript.txt から（書き出すとき descript.txt には触らないので、ここでそろえておく）
  Model.act(() => {
    const meta = Model.project.meta || (Model.project.meta = {});
    meta.ghostDir = path;
    if (info.name) meta.name = info.name;
    if (info.sakuraName) meta.sakuraName = info.sakuraName;
    if (info.keroName) meta.keroName = info.keroName;
  });
  Session.yayaGhost = info;
  renderStatus();
  toast(t('「{name}」につなぎました。書き出すと、このゴーストに書きこみます', { name: info.name || path }));
}

function unlink() {
  if (!linkedPath()) return;
  Model.act(() => { delete Model.project.meta.ghostDir; });
  Session.yayaGhost = null;
  renderStatus();
  toast(t('つなぐのをやめました。書き出しは、ふつうの書き出しにもどります'));
}

/**
 * 書き出すときの材料。つないでいれば { linked: パス, handwritten: [手書きの関数] }、
 * つないでいなければ { handwritten: [プロジェクトの辞書の関数] }（段階 8-2。辞書にあるイベントの入り口は、ブロックからは書かない）。
 */
async function exportOptions() {
  const path = linkedPath();
  if (!path) return { handwritten: dicFunctionNames(Model.project) };
  const info = await ensureInspected() || Session.yayaGhost;
  return { linked: path, handwritten: info && Array.isArray(info.functions) ? info.functions : [] };
}

/** いまわかっている「手書き」の関数（調べ終わるのを待たない。YAYA を見るところが使う。panels/yayaview.js） */
function handwrittenNow() {
  return linkedPath() ? ((Session.yayaGhost || {}).functions || []) : dicFunctionNames(Model.project);
}

function render() {
  ensureInspected();
  renderStatus();
}

function init() {
  $('#btn-yaya-link').addEventListener('click', link);
  $('#btn-yaya-unlink').addEventListener('click', unlink);
}

export const YayaLink = { init, render, exportOptions, handwrittenNow };
