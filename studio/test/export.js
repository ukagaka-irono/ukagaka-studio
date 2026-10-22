/* 書き出しの答え合わせテスト
 *
 *   node studio\test\export.js            見くらべる
 *   node studio\test\export.js --update   いまの出力を期待値として保存しなおす
 *
 * 栞のほうは parity / behavior で守られていますが、スタジオが書き出すファイル
 * （surfaces.txt・descript.txt・ghost.json・yaya.txt・studio_program.dic）は形が崩れても気づけませんでした。
 * ここで材料のプロジェクトを export_host.exe に流して、出てきた中身を
 * studio/test/expected/ の期待値とバイトで見くらべます。
 *
 * ブロックを YAYA に訳した辞書（studio_program.dic）は画面（ui/js/model/yaya.js）が作るので、
 * ここで同じものを作って export_host に --dic で渡します。
 *
 * updates2.dau だけは期待値ファイルではなく、node の crypto で計算した MD5 と
 * 突き合わせます（同じ計算をもう一度書くのではなく、別の実装と合うかを見ます）。
 *
 * 書き出しかたを変えたときは、出てきたものを目で確かめてから --update してください。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const here = __dirname;
const root = path.resolve(here, '..', '..');
const host = path.join(root, 'studio', 'test', 'export_host.exe');
const fixtureDir = path.join(here, 'fixture');
const expectDir = path.join(here, 'expected');

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', off: '\x1b[0m' };
const { red, green, dim, off } = COLOR;

const update = process.argv.includes('--update');

if (!fs.existsSync(host)) {
  console.error(`${red}[export] export_host.exe がありません。先に .\\build.ps1 -Test を実行してください。${off}`);
  process.exit(2);
}

/** export_host を動かして、出てきたバイト列を返す */
function run(args) {
  return execFileSync(host, args, { encoding: 'buffer', maxBuffer: 1 << 26 });
}

// 材料ごとの studio_program.dic（画面と同じ ui/js/model/yaya.js で訳す。ES モジュールなので別の node で）
const dicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-dic-'));
process.on('exit', () => fs.rmSync(dicDir, { recursive: true, force: true }));
function dicFor(fixture) {
  const out = path.join(dicDir, `${fixture}.dic`);
  if (!fs.existsSync(out)) {
    const yaya = require('url').pathToFileURL(path.join(root, 'ui', 'js', 'model', 'yaya.js')).href;
    const code = `import { toYaya, programOf } from ${JSON.stringify(yaya)};
import fs from 'fs';
const p = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
fs.writeFileSync(process.argv[2], toYaya(programOf(p)));`;
    execFileSync(process.execPath, ['--input-type=module', '-e', code, path.join(fixtureDir, fixture), out]);
  }
  return out;
}

let failed = 0;
let checked = 0;

/** 期待値ファイルと見くらべる（--update なら書きなおす） */
function compare(name, got) {
  const file = path.join(expectDir, name);
  checked++;
  if (update) {
    fs.mkdirSync(expectDir, { recursive: true });
    fs.writeFileSync(file, got);
    console.log(`${dim}  保存 ${name}${off}`);
    return;
  }
  if (!fs.existsSync(file)) {
    failed++;
    console.log(`${red}  だめ ${name}: 期待値がありません（--update で作れます）${off}`);
    return;
  }
  const want = fs.readFileSync(file);
  if (Buffer.compare(want, got) === 0) {
    console.log(`${green}  OK  ${off}${name}`);
    return;
  }
  failed++;
  console.log(`${red}  だめ ${name}${off}`);
  showDiff(want.toString('utf8'), got.toString('utf8'));
}

/** 最初に食いちがった行のまわりだけ見せる */
function showDiff(want, got) {
  const a = want.split('\n');
  const b = got.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    console.log(`        ${i + 1} 行目`);
    console.log(`        ほしい: ${JSON.stringify(a[i])}`);
    console.log(`        出た  : ${JSON.stringify(b[i])}`);
    const rest = Math.max(a.length, b.length) - i - 1;
    if (rest > 0) console.log(`        ${dim}（ほかにも ${rest} 行あります）${off}`);
    return;
  }
}

// ------------------------------------------------- 書き出したファイルの中身
const cases = [
  ['ghost.json', 'shell/master/surfaces.txt', 'surfaces.txt'],
  ['ghost.json', 'ghost/master/descript.txt', 'descript.txt'],
  ['ghost.json', 'ghost/master/ghost.json', 'program.json'],
  ['ghost.json', 'install.txt', 'install.txt'],
  ['plain.json', 'ghost/master/descript.txt', 'descript-plain.txt'],
  ['balloon.json', 'balloon/descript.txt', 'balloon-descript.txt'],
  ['balloon.json', 'install.txt', 'balloon-install.txt'],
  // 名前が空のときは「あたらしいゴースト」になる（どこにも空の name が出ない）
  ['noname.json', 'install.txt', 'noname-install.txt'],
  ['noname.json', 'ghost/master/descript.txt', 'noname-descript.txt'],
  ['noname.json', 'balloon/descript.txt', 'noname-balloon-descript.txt'],
  ['noname.json', 'readme.txt', 'noname-readme.txt'],
  // ゴーストの言語が English のとき（readme.txt・名前が空のときの名前・バルーンの名前・ghost.json の meta.lang）
  ['en.json', 'readme.txt', 'en-readme.txt'],
  ['en.json', 'ghost/master/descript.txt', 'en-descript.txt'],
  ['en.json', 'balloon/descript.txt', 'en-balloon-descript.txt'],
  ['en.json', 'ghost/master/ghost.json', 'en-program.json'],
  // YAYA で動かすためのもの（yaya.txt・訳した辞書）。辞書のコメントはゴーストの言語
  ['ghost.json', 'ghost/master/yaya.txt', 'yaya-txt.txt'],
  ['ghost.json', 'ghost/master/studio_program.dic', 'studio_program.dic'],
  ['en.json', 'ghost/master/studio_program.dic', 'en-studio_program.dic'],
  // ファイルの一覧（YAYA 一式が ghost/master/ に入ること）。大きさは、しくみの辞書を直すたびに変わるので見ない
  ['ghost.json', '', 'files.txt', 'namesOnly'],
];

console.log('  ---- 書き出したファイルの中身');
for (const [fixture, want, expected, how] of cases) {
  const args = [path.join(fixtureDir, fixture)];
  if (want) args.push(want);
  let got = run([...args, '--dic', dicFor(fixture)]);
  if (how === 'namesOnly') got = Buffer.from(got.toString('utf8').replace(/ \(\d+ バイト\)/g, ''), 'utf8');
  compare(expected, got);
}

// ------------------------------------------------- ネットワーク更新の照合表
//
// 中身を作るところから確かめたいので、その場でフォルダを組み立てます。
console.log('  ---- ネットワーク更新の照合表 (updates2.dau)');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-dau-'));
try {
  const files = {
    'readme.txt': Buffer.from('こんにちは\r\n', 'utf8'),
    'ghost\\master\\ghost.json': Buffer.from('{"a":1}\n', 'utf8'),
    'shell\\master\\surface0.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0xff]),
    // これは配ってはいけないもの（使う人の持ちもの・作業用）
    'ghost\\master\\ikaga_save.json': Buffer.from('{"好感度":99}', 'utf8'),
    'ghost\\master\\ikaga_debug.txt': Buffer.from('log', 'utf8'),
    'ghost\\master\\yaya_variable.cfg': Buffer.from('Studio.boots, 3', 'utf8'),
    'ghost\\master\\studio_debug.txt': Buffer.from('log', 'utf8'),
    'delete.txt': Buffer.from('old.txt\r\n', 'utf8'),
  };
  for (const rel of Object.keys(files)) {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, files[rel]);
  }

  const out = run(['--dau', tmp]).toString('utf8');
  // 出力は 0x01 を <1>、改行を <CR><LF> と書いたもの
  const lines = out.split('\n').map((s) => s.replace(/\r$/, '')).filter((s) => s.length);
  const want = ['ghost\\master\\ghost.json', 'readme.txt', 'shell\\master\\surface0.png'];

  checked++;
  const names = lines.map((s) => s.split('<1>')[0]);
  if (names.join(' / ') !== want.join(' / ')) {
    failed++;
    console.log(`${red}  だめ 並んでいるファイルがちがいます${off}`);
    console.log(`        ほしい: ${want.join(' / ')}`);
    console.log(`        出た  : ${names.join(' / ')}`);
  } else {
    console.log(`${green}  OK  ${off}配るファイルだけが並んでいる（持ちもの・作業用は入らない）`);
  }

  for (const line of lines) {
    const parts = line.split('<1>');
    checked++;
    const rel = parts[0];
    const md5 = crypto.createHash('md5').update(files[rel]).digest('hex');
    if (parts[1] !== md5) {
      failed++;
      console.log(`${red}  だめ ${rel} の MD5${off}`);
      console.log(`        ほしい: ${md5}`);
      console.log(`        出た  : ${parts[1]}`);
    } else if (parts[2] !== '<CR><LF>' || parts.length !== 3) {
      failed++;
      console.log(`${red}  だめ ${rel} の行の形（0x01 が 2 つ + CRLF）${off}`);
      console.log(`        出た  : ${JSON.stringify(line)}`);
    } else {
      console.log(`${green}  OK  ${off}${rel} ${dim}${md5}${off}`);
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ------------------------------------------------- いまあるシェルのフォルダの読みこみ（段階 3-5d）
//
// その場で小さな PNG を作って、シェルのフォルダを組み立てます。
console.log('  ---- いまあるシェルのフォルダの読みこみ');
{
  const zlib = require('zlib');
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const png = (w, h) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6;        // 8bit RGBA
    const rows = Buffer.alloc((w * 4 + 1) * h);
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-shell-'));
  try {
    const dir = path.join(root, 'ghost-a', 'shell', 'master');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'surface0.png'), png(3, 4));
    fs.writeFileSync(path.join(dir, 'surface0010.png'), png(5, 6));     // 0 を足した名前も 10 番
    fs.writeFileSync(path.join(dir, 'surface11.png'), png(2, 2));
    fs.writeFileSync(path.join(dir, 'surface1.png'), png(7, 8));
    fs.writeFileSync(path.join(dir, 'surface0001.png'), png(9, 9));     // 1 番が 2 つ → 名前の短いほう
    fs.writeFileSync(path.join(dir, 'surface2.png'), Buffer.from('not a png'));   // 読めない
    fs.writeFileSync(path.join(dir, 'body.png'), png(1, 1));            // 番号の絵ではない
    fs.writeFileSync(path.join(dir, 'surfaces.txt'),
      'charset,UTF-8\r\nsurface0\r\n{\r\n}\r\nsurface10,11\r\n{\r\n}\r\nsurface100-102\r\n{\r\nelement0,overlay,body.png,0,0\r\n}\r\nsurface.append3\r\n{\r\n}\r\n');
    // 2 番は読めない絵。3・100〜102 番は surfaces.txt にだけある（組み合わせの絵）
    const want = [
      'folder: master',
      'image: 0 surface0.png 3x4', 'image: 1 surface1.png 7x8',
      'image: 10 surface0010.png 5x6', 'image: 11 surface11.png 2x2',
      'composite: 3', 'composite: 100', 'composite: 101', 'composite: 102',
      'unreadable: surface2.png',
    ];
    const cases = [['ゴーストのフォルダを渡しても shell/master を見つける', path.join(root, 'ghost-a')],
      ['シェルのフォルダをじかに渡しても読める', dir]];
    for (const [label, p] of cases) {
      checked++;
      const got = run(['--shell', p]).toString('utf8').split(/\r?\n/).filter((s) => s);
      if (got.join(' | ') === want.join(' | ')) {
        console.log(`${green}  OK  ${off}${label}`);
      } else {
        failed++;
        console.log(`${red}  だめ ${label}${off}`);
        console.log(`        ほしい: ${want.join(' | ')}`);
        console.log(`        出た  : ${got.join(' | ')}`);
      }
    }
    checked++;
    let refused = '';
    try { run(['--shell', root]); } catch (e) { refused = String(e.stdout || ''); }
    if (refused.includes('error: not_shell_folder')) console.log(`${green}  OK  ${off}シェルのフォルダでなければ断る`);
    else { failed++; console.log(`${red}  だめ シェルのフォルダでないのに断りませんでした${off}`); }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ おしまい
if (failed) {
  console.log(`${red}[export] ${failed} か所ちがいます（${checked} か所中）。${off}`);
  console.log(`${dim}  わざと変えたのなら: node studio\\test\\export.js --update${off}`);
  process.exit(1);
}
console.log(`${green}[export] ${checked} か所すべて期待どおりです。${off}`);
