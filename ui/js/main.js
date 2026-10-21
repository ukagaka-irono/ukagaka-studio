/* 伺かスタジオ - 画面の入り口と組み立て
 *
 * index.html が読むのはこのファイルだけです。ほかは import でたどって読みこまれます。
 * ここでするのは、各部品の init() を呼ぶことと、まとめて描きなおすことだけです。
 *
 *   model/   データと規則（DOM を触らない）
 *   core/    画面の土台（API・お知らせ・画面の状態・上の層への受け口）
 *   editor/  キャンバスとパレット
 *   panels/  右の列のタブ
 *
 * import は上から下へだけ向けます（docs/maintenance.md）。
 */

import { Model } from './model/model.js';
import { sampleProject } from './model/sample.js';
import { $ } from './core/dom.js';
import { api } from './core/api.js';
import { toast } from './core/toast.js';
import { Session } from './core/session.js';
import { updateTitle } from './core/title.js';
import { Render } from './editor/render.js';
import { Drag } from './editor/drag.js';
import { Palette } from './editor/palette.js';
import { Scripts } from './editor/scripts.js';
import { Zoom } from './editor/zoom.js';
import { ContextMenu } from './editor/contextmenu.js';
import { Tabs } from './panels/tabs.js';
import { Run } from './panels/run.js';
import { Shell } from './panels/shell.js';
import { Vars } from './panels/vars.js';
import { Ghost } from './panels/ghost.js';
import { Search } from './panels/search.js';
import { Dialog } from './panels/dialog.js';
import { Ssp } from './panels/ssp.js';
import { Shortcuts } from './shortcuts.js';

// ---------------------------------------------------------------- 再描画
let renderQueued = false;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderAll();
  });
}

function renderAll() {
  const project = Model.project;
  Render.renderWorkspace($('#canvas'), project);
  Palette.render();
  $('#canvas-hint').style.display = project.scripts.length ? 'none' : '';
  Vars.render();
  Run.render();
  Search.renderCheck();
  Search.renderSearch();
  Ghost.render();
  $('#btn-undo').disabled = !Model.undoStack.length;
  $('#btn-redo').disabled = !Model.redoStack.length;
  updateTitle();
}

// ------------------------------------------------------------ 上のボタン
function initTopbar() {
  $('#btn-new').addEventListener('click', () => {
    if (Model.dirty && !confirm('保存していない変更があります。新しく作りますか？')) return;
    Model.init(sampleProject());
    Session.vars = {};
    toast('新しいゴーストを作りました');
  });
  $('#btn-open').addEventListener('click', Dialog.openProjectDialog);
  $('#btn-save').addEventListener('click', () => Dialog.saveProject(false));
  $('#btn-undo').addEventListener('click', () => Model.undo());
  $('#btn-redo').addEventListener('click', () => Model.redo());
  $('#btn-export').addEventListener('click', () => { Tabs.switchTab('export'); Dialog.doExport('dir'); });
}

/** 起動時に exe からもらった状態を、書き出しタブに出す */
function showState(state) {
  if (!state) return;
  $('#export-dir').value = state.defaultOutDir || '';
  const st = $('#dll-status');
  st.className = 'status-line ' + (state.dllFound ? 'status-ok' : 'status-ng');
  st.textContent = state.dllFound
    ? '栞 (ikaga.dll) の準備ができています'
    : 'ikaga.dll がまだありません。shiori\\build.ps1 を実行してください。';
  $('#ssp-hint').textContent = state.sspGhostDir
    ? 'SSP らしきフォルダを見つけました: ' + state.sspGhostDir
    : 'SSP の ghost フォルダを指定すると、そのまま追加できます。';
}

// ------------------------------------------------------------------- 起動
async function boot() {
  Palette.init();
  Ghost.init();
  ContextMenu.init();
  Drag.init({
    workspace: $('#workspace'),
    canvas: $('#canvas'),
    layer: $('#drag-layer'),
    palette: $('#palette'),
    trash: $('#trash'),
  });

  Model.onChange(scheduleRender);

  let state = null;
  try { state = await api('/api/state'); } catch (e) { console.warn(e); }
  Session.state = state;
  showState(state);

  let loaded = null;
  if (state && state.lastProject) {
    try { loaded = await api('/api/project?name=' + encodeURIComponent(state.lastProject)); } catch { /* 新規 */ }
  }
  Model.init(loaded || sampleProject());
  Zoom.setZoom(1);
  Tabs.switchTab('run');
  Shell.resetStage();

  initTopbar();
  Tabs.init();
  Run.init();
  Vars.init();
  Shell.init();
  Scripts.init();
  Zoom.init();
  Dialog.init();
  Ssp.init();
  Search.init();
  Shortcuts.init();

  window.addEventListener('beforeunload', (e) => {
    if (!Model.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  setInterval(() => { if (Model.dirty) Dialog.saveProject(true); }, 60000);
}

// exe（studio/src/main.cpp）が、ウィンドウを閉じるときに呼ぶもの。
// 画面の外から触れるのはここに載せたものだけです。
window.IKAGA = { Model, Dialog };

document.addEventListener('DOMContentLoaded', boot);
