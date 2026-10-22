/* テスト用の道具箱 — ブロックを YAYA で動かして、応答をほどく
 *
 * parity.js（一致テスト）・behavior.js（ふるまいテスト）・yaya.js で共用します。
 *
 *   runYaya        … test_host.exe --dll yaya.dll で、用意したゴーストにイベントを順に投げる（SSP のかわり）
 *   runYayaProgram … ghost.json（ブロック）を YAYA に訳してから、runYaya で動かす
 *   runYayaPreview … 「ためす」と同じやりかた（yaya_host.exe と studio_preview.dic）で、かたまりを 1 つ動かす
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..', '..');
const testHost = path.join(root, 'shiori', 'dist', 'test_host.exe');
const yayaDll = path.join(root, 'third_party', 'yaya', 'yaya.dll');
const yayaBase = path.join(root, 'third_party', 'yaya-dic', 'yaya_base');

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', off: '\x1b[0m' };

/** test_host の出力を [{ value, commTo, status, age }] にほどく */
function parse(raw) {
  const out = [];
  let cur = null;
  for (const rawLine of raw.split('\n')) {
    // 応答そのものが \r\n を持っていて、それを printf がテキストモードで書くので
    // 行末が \r\r\n になる。まとめて落とす。
    const line = rawLine.replace(/\r+$/, '');
    if (line.startsWith('---- ')) {
      cur = { value: '', commTo: '', status: '', age: '' };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('SHIORI/3.0 ')) cur.status = line.slice(11);
    else if (line.startsWith('Value: ')) cur.value = line.slice(7);
    else if (line.startsWith('Reference0: ')) cur.commTo = line.slice(12);
    else if (line.startsWith('Age: ')) cur.age = line.slice(5);
  }
  return out;
}

function noSpaces(specs, who) {
  for (const spec of specs) {
    if (spec.includes(' ')) throw new Error(`Reference に空白は使えません（${who} の都合）: ${spec}`);
  }
}

/**
 * YAYA（third_party\yaya\yaya.dll）にイベントを順に投げる。
 * dir には yaya.txt と辞書を置いておく。yaya.dll と受け口の辞書 yaya_base はここで置き、
 * 前回の変数の保存（yaya_variable.cfg）は消す。
 */
function runYaya(dir, specs, keepSave = false) {
  if (!fs.existsSync(testHost)) {
    throw new Error('test_host.exe がありません。先に .\\build.ps1 -Test を実行してください。');
  }
  if (!fs.existsSync(yayaDll)) throw new Error(`yaya.dll がありません: ${yayaDll}`);
  fs.copyFileSync(yayaDll, path.join(dir, 'yaya.dll'));
  fs.cpSync(yayaBase, path.join(dir, 'yaya_base'), { recursive: true });
  const saved = path.join(dir, 'yaya_variable.cfg');
  if (!keepSave && fs.existsSync(saved)) fs.unlinkSync(saved);
  noSpaces(specs, 'test_host');
  return parse(execFileSync(testHost, ['--dll', 'yaya.dll', dir, ...specs],
    { encoding: 'utf8', maxBuffer: 1 << 24 }));
}

const yayaRuntime = path.join(root, 'studio', 'res', 'yaya', 'studio_runtime.dic');
const yayaWork = path.join(root, 'shiori', 'test', 'yaya', 'work');

/** ブロックを YAYA に訳すところ（ui/js/model/yaya.js。ES モジュールなので import で読む） */
async function yayaTranslator() {
  const { pathToFileURL } = require('url');
  return import(pathToFileURL(path.join(root, 'ui', 'js', 'model', 'yaya.js')).href);
}

/**
 * ghost.json（書き出す形）を YAYA に訳して、YAYA でイベントを順に投げる。
 * 作業用のゴーストは shiori\test\yaya\work\<name>\ に作ります（毎回作りなおし）。
 * keepSave なら、前回の変数の保存（yaya_variable.cfg）を残したまま起動しなおします。
 */
async function runYayaProgram(name, program, specs, keepSave = false) {
  const { toYaya, yayaTxt } = await yayaTranslator();
  const dir = path.join(yayaWork, name);
  if (!keepSave) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'yaya.txt'), yayaTxt());
  fs.copyFileSync(yayaRuntime, path.join(dir, 'studio_runtime.dic'));
  fs.writeFileSync(path.join(dir, 'studio_program.dic'), toYaya(program));
  // テスト用のおそい SAORI も、ゴーストのフォルダに置く（あれば）
  const saori = path.join(root, 'shiori', 'dist', 'slow_saori.dll');
  if (fs.existsSync(saori)) fs.copyFileSync(saori, path.join(dir, 'slow_saori.dll'));
  return runYaya(dir, specs, keepSave);
}

const yayaHost = path.join(root, 'shiori', 'dist', 'yaya_host.exe');
const yayaPreviewDic = path.join(root, 'studio', 'res', 'yaya', 'studio_preview.dic');

/**
 * 「ためす」と同じやりかたで、YAYA でかたまりを 1 つ動かす（yaya_host.exe と studio_preview.dic）。
 * input は { vars, sys, refs }。答えは { script, commTo, vars } か { error }。
 */
async function runYayaPreview(name, program, scriptId, input) {
  const { toYaya, yayaTxt } = await yayaTranslator();
  if (!fs.existsSync(yayaHost)) {
    throw new Error('yaya_host.exe がありません。先に .\\build.ps1 を実行してください。');
  }
  const dir = path.join(yayaWork, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(yayaDll, path.join(dir, 'yaya.dll'));
  fs.cpSync(yayaBase, path.join(dir, 'yaya_base'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'yaya.txt'), yayaTxt() + 'dic, studio_preview.dic\r\n');
  fs.copyFileSync(yayaRuntime, path.join(dir, 'studio_runtime.dic'));
  fs.copyFileSync(yayaPreviewDic, path.join(dir, 'studio_preview.dic'));
  fs.writeFileSync(path.join(dir, 'studio_program.dic'), toYaya(program));
  const saved = path.join(dir, 'yaya_variable.cfg');
  if (fs.existsSync(saved)) fs.unlinkSync(saved);

  const req = ['GET SHIORI/3.0', 'Charset: UTF-8', 'Sender: UkagakaStudio', 'SecurityLevel: local',
    'ID: OnStudioPreview', `Reference0: ${scriptId}`, `Reference1: ${JSON.stringify(input || {})}`, '', ''].join('\r\n');
  const out = execFileSync(yayaHost, [dir], { input: Buffer.from(req, 'utf8'), maxBuffer: 1 << 24 }).toString('utf8');
  const line = out.split('\r\n').find((l) => l.startsWith('Value: '));
  if (!line) throw new Error(`YAYA が答えませんでした:\n${out}`);
  return JSON.parse(line.slice(7));
}

/**
 * "*回数" を付けた spec は test_host が繰り返すが、応答が空の回は表示しない。
 * 繰り返しの結果をきちんと数えたいときは、この形で展開して投げる。
 */
function repeat(spec, times) {
  return new Array(times).fill(spec);
}

module.exports = {
  root, runYaya, runYayaProgram, runYayaPreview, yayaTranslator, repeat,
  COLOR, testHost, yayaDll, yayaHost,
};
