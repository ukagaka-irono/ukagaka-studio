/* 伺かスタジオ - 保存 / 読込 と 書き出し（ダイアログまわり）
 *
 * exe の中の API を呼んで、プロジェクトの出し入れと、ゴースト一式の書き出しをします。
 *
 * app.js とは、おたがいに import しあっています（App と Dialog）。
 * どちらが先に読みこまれても動くように、相手のものは**関数の中でだけ**使ってください。
 * ファイルのいちばん外で App.xxx = … のように触ると、読みこみの時点で落ちます。
 */

import { Model } from './model.js';
import { Render } from './render.js';
import { $, App, api, escapeHtml, updateTitle } from './app.js';

// ---------------------------------------------------------- 保存 / 読込
async function saveProject(silent) {
  const name = Model.project.meta.name || 'ゴースト';
  try {
    const r = await api('/api/project', { method: 'POST', body: { name, project: Model.project } });
    App.projectName = r.saved;
    Model.dirty = false;
    updateTitle();
    if (!silent) App.toast(`「${r.saved}」を保存しました`);
    return true;
  } catch (e) {
    App.toast(e.message, true);
    return false;
  }
}

/** ウィンドウを閉じるとき、アプリ本体から呼ばれる（保存し終わったら合図を返す） */
async function requestSaveAndClose() {
  try { await saveProject(true); } catch (e) { /* 保存できなくても閉じる */ }
  if (window.chrome && window.chrome.webview) window.chrome.webview.postMessage('saved');
}

function modal(title, bodyEl, buttons) {
  const root = $('#modal-root');
  root.textContent = '';
  const box = Render.div('modal');
  box.appendChild(Render.el('h3', null, title));
  const body = Render.div('modal-body');
  body.appendChild(bodyEl);
  box.appendChild(body);
  const foot = Render.div('modal-foot');
  for (const b of buttons) {
    const btn = Render.el('button', 'btn' + (b.primary ? ' primary' : ''), b.label);
    btn.addEventListener('click', () => { if (b.run) b.run(); if (b.close !== false) closeModal(); });
    foot.appendChild(btn);
  }
  box.appendChild(foot);
  root.appendChild(box);
  root.classList.add('open');
  root.onclick = (e) => { if (e.target === root) closeModal(); };
}
function closeModal() { $('#modal-root').classList.remove('open'); }

async function openProjectDialog() {
  let state;
  try { state = await api('/api/state'); } catch (e) { App.toast(e.message, true); return; }
  const list = Render.div('');
  if (!state.projects.length) list.appendChild(Render.div('hint', 'まだ保存したプロジェクトがありません。'));
  for (const p of state.projects) {
    const row = Render.div('proj-row');
    row.appendChild(Render.div('t', p.title));
    row.appendChild(Render.div('d', new Date(p.updated).toLocaleString('ja-JP')));
    const x = Render.el('button', 'x', '✕');
    x.title = '削除';
    x.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`「${p.title}」を削除しますか？`)) return;
      await api('/api/project/delete', { method: 'POST', body: { name: p.file } });
      closeModal();
      openProjectDialog();
    });
    row.appendChild(x);
    row.addEventListener('click', async () => {
      try {
        const data = await api('/api/project?name=' + encodeURIComponent(p.file));
        Model.init(data);
        App.projectName = p.file;
        App.sessionVars = {};
        closeModal();
        App.toast(`「${p.title}」を開きました`);
      } catch (e) { App.toast(e.message, true); }
    });
    list.appendChild(row);
  }
  modal('プロジェクトを開く', list, [
    { label: 'お手本から始める', run: () => setTimeout(openSampleDialog, 0) },
    { label: '閉じる' },
  ]);
}

/** お手本ゴースト（exe に入っている見本）をひらく */
async function openSampleDialog() {
  let index;
  try {
    index = await (await fetch('samples/index.json')).json();
  } catch (e) {
    App.toast('お手本を読めませんでした', true);
    return;
  }
  const list = Render.div('');
  list.appendChild(Render.div('hint',
    'えらぶと、いまのプロジェクトを置きかえて開きます（保存していないものは消えます）。'));
  for (const s of index) {
    const row = Render.div('proj-row');
    row.appendChild(Render.div('t', s.title));
    row.appendChild(Render.div('d', s.desc));
    row.addEventListener('click', async () => {
      if (Model.dirty && !confirm('保存していない変更があります。お手本を開きますか？')) return;
      try {
        const data = await (await fetch('samples/' + s.file)).json();
        Model.init(data);
        App.projectName = '';          // 上書き保存ではなく、名前を付けて保存させる
        App.sessionVars = {};
        closeModal();
        App.toast(`お手本「${s.title}」を開きました。保存すると自分のものになります`);
      } catch (e) { App.toast('お手本を読めませんでした', true); }
    });
    list.appendChild(row);
  }
  modal('お手本からはじめる', list, [{ label: '閉じる' }]);
}

// ------------------------------------------------------------- 書き出し
async function doExport(mode) {
  const outDir = $('#export-dir').value.trim();
  const box = $('#export-result');
  box.textContent = '書き出し中…';
  try {
    const r = await api('/api/export', {
      method: 'POST',
      body: {
        project: Model.project,
        outDir,
        mode,
        includeShell: $('#export-shell').checked,
        overwriteShell: $('#export-overwrite').checked,
      },
    });
    box.textContent = '';
    const p = Render.div('');
    if (mode === 'nar') {
      p.innerHTML = `<b>.nar を作りました</b><br><code>${escapeHtml(r.path)}</code><br>` +
        'SSP のウィンドウにドラッグ＆ドロップするとインストールできます。';
    } else {
      p.innerHTML = `<b>書き出しました</b><br><code>${escapeHtml(r.root)}</code><br>` +
        `ファイル ${r.written.length} 個` +
        (r.skipped.length ? `（既存のシェル ${r.skipped.length} 個はそのまま）` : '');
    }
    if (!r.dll) {
      p.appendChild(Render.div('status-line status-ng',
        'ikaga.dll が見つかりません。shiori\\build.ps1 を実行してから書き出し直してください。'));
    }
    const open = Render.el('button', 'btn small', 'フォルダを開く');
    open.style.marginTop = '8px';
    open.addEventListener('click', () => api('/api/reveal', {
      method: 'POST', body: { path: r.root || r.path },
    }).catch(() => {}));
    p.appendChild(open);
    box.appendChild(p);
    App.toast('書き出しました');
  } catch (e) {
    box.textContent = '';
    box.appendChild(Render.div('status-line status-ng', e.message));
    App.toast(e.message, true);
  }
}

export const Dialog = { saveProject, requestSaveAndClose, openProjectDialog, openSampleDialog, doExport, modal, closeModal };
