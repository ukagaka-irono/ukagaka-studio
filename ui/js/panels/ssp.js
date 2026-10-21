/* 伺かスタジオ - 動いているゴーストとの連携（SSTP）
 *
 * SSP を見つけて、いま組んでいるトークをその場のゴーストに喋らせたり、
 * 書き出したゴーストを SSP に入れたりします。
 */

import { Model } from '../model/model.js';
import { $, escapeHtml } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { Events } from '../core/events.js';
import { Render } from '../editor/render.js';
import { Run } from './run.js';
import { Pages } from './pages.js';
import { t } from '../i18n/i18n.js';

// -------------------------------------------------------------- SSP 連携
function describeSsp(ssp) {
  if (!ssp) return { text: t('SSP: 確認できません'), ok: false };
  if (ssp.sstp) {
    return { text: ssp.ghost ? t('SSP: つながっています（{ghost}）', { ghost: ssp.ghost }) : t('SSP: つながっています'), ok: true };
  }
  if (ssp.running) return { text: t('SSP: 起動中（SSTP の応答なし）'), ok: false };
  if (ssp.exe) return { text: t('SSP: 見つかりました（停止中）'), ok: false };
  return { text: t('SSP: 見つかりません'), ok: false };
}

async function refreshSsp() {
  let ssp = null;
  try { ssp = await api('/api/ssp'); } catch (e) { /* 表示だけ更新する */ }
  Session.ssp = ssp;

  const badge = $('#ssp-status');
  const info = describeSsp(ssp);
  badge.textContent = info.text;
  badge.classList.toggle('is-off', !info.ok);
  $('#btn-run-ssp').disabled = !info.ok;
  $('#btn-send-event').disabled = !info.ok;
  $('#btn-send-comm').disabled = !info.ok;

  const box = $('#ssp-info');
  if (box) {
    box.className = 'status-line ' + (info.ok ? 'status-ok' : 'status-ng');
    let text = info.text;
    if (ssp && ssp.ghostDir) text += `\n${ssp.ghostDir}`;
    else text += t('\n下の欄に ssp.exe の場所を入れてください。');
    box.textContent = text;
    box.style.whiteSpace = 'pre-wrap';
  }
  const install = $('#btn-ssp-install');
  if (install) install.disabled = !(ssp && ssp.ghostDir);
  const launch = $('#btn-ssp-launch');
  if (launch) launch.disabled = !(ssp && ssp.exe) || (ssp && ssp.running);
  if (ssp && ssp.exe && !$('#ssp-path').value) $('#ssp-path').value = ssp.exe;
  return ssp;
}

async function sendScriptToSsp() {
  const script = Run.currentScript();
  if (!script) { toast(t('実行するかたまりがありません'), true); return; }
  let res;
  try {
    res = await Run.runPreview(script);
  } catch (e) { toast(e.message, true); return; }
  Session.vars = res.vars || {};
  $('#script-preview').textContent = res.script || t('（なにも出力されませんでした）');
  Run.renderVars();
  if (!res.script) { toast(t('出力がありませんでした'), true); return; }
  try {
    await api('/api/ssp/script', { method: 'POST', body: { script: res.script } });
    toast(t('SSP のゴーストに送りました'));
  } catch (e) {
    toast(e.message, true);
    refreshSsp();
  }
}

async function sendEventToSsp() {
  const script = Run.currentScript();
  if (!script) return;
  if (script.kind !== 'event') {
    toast(t('イベントのかたまりを選んでください'), true);
    return;
  }
  try {
    await api('/api/ssp/notify', { method: 'POST', body: { event: script.event, refs: Run.refsFor(script) } });
    toast(t('{event} を送りました（SSP に入れたゴーストが反応します）', { event: script.event }));
  } catch (e) {
    toast(e.message, true);
    refreshSsp();
  }
}

// 他のゴーストのふりをして、動いているゴーストに話しかける。
// 「話しかけられたとき」のブロックを、本物のゴーストで試すためのもの。
async function sendCommToSsp() {
  const script = Run.currentScript();
  const isComm = script && script.kind === 'event' && script.event === 'OnCommunicate';
  // 「話しかけられたとき」を選んでいれば、その条件どおりの内容で話しかける
  const sender = (isComm && script.from) || t('ほかのゴースト');
  const sentence = (isComm && script.contains) || t('こんにちは');
  try {
    await api('/api/ssp/communicate', { method: 'POST', body: { sentence, sender } });
    toast(t('「{sender}」が「{sentence}」と話しかけました', { sender, sentence }));
  } catch (e) {
    toast(e.message, true);
    refreshSsp();
  }
}

async function installToSsp() {
  const box = $('#ssp-result');
  box.textContent = t('SSP に入れています…');
  try {
    const r = await api('/api/ssp/install', {
      method: 'POST',
      body: {
        project: Model.project,
        includeShell: $('#export-shell').checked,
        overwriteShell: $('#export-overwrite').checked,
        activate: true,
      },
    });
    const notes = {
      reload: t('入れ直して、栞を読み込み直しました。すぐ反映されています。'),
      change: t('SSP のゴーストを切り替えました。切り替わらないときは、新しいゴーストなので SSP を再起動してください。'),
      none: t('書き出しました。SSP を起動（または再起動）すると反映されます。'),
      failed: t('書き出しましたが、SSP への指示は届きませんでした。'),
    };
    box.innerHTML =
      t('<b>{folder}</b> を入れました（{files} ファイル）<br>', { folder: escapeHtml(r.folder), files: r.files }) +
      `<code>${escapeHtml(r.root)}</code><br>${escapeHtml(notes[r.action] || '')}`;
    toast(t('SSP に入れました'));
    Events.emit('installed');
    refreshSsp();
  } catch (e) {
    box.textContent = '';
    box.appendChild(Render.div('status-line status-ng', e.message));
    toast(e.message, true);
  }
}

function init() {
  $('#btn-run-ssp').addEventListener('click', sendScriptToSsp);
  $('#btn-send-event').addEventListener('click', sendEventToSsp);
  $('#btn-send-comm').addEventListener('click', sendCommToSsp);
  $('#btn-ssp-install').addEventListener('click', installToSsp);
  $('#btn-ssp-refresh').addEventListener('click', async () => {
    await refreshSsp();
    toast(t('SSP の状態を確認しました'));
  });
  $('#btn-ssp-launch').addEventListener('click', async () => {
    try {
      await api('/api/ssp/launch', { method: 'POST', body: {} });
      toast(t('SSP を起動しました'));
      setTimeout(refreshSsp, 2500);
    } catch (e) { toast(e.message, true); }
    refreshSsp();
  });
  $('#btn-ssp-path').addEventListener('click', async () => {
    try {
      await api('/api/ssp/path', { method: 'POST', body: { path: $('#ssp-path').value.trim() } });
      await refreshSsp();
      toast(t('SSP の場所を覚えました'));
    } catch (e) { toast(e.message, true); }
  });
  // SSP のようすが要るところ（書き出しの画面・ためすのタブ）を開いたら、たしかめなおす
  Pages.onShow((name) => { if (name === 'export') refreshSsp(); });
  const runTab = document.querySelector('.side-tab[data-tab="run"]');
  if (runTab) runTab.addEventListener('click', refreshSsp);
  refreshSsp();
  setInterval(refreshSsp, 30000);
}

export const Ssp = { init, refreshSsp, sendScriptToSsp, sendEventToSsp, sendCommToSsp, installToSsp };
