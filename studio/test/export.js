/* 書き出しの答え合わせテスト
 *
 *   node studio\test\export.js            見くらべる
 *   node studio\test\export.js --update   いまの出力を期待値として保存しなおす
 *
 * ブロックの動きは parity / behavior で守られていますが、スタジオが書き出すファイル
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
  // シェルの descript.txt（着せ替えの名前とメニュー。sakura.bindgroupN / sakura.menuitemN）
  ['ghost.json', 'shell/master/descript.txt', 'shell-descript.txt'],
  ['ghost.json', 'ghost/master/descript.txt', 'descript.txt'],
  ['ghost.json', 'ghost/master/ghost.json', 'program.json'],
  ['ghost.json', 'install.txt', 'install.txt'],
  ['plain.json', 'ghost/master/descript.txt', 'descript-plain.txt'],
  ['balloon.json', 'balloon/descript.txt', 'balloon-descript.txt'],
  ['balloon.json', 'install.txt', 'balloon-install.txt'],
  // バルーンの見た目をえらんだとき（大きさ・かたち・しっぽ・線と文字の色）
  ['balloon-styled.json', 'balloon/descript.txt', 'balloon-styled-descript.txt'],
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
  // プロジェクトの YAYA の辞書（段階 8-2）。使える名前のものだけを書き、yaya.txt に足す（改行は CRLF）
  ['dics.json', 'ghost/master/yaya.txt', 'dics-yaya-txt.txt'],
  ['dics.json', 'ghost/master/talk.dic', 'dics-talk.txt'],
  ['dics.json', '', 'dics-files.txt', 'namesOnly'],
];

console.log('  ---- 書き出したファイルの中身');
for (const [fixture, want, expected, how] of cases) {
  const args = [path.join(fixtureDir, fixture)];
  if (want) args.push(want);
  let got = run([...args, '--dic', dicFor(fixture)]);
  if (how === 'namesOnly') got = Buffer.from(got.toString('utf8').replace(/ \(\d+ バイト\)/g, ''), 'utf8');
  compare(expected, got);
}

// ------------------------------------------------- 大きな surfaces.txt
//
// 見出しに番号をたくさん並べた surfaces.txt でも、読みこみがすぐ終わること（広げる番号は 1 つの見出しで 2000 まで）
console.log('  ---- 大きな surfaces.txt の読みこみ');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-big-'));
  try {
    const ranges = [];
    for (let i = 0; i < 10; i++) ranges.push(`${i * 2000}-${i * 2000 + 1999}`);
    const body = [];
    for (let i = 0; i < 5; i++) body.push(`animation${i}.interval,always`, `animation${i}.pattern0,overlay,100,50,0,0`);
    for (let i = 0; i < 5; i++) body.push(`collision${i},0,0,10,10,Area${i}`);
    fs.writeFileSync(path.join(dir, 'surfaces.txt'), [`surface${ranges.join(',')}`, '{', ...body, '}'].join('\r\n'));
    checked++;
    const started = Date.now();
    let out = '';
    try {
      out = execFileSync(host, ['--shell', dir], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60000 });
    } catch (e) {
      out = '';
    }
    const ms = Date.now() - started;
    const anims = out.split(/\r?\n/).filter((l) => l.startsWith('animation: ')).length;
    if (out && ms < 20000 && anims === 2000 * 5) {
      console.log(`${green}  OK  ${off}見出しの番号は 2000 までにして、すぐ読み終わる（${ms} ミリ秒）`);
    } else {
      failed++;
      console.log(`${red}  だめ 大きな surfaces.txt（${ms} ミリ秒、うごき ${anims} こ）${off}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------- Windows の機械の名前
//
// ゴーストの名前が CON・NUL・COM1 などだと、そのままではフォルダもファイルも作れないので、前に _ を付ける
console.log('  ---- Windows の機械の名前（CON・NUL など）');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-dev-'));
  try {
    const folders = [];
    for (const name of ['NUL', 'con.txt', 'COM1', 'Console']) {
      const file = path.join(dir, 'p.json');
      fs.writeFileSync(file, JSON.stringify({ format: 'ikaga/1', meta: { name }, scripts: [] }));
      const out = run([file, '--dic', dicFor('plain.json')]).toString('utf8');
      folders.push((/== folder: (.*?) \//.exec(out) || [])[1]);
    }
    checked++;
    const want = ['_NUL', '_con.txt', '_COM1', 'Console'];
    if (JSON.stringify(folders) === JSON.stringify(want)) {
      console.log(`${green}  OK  ${off}CON・NUL・COM1 には _ を付け、ほかの名前はそのまま`);
    } else {
      failed++;
      console.log(`${red}  だめ Windows の機械の名前${off}`);
      console.log(`        ほしい: ${JSON.stringify(want)}`);
      console.log(`        出た  : ${JSON.stringify(folders)}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------- 長い当たり判定の名前
//
// うごきの当たり判定の名前は長さが決まっていないので、長くても書き出しが止まらず、1 行がそのまま書けること
// （前は決まった大きさの入れものに書いていて、長い名前で exe ごと止まりました）
console.log('  ---- うごきの当たり判定の長い名前');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-long-'));
  try {
    const name = 'N'.repeat(400);
    const project = {
      format: 'ikaga/1', meta: { name: 'long' }, scripts: [],
      animations: [{ id: 1, base: 0, interval: 'always', patterns: [{ method: 'overlay', surface: 100, wait: 50, x: 0, y: 0 }],
        collisions: [
          { name, shape: 'rect', x1: 0, y1: 0, x2: 10, y2: 10 },
          { name, shape: 'ellipse', x1: 1, y1: 2, x2: 3, y2: 4 },
          { name, shape: 'circle', x1: 5, y1: 6, x2: 7 },
        ] }],
    };
    const file = path.join(dir, 'long.json');
    fs.writeFileSync(file, JSON.stringify(project));
    checked++;
    let out = '';
    try {
      out = run([file, 'shell/master/surfaces.txt', '--dic', dicFor('ghost.json')]).toString('utf8');
    } catch (e) {
      out = `（止まりました: ${e.status}）`;
    }
    const want = [
      `animation1.collision0,0,0,10,10,${name}`,
      `animation1.collisionex0,${name},ellipse,1,2,3,4`,
      `animation1.collisionex1,${name},circle,5,6,7`,
    ];
    if (want.every((l) => out.includes(l + '\r\n'))) {
      console.log(`${green}  OK  ${off}400 字の名前でも止まらず、四角・楕円・円の行がそのまま書ける`);
    } else {
      failed++;
      console.log(`${red}  だめ 長い当たり判定の名前${off}`);
      console.log(`        出た  : ${out.slice(0, 200)}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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

// その場で作る小さな PNG（w×h の透明な絵）
const zlib = require('zlib');
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function png(w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;        // 8bit RGBA
  const rows = Buffer.alloc((w * 4 + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------- サムネイルと、画面で書いた readme（段階 5-11）
console.log('  ---- サムネイルと readme');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-thumb-'));
  try {
    const thumb = png(4, 3);
    fs.writeFileSync(path.join(dir, 'thumb.png'), thumb);
    const project = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'plain.json'), 'utf8'));
    project.meta = Object.assign({}, project.meta, {
      readme: 'みかんのゴーストです。\nよろしくね。',
      thumbnail: { path: path.join(dir, 'thumb.png'), name: 'thumb.png', w: 4, h: 3 },
    });
    const fx = path.join(dir, 'project.json');
    fs.writeFileSync(fx, JSON.stringify(project));
    const dic = dicFor('plain.json');
    // 1 つのファイルをたずねると「== folder: …」「---- 名前 (大きさ)」の 2 行のあとに中身が来る
    const body = (buf) => { const i = buf.indexOf(10); return buf.subarray(buf.indexOf(10, i + 1) + 1); };
    const steps = [
      // 出力はテキストなので、中身ではなく一覧の名前と大きさを見る
      ['えらんだ PNG が thumbnail.png としていちばん上に入る', () => run([fx, '--dic', dic]).toString('utf8')
        .includes(`---- thumbnail.png (${thumb.length} バイト)`)],
      ['画面で書いた readme が上に入り、改行は CRLF になる', () => body(run([fx, 'readme.txt', '--dic', dic])).toString('utf8')
        .startsWith('みかんのゴーストです。\r\nよろしくね。\r\n\r\n----\r\n')],
      ['サムネイルをえらんでいなければ thumbnail.png は無い', () => !run([path.join(fixtureDir, 'plain.json'), '--dic', dic])
        .toString('utf8').includes('thumbnail.png')],
      // プロジェクトに書いてあるネットワークの場所（\\…）は読まない（同じ PNG を \\localhost\C$\… でさしても入らない）
      ['ネットワークの場所のサムネイルと立ち絵は読まない', () => {
        const unc = '\\\\localhost\\' + path.join(dir, 'thumb.png').replace(/^([A-Za-z]):/, '$1$');
        const p2 = JSON.parse(fs.readFileSync(fx, 'utf8'));
        p2.meta.thumbnail.path = unc;
        p2.shell = Object.assign({}, p2.shell, { images: [{ id: 0, path: unc, name: 'thumb.png', w: 4, h: 3 }] });
        const fx2 = path.join(dir, 'project-unc.json');
        fs.writeFileSync(fx2, JSON.stringify(p2));
        const list = run([fx2, '--dic', dic]).toString('utf8');
        return !list.includes('thumbnail.png') && !list.includes(`---- shell/master/surface0.png (${thumb.length} バイト)`);
      }],
    ];
    for (const [label, fn] of steps) {
      checked++;
      if (fn()) console.log(`${green}  OK  ${off}${label}`);
      else { failed++; console.log(`${red}  だめ ${label}${off}`); }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------- いまあるシェルのフォルダの読みこみ（段階 3-5d）
//
// その場で小さな PNG を作って、シェルのフォルダを組み立てます。
console.log('  ---- いまあるシェルのフォルダの読みこみ');
{
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
      'areas: {}', 'skipped: 0',
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

    // うごき・当たり判定・着せ替えの名前も読む（四角でない当たり判定と古い書式は数えるだけ）
    const dir2 = path.join(root, 'shell-b');
    fs.mkdirSync(dir2, { recursive: true });
    fs.writeFileSync(path.join(dir2, 'surface0.png'), png(4, 4));
    fs.writeFileSync(path.join(dir2, 'surface10.png'), png(4, 4));
    fs.writeFileSync(path.join(dir2, 'surfaces.txt'), [
      'charset,UTF-8', 'descript', '{', 'version,1', '}',
      'surface0', '{',
      'collision0,10,20,90,60,Head',
      'collisionex1,Ribbon,ellipse,1,2,3,4',
      'animation0.interval,random,5',
      'animation0.pattern0,overlay,100,50,0,0',
      'animation0.pattern1,alternativestart,[1.2]',
      'animation0.pattern2,scaling,0,300,92.5,100',
      'animation0.collision0,1,2,30,40,Wing',
      'animation0.collisionex1,Tail,circle,5,6,7',
      'animation3.interval,bind',
      'animation3.pattern0,add,500,0,0,40',
      '0interval,sometimes',
      '0pattern0,100,5,overlay,0,0',
      '}',
      'surface10{',
      'animation3.interval,bind',
      'animation3.pattern0,add,510,0,0,0',
      '}',
    ].join('\r\n'));
    fs.writeFileSync(path.join(dir2, 'descript.txt'),
      'charset,UTF-8\r\nsakura.bindgroup3.name,服,セーラー,thumb.png\r\nsakura.bindgroup3.default,1\r\nsakura.bindgroup3.addid,4,5\r\n' +
      'sakura.bindoption0.group,服,multiple\r\nkero.bindgroup3.name,ぼうし,麦わら\r\n');
    checked++;
    const got2 = run(['--shell', dir2]).toString('utf8').split(/\r?\n/).filter((s) => s);
    const pick = (prefix) => got2.filter((l) => l.startsWith(prefix)).map((l) => l.slice(prefix.length));
    const anims2 = pick('animation: ').map((s) => JSON.parse(s));
    const want2 = {
      areas: { 0: [{ name: 'Head', x1: 10, y1: 20, x2: 90, y2: 60 }] },
      animations: [
        { id: 0, base: 0, interval: 'random', every: 5, patterns: [
          { method: 'overlay', surface: 100, wait: 50, x: 0, y: 0 },
          { method: 'alternativestart', ids: [1, 2] },
          { method: 'scaling', surface: 0, wait: 300, x: 92.5, y: 100 },
        ], collisions: [
          { name: 'Wing', shape: 'rect', x1: 1, y1: 2, x2: 30, y2: 40 },
          { name: 'Tail', shape: 'circle', x1: 5, y1: 6, x2: 7 },
        ] },
        { id: 3, base: 0, interval: 'bind', every: 4, patterns: [{ method: 'add', surface: 500, wait: 0, x: 0, y: 40 }], collisions: [],
          bind: { category: '服', part: 'セーラー', default: true, addid: [4, 5], option: 'multiple' } },
        { id: 3, base: 10, interval: 'bind', every: 4, patterns: [{ method: 'add', surface: 510, wait: 0, x: 0, y: 0 }], collisions: [],
          bind: { category: 'ぼうし', part: '麦わら' } },
      ],
      skipped: 3,
    };
    const gotAll = { areas: JSON.parse(pick('areas: ')[0] || 'null'), animations: anims2, skipped: Number(pick('skipped: ')[0]) };
    if (JSON.stringify(gotAll) === JSON.stringify(want2)) {
      console.log(`${green}  OK  ${off}うごき・四角い当たり判定・着せ替えの名前も読み、読めない行（四角でない当たり判定・古い書式）は数える`);
    } else {
      failed++;
      console.log(`${red}  だめ うごきと当たり判定の読みこみ${off}`);
      console.log(`        ほしい: ${JSON.stringify(want2)}`);
      console.log(`        出た  : ${JSON.stringify(gotAll)}`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// ------------------------------------------------- プロジェクトの前の版（project_history.h）
//
// 保存するのと同じ順に、前の版を残してから上書きします（export_host --history）。
console.log('  ---- プロジェクトの前の版');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikaga-history-'));
  const name = 'テスト';
  const save = (text, ...opt) => {
    const f = path.join(dir, 'new.json');
    fs.writeFileSync(f, text);
    const out = run(['--history', dir, name, f, ...opt]).toString('utf8').split(/\r?\n/).filter((s) => s);
    return { kept: out[0] === 'kept: 1', bodies: out.slice(1).map((l) => l.replace(/^version: \S+ /, '')) };
  };
  const steps = [
    ['はじめての保存では、前の版は無い', () => save('A'), { kept: false, bodies: [] }],
    ['手で保存すると、上書きする前のものを残す', () => save('B'), { kept: true, bodies: ['A'] }],
    ['中身が同じなら残さない', () => save('B'), { kept: false, bodies: ['A'] }],
    ['自動保存は、いちばん新しい版から間があいていなければ残さない', () => save('C', 'auto', '600'), { kept: false, bodies: ['A'] }],
    ['間があいていれば、自動保存でも残す（新しい順）', () => save('D', 'auto', '0'), { kept: true, bodies: ['C', 'A'] }],
    ['残す数をこえたら、古いものから消す', () => save('E', 'manual', '600', '2'), { kept: true, bodies: ['D', 'C'] }],
  ];
  try {
    for (const [label, fn, want] of steps) {
      checked++;
      const got = fn();
      if (JSON.stringify(got) === JSON.stringify(want)) {
        console.log(`${green}  OK  ${off}${label}`);
      } else {
        failed++;
        console.log(`${red}  だめ ${label}${off}`);
        console.log(`        ほしい: ${JSON.stringify(want)}`);
        console.log(`        出た  : ${JSON.stringify(got)}`);
      }
    }
    checked++;
    const ids = fs.readdirSync(path.join(dir, '.history', name));
    if (ids.every((f) => /^\d{8}-\d{6}(-\d+)?\.json$/.test(f))) console.log(`${green}  OK  ${off}版は .history\\<名前>\\<日時>.json に残る`);
    else { failed++; console.log(`${red}  だめ 版のファイル名が日時になっていません: ${ids.join(', ')}${off}`); }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ おしまい
if (failed) {
  console.log(`${red}[export] ${failed} か所ちがいます（${checked} か所中）。${off}`);
  console.log(`${dim}  わざと変えたのなら: node studio\\test\\export.js --update${off}`);
  process.exit(1);
}
console.log(`${green}[export] ${checked} か所すべて期待どおりです。${off}`);
