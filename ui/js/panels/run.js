/* 伺かスタジオ - 「実行」タブ（ためす・変数のようす・ゴーストの記録） */

import { MOUSE_EVENTS } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { Player } from '../model/player.js';
import { programOf, toYaya } from '../model/yaya.js';
import { dicFunctionNames, dicIssues } from '../model/dics.js';
import { Lint } from '../model/lint.js';
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
  // プロジェクトの辞書の関数（段階 8-7。「call:関数の名前」で動かす）
  const names = dicFunctionNames(Model.project);
  if (names.length) {
    const group = Render.el('optgroup');
    group.label = t('辞書の関数');
    for (const n of names) {
      const o = Render.el('option', null, n);
      o.value = 'call:' + n;
      group.appendChild(o);
    }
    sel.appendChild(group);
  }
  if (!sel.querySelector('option')) {
    const o = Render.el('option', null, t('（まだブロックがありません）'));
    o.value = '';
    sel.appendChild(o);
  }
  // 前に選んでいたものが残っていればそれを、なければ先頭を選ぶ
  if (prev && Array.from(sel.querySelectorAll('option')).some((o) => o.value === prev)) sel.value = prev;
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
  // メニューの項目は、えらばれたかたまりの id が Reference0 に来る（model/yaya.js の sakura.recommendsites）
  if (script.event === 'OnStudioMenu') return [script.id];
  // キー（段階 7-2）。数ならキーコードとして、文字ならキーの文字として渡す
  if (script.event === 'OnKeyPress') {
    const key = String(script.key || '').trim() || 'f1';
    return /^\d+$/.test(key) ? ['', key] : [key, ''];
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
  return previewRequest(script.id, refsFor(script));
}

/**
 * プログラムを動かす・ファイルを書きかえるなどの関数（Lint.riskyCode）をよぶ YAYA が入っていたら、「ためす」の前に一度だけ確かめる。
 * 「ためす」も本物の yaya.dll で動かすので、人からもらったプロジェクトのコードが、このパソコンでそのまま動くため。
 * よんでいる関数が変わったら、もう一度たずねます
 */
let allowedCode = '';
function codeAllowed(install = false) {
  const risky = Lint.riskyCode(Model.project);
  if (!risky.length) return true;
  const names = [...new Set(risky.map((r) => r.name))].sort().join(', ');
  const key = (Model.project.meta || {}).name + '\n' + names;
  if (allowedCode === key) return true;
  const ok = confirm(install
    ? t('このプロジェクトの YAYA は、このパソコンでプログラムを動かしたり、ファイルを書きかえたりできる関数（{names}）をよんでいます。SSP に入れると本当に動きます。\n\n自分で書いたものか、信頼できる人からもらったものだけ、入れてください。SSP に入れますか？', { names })
    : t('このプロジェクトの YAYA は、このパソコンでプログラムを動かしたり、ファイルを書きかえたりできる関数（{names}）をよんでいます。「ためす」でも本当に動きます。\n\n自分で書いたものか、信頼できる人からもらったものだけ、ためしてください。ためしますか？', { names }));
  if (ok) allowedCode = key;
  return ok;
}

/**
 * scriptId はかたまりの id か「event:イベント名」（SSP と同じえらびかたで、そのイベントを動かす）か「call:関数の名前」。
 * プロジェクトの辞書もいっしょに渡し（段階 8-7）、辞書にあるイベントは、書き出したゴーストと同じく辞書の関数を動かします
 */
function previewRequest(scriptId, refs) {
  if (!codeAllowed()) return Promise.reject(new Error(t('ためすのをやめました。チェックタブで、プログラムやファイルにさわる YAYA を確かめてください。')));
  const meta = Model.project.meta || {};
  const handwritten = dicFunctionNames(Model.project);
  if (scriptId.startsWith('event:') && handwritten.includes(scriptId.slice(6))) scriptId = 'call:' + scriptId.slice(6);
  return api('/api/preview', {
    method: 'POST',
    body: {
      dic: toYaya(programOf(Model.project), { handwritten }),
      dics: (Model.project.dics || []).map((d) => ({ name: d.name, text: d.text })),
      scriptId,
      refs,
      vars: Session.vars,
      sys: { ghostName: meta.name || '', shellName: 'master' },
    },
  });
}

/** プロジェクトの辞書の関数を動かす（段階 8-7。「実行」タブの「辞書の関数」と、辞書の画面のかたまりの ▶） */
/**
 * 「ためす」がうまくいかなかったときの文。辞書にチェックタブの ⛔（かぶった関数・読めない行など）があると、
 * YAYA は辞書をまるごと読まず「答えがない」としか言えないので、そのことを足します
 */
function previewError(e) {
  let broken = 0;
  dicIssues(Model.project, (level) => { if (level === 'error') broken++; });
  return broken ? t('{message}（辞書にまちがいがあると、YAYA は辞書をまるごと読みません。チェックタブを見てください）', { message: e.message }) : e.message;
}

async function runDicFunction(name) {
  $('#run-target').value = 'call:' + name;
  Pages.show('talk');
  Tabs.switchTab('run');
  let res;
  try {
    res = await previewRequest('call:' + name, []);
  } catch (e) {
    const message = previewError(e);
    $('#script-preview').textContent = t('（ためせませんでした: {message}）', { message });
    toast(message, true);
    return;
  }
  showResult(res);
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
    const message = previewError(e);
    $('#script-preview').textContent = t('（ためせませんでした: {message}）', { message });
    toast(message, true);
    return;
  }
  showResult(res);
}

/**
 * イベントを、SSP と同じえらびかたで動かす（「ためす」の立ち絵をさわったとき。panels/touch.js）。
 * どのかたまりも合わなければ、ブロックが無いときの反応が返ります。
 */
async function runEvent(event, refs) {
  let res;
  try {
    res = await previewRequest('event:' + event, refs || []);
  } catch (e) {
    toast(previewError(e), true);
    return;
  }
  const where = refs && refs[4] ? `（${refs[4]}）` : '';
  toast(t('{event}{where} をためしました', { event, where }));
  showResult(res);
}

/**
 * ランダムトークを 100 回引いて、どれが何回出るかを見せる（段階 7-5）。引くのは SSP と同じ YAYA のえらびかた
 * （studio_runtime.dic の Studio.DrawTalks。しぼり込み・えらばれやすさ・続けて出さない決まり）で、トークは動かしません。
 * しぼり込みは、いまの時刻と、いまの変数（「ためす」の続き）で見ます
 */
async function drawTalks(times = 100) {
  let res;
  try {
    res = await previewRequest('draw:' + times, []);
  } catch (e) {
    toast(previewError(e), true);
    return;
  }
  const draws = res.draws || {};
  const talks = (Model.project.scripts || []).filter((s) => s.kind === 'talk' && !s.disabled);
  const rows = talks.map((s) => ({ title: s.name || Model.scriptTitle(s), n: Number(draws[s.id]) || 0 }))
    .sort((a, b) => b.n - a.n);
  const lines = [t('ランダムトークを {times} 回引きました（いまの時刻と変数で。続けて出さない決まりもふくみます）', { times }), ''];
  if (!rows.length) lines.push(t('ランダムトークがありません'));
  for (const r of rows) {
    const bar = '█'.repeat(Math.round((r.n / times) * 15));   // せまい欄でも 1 行に収まるように
    lines.push(`${String(r.n).padStart(4)}  ${bar}${bar ? ' ' : ''}${r.title}`);
  }
  if (res.none) lines.push('', t('（出せるトークが無かった回: {n}）', { n: res.none }));
  $('#script-preview').textContent = lines.join('\n');
}

function showResult(res) {
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
  provide({ runScript, runDicFunction });

  $('#btn-draw').addEventListener('click', () => drawTalks(100));
  $('#btn-run').addEventListener('click', () => {
    const value = $('#run-target').value;
    if (value.startsWith('call:')) { runDicFunction(value.slice(5)); return; }
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

export const Run = { init, codeAllowed, render: renderTargets, currentScript, refsFor, runPreview, runScript, runEvent, renderVars };
