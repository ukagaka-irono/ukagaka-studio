/* 伺かスタジオ - 「実行」タブ（ためす・変数のようす・ゴーストの記録） */

import { MOUSE_EVENTS } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { Player } from '../model/player.js';
import { programOf, toYaya } from '../model/yaya.js';
import { $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { provide } from '../core/commands.js';
import { Events } from '../core/events.js';
import { Render } from '../editor/render.js';
import { Tabs } from './tabs.js';
import { Pages } from './pages.js';
import { Stage } from './stage.js';
import { t } from '../i18n/i18n.js';

function renderTargets() {
  const sel = $('#run-target');
  const prev = sel.value;
  sel.textContent = '';
  for (const s of Model.project.scripts) {
    if (s.kind === 'loose') continue;
    const o = Render.el('option', null, Model.scriptTitle(s));
    o.value = s.id;
    sel.appendChild(o);
  }
  if (!sel.childElementCount) {
    const o = Render.el('option', null, t('（まだブロックがありません）'));
    o.value = '';
    sel.appendChild(o);
  }
  // 前に選んでいたものが残っていればそれを、なければ先頭を選ぶ
  if (prev && Model.project.scripts.some((s) => s.id === prev)) sel.value = prev;
  else sel.selectedIndex = 0;
}

/** いま「実行」タブで選んでいるかたまり */
function currentScript() {
  const id = $('#run-target').value;
  return Model.project.scripts.find((s) => s.id === id) || null;
}

// ためすときの Reference。マウス系はブロックで選んだ場所・相手を入れておくと、
// 「イベントの情報」ブロックが本番と同じ値を返す。
function refsFor(script) {
  if (!script || script.kind !== 'event') return [];
  if (script.event === 'OnCommunicate') {
    // 相手の名前・言われたこと。空欄なら、ためすとき用の仮の値を入れる。
    return [script.from || t('ほかのゴースト'), script.contains || t('こんにちは')];
  }
  if (!MOUSE_EVENTS[script.event]) return [];
  const who = script.who >= 0 ? script.who : 0;
  return ['0', '0', '0', String(who), script.area || 'Head'];
}

/**
 * ブロックを動かして、さくらスクリプトをもらう。
 * ブロックを YAYA の辞書に訳して（model/yaya.js）exe に渡し、SSP に入るのと同じ yaya.dll で
 * 動かしてもらいます（studio/src/yaya_preview.cpp）。動きの決まりを画面側に書かないためです。
 */
async function runPreview(script) {
  const meta = Model.project.meta || {};
  return api('/api/preview', {
    method: 'POST',
    body: {
      dic: toYaya(programOf(Model.project)),
      scriptId: script.id,
      refs: refsFor(script),
      vars: Session.vars,
      sys: { ghostName: meta.name || '', shellName: 'master' },
    },
  });
}

async function runScript(script) {
  if (!script) return;
  $('#run-target').value = script.id;
  Pages.show('talk');
  Tabs.switchTab('run');
  let res;
  try {
    res = await runPreview(script);
  } catch (e) {
    $('#script-preview').textContent = t('（ためせませんでした: {message}）', { message: e.message });
    toast(e.message, true);
    return;
  }
  Session.vars = res.vars || {};
  let preview = res.script || t('（なにも出力されませんでした）');
  // 話しかけ先はさくらスクリプトに出ないので、ここで見せる
  if (res.commTo) preview += t('\n\n（「{commTo}」に届きます）', { commTo: res.commTo });
  $('#script-preview').textContent = preview;
  renderVars();
  Stage.playSakura(res.script);
  Events.emit('ran');
}

function renderVars() {
  const box = $('#run-vars');
  box.textContent = '';
  // まだ実行していなくても、プロジェクトの初期値を見せる（何があるか分かるように）
  const shown = {};
  for (const v of Model.project.variables || []) shown[v.name] = v.value;
  Object.assign(shown, Session.vars);
  const names = Object.keys(shown).filter((k) => k[0] !== '@');
  if (!names.length) {
    box.appendChild(Render.div('run-var is-empty', t('まだ変数がありません')));
    return;
  }
  for (const k of names) {
    box.appendChild(Render.div('run-var', `${k}: ${Player.toStr(shown[k])}`));
  }
}

/** ためすときの変数を、プロジェクトの初期値にもどす */
function resetSessionVars() {
  Session.vars = {};
  renderVars();
  toast(t('ためすときの変数を、初期値にもどしました'));
}

/** 書き出したゴーストが覚えている変数（YAYA の yaya_variable.cfg）を消す */
async function resetGhostSave() {
  try {
    const r = await api('/api/save/reset', {
      method: 'POST',
      body: { project: Model.project, outDir: $('#export-dir') ? $('#export-dir').value : '' },
    });
    const n = (r.deleted || []).length;
    toast(n
      ? t('ゴーストの記憶を消しました（{n} か所）。次に動かすと初期値からになります', { n })
      : t('消すものがありませんでした（まだ動かしていないようです）'));
  } catch (e) {
    toast(e.message, true);
  }
}

/** ゴーストの記録（studio_debug.txt）を読む・はじめる・やめる
 *
 * 栞は「ファイルがあるときだけ」書くので、記録をはじめる＝空ファイルを作る、です。
 * SAORI が呼べなかった理由など、画面に出ない事情はここに残ります。
 */
async function ghostLog(action) {
  const box = $('#ghost-log');
  try {
    const r = await api('/api/ghost/log', {
      method: 'POST',
      body: {
        project: Model.project,
        outDir: $('#export-dir') ? $('#export-dir').value : '',
        action: action || '',
      },
    });
    if (!(r.places || []).length) {
      box.textContent = t('まだ書き出していないようです。先に「SSP に入れて動かす」を押してください。');
      return;
    }
    if (action === 'clear') {
      box.textContent = t('記録をやめました。');
      toast(t('記録をやめました'));
      return;
    }
    if (!r.recording) {
      box.textContent = t('いまは記録していません。「記録をはじめる」を押すと、つぎに動かしたときから残ります。');
      return;
    }
    // 長い記録は、exe がうしろの方だけ返します（truncated）
    box.textContent = r.text && r.text.trim()
      ? (r.truncated ? t('（古いところは省いています）') + '\n' : '') + r.text
      : t('記録中です（{path}）。まだ何も書かれていません。\nゴーストを動かしてから、もう一度「読む」を押してください。', { path: r.path });
    box.scrollTop = box.scrollHeight;
    if (action === 'start') toast(t('記録をはじめました'));
  } catch (e) {
    box.textContent = e.message;
    toast(e.message, true);
  }
}

function init() {
  provide({ runScript });

  $('#btn-run').addEventListener('click', () => {
    const s = currentScript();
    if (s) runScript(s);
    else toast(t('実行するかたまりがありません'), true);
  });
  $('#btn-copy-script').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#script-preview').textContent);
      toast(t('コピーしました'));
    } catch { toast(t('コピーできませんでした'), true); }
  });
  $('#btn-vars-reset').addEventListener('click', resetSessionVars);
  $('#btn-save-reset').addEventListener('click', resetGhostSave);
  $('#btn-log-show').addEventListener('click', () => ghostLog(''));
  $('#btn-log-start').addEventListener('click', () => ghostLog('start'));
  $('#btn-log-clear').addEventListener('click', () => ghostLog('clear'));
}

export const Run = { init, render: renderTargets, currentScript, refsFor, runPreview, runScript, renderVars };
