/* テスト用の道具箱 — 栞を動かして、応答をほどく
 *
 * parity.js（プレビューとの一致テスト）と behavior.js（栞のふるまいテスト）で共用します。
 *
 * 動かせる相手は 3 つあります。どれも同じ形で応答を返すので、同じ読みかたで比べられます。
 *   run        … shiori\dist\test_host.exe    32bit の栞（SSP に入るもの）
 *   runPreview … studio\test\preview_host.exe 64bit のスタジオに積んだ、同じ栞
 *   runYaya    … test_host.exe --dll yaya.dll  YAYA（段階 3 で如何栞と置きかえるもの）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..', '..');
const dllSrc = path.join(root, 'shiori', 'dist', 'ikaga.dll');
const testHost = path.join(root, 'shiori', 'dist', 'test_host.exe');
const previewHost = path.join(root, 'studio', 'test', 'preview_host.exe');
const yayaDll = path.join(root, 'third_party', 'yaya', 'yaya.dll');
const yayaBase = path.join(root, 'third_party', 'yaya-dic', 'yaya_base');

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', off: '\x1b[0m' };

function requireBuild() {
  if (!fs.existsSync(testHost)) {
    throw new Error('test_host.exe がありません。先に .\\build.ps1 -Test を実行してください。');
  }
  if (!fs.existsSync(dllSrc)) throw new Error(`ikaga.dll がありません: ${dllSrc}`);
}

/** 栞は自分と同じフォルダの ghost.json を読むので、DLL を置いて、前回の保存を消す */
function prepare(dir) {
  requireBuild();
  fs.copyFileSync(dllSrc, path.join(dir, 'ikaga.dll'));
  // テスト用のおそい SAORI も、ゴーストのフォルダに置く（あれば）
  const saori = path.join(root, 'shiori', 'dist', 'slow_saori.dll');
  if (fs.existsSync(saori)) fs.copyFileSync(saori, path.join(dir, 'slow_saori.dll'));
  for (const junk of ['ikaga_save.json', 'ikaga_debug.txt']) {
    const p = path.join(dir, junk);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

/** test_host / preview_host の出力を [{ value, commTo, status, age }] にほどく */
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
 * 32bit の栞（SSP に入るもの）にイベントを順に投げる。
 * specs は "OnBoot" か "OnMouseClick:0,0,0,0,Head" の形。
 */
function run(dir, specs) {
  prepare(dir);
  noSpaces(specs, 'test_host');
  return parse(execFileSync(testHost, [dir, ...specs], { encoding: 'utf8', maxBuffer: 1 << 24 }));
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

/**
 * 伺かスタジオに積んだ栞（64bit）で、同じかたまりを動かす。
 * specs は "p01" か "p27:参照0,参照1" の形（イベント名ではなく、かたまりの id）。
 */
function runPreview(projectPath, specs) {
  if (!fs.existsSync(previewHost)) {
    throw new Error('preview_host.exe がありません。先に .\\build.ps1 -Test を実行してください。');
  }
  noSpaces(specs, 'preview_host');
  return parse(execFileSync(previewHost, [projectPath, ...specs],
    { encoding: 'utf8', maxBuffer: 1 << 24 }));
}

/**
 * "*回数" を付けた spec は test_host が繰り返すが、応答が空の回は表示しない。
 * 繰り返しの結果をきちんと数えたいときは、この形で展開して投げる。
 */
function repeat(spec, times) {
  return new Array(times).fill(spec);
}

module.exports = {
  root, run, runPreview, runYaya, runYayaProgram, yayaTranslator, prepare, repeat, COLOR,
  testHost, previewHost, dllSrc, yayaDll,
};
