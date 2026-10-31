/* 伺かスタジオ - 保存 / 読込 と 書き出し（ダイアログまわり）
 *
 * exe の中の API を呼んで、プロジェクトの出し入れと、ゴースト一式の書き出しをします。
 */

import { Model } from '../model/model.js';
import { programOf, toYaya } from '../model/yaya.js';
import { diffProjects, diffIsEmpty, countBlocks } from '../model/diff.js';
import { YayaLink } from './yayalink.js';
import { $, escapeHtml } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { updateTitle } from '../core/title.js';
import { Events } from '../core/events.js';
import { Render } from '../editor/render.js';
import { t, getLang } from '../i18n/i18n.js';
import { Search } from './search.js';
import { Pages } from './pages.js';

// ---------------------------------------------------------- 保存 / 読込
/**
 * プロジェクトを保存する。上書きする前のものは、exe が前の版として残します（studio/src/project_history.h）。
 * auto は 1 分ごとの自動保存のしるし（前の版は 10 分おきにだけ残します）
 *
 * 書く先は、開いているファイル（Session.projectName）です。ゴーストの名前を変えても、ほかのプロジェクトには書きません。
 * 新しく作ったもの・お手本・読みこんだもの（Session.projectName が空）は、名前から新しいファイルを作ります
 * （同じ名前のファイルがあれば、exe が「名前 (2)」のようにずらします）。
 */
let saving = null;   // 保存している最中（重なると、新しいものが 2 つのファイルに分かれるので、順番に）
async function saveProject(silent, auto = false) {
  while (saving) { try { await saving; } catch { /* 前の保存の失敗は、その保存が知らせます */ } }
  saving = saveOnce(silent, auto);
  try { return await saving; } finally { saving = null; }
}
async function saveOnce(silent, auto) {
  const name = Model.project.meta.name || t('ゴースト');
  const project = Model.project;
  const sent = JSON.stringify(project);
  const opened = Model.generation;
  try {
    const r = await api('/api/project', { method: 'POST', body: { file: Session.projectName, name, project, auto } });
    // 保存しているあいだに、ほかのプロジェクトを開いていたら、そちらの名前や印にはさわらない
    if (Model.generation !== opened) return true;
    Session.projectName = r.saved;
    // 保存しているあいだに変えたものは、まだ保存していない
    Model.dirty = JSON.stringify(Model.project) !== sent;
    updateTitle();
    if (!silent) toast(t('「{name}」を保存しました', { name: r.saved }));
    // 手で保存したときだけ知らせる（自動保存・閉じるときの保存では、SSP に入れない。panels/ssp.js）
    if (!silent) Events.emit('saved', { auto });
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

// opts.wide … 図のような広いものを出すときに、窓を広くする（panels/graph.js）
function modal(title, bodyEl, buttons, opts = {}) {
  const root = $('#modal-root');
  root.textContent = '';
  const box = Render.div('modal' + (opts.wide ? ' modal-wide' : ''));
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
    // 名前の同じプロジェクトも見分けられるように、ファイル名が名前とちがえば添える
    row.appendChild(Render.div('t', p.file === p.title ? p.title : `${p.title} — ${p.file}`));
    row.appendChild(Render.div('d', new Date(p.updated).toLocaleString('ja-JP')));
    const past = Render.el('button', 'x', '🕘');
    past.title = t('前の版');
    past.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
      setTimeout(() => openHistoryDialog(p.file, p.title), 0);
    });
    row.appendChild(past);
    const x = Render.el('button', 'x', '✕');
    x.title = t('削除');
    x.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(t('「{title}」を削除しますか？', { title: p.title }))) return;
      try {
        await api('/api/project/delete', { method: 'POST', body: { name: p.file } });
      } catch (err) { toast(err.message, true); return; }
      // 開いているものを消したら、自動保存で作りなおさない（このあと変えて保存すると、新しいファイルになります）
      if (p.file === Session.projectName) {
        Session.projectName = '';
        Model.dirty = false;
        updateTitle();
      }
      closeModal();
      openProjectDialog();
    });
    row.appendChild(x);
    row.addEventListener('click', async () => {
      if (Model.dirty && !confirm(t('保存していない変更があります。「{title}」を開きますか？', { title: p.title }))) return;
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
  const buttons = [{ label: t('お手本から始める'), run: () => setTimeout(openSampleDialog, 0) }];
  if (Session.projectName) {
    const name = Session.projectName;
    buttons.push({ label: t('いまのプロジェクトの前の版'), run: () => setTimeout(() => openHistoryDialog(name, name), 0) });
  }
  buttons.push({ label: t('閉じる') });
  modal(t('プロジェクトを開く'), list, buttons);
}

const timeText = (iso) => new Date(iso).toLocaleString(getLang() === 'en' ? 'en-US' : 'ja-JP');

/** 保存したプロジェクトの前の版をえらんで開く（file は projects\ のファイル名） */
async function openHistoryDialog(file, title) {
  let r;
  try { r = await api('/api/project/history?name=' + encodeURIComponent(file)); } catch (e) { toast(e.message, true); return; }
  const list = Render.div('');
  list.appendChild(Render.div('hint', r.versions.length
    ? t('保存するたびに、上書きする前のものを残しています（自動保存は 10 分おき・新しいほうから 30 こ）。えらぶと、その版を開きます。')
    : t('まだ前の版がありません。保存しなおすと、上書きする前のものが残ります。')));
  for (const v of r.versions) {
    const row = Render.div('proj-row');
    row.appendChild(Render.div('t', timeText(v.time)));
    if (typeof v.scripts === 'number') row.appendChild(Render.div('d', t('かたまり {n} こ', { n: v.scripts })));
    // いま開いているプロジェクトの版なら、いまとのちがいを見られる（段階 7-6）
    if (file === Session.projectName) {
      const cmp = Render.el('button', 'btn small', t('いまとくらべる'));
      cmp.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const data = await api('/api/project/version?name=' + encodeURIComponent(file) + '&id=' + encodeURIComponent(v.id));
          showDiff(Model.normalize(data), timeText(v.time), file, title);
        } catch (err) { toast(err.message, true); }
      });
      row.appendChild(cmp);
    }
    row.addEventListener('click', async () => {
      if (Model.dirty && !confirm(t('保存していない変更があります。前の版を開きますか？'))) return;
      try {
        const data = await api('/api/project/version?name=' + encodeURIComponent(file) + '&id=' + encodeURIComponent(v.id));
        Model.init(data);
        Session.projectName = file;
        Session.vars = {};
        Model.dirty = true;     // 保存すると、いまの版のかわりになります（いまの版も前の版として残ります）
        updateTitle();
        closeModal();
        toast(t('{time} の版を開きました。保存すると、これがいまの版になります（いまの版も前の版として残ります）', { time: timeText(v.time) }));
      } catch (e) { toast(e.message, true); }
    });
    list.appendChild(row);
  }
  modal(t('「{title}」の前の版', { title }), list, [
    { label: t('もどる'), run: () => setTimeout(openProjectDialog, 0) },
    { label: t('閉じる') },
  ]);
}

// ゴーストの情報・設定の欄の名前（ちがいの一覧で使う）
const FIELD_LABELS = {
  name: () => t('ゴーストの名前'), sakuraName: () => t('本体（さくら）の名前'), keroName: () => t('相方（うにゅう）の名前'),
  craftman: () => t('作者名'), craftmanUrl: () => t('作者URL'), homeUrl: () => t('更新のありか'), version: () => t('バージョン'),
  description: () => t('説明'), lang: () => t('ゴーストの言語'), readme: () => t('readme.txt に書くこと'),
  randomTalkEnabled: () => t('自動でしゃべる'), randomTalkInterval: () => t('しゃべる間隔（秒）'),
  noRepeatCount: () => t('同じトークを避ける数（0＝おまかせ）'),
};

function valueText(v) {
  if (v === undefined || v === null || v === '') return t('（なし）');
  if (typeof v === 'boolean') return v ? t('はい') : t('いいえ');
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}

/** 前の版（old）と、いまのプロジェクトのちがいを見せる（段階 7-6）。足したもの・変えたかたまりは、押すとそこへ動く */
function showDiff(old, when, file, title) {
  const d = diffProjects(old, Model.project);
  const body = Render.div('diff');
  body.appendChild(Render.div('hint', t('{time} の版から、いままでに変わったところです（かたまりの置き場所だけのちがいは数えません）。', { time: when })));
  if (diffIsEmpty(d)) body.appendChild(Render.div('check-ok', t('ちがいはありません')));
  const mark = { added: '＋', removed: '－', changed: '＊' };
  const section = (label) => body.appendChild(Render.div('missing-head', label));
  if (d.scripts.length) {
    section(t('かたまり'));
    for (const c of d.scripts) {
      const s = c.after || c.before;
      const row = Render.el(c.after ? 'button' : 'div', 'diff-row is-' + c.kind);
      let text = `${mark[c.kind]} ${Model.scriptTitle(s)}`;
      if (c.kind === 'changed') {
        const n0 = countBlocks(c.before.blocks);
        const n1 = countBlocks(c.after.blocks);
        text += n0 === n1 ? t('（ブロック {n} こ）', { n: n1 }) : t('（ブロック {a} → {b} こ）', { a: n0, b: n1 });
      }
      row.textContent = text;
      if (c.after) {
        row.title = t('クリックでその場所へ移動します');
        row.addEventListener('click', () => {
          closeModal();
          Pages.show('talk');
          setTimeout(() => Search.jumpTo({ script: c.after }), 120);   // キャンバスを描いてから
        });
      }
      body.appendChild(row);
    }
  }
  if (d.variables.length) {
    section(t('変数'));
    for (const c of d.variables) {
      const text = c.kind === 'changed'
        ? t('{name}（はじめの値 {a} → {b}）', { name: c.name, a: valueText(c.before), b: valueText(c.after) })
        : t('{name}（はじめの値 {v}）', { name: c.name, v: valueText(c.kind === 'added' ? c.after : c.before) });
      body.appendChild(Render.div('diff-row is-' + c.kind, `${mark[c.kind]} ${text}`));
    }
  }
  const fields = d.meta.concat(d.settings);
  if (fields.length) {
    section(t('ゴーストの情報と設定'));
    for (const c of fields) {
      const label = FIELD_LABELS[c.key] ? FIELD_LABELS[c.key]() : c.key;
      body.appendChild(Render.div('diff-row is-changed', `＊ ${label}: ${valueText(c.before)} → ${valueText(c.after)}`));
    }
  }
  modal(t('{time} の版とのちがい', { time: when }), body, [
    { label: t('もどる'), run: () => setTimeout(() => openHistoryDialog(file, title), 0) },
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
      Session.projectName = '';          // 保存すると、新しいファイルを作る（同じ名前のプロジェクトは上書きしない）
      Session.vars = {};
      toast(t('読み込みました'));
    } catch (e) { toast(e.message, true); }
  });
}

export const Dialog = { init, saveProject, requestSaveAndClose, openProjectDialog, openHistoryDialog, openSampleDialog, doExport, modal, closeModal };
