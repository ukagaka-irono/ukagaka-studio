/* 伺かスタジオ - 画面の入り口と組み立て
 *
 * index.html が読むのはこのファイルだけです。ほかは import でたどって読みこまれます。
 * ここでするのは、各部品の init() を呼ぶことと、まとめて描きなおすことだけです。
 *
 *   model/   データと規則（DOM を触らない）
 *   core/    画面の土台（API・お知らせ・画面の状態・上の層への受け口）
 *   editor/  キャンバスとパレット
 *   panels/  画面（トークの右の列・キャラと絵・ゴースト情報・書き出し・ヘルプ）
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
import { Theme } from './core/theme.js';
import { Render } from './editor/render.js';
import { Drag } from './editor/drag.js';
import { Palette } from './editor/palette.js';
import { Scripts } from './editor/scripts.js';
import { Zoom } from './editor/zoom.js';
import { ContextMenu } from './editor/contextmenu.js';
import { Picker } from './editor/picker.js';
import { Parts } from './editor/parts.js';
import { Pages } from './panels/pages.js';
import { Tabs } from './panels/tabs.js';
import { Run } from './panels/run.js';
import { Stage } from './panels/stage.js';
import { Chara } from './panels/chara.js';
import { Vars } from './panels/vars.js';
import { Ghost } from './panels/ghost.js';
import { Search } from './panels/search.js';
import { Dialog } from './panels/dialog.js';
import { Ssp } from './panels/ssp.js';
import { Guide } from './panels/guide.js';
import { Language } from './panels/language.js';
import { YayaLink } from './panels/yayalink.js';
import { About } from './panels/about.js';
import { Shortcuts } from './shortcuts.js';
import { t, getLang, translateDom } from './i18n/i18n.js';

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

// 描きなおすのは、いつも見えているもの（上のバー・チェックの数）と、いま見えている画面だけです。
// 画面を切りかえたら、その画面を描きなおします（Pages.onShow）。
function renderAll() {
  const project = Model.project;
  YayaLink.render();         // つないだ手書きのゴースト（つなぎ先が変わったときだけ調べなおす。チェックタブが使う）
  Ghost.render();            // 上のバーの名前と、ゴースト情報の欄（軽いので、いつも）
  Search.renderCheck();      // トークの右の列の「チェック」の数
  switch (Pages.current) {
    case 'talk':
      Render.renderWorkspace($('#canvas'), project);
      Drag.reselect();           // えらんでいたブロックを、描きなおした見た目の上でえらびなおす
      Palette.render();
      $('#canvas-hint').style.display = project.scripts.length ? 'none' : '';
      Vars.render();
      Run.render();
      Search.renderSearch();
      Stage.refresh();
      break;
    case 'chara':
      Chara.render();
      break;
    default:
      break;
  }
  $('#btn-undo').disabled = !Model.undoStack.length;
  $('#btn-redo').disabled = !Model.redoStack.length;
  updateTitle();
}

// ------------------------------------------------------------ 上のボタン
function initTopbar() {
  $('#btn-new').addEventListener('click', () => {
    if (Model.dirty && !confirm(t('保存していない変更があります。新しく作りますか？'))) return;
    Model.init(sampleProject());
    Session.vars = {};
    toast(t('新しいゴーストを作りました'));
  });
  $('#btn-open').addEventListener('click', Dialog.openProjectDialog);
  $('#btn-save').addEventListener('click', () => Dialog.saveProject(false));
  $('#btn-undo').addEventListener('click', () => Model.undo());
  $('#btn-redo').addEventListener('click', () => Model.redo());
  $('#btn-export').addEventListener('click', () => { Pages.show('export'); Dialog.doExport('dir'); });
}

/** 起動時に exe からもらった状態を、書き出しの画面に出す */
function showState(state) {
  if (!state) return;
  $('#export-dir').value = state.defaultOutDir || '';
  const st = $('#dll-status');
  st.className = 'status-line ' + (state.dllFound ? 'status-ok' : 'status-ng');
  st.textContent = state.dllFound
    ? t('栞 (yaya.dll) の準備ができています')
    : t('yaya.dll が exe に入っていません。.\\build.ps1 で作りなおしてください。');
  $('#ssp-hint').textContent = state.sspGhostDir
    ? t('SSP らしきフォルダを見つけました: {dir}', { dir: state.sspGhostDir })
    : t('SSP の ghost フォルダを指定すると、そのまま追加できます。');
}

// ------------------------------------------------------------------- 起動
async function boot() {
  translateDom(document.body);   // index.html に直に書いた文（日本語のときは何もしない）
  // exe が自分で出すもの（閉じるときの確認・書き出す readme など）も、画面と同じ言語にする（studio/src/lang.h）
  if (window.chrome && window.chrome.webview) window.chrome.webview.postMessage('lang:' + getLang());
  Theme.init();
  Language.init();
  Pages.init();
  Pages.onShow(scheduleRender);  // 切りかえた画面を描く
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

  // 言語を切りかえて読みなおしたときは、切りかえる前に開いていたものをそのまま開く（panels/language.js）
  const carried = Language.takeCarried();
  let loaded = carried ? carried.project : null;
  if (!carried && state && state.lastProject) {
    try { loaded = await api('/api/project?name=' + encodeURIComponent(state.lastProject)); } catch { /* 新規 */ }
  }
  try {
    Model.init(loaded || sampleProject());
  } catch (e) {
    // 前に開いていたものが読めない形（新しい版で保存した、など）。ファイルはそのまま残し、ひな形で始める
    Model.init(sampleProject());
    const name = carried ? (carried.project.meta || {}).name || '' : state.lastProject;
    toast(t('「{name}」を開けませんでした: {message}', { name, message: e.message }), true);
  }
  if (carried) {
    Model.dirty = !!carried.dirty;
    Session.projectName = carried.name || '';
  }
  Zoom.setZoom(1);
  Tabs.switchTab('run');
  Stage.reset();

  initTopbar();
  Tabs.init();
  Run.init();
  Vars.init();
  Chara.init();
  Scripts.init();
  Zoom.init();
  Dialog.init();
  Ssp.init();
  YayaLink.init();
  Search.init();
  Picker.init();
  Guide.init();
  About.init(state);
  Parts.load();      // 部品（exe のとなりの parts.json）。読めたらパレットの「部品」を描きなおす
  Shortcuts.init();
  if (carried && carried.page) Pages.show(carried.page);   // 切りかえる前に見ていた画面

  window.addEventListener('beforeunload', (e) => {
    if (!Model.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // 1 分ごとの自動保存（前の版は、exe が 10 分おきにだけ残します）
  setInterval(() => { if (Model.dirty) Dialog.saveProject(true, true); }, 60000);
}

// exe（studio/src/main.cpp）が、ウィンドウを閉じるときに呼ぶもの。
// 画面の外から触れるのはここに載せたものだけです。
window.IKAGA = { Model, Dialog };

document.addEventListener('DOMContentLoaded', boot);
