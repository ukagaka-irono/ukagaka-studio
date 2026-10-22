/* エディタの中身のテスト（データの整形とチェックタブ）
 *
 *   node ui\test\editor.js
 *
 * 画面を出さずに、ui/js の中の「判断しているところ」だけを動かします。
 *
 *   model.js      … 読みこんだプロジェクトの整形（normalize）と、かたまりの名前
 *   lint.js       … チェックタブが出す注意
 *   blockindex.js … 「ブロックを探して置く」（/ キー）で、字からブロックをさがすところ
 *
 * ブロックを動かすところは栞（shiori/src/interp.cpp）にしかないので、ここでは見ません
 * （そちらは shiori/test/parity と shiori/test/behavior が見ています）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const COLOR = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', off: '\x1b[0m' };
const { red, green, dim, off } = COLOR;

// 画面のモジュールをそのまま読みこむ（どれも DOM を触りません）
// node の navigator.language は en-US なので、日本語に決めうちにします（ui/js/i18n/i18n.js）
globalThis.IKAGA_LANG = 'ja';
const { Model } = require('../js/model/model.js');
const { Lint } = require('../js/model/lint.js');
const { EVENTS, PALETTE } = require('../js/model/blocks.js');
const { buildBlockIndex, searchBlocks } = require('../js/model/blockindex.js');

let failed = 0;
let checked = 0;
let group = '';

function section(name) { group = name; console.log(`  ---- ${name}`); }

function check(what, got, want) {
  checked++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    console.log(`${green}  OK  ${off}${what}`);
    return;
  }
  failed++;
  console.log(`${red}  だめ ${what}${off}`);
  console.log(`        ほしい: ${b}`);
  console.log(`        出た  : ${a}`);
}

/** チェックタブの結果から、message に文字列をふくむものを探す */
function issuesOf(project, part) {
  Model.project = Model.normalize(project);
  return Lint.run(Model.project)
    .filter((i) => i.message.includes(part) || (i.hint || '').includes(part))
    .map((i) => i.level);
}

// ===================================================== プロジェクトの整形
section('読みこんだプロジェクトの整形 (model.normalize)');

{
  const p = Model.normalize({});
  check('空でも既定値でうまる', {
    name: p.meta.name, homeUrl: p.meta.homeUrl,
    interval: p.settings.randomTalkInterval,
    scripts: p.scripts.length, vars: p.variables.length, anims: p.animations.length,
  }, { name: 'あたらしいゴースト', homeUrl: '', interval: 180, scripts: 0, vars: 0, anims: 0 });
}

{
  const p = Model.normalize({
    variables: [{ name: 'すき', value: 3 }, { name: '', value: 1 }, { value: 9 }],
  });
  check('名前のない変数は落とす', p.variables, [{ name: 'すき', value: 3 }]);
}

{
  // ゴーストの言語（meta.lang）。無いものは日本語のゴーストで、画面の言語では埋めない
  const of = (meta) => Model.normalize({ meta }).meta.lang;
  check('ゴーストの言語: en・ja はそのまま、知らないものと無いものは持たない（日本語のゴースト）',
    [of({ lang: 'en' }), of({ lang: 'ja' }), of({ lang: 'fr' }), of({})], ['en', 'ja', undefined, undefined]);
}

{
  const p = Model.normalize({
    animations: [{
      id: 3, base: 0, interval: 'talk', every: 2,
      patterns: [
        { method: 'interpolate', surface: 1, wait: 50, x: -2, y: 3 },
        { method: 'しらない', surface: 2 },
        { method: 'import', file: 'a.png', wait: 10 },
      ],
      collisions: [
        { name: 'Wing', shape: 'polygon', points: '1,2 3,4 5,6' },
        { name: 'Odd', shape: 'へんな形' },
        { name: '   ', shape: 'rect' },
      ],
    }],
  });
  const a = p.animations[0];
  check('知らない重ねかたは base に倒す', a.patterns.map((x) => x.method),
    ['interpolate', 'base', 'import']);
  check('こまの既定値がうまる', a.patterns[1],
    { surface: 2, wait: 200, method: 'base', x: 0, y: 0, file: '' });
  check('差しこむファイル名は残る', a.patterns[2].file, 'a.png');
  check('名前のない当たり判定は落とし、知らない形は四角に倒す',
    a.collisions.map((c) => [c.name, c.shape]), [['Wing', 'polygon'], ['Odd', 'rect']]);
  check('多角形のかどはそのまま持つ', a.collisions[0].points, '1,2 3,4 5,6');
}

{
  const p = Model.normalize({
    scripts: [
      { kind: 'event', event: 'OnNadeNade', filter: { area: 'Head', who: 1 } },
      { kind: 'event', event: 'OnCommunicate', filter: { from: 'みかん', contains: 'ねえ' } },
      { kind: 'talk' },
      { kind: 'function' },
    ],
  });
  check('マウスのしぼり込みをほどく',
    [p.scripts[0].area, p.scripts[0].who], ['Head', 1]);
  check('通信のしぼり込みをほどく',
    [p.scripts[1].from, p.scripts[1].contains], ['みかん', 'ねえ']);
  check('トークには名前とえらばれやすさが付く',
    [p.scripts[2].name, p.scripts[2].weight], ['トーク', 1]);
  check('名前のないトークにも名前が付く', p.scripts[3].name, 'なまえのないトーク');
  check('置き場所が決まる', typeof p.scripts[0].x, 'number');
}

// ===================================================== プロジェクトの形の版
section('プロジェクトの形の版 (format)');

/** normalize して、読めたら format を、読めなければ投げたメッセージを返す */
function formatOf(project) {
  try {
    return { format: Model.normalize(project).format };
  } catch (e) {
    return { error: e.message };
  }
}

check('いまの版はそのまま読める', formatOf({ format: 'ikaga/1' }), { format: 'ikaga/1' });
check('元のなしスタジオのプロジェクト（nashi/1）も読めて、ikaga/1 になる',
  formatOf({ format: 'nashi/1' }), { format: 'ikaga/1' });
check('format が無いもの（手書きの ghost.json など）は版 1 として読む',
  formatOf({ meta: { name: 'てがき' } }), { format: 'ikaga/1' });
{
  const r = formatOf({ format: 'ikaga/2' });
  check('新しすぎる版は読まない（伺かスタジオを新しくするよう言う）',
    !!r.error && r.error.includes('ikaga/2') && r.error.includes('新しく'), true);
}
check('知らない名前の形は読まない', !!formatOf({ format: 'foo/1' }).error, true);
check('版の書きかたがおかしいものは読まない', !!formatOf({ format: 'ikaga/one' }).error, true);
check('版 0 は読まない', !!formatOf({ format: 'ikaga/0' }).error, true);
check('オブジェクトでないもの（配列）は読まない', !!formatOf([{ format: 'ikaga/1' }]).error, true);
check('オブジェクトでないもの（null）は読まない', !!formatOf(null).error, true);
{
  const src = { format: 'nashi/1', meta: { name: 'もと' }, scripts: [] };
  Model.normalize(src);
  check('読みこんだ元のものは書きかえない', src.format, 'nashi/1');
}
{
  // 読めない形を開こうとしても、いま開いているプロジェクトは残る
  Model.init({ format: 'ikaga/1', meta: { name: 'ひらいているもの' } });
  let threw = false;
  try { Model.init({ format: 'ikaga/99' }); } catch (e) { threw = true; }
  check('読めない形を開こうとしても、いまのプロジェクトは残る',
    [threw, Model.project.meta.name], [true, 'ひらいているもの']);
}
check('ひな形（newProject）はいまの版', Model.newProject().format, Model.FORMAT);
// 栞が読む形の ghost.json（栞のテスト用ゴースト）も、そのまま読みこめる
for (const rel of ['parity', 'fixture', 'behavior/main', 'behavior/empty']) {
  const raw = fs.readFileSync(path.join(root, 'shiori', 'test', ...rel.split('/'), 'ghost.json'), 'utf8');
  check(`栞の ghost.json も読みこめる（shiori/test/${rel}）`, formatOf(JSON.parse(raw)), { format: Model.FORMAT });
}

section('かたまりの名前 (scriptTitle)');
{
  Model.project = Model.normalize({
    animations: [{ id: 0, base: 0, collisions: [{ name: 'Wing', shape: 'rect' }] }],
  });
  check('ふつうのイベント',
    Model.scriptTitle({ kind: 'event', event: 'OnBoot' }), '起動したとき');
  check('◯秒ごと',
    Model.scriptTitle({ kind: 'event', event: 'OnSecondChange', everySec: 5 }),
    '5秒ごとにくりかえす');
  check('なでなで（仮シェルの場所）',
    Model.scriptTitle({ kind: 'event', event: 'OnNadeNade', area: 'Head', who: 0 }),
    'さくらのあたまがなでられたとき');
  check('なでなで（うごきで足した場所）',
    Model.scriptTitle({ kind: 'event', event: 'OnNadeNade', area: 'Wing', who: -1 }),
    'どちらかのWingがなでられたとき');
  check('話しかけられたとき',
    Model.scriptTitle({ kind: 'event', event: 'OnCommunicate', from: 'みかん', contains: 'やあ' }),
    'みかんに「やあ」と話しかけられたとき');
  check('知らないイベントはそのまま',
    Model.scriptTitle({ kind: 'event', event: 'OnUnknownThing' }), 'OnUnknownThing');
}

// =========================================================== チェックタブ
section('チェックタブ (lint)');

const withScript = (blocks, extra) => Object.assign({
  meta: {}, variables: [{ name: 'こたえ', value: '' }],
  scripts: [{ id: 's1', kind: 'event', event: 'OnBoot', blocks }],
}, extra || {});

check('なにも言わないセリフ',
  issuesOf(withScript([{ type: 'say', who: 0, text: '' }]), 'なにも言わないセリフ'), ['warn']);

check('話しかける相手が空',
  issuesOf(withScript([{ type: 'communicate', who: 0, to: '', text: 'やあ' }]), '話しかける相手が空'),
  ['error']);

check('無い変数を使っている',
  issuesOf(withScript([{ type: 'set', name: 'ないよ', value: 1 }]), '「ないよ」がありません'),
  ['error']);

check('知らないブロック',
  issuesOf(withScript([{ type: 'なぞ' }]), '知らないブロック'), ['error']);

// --- ネットワーク更新
check('更新のありかが空のまま、更新ブロックを置いている',
  issuesOf(withScript([{ type: 'update' }]), 'ネットワーク更新のブロック'), ['warn']);

check('更新のありかを決めていれば言わない',
  issuesOf(withScript([{ type: 'update' }], { meta: { homeUrl: 'https://example.com/' } }),
    'ネットワーク更新のブロック'), []);

// --- 待たない SAORI
check('よぶファイルが空',
  issuesOf(withScript([{ type: 'saori_call', file: '', into: 'こたえ' }]), 'よぶファイルが空'),
  ['error']);

check('答えの入れ先が空',
  issuesOf(withScript([{ type: 'saori_call', file: 'a.dll', into: '' }]), '答えの入れ先が空'),
  ['warn']);

check('答えの入れ先が無い変数',
  issuesOf(withScript([{ type: 'saori_call', file: 'a.dll', into: 'ないよ' }]),
    '「ないよ」がありません'), ['error']);

check('答えの入れ先も「使っている」に数える',
  issuesOf(withScript([{ type: 'saori_call', file: 'a.dll', into: 'こたえ' }]),
    'どこでも使われていません'), []);

// --- たずねる・◯秒後によぶ
check('たずねる先が空',
  issuesOf(withScript([{ type: 'ask', into: '' }]), '答えの入れ先が空の「たずねる」'), ['error']);

check('たずねる先が無い変数',
  issuesOf(withScript([{ type: 'ask', into: 'ないよ' }]), '「ないよ」がありません'), ['error']);

check('たずねる先も「使っている」に数える',
  issuesOf(withScript([{ type: 'ask', into: 'こたえ' }]), 'どこでも使われていません'), []);

check('◯秒後によぶ先が無いトーク',
  issuesOf(withScript([{ type: 'later', sec: 5, name: 'ないトーク' }]), 'というトークがありません'),
  ['error']);

check('◯秒後によぶ先が空',
  issuesOf(withScript([{ type: 'later', sec: 5, name: '' }]), '行き先がえらばれていません'),
  ['error']);

check('どこでも使われていない変数は言う',
  issuesOf(withScript([{ type: 'say', who: 0, text: 'やあ' }]), 'どこでも使われていません'),
  ['warn']);

{
  // つないだ手書きの YAYA ゴーストに同じイベントがあると、手書きが優先されることを知らせる（panels/yayalink.js）
  Model.project = Model.normalize(withScript([{ type: 'say', who: 0, text: 'やあ' }]));
  const ev = Model.project.scripts.find((s) => s.kind === 'event').event;
  const pick = (fns) => Lint.run(Model.project, { handwritten: fns })
    .filter((i) => i.message.includes('手書きの辞書にもあります')).map((i) => i.level);
  check('手書きの辞書にもあるイベントは知らせる', pick([ev, 'Hand.Helper']), ['warn']);
  check('手書きの辞書に無いイベントは言わない', pick(['Hand.Helper']), []);
  check('つないでいなければ言わない', pick([]), []);

  // 手書きの YAYA をよぶブロック（段階 3-5c）
  const levels = (blocks, fns, part) => {
    Model.project = Model.normalize(withScript(blocks));
    return Lint.run(Model.project, { handwritten: fns })
      .filter((i) => i.message.includes(part)).map((i) => i.level);
  };
  check('YAYA の関数: つないでいなければ、つないだときだけ動くと言う',
    levels([{ type: 'yaya_call', name: 'Hand.Greet' }], [], '手書きの YAYA の関数をよぶ'), ['warn']);
  check('YAYA の関数: 手書きの辞書に無い名前は言う',
    levels([{ type: 'yaya_call', name: 'Hand.Nai' }], ['Hand.Greet'], 'がありません'), ['warn']);
  check('YAYA の関数: 手書きの辞書にある名前なら言わない',
    levels([{ type: 'yaya_call', name: 'Hand.Greet' }], ['Hand.Greet'], 'YAYA'), []);
  check('YAYA の関数: 名前が空',
    levels([{ type: 'yaya_call', name: '' }], ['Hand.Greet'], '名前が空'), ['error']);
  check('YAYA の関数: 名前にブロックがはまっている',
    levels([{ type: 'yaya_call', name: { type: 'sys', key: 'commtext' } }], [], 'ブロックがはまっています'), ['error']);
  check('YAYA の式: ブロックがはまっている',
    levels([{ type: 'say', who: 0, text: { type: 'yaya_expr', code: { type: 'sys', key: 'commtext' } } }], [], 'ブロックがはまっています'),
    ['error']);
}

// ================================== ブロックを字でさがす（editor/picker.js が使う）
section('ブロックを字でさがす (blockindex)');
{
  const index = buildBlockIndex(['好感度']);
  const idOf = (e) => e.key || e.event || e.name || e.kind;
  const found = (q, n) => searchBlocks(index, q).slice(0, n || 1).map(idOf);

  check('イベントは 1 つずつ別の行（「その他（自分で書く）」はのぞく）',
    index.filter((e) => e.kind === 'event').map((e) => e.event),
    EVENTS.map((e) => e[1]).filter((ev) => ev !== '__custom__'));
  check('トークの帽子も入る', index.filter((e) => e.kind === 'talk' || e.kind === 'function').length, 2);
  check('変数は、いまのプロジェクトのものが入る', index.filter((e) => e.kind === 'var').map((e) => e.name), ['好感度']);
  const keys = Object.values(PALETTE).flat().filter((x) => typeof x === 'string' && x[0] !== '@');
  check('パレットのブロックは全部さがせる', keys.filter((k) => !index.some((e) => e.key === k)), []);
  check('同じ見た目の行がない', index.map((e) => e.label).filter((l, i, a) => a.indexOf(l) !== i), []);

  check('「話す」→ 話すブロック（キャラが話す、より先）', found('話す', 2), ['say', 'chara']);
  check('「改行」→ 改行するブロック（話すブロックの欄の既定値より先）', found('改行', 2), ['newline', 'say']);
  check('「なで」→ なでられたとき', found('なで'), ['OnNadeNade']);
  check('カタカナ・半角カナでもさがせる（ﾅﾃﾞ）', found('ﾅﾃﾞ'), ['OnNadeNade']);
  check('中の名前でもさがせる（onnade・SAY）', [found('onnade')[0], found('SAY')[0]], ['OnNadeNade', 'say']);
  check('言葉を 2 つ（さくら 話す）', found('さくら 話す', 9), ['say']);
  check('カテゴリの名前（せりふ）', found('せりふ', 2), ['say', 'newline']);
  check('「変数」→ 変数のブロックが先', found('変数', 2), ['set', 'change']);
  check('変数の名前', found('好感'), ['好感度']);
  check('はじめに出てくるほうが先（もし）', found('もし', 2), ['if', 'if_else']);
  check('見つからなければ空', searchBlocks(index, 'xyz'), []);
  check('空なら全部、パレットの順', searchBlocks(index, '  ').map(idOf), index.map(idOf));
}

// ============================================== お手本ゴースト（ui/samples）
section('お手本ゴースト');
{
  /** お手本がチェックタブに引っかかっていたら、お手本になりません。ゴーストの言語もそろっているか見ます */
  const sample = (file, lang) => {
    const project = Model.normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
    Model.project = project;
    const name = path.relative(root, file).replace(/\//g, '\\');
    check(`${name} は問題なし`, Lint.run(project).map((i) => `${i.level}: ${i.message}`), []);
    check(`${name} のゴーストの言語`, project.meta.lang || 'ja', lang);
  };
  const lists = {};
  // 日本語のお手本は ui/samples、英語のお手本は ui/samples/en（画面の言語でえらびます。panels/dialog.js）
  for (const [lang, dir] of [['ja', path.join(root, 'ui', 'samples')], ['en', path.join(root, 'ui', 'samples', 'en')]]) {
    lists[lang] = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    for (const s of lists[lang]) sample(path.join(dir, s.file), lang);
  }
  check('お手本の数（英語のお手本も、日本語と同じだけある）', [lists.ja.length > 0, lists.en.length], [true, lists.ja.length]);
  // はじめて起動したときに exe が置くサンプル（studio/tools/embed.ps1 が埋め込む）
  sample(path.join(root, 'studio', 'res', 'sample-project.json'), 'ja');
  sample(path.join(root, 'studio', 'res', 'sample-project.en.json'), 'en');
}

// ------------------------------------------------------------------ おしまい
if (failed) {
  console.log(`${red}[editor] ${failed} か所ちがいます（${checked} か所中）。${off}`);
  process.exit(1);
}
console.log(`${green}[editor] ${checked} か所すべて期待どおりです。${off}`);
