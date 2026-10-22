/* 伺かスタジオ - 保存 / 読込 と 書き出し（ダイアログまわり）
 *
 * exe の中の API を呼んで、プロジェクトの出し入れと、ゴースト一式の書き出しをします。
 */

import { Model } from '../model/model.js';
import { programOf, toYaya } from '../model/yaya.js';
import { YayaLink } from './yayalink.js';
import { $, escapeHtml } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { updateTitle } from '../core/title.js';
import { Events } from '../core/events.js';
import { Render } from '../editor/render.js';
import { t, getLang } from '../i18n/i18n.js';

// ---------------------------------------------------------- 保存 / 読込
async function saveProject(silent) {
  const name = Model.project.meta.name || t('ゴースト');
  try {
    const r = await api('/api/project', { method: 'POST', body: { name, project: Model.project } });
    Session.projectName = r.saved;
    Model.dirty = false;
    updateTitle();
    if (!silent) toast(t('「{name}」を保存しました', { name: r.saved }));
    return true;
  } catch (e) {
    toast(e.message, true);
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
  try { state = await api('/api/state'); } catch (e) { toast(e.message, true); return; }
  const list = Render.div('');
  if (!state.projects.length) list.appendChild(Render.div('hint', t('まだ保存したプロジェクトがありません。')));
  for (const p of state.projects) {
    const row = Render.div('proj-row');
    row.appendChild(Render.div('t', p.title));
    row.appendChild(Render.div('d', new Date(p.updated).toLocaleString('ja-JP')));
    const x = Render.el('button', 'x', '✕');
    x.title = t('削除');
    x.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(t('「{title}」を削除しますか？', { title: p.title }))) return;
      await api('/api/project/delete', { method: 'POST', body: { name: p.file } });
      closeModal();
      openProjectDialog();
    });
    row.appendChild(x);
    row.addEventListener('click', async () => {
      try {
        const data = await api('/api/project?name=' + encodeURIComponent(p.file));
        Model.init(data);
        Session.projectName = p.file;
        Session.vars = {};
        closeModal();
        toast(t('「{title}」を開きました', { title: p.title }));
      } catch (e) { toast(e.message, true); }
    });
    list.appendChild(row);
  }
  modal(t('プロジェクトを開く'), list, [
    { label: t('お手本から始める'), run: () => setTimeout(openSampleDialog, 0) },
    { label: t('閉じる') },
  ]);
}

/** お手本ゴースト（exe に入っている見本）をひらく */
async function openSampleDialog() {
  // お手本は、画面の言語のものを出します（英語のお手本は ui/samples/en/。会話もゴーストの言語も英語）
  const base = getLang() === 'en' ? 'samples/en/' : 'samples/';
  let index;
  try {
    index = await (await fetch(base + 'index.json')).json();
  } catch (e) {
    toast(t('お手本を読めませんでした'), true);
    return;
  }
  const list = Render.div('');
  list.appendChild(Render.div('hint',
    t('えらぶと、いまのプロジェクトを置きかえて開きます（保存していないものは消えます）。')));
  for (const s of index) {
    const row = Render.div('proj-row');
    row.appendChild(Render.div('t', s.title));
    row.appendChild(Render.div('d', s.desc));
    row.addEventListener('click', async () => {
      if (Model.dirty && !confirm(t('保存していない変更があります。お手本を開きますか？'))) return;
      try {
        const data = await (await fetch(base + s.file)).json();
        Model.init(data);
        Session.projectName = '';          // 上書き保存ではなく、名前を付けて保存させる
        Session.vars = {};
        closeModal();
        toast(t('お手本「{title}」を開きました。保存すると自分のものになります', { title: s.title }));
        Events.emit('sample-opened');
      } catch (e) { toast(t('お手本を読めませんでした'), true); }
    });
    list.appendChild(row);
  }
  modal(t('お手本からはじめる'), list, [{ label: t('閉じる') }]);
}

// ------------------------------------------------------------- 書き出し
async function doExport(mode) {
  const outDir = $('#export-dir').value.trim();
  const box = $('#export-result');
  box.textContent = t('書き出し中…');
  try {
    // 手書きの YAYA ゴーストにつないでいれば、そのゴーストに書きこむ（手書きにあるイベントは訳さない）
    const link = await YayaLink.exportOptions();
    if (link.linked && mode === 'nar') {
      throw new Error(t('手書きの YAYA ゴーストにつないでいるあいだは、.nar は作れません（つないだゴーストに書きこみます）'));
    }
    const r = await api('/api/export', {
      method: 'POST',
      body: {
        project: Model.project,
        dic: toYaya(programOf(Model.project), { handwritten: link.handwritten }),   // ブロックを YAYA に訳した辞書
        linked: link.linked || '',
        outDir,
        mode,
        includeShell: $('#export-shell').checked,
        overwriteShell: $('#export-overwrite').checked,
      },
    });
    box.textContent = '';
    const p = Render.div('');
    if (r.mode === 'linked') {
      p.innerHTML = t('<b>つないだゴーストに書き出しました</b><br><code>{path}</code><br>書きかえたファイル {count} 個（手書きの辞書には触っていません）',
        { path: escapeHtml(r.root), count: r.written.length });
    } else if (mode === 'nar') {
      p.innerHTML = t('<b>.nar を作りました</b><br><code>{path}</code><br>SSP のウィンドウにドラッグ＆ドロップするとインストールできます。',
        { path: escapeHtml(r.path) });
    } else {
      p.innerHTML = t('<b>書き出しました</b><br><code>{path}</code><br>ファイル {count} 個', { path: escapeHtml(r.root), count: r.written.length }) +
        (r.skipped.length ? t('（既存のシェル {count} 個はそのまま）', { count: r.skipped.length }) : '');
    }
    if (!r.dll) {
      p.appendChild(Render.div('status-line status-ng',
        t('YAYA（yaya.dll）が exe に入っていません。.\\build.ps1 で作りなおしてから書き出し直してください。')));
    }
    const open = Render.el('button', 'btn small', t('フォルダを開く'));
    open.style.marginTop = '8px';
    open.addEventListener('click', () => api('/api/reveal', {
      method: 'POST', body: { path: r.root || r.path },
    }).catch(() => {}));
    p.appendChild(open);
    box.appendChild(p);
    toast(t('書き出しました'));
    Events.emit('exported');
  } catch (e) {
    box.textContent = '';
    box.appendChild(Render.div('status-line status-ng', e.message));
    toast(e.message, true);
  }
}

function init() {
  $('#btn-export-dir').addEventListener('click', () => doExport('dir'));
  $('#btn-export-nar').addEventListener('click', () => doExport('nar'));
  $('#btn-import').addEventListener('click', async () => {
    const p = $('#import-path').value.trim();
    if (!p) return;
    try {
      const r = await api('/api/import', { method: 'POST', body: { path: p } });
      Model.init(r.project);
      Session.vars = {};
      toast(t('読み込みました'));
    } catch (e) { toast(e.message, true); }
  });
}

export const Dialog = { init, saveProject, requestSaveAndClose, openProjectDialog, openSampleDialog, doExport, modal, closeModal };
