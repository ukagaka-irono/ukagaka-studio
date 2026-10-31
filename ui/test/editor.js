/* エディタの中身のテスト（データの整形とチェックタブ）
 *
 *   node ui\test\editor.js
 *
 * 画面を出さずに、ui/js の中の「判断しているところ」だけを動かします。
 *
 *   model.js      … 読みこんだプロジェクトの整形（normalize）と、かたまりの名前
 *   lint.js       … チェックタブが出す注意
 *   blockindex.js … 「ブロックを探して置く」（/ キー）で、字からブロックをさがすところ
 *   clipboard.js  … プロジェクトをまたいだコピー（DOM と localStorage の代わりの小さな入れもので）
 *
 * ブロックを動かすところ（YAYA への訳 ui/js/model/yaya.js と、しくみの辞書）は、ここでは見ません
 * （そちらは shiori/test/parity と shiori/test/behavior が YAYA で動かして見ています）。
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
  // 欠けたところは既定値で埋める（meta や settings があっても）。言語は埋めない
  const p = Model.normalize({ meta: { name: 'x' }, settings: {} });
  check('meta・settings があっても、欠けた項目は既定値', [p.meta.name, p.meta.version, p.meta.lang, p.settings.randomTalkInterval],
    ['x', '1.0.0', undefined, 180]);
}

{
  // 変数の名前を変えると、変数をえらぶ欄はみな変わる（たずねる・SAORI の答えを入れる先も）
  Model.init({ format: 'ikaga/1', meta: { name: 'V' }, variables: [{ name: 'ans', value: '' }], scripts: [{
    id: 's', kind: 'event', event: 'OnBoot', blocks: [
      { type: 'ask', into: 'ans', initial: '' }, { type: 'set', name: 'ans', value: 1 },
      { type: 'saori_call', file: 'a.dll', a: '', b: '', into: 'ans', value: -1 },
    ] }] });
  Model.renameVariable('ans', 'こたえ');
  check('変数の名前を変える', Model.project.scripts[0].blocks.map((b) => b.into || b.name), ['こたえ', 'こたえ', 'こたえ']);
}

{
  // 人からもらったファイルの、形のおかしいかたまりとブロックで、チェックタブや題が止まらない
  const { getDef } = require('../js/model/blocks.js');
  const project = {
    scripts: [null, 7, { id: 1, kind: 'event', event: 5, blocks: [
      { type: 'constructor' }, { type: '__proto__' }, { type: 'toString' }, { type: 'say', who: 0, text: 'a', nl: 0 },
    ] }],
  };
  const p = Model.normalize(project);
  let error = '';
  try { Model.project = p; Lint.run(p); } catch (e) { error = e.message; }
  check('かたまりでないものは落とし、名前やイベント名は文字にし、Object の中身の名前はブロックにしない',
    [p.scripts.length, p.scripts[0].id, p.scripts[0].event, typeof Model.scriptTitle(p.scripts[0]),
      p.scripts[0].blocks.map((b) => !!getDef(b)), error],
    [1, '1', '5', 'string', [false, false, false, true], '']);
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
    { surface: 2, wait: 200, method: 'base', x: 0, y: 0, file: '', ids: [] });
  check('差しこむファイル名は残る', a.patterns[2].file, 'a.png');
  check('名前のない当たり判定は落とし、知らない形は四角に倒す',
    a.collisions.map((c) => [c.name, c.shape]), [['Wing', 'polygon'], ['Odd', 'rect']]);
  check('多角形のかどはそのまま持つ', a.collisions[0].points, '1,2 3,4 5,6');

  // SERIKO の残り: まとめて動かす番号・大きさの小数・こまかい混ぜかた・着せ替え
  const q = Model.normalize({
    format: 'ikaga/1',
    animations: [{
      id: 5, interval: 'bind', bind: { category: ' 服 ', part: 'セーラー', default: 1 },
      patterns: [
        { method: 'alternativestart', ids: '3, 4.5 3 x 200' },
        { method: 'parallelstop', ids: [7, '8', 7] },
        { method: 'scaling', x: 92.5, y: 110 },
        { method: 'blend-soft-light' },
        { method: 'add', surface: 500 },
      ],
    }],
  }).animations[0];
  check('まとめて動かす番号は 0〜127 の数だけ、重ならずに残る',
    [q.patterns[0].ids, q.patterns[1].ids], [[3, 4, 5], [7, 8]]);
  check('大きさ（scaling）の倍率は小数のまま', [q.patterns[2].x, q.patterns[2].y], [92.5, 110]);
  check('こまかい混ぜかたと、着せ替えの部品を重ねる add も通す',
    q.patterns.map((x) => x.method), ['alternativestart', 'parallelstop', 'scaling', 'blend-soft-light', 'add']);
  check('着せ替えの種類と名前は前後の空白を落とし、はじめから着るかを持つ',
    q.bind, { category: '服', part: 'セーラー', default: true, option: '', addid: [] });
  const b2 = Model.normalize({ format: 'ikaga/1', animations: [
    { id: 1, interval: 'bind', bind: { option: 'multiple', addid: [6, '7', 200, 6] } },
    { id: 2, interval: 'bind', bind: { option: 'へん' } },
  ] }).animations.map((x) => [x.bind.option, x.bind.addid]);
  check('着せ替えのえらびかたは決まった名前だけ、いっしょに着る番号は 0〜127 で重ならずに残る',
    b2, [['multiple', [6, 7]], ['', []]]);

  // 絵の上で描いた当たり判定（shell.areas）: 番号ごとの四角。名前の無いもの・番号でないキーは落とし、座標は整数に
  const areas = Model.normalize({
    format: 'ikaga/1',
    shell: { areas: { 0: [{ name: ' Head ', x1: 1.4, y1: 2, x2: 50, y2: 60.6 }, { name: '' }], x: [{ name: 'a' }], 10: 'へん' } },
  }).shell.areas;
  check('描いた当たり判定は、番号ごとに名前と整数の座標で持つ', areas, { 0: [{ name: 'Head', x1: 1, y1: 2, x2: 50, y2: 61 }] });
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
// 書き出す形の ghost.json（ブロックの写し。YAYA のテスト用ゴースト）も、そのまま読みこめる
for (const rel of ['parity', 'behavior/main', 'behavior/empty']) {
  const raw = fs.readFileSync(path.join(root, 'shiori', 'test', ...rel.split('/'), 'ghost.json'), 'utf8');
  check(`書き出す形の ghost.json も読みこめる（shiori/test/${rel}）`, formatOf(JSON.parse(raw)), { format: Model.FORMAT });
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

{
  // かたまりをたたむ（段階 5-7）。たたんだ印は true のときだけ残す
  const p = Model.normalize({ scripts: [
    { id: 'a', kind: 'event', event: 'OnBoot', folded: true, blocks: [] },
    { id: 'b', kind: 'event', event: 'OnBoot', folded: 'yes', blocks: [] },
    { id: 'c', kind: 'event', event: 'OnBoot', blocks: [] },
  ] });
  check('たたんだ印: true は残し、ほかは消す', p.scripts.map((s) => 'folded' in s), [true, false, false]);
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

// --- 段階 8-2: プロジェクトの YAYA の辞書
{
  const { dicNameOk, dicFunctionNames } = require('../js/model/dics.js');
  check('辞書の名前', ['talk.dic', 'ＡＩ.DIC', '../x.dic', 'a\\b.dic', 'x.txt', '.dic', 'studio_runtime.dic', 'Studio_Program.dic'].map(dicNameOk),
    [true, true, false, false, false, false, false, false]);
  check('8.3 の短い名前・yaya.txt の区切り・Windows の機械の名前は使えない（Console.dic はよい）',
    ['STUDIO~1.DIC', 'a,b.dic', 'NUL.dic', 'com1.dic', 'LPT¹.dic', 'con .dic', 'Console.dic'].map(dicNameOk),
    [false, false, false, false, false, false, true]);
  const p = Model.normalize({ scripts: [], dics: [{ name: 'a.dic', text: 'X\r\n{\r\n\t1\r\n}\r\n' }, { name: 3 }, 'x', { name: 'b.dic' }] });
  check('読みこんだ辞書は、決まった形にする（改行は \\n、名前の無いものは落とす）', p.dics, [{ name: 'a.dic', text: 'X\n{\n\t1\n}\n' }, { name: 'b.dic', text: '' }]);
  check('新しいプロジェクトの辞書は空', Model.newProject().dics, []);
  const proj = (dics, extra) => Object.assign({ meta: {}, variables: [], scripts: [], dics }, extra || {});
  const msgs = (pr) => { Model.project = Model.normalize(pr); return Lint.run(Model.project).filter((i) => /辞書/.test(i.message)).map((i) => `${i.level}: ${i.message}`); };
  check('書きまちがいは、辞書と行で知らせる', msgs(proj([{ name: 'a.dic', text: 'X\n{\n\tif {\n\t}\n}\n' }])),
    ['error: 辞書「a.dic」の 3 行目が、YAYA として読めません']);
  check('スタジオや yaya_base の名前はかぶりとして知らせる',
    msgs(proj([{ name: 'a.dic', text: 'Studio.Event\n{\n\t1\n}\nOnRequest\n{\n\t1\n}\n' }])),
    ['error: 辞書「a.dic」の関数「Studio.Event」は、スタジオのしくみか yaya_base がもう使っている名前です',
      'error: 辞書「a.dic」の関数「OnRequest」は、スタジオのしくみか yaya_base がもう使っている名前です']);
  check('辞書どうしのかぶり・使えない名前・同じ名前の辞書',
    msgs(proj([{ name: 'a.dic', text: 'F\n{\n\t1\n}\n' }, { name: 'b.dic', text: 'F\n{\n\t2\n}\n' }, { name: '../c.dic', text: '' }, { name: 'A.DIC', text: '' }])),
    ['error: 関数「F」が、辞書「a.dic」と「b.dic」の両方にあります', 'error: 辞書の名前「../c.dic」は使えません', 'error: 辞書「A.DIC」が 2 つあります']);
  check('ブロックと同じイベントは、辞書が動くと知らせる',
    msgs(proj([{ name: 'a.dic', text: 'OnBoot\n{\n\t"x"\n}\n' }], { scripts: [{ id: 's', kind: 'event', event: 'OnBoot', blocks: [{ type: 'say', who: 0, text: 'やあ' }] }] })),
    ['warn: OnBoot は、プロジェクトの辞書「a.dic」にもあります']);
  check('つないでいるあいだは書き出さないと知らせる',
    msgs(proj([{ name: 'a.dic', text: '' }], { meta: { ghostDir: 'C:\\g' } })), ['warn: 手書きのゴーストにつないでいるあいだは、プロジェクトの辞書を書き出しません']);
  check('辞書の関数は「手書き」として書き出しにわたす', dicFunctionNames(Model.normalize(proj([{ name: 'a.dic', text: 'OnBoot\n{\n\t1\n}\nH\n{\n\t2\n}\n' }]))), ['OnBoot', 'H']);
}

// --- 段階 8-1: YAYA の式が YAYA として読めるか
check('読めない YAYA の式は言う', issuesOf(withScript([{ type: 'say', who: 0, text: { type: 'yaya_expr', code: '1 + (2' } }]), 'YAYA として読めません'), ['warn']);
check('読める YAYA の式なら言わない',
  issuesOf(withScript([{ type: 'say', who: 0, text: { type: 'yaya_expr', code: 'STRLEN(Studio.var["x"]) * 2 + (1, 2)[0]' } }]), 'YAYA として読めません'), []);

// --- 段階 7-7: 選択肢のつながり
{
  const { choiceGraph } = require('../js/model/graph.js');
  const g = choiceGraph({ scripts: [
    { id: 'boot', kind: 'event', event: 'OnBoot', blocks: [
      { type: 'choice', label: 'はい', target: 'yes' },
      { type: 'choice', label: 'いいえ', target: 'nai' },
    ] },
    { id: 'y', kind: 'function', name: 'yes', blocks: [{ type: 'call', name: 'end' }] },
    { id: 'e', kind: 'function', name: 'end', blocks: [{ type: 'later', sec: 5, name: 'yes' }] },
    { id: 'off', kind: 'function', name: 'off', disabled: true, blocks: [{ type: 'call', name: 'yes' }] },
    { id: 'lone', kind: 'event', event: 'OnClose', blocks: [] },
  ] });
  check('つながりの線（選択肢・よぶ・◯秒後によぶ。止めたかたまりは入れない）',
    g.edges.map((e) => [e.from, e.to, e.kind, e.label]),
    [['boot', 'y', 'choice', 'はい'], ['boot', 'missing:nai', 'choice', 'いいえ'], ['y', 'e', 'call', ''], ['e', 'y', 'call', '']]);
  check('点の列と行（輪になっていても止まる・つながりの無いかたまりは出さない）',
    g.nodes.map((n) => [n.id, n.depth, n.row]), [['boot', 0, 0], ['y', 1, 0], ['e', 2, 0], ['missing:nai', 1, 1]]);
  check('つながりが無ければ線も点も無い', choiceGraph({ scripts: [{ id: 'a', kind: 'event', event: 'OnBoot', blocks: [] }] }).nodes.length, 0);
}

// --- 段階 7-6: 前の版とのちがい
{
  const { diffProjects, diffIsEmpty, countBlocks } = require('../js/model/diff.js');
  const say = (text) => ({ type: 'say', who: 0, text });
  const old = Model.normalize({
    meta: { name: 'みかん' }, variables: [{ name: 'x', value: 0 }, { name: 'y', value: 1 }],
    scripts: [
      { id: 'a', kind: 'event', event: 'OnBoot', x: 10, y: 10, blocks: [say('やあ')] },
      { id: 'b', kind: 'event', event: 'OnClose', blocks: [say('またね')] },
      { id: 'c', kind: 'talk', name: 'ひま', blocks: [say('ひま')] },
    ],
  });
  const now = Model.normalize(JSON.parse(JSON.stringify(old)));
  check('同じなら、ちがいは無い', diffIsEmpty(diffProjects(old, now)), true);
  now.scripts[0].x = 500; now.scripts[0].folded = true;
  check('置き場所とたたんだ印だけなら、ちがいは無い', diffIsEmpty(diffProjects(old, now)), true);
  now.scripts[1].blocks.push(say('おやすみ'));
  now.scripts = now.scripts.filter((s) => s.id !== 'c');
  now.scripts.push(Model.normalize({ scripts: [{ id: 'd', kind: 'event', event: 'OnMouseDoubleClick', blocks: [] }] }).scripts[0]);
  now.variables = [{ name: 'x', value: 5 }, { name: 'z', value: 0 }];
  now.meta.name = 'いよかん';
  now.settings.randomTalkInterval = 60;
  const d = diffProjects(old, now);
  check('かたまりのちがい（変えた・足した・消した）', d.scripts.map((c) => [c.kind, (c.after || c.before).id]), [['changed', 'b'], ['added', 'd'], ['removed', 'c']]);
  check('変数のちがい', d.variables.map((v) => [v.kind, v.name]), [['changed', 'x'], ['added', 'z'], ['removed', 'y']]);
  check('ゴーストの情報と設定のちがい', [d.meta.map((m) => m.key), d.settings.map((m) => m.key)], [['name'], ['randomTalkInterval']]);
  check('ブロックの数（入れ子もふくむ）', countBlocks([{ type: 'if', cond: { type: 'compare' }, then: [say('a')] }]), 3);
}

// --- 段階 7-4: 部品のファイル
{
  const { partsToFile, partsFromFile } = require('../js/model/partsfile.js');
  const parts = [{ id: 'p1', name: 'あいさつ', blocks: [{ type: 'say', who: 0, text: 'やあ' }], variables: [{ name: '好感度', value: 3 }] }];
  const file = partsToFile(parts);
  check('書き出したファイルに id は入らない', JSON.parse(file).parts[0].id, undefined);
  const back = partsFromFile(file, []);
  check('読みこむと、名前・ブロック・変数がもどる', [back[0].name, back[0].blocks[0].text, back[0].variables[0].value], ['あいさつ', 'やあ', 3]);
  check('読みこむと、新しい id が付く', typeof back[0].id === 'string' && back[0].id.length > 1, true);
  check('名前がかぶったら変える', partsFromFile(file, ['あいさつ', 'あいさつ (2)']).map((p) => p.name), ['あいさつ (3)']);
  const mixed = JSON.stringify({ format: 'ikaga-parts/1', parts: [{ name: '', blocks: [{ type: 'say' }] }, { name: 'から', blocks: [] }, { name: 'よい', blocks: [{ type: 'say' }, 3] }] });
  check('形のおかしい部品は読みとばす', partsFromFile(mixed).map((p) => [p.name, p.blocks.length]), [['よい', 1]]);
  let err = '';
  try { partsFromFile('{"format":"ikaga/1","scripts":[]}'); } catch (e) { err = e.message; }
  check('部品のファイルでなければ not_parts', err, 'not_parts');
}

// --- 段階 7-2: キーのしぼり込み
{
  const { programOf } = require('../js/model/yaya.js');
  const p = Model.normalize({ scripts: [
    { id: 'k', kind: 'event', event: 'OnKeyPress', when: 'f1', blocks: [] },
    { id: 'n', kind: 'event', event: 'OnKeyPress', blocks: [] },
  ] });
  check('書き出した when をキーにほどく', p.scripts.map((s) => [s.key, 'when' in s]), [['f1', false], ['', false]]);
  check('キーの帽子の名前', p.scripts.map((s) => Model.scriptTitle(s)), ['f1 キーが押されたとき', 'キーが押されたとき']);
  check('キーが空なら when を書かない', programOf(p).scripts.map((s) => s.when), ['f1', undefined]);
}

// --- 段階 7-1: 決めた回数めの起動
{
  const one = (s) => Object.assign({ meta: {}, variables: [],
    scripts: [Object.assign({ id: 'a', kind: 'event', event: 'OnStudioNthBoot', blocks: [{ type: 'say', who: 0, text: 'やあ' }] }, s)] });
  check('使えない回数は言う', issuesOf(one({ nth: 0 }), 'は、使えません'), ['warn']);
  check('使える回数なら言わない', issuesOf(one({ nth: 3 }), 'は、使えません'), []);
  const p = Model.normalize({ scripts: [{ id: 'x', kind: 'event', event: 'OnStudioNthBoot', when: '7', blocks: [] }] });
  check('書き出した when を回数にほどく', [p.scripts[0].nth, 'when' in p.scripts[0]], [7, false]);
  check('回数めの起動の帽子の名前', Model.scriptTitle(p.scripts[0]), '7 回目に起動したとき');
}

// --- 段階 6-3: まだ反応していないイベント
{
  const keys = (list) => list.map((m) => (m.kind === 'talk' ? 'talk' : m.event + (m.builtin ? '*' : '')));
  check('からっぽなら、よく使うイベントとランダムトークを出す', keys(Lint.missingEvents({ scripts: [] })),
    ['OnFirstBoot*', 'OnBoot*', 'OnClose*', 'OnMouseDoubleClick*', 'OnNadeNade*', 'OnGhostChanged', 'OnGhostChanging', 'OnWindowStateRestore', 'talk']);
  const p = { scripts: [
    { kind: 'event', event: 'OnBoot', blocks: [] },
    { kind: 'event', event: 'OnClose', disabled: true, blocks: [] },
    { kind: 'event', event: 'OnNadeNade', area: 'Head', blocks: [] },
    { kind: 'talk', name: 'あ', blocks: [] },
  ] };
  check('置いたもの・手書きにあるものは出さない（止めたものは出す）', keys(Lint.missingEvents(p, ['OnGhostChanged'])),
    ['OnFirstBoot*', 'OnClose*', 'OnMouseDoubleClick*', 'OnGhostChanging', 'OnWindowStateRestore']);
}

// --- 段階 6-2: 続きもの
{
  const ser = (name, episodes) => ({ type: 'serial', name, end: 'loop', episodes });
  const ep = [{ type: 'say', who: 0, text: 'やあ' }];
  check('続きものの名前が空', issuesOf(withScript([ser('', [ep])]), '続きものに、名前がありません'), ['error']);
  check('続きものの名前がかぶっている', issuesOf(withScript([ser('あ', [ep]), ser('あ', [ep])]), 'が 2 つあります'), ['warn']);
  check('からっぽの話', issuesOf(withScript([ser('あ', [ep, []])]), 'からっぽの話'), ['warn']);
  check('ちゃんとした続きものは言わない', issuesOf(withScript([ser('あ', [ep, ep])]), '続きもの'), []);
}

// --- 段階 6-1: ランダムトークのしぼり込み
{
  const { programOf } = require('../js/model/yaya.js');
  const cond = { type: 'compare', op: '>', a: { type: 'var', name: 'こたえ' }, b: 5 };
  const talk = (extra) => withScript([], { scripts: [Object.assign({ id: 't', kind: 'talk', name: 'あ', weight: 1,
    blocks: [{ type: 'say', who: 0, text: 'やあ' }] }, extra)] });
  check('条件の中の変数も「読んでいる」に数える', issuesOf(talk({ cond }), 'どこでも使われていません'), []);
  check('条件の中の無い変数も知らせる',
    issuesOf(talk({ cond: Object.assign({}, cond, { a: { type: 'var', name: 'ないよ' } }) }), '「ないよ」がありません'), ['error']);
  const one = programOf(talk({ when: 'morning', cond })).scripts[0];
  check('書き出す形に時間帯と条件が入る', [one.when, one.cond && one.cond.type], ['morning', 'compare']);
  const none = programOf(talk({ when: 'たぶん' })).scripts[0];
  check('知らない時間帯と空の条件は書かない', ['when' in none, 'cond' in none], [false, false]);
}

// --- 段階 5-12: ひな形ウィザード
{
  const { STARTER_PARTS, starterProject } = require('../js/model/sample.js');
  const all = Object.fromEntries(STARTER_PARTS.map((x) => [x.key, true]));
  const none = Object.fromEntries(STARTER_PARTS.map((x) => [x.key, false]));
  const lintOf = (p) => { Model.project = p; return Lint.run(p).map((i) => `${i.level}: ${i.message}`); };
  check('ひな形: 全部入れても、チェックに引っかからない', lintOf(starterProject({ parts: all })), []);
  check('ひな形: いつもの部品でも、チェックに引っかからない', lintOf(starterProject()), []);
  check('ひな形: なにも入れなければ、からっぽで自動でしゃべらない',
    (() => { const p = starterProject({ parts: none }); return [p.scripts.length, p.variables.length, p.settings.randomTalkEnabled]; })(),
    [0, 0, false]);
  check('ひな形: 部品ごとに入れる', lintOf(starterProject({ parts: Object.assign({}, none, { menu: true }) })), []);
  const named = starterProject({ name: 'みかん', sakuraName: 'みか', keroName: 'かん', parts: Object.assign({}, none, { greet: true }) });
  check('ひな形: 名前がゴーストとあいさつに入る',
    [named.meta.name, named.meta.sakuraName, named.scripts[0].blocks[1].text], ['みかん', 'みか', 'はじめまして。みかです。']);
  const anniv = starterProject({ parts: Object.assign({}, none, { anniv: true }), today: new Date(2026, 9, 23) });
  check('ひな形: 記念日は今日の日づけ', [anniv.scripts[0].month, anniv.scripts[0].day], [10, 23]);
}

// --- 段階 5-10: 手書きの関数をえらぶ
{
  const { yayaCallChoices } = require('../js/model/yaya.js');
  check('えらべる手書きの関数（入り口としくみは外し、並べる）',
    yayaCallChoices(['Hand.Greet', 'OnBoot', 'On_homeurl', 'Studio.Event', 'SHIORI3FW.Init', 'aitalk', 'Hand.Greet', 'Once']),
    ['Hand.Greet', 'Once', 'aitalk']);
  check('つないでいなければ、えらぶものはない', yayaCallChoices(undefined), []);
}

// --- 段階 5-9: 記念日とアラーム
{
  const one = (s) => Object.assign({ meta: {}, variables: [],
    scripts: [Object.assign({ id: 'a', kind: 'event', blocks: [{ type: 'say', who: 0, text: 'やあ' }] }, s)] });
  check('ない時刻は言う', issuesOf(one({ event: 'OnStudioAlarm', hour: 24, minute: 0 }), 'は、ありません'), ['warn']);
  check('ある時刻なら言わない', issuesOf(one({ event: 'OnStudioAlarm', hour: 23, minute: 59 }), 'は、ありません'), []);
  check('ない日づけは言う', issuesOf(one({ event: 'OnStudioAnniversary', month: 4, day: 31 }), 'は、ありません'), ['warn']);
  check('2 月 29 日はある', issuesOf(one({ event: 'OnStudioAnniversary', month: 2, day: 29 }), 'は、ありません'), []);
  const p = Model.normalize({ scripts: [
    { id: 'x', kind: 'event', event: 'OnStudioAlarm', when: '07:05', blocks: [] },
    { id: 'y', kind: 'event', event: 'OnStudioAnniversary', when: '12-25', blocks: [] },
    { id: 'z', kind: 'event', event: 'OnStudioAlarm', blocks: [] },
  ] });
  check('書き出した when を、時刻と日づけにほどく',
    p.scripts.map((s) => [s.hour, s.minute, s.month, s.day, 'when' in s]),
    [[7, 5, undefined, undefined, false], [undefined, undefined, 12, 25, false], [12, 0, undefined, undefined, false]]);
  check('アラームの帽子の名前', Model.scriptTitle(p.scripts[0]), '毎日 07:05 になったとき');
  check('記念日の帽子の名前', Model.scriptTitle(p.scripts[1]), '毎年 12 月 25 日（記念日）');
}

// --- 段階 5-8: SSP のメニューの項目
{
  const menu = (items, extra) => Object.assign({
    meta: {}, variables: [],
    scripts: items.map((m, i) => ({ id: 'm' + i, kind: 'event', event: 'OnStudioMenu', menu: m,
      blocks: [{ type: 'say', who: 0, text: 'やあ' }] })),
  }, extra || {});
  check('メニューに出す名前が空', issuesOf(menu(['']), 'メニューに出す名前が空'), ['error']);
  check('メニューの名前がかぶっている', issuesOf(menu(['あ', 'あ']), 'が 2 つあります'), ['warn']);
  check('ちがう名前なら言わない', issuesOf(menu(['あ', 'い']), 'メニュー'), []);
  Model.project = Model.normalize(menu(['あ']));
  check('メニューの手書きとのかぶり',
    Lint.run(Model.project, { handwritten: ['On_sakura.recommendsites'] })
      .filter((i) => i.message.includes('On_sakura.recommendsites')).map((i) => i.level), ['warn']);
  check('メニューの帽子の名前', Model.scriptTitle(Model.project.scripts[0]), 'メニューの「あ」がえらばれたとき');
}

// --- 段階 5-6: 長すぎるセリフ・よばれないトーク・読まれない変数
check('長すぎるセリフは言う',
  issuesOf(withScript([{ type: 'say', who: 0, text: 'あ'.repeat(201) }]), '文字の長いセリフ'), ['warn']);
check('200 文字までのセリフは言わない',
  issuesOf(withScript([{ type: 'say', who: 0, text: 'あ'.repeat(200) }]), '文字の長いセリフ'), []);
{
  const fn = (blocks) => withScript(blocks, {
    scripts: [
      { id: 's1', kind: 'event', event: 'OnBoot', blocks },
      { id: 's2', kind: 'function', name: 'おまけ', blocks: [{ type: 'say', who: 0, text: 'やあ' }] },
    ],
  });
  check('どこからもよばれないトークは言う',
    issuesOf(fn([{ type: 'say', who: 0, text: 'やあ' }]), 'どこからもよばれていません'), ['warn']);
  check('よぶブロックがあれば言わない',
    issuesOf(fn([{ type: 'call', name: 'おまけ' }]), 'どこからもよばれていません'), []);
  check('選択肢の行き先も「よんでいる」に数える',
    issuesOf(fn([{ type: 'choice', label: 'はい', target: 'おまけ' }]), 'どこからもよばれていません'), []);
  check('◯秒後によぶ先も「よんでいる」に数える',
    issuesOf(fn([{ type: 'later', sec: 5, name: 'おまけ' }]), 'どこからもよばれていません'), []);
}
check('値を入れるだけの変数は言う',
  issuesOf(withScript([{ type: 'set', name: 'こたえ', value: 1 }]), '値を入れるだけ'), ['warn']);
check('読んでいれば言わない',
  issuesOf(withScript([{ type: 'set', name: 'こたえ', value: 1 },
    { type: 'say', who: 0, text: { type: 'var', name: 'こたえ' } }]), '値を入れるだけ'), []);

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

section('プロジェクトをまたいだコピー (clipboard)');
{
  // 画面の部品を、DOM の代わりの小さな入れもので動かします（お知らせの欄と localStorage だけ使う）
  const said = [];
  const box = { textContent: '', classList: { toggle() {}, add() {}, remove() {} } };
  globalThis.document = { querySelector: () => box };
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;   // お知らせを消すタイマーは要らない
  const { Clipboard } = require('../js/editor/clipboard.js');
  const { Session } = require('../js/core/session.js');
  const say = () => { said.push(box.textContent); return box.textContent; };

  // かたまり A: 変数「好感度」「こたえ」を使うブロック（はめこんだブロックの中の変数もふくむ）
  Model.init({
    format: 'ikaga/1', meta: { name: 'A' },
    variables: [{ name: '好感度', value: 5 }, { name: 'こたえ', value: 'はい' }, { name: '使わない', value: 0 }],
    scripts: [{ id: 's1', kind: 'event', event: 'OnBoot', blocks: [
      { type: 'if', cond: { type: 'compare', op: '>', a: { type: 'var', name: '好感度' }, b: 3 },
        then: [{ type: 'ask', into: 'こたえ', initial: '' }] },
    ] }],
  });
  const block = Model.project.scripts[0].blocks[0];
  check('使っている変数を、はめこんだブロックの中までさがす', Clipboard.usedVariables(block), ['好感度', 'こたえ']);
  Clipboard.copy(block);

  // 起動しなおしたつもりで、画面の中のコピーを消し、別のプロジェクト B にはりつける
  Session.clipboard = null;
  Session.clipboardVars = [];
  Model.init({ format: 'ikaga/1', meta: { name: 'B' }, variables: [{ name: '好感度', value: 100 }], scripts: [] });
  Clipboard.pasteAt(40, 40);
  say();
  const pasted = Model.project.scripts[0] && Model.project.scripts[0].blocks[0];
  check('起動しなおしても、別のプロジェクトにはりつけられる', JSON.stringify(pasted), JSON.stringify(block));
  check('はりつけた先に無い変数だけ、初期値つきで足す（ある変数の初期値はそのまま）',
    Model.project.variables, [{ name: '好感度', value: 100 }, { name: 'こたえ', value: 'はい' }]);
  check('足した変数をお知らせする', said[said.length - 1], 'はりつけました（変数「こたえ」も足しました）');
  Model.undo();
  check('元にもどすと、はりつけたものも足した変数も消える',
    [Model.project.scripts.length, Model.project.variables.length], [0, 1]);

  // 部品（editor/parts.js）: ブロックの並びと、使っている変数の初期値を持つ。元のブロックとは切り離す
  const { Parts } = require('../js/editor/parts.js');
  Model.init({
    format: 'ikaga/1', meta: { name: 'C' },
    variables: [{ name: '好感度', value: 5 }, { name: 'なまえ', value: 'きみ' }],
    scripts: [{ id: 's1', kind: 'event', event: 'OnBoot', blocks: [
      { type: 'say', who: 0, text: { type: 'join', a: 'やあ、', b: { type: 'var', name: 'なまえ' } } },
      { type: 'change', name: '好感度', value: 1 },
    ] }],
  });
  const stack = Model.project.scripts[0].blocks;
  const part = Parts.make('  あいさつ  ', stack);
  stack[0].who = 1;
  check('部品は、名前（前後の空白なし）・ブロックの写し・使っている変数の初期値を持つ',
    [part.name, part.blocks.length, part.blocks[0].who, part.variables],
    ['あいさつ', 2, 0, [{ name: 'なまえ', value: 'きみ' }, { name: '好感度', value: 5 }]]);

  // 辞書のブロックは辞書の画面に、トークのブロックはトークの画面にだけはりつける（段階 9-2）
  const dicStack = [{ type: 'y_out', value: '"a"', prefix: '' }];
  Clipboard.copy(dicStack[0]);
  const talkStack = [];
  const intoTalk = Clipboard.paste(talkStack, 0);
  const refusedTalk = say();
  const intoDic = Clipboard.paste(dicStack, 1, { dic: true });
  Clipboard.copy({ type: 'say', who: 0, text: 'やあ' });
  const intoDic2 = Clipboard.paste(dicStack, 0, { dic: true });
  const refusedDic = say();
  check('辞書のブロックはトークの列にははらず、辞書の列にははる。トークのブロックは辞書の列にははらない',
    [intoTalk, talkStack.length, refusedTalk, intoDic, dicStack.length, intoDic2, refusedDic],
    [false, 0, '辞書のブロックは、辞書の画面にはりつけます', true, 2, false, 'トークのブロックは、トークの画面にはりつけます']);
  globalThis.setTimeout = realTimeout;
  delete globalThis.document;
  delete globalThis.localStorage;
}

section('このかたまりの YAYA を見る (scriptYaya)');
{
  const { toYaya, programOf, scriptYaya } = require('../js/model/yaya.js');
  const program = programOf(Model.normalize({
    format: 'ikaga/1', meta: { name: 'Y' },
    scripts: [
      { id: 'a1', kind: 'event', event: 'OnBoot', note: 'あいさつ', blocks: [{ type: 'say', who: 0, text: 'やあ', nl: 1 }] },
      { id: 'a2', kind: 'talk', name: 'ひとり', blocks: [{ type: 'say', who: 1, text: 'ふむ', nl: 0 }] },
      { id: 'a3', kind: 'loose', blocks: [{ type: 'say', who: 0, text: 'はぐれ', nl: 0 }] },
    ],
  }));
  const one = scriptYaya(program, 'a1');
  check('書き出す辞書と 1 字もちがわない（そのまま中にある）', toYaya(program).includes(one), true);
  check('そのかたまりの関数だけを切り出す（メモのコメントもふくむ）',
    [one.split('\r\n')[0], one.includes('// メモ: あいさつ'), one.includes('やあ'), one.includes('ふむ'), one.endsWith('}')],
    ['// OnBoot  (a1)', true, true, false, true]);
  check('書き出さないかたまり（帽子の無いもの）は null', scriptYaya(program, 'a3'), null);
}

section('セリフの一覧と CSV (lines)');
{
  const { collectLines, linesToCsv, parseCsv, applyCsv } = require('../js/model/lines.js');
  Model.init({
    format: 'ikaga/1', meta: { name: 'L' },
    scripts: [
      { id: 's1', kind: 'event', event: 'OnBoot', blocks: [
        { type: 'say', who: 0, text: 'こんにちは', nl: 1 },
        { type: 'if', cond: { type: 'bool', value: true }, then: [{ type: 'say', who: 1, text: 'ふむ, "なるほど"\n2 行目', nl: 0 }] },
        { type: 'random_one', branches: [[{ type: 'say', who: 0, text: 'A', nl: 0 }], [{ type: 'say', who: 0, text: { type: 'var', name: 'x' } }]] },
      ] },
      { id: 'L', kind: 'loose', blocks: [{ type: 'say', who: 0, text: 'はぐれ', nl: 0 }] },
    ],
  });
  const lines = collectLines(Model.project);
  check('口の中・えらび先の中まで集め、帽子の無いかたまりは外す',
    lines.map((l) => [l.key, l.who, l.readonly]),
    [['s1/0', 0, false], ['s1/1/then/0', 1, false], ['s1/2/branches.0/0', 0, false], ['s1/2/branches.1/0', 0, true]]);
  const csv = linesToCsv(lines, (s) => s.event);
  const rows = parseCsv(csv);
  check('CSV は BOM つきで、カンマ・引用符・改行をふくむセリフも、読みもどすと同じになる',
    [csv.charCodeAt(0) === 0xfeff, rows.length, rows[2][3]], [true, 4, 'ふむ, "なるほど"\n2 行目']);
  rows[1][3] = 'やあ';                                  // 1 つだけ直す
  rows.push(['s9/0', 'もう無い', '0', 'x']);            // もう無いブロック
  const r = applyCsv(Model.project, rows);
  check('変わったセリフだけ書きもどし、もう無いブロックは数える',
    [r.changed, r.same, r.unknown, Model.project.scripts[0].blocks[0].text], [1, 2, ['s9/0'], 'やあ']);
  check('key と text の列が無い CSV は読まない', applyCsv(Model.project, parseCsv('a,b\n1,2')).error, 'no_columns');
}

section('さがして置きかえる (replace)');
{
  const { countText, replaceText } = require('../js/model/replace.js');
  Model.init({
    format: 'ikaga/1', meta: { name: 'R' },
    scripts: [{ id: 's1', kind: 'event', event: 'OnBoot', blocks: [
      { type: 'say', who: 0, text: 'ねこが好き。ねこ！', nl: 1 },
      { type: 'say', who: 0, text: { type: 'join', a: 'ねこ', b: 'と犬' }, nl: 0 },
      { type: 'yaya_call', name: 'Hand.ねこ', a: 'ねこ', b: '' },
      { type: 'wait', ms: 500 },
    ] }],
  });
  check('はめこんだブロックの中もふくめて数える（YAYA の関数の名前の欄は数えない）', countText(Model.project, 'ねこ'), 4);
  const n = replaceText(Model.project, 'ねこ', 'いぬ$&');
  const b = Model.project.scripts[0].blocks;
  check('置きかえた数と中身（$& はそのまま文字として入る）',
    [n, b[0].text, b[1].text.a, b[2].name, b[2].a, b[3].ms],
    [4, 'いぬ$&が好き。いぬ$&！', 'いぬ$&', 'Hand.ねこ', 'いぬ$&', 500]);
  check('空の言葉では何もしない', [countText(Model.project, ''), replaceText(Model.project, '', 'x')], [0, 0]);
  // 辞書は、文字列の中だけ（段階 9-3）。関数の名前・変数・コメントは置きかえない
  Model.init({ format: 'ikaga/1', meta: { name: 'R2' }, scripts: [], dics: [{ name: 'a.dic',
    text: 'ねこ.Say // ねこ\n{\n\t_ねこ = "ねこだよ" + \'ねこ\'\n\t_s = <<"\n\tねこの行\n">>\n}\n' }] });
  check('辞書は、文字列とヒアドキュメントの中だけを数える', countText(Model.project, 'ねこ'), 3);
  const m = replaceText(Model.project, 'ねこ', 'いぬ');
  check('辞書の文字列の中だけを置きかえる', [m, Model.project.dics[0].text],
    [3, 'ねこ.Say // ねこ\n{\n\t_ねこ = "いぬだよ" + \'いぬ\'\n\t_s = <<"\n\tいぬの行\n">>\n}\n']);
}

section('このソフトについて (about)');
{
  // もとにしたプロジェクトの表示は、ライセンス（なしライセンス 1.1 の 3 節）のための決まった文。
  // ヘルプの画面と README・LICENSE で、1 字もちがわないようにする（全角の空白もふくめて）
  const { ORIGIN_NOTICE } = require('../js/panels/about.js');
  const lines = ORIGIN_NOTICE.split('\n');
  const has = (rel) => {
    const text = fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/).map((l) => l.replace(/^[>\s]+/, ''));
    return lines.every((line) => text.includes(line));
  };
  check('表示は 3 行（もとにしたこと・場所・作者）', lines.length, 3);
  check('README.md・README.en.md・LICENSE と同じ文',
    ['README.md', 'README.en.md', 'LICENSE'].map(has), [true, true, true]);
  const html = fs.readFileSync(path.join(root, 'ui', 'index.html'), 'utf8');
  check('ヘルプの画面に、表示を入れる場所と元のページを開くボタンがある',
    [html.includes('id="about-notice"'), html.includes('id="btn-about-origin"')], [true, true]);
}

section('使えないイベント名 (eventNameOk。しくみ・yaya_base の関数と同じ名前)');
{
  const { toYaya, programOf } = require('../js/model/yaya.js');
  Model.init({
    format: 'ikaga/1', meta: { name: 'E' }, variables: [],
    scripts: ['ChainTalk', 'Studio.Event', 'OnBoot'].map((event, i) => ({ id: 'e' + i, kind: 'event', event,
      blocks: [{ type: 'say', who: 0, text: 'a', nl: 0 }] })),
  });
  const dic = toYaya(programOf(Model.project));
  const defined = (name) => dic.split(/\r?\n/).includes(name);
  check('しくみ・yaya_base の関数と同じ名前の入り口は書かない（OnBoot は書く）',
    [defined('ChainTalk'), defined('Studio.Event'), defined('OnBoot')], [false, false, true]);
  {
    // とても大きな数を 1e+21 と書くと、YAYA は 21 と読むので、そう書かない
    const big = Model.normalize({ format: 'ikaga/1', meta: { name: 'N' }, variables: [], scripts: [{ id: 'n', kind: 'event', event: 'OnBoot',
      blocks: [{ type: 'say', who: 0, text: '{待つ:1000000000000000000000}', nl: 0 }] }] });
    const out = toYaya(programOf(big));
    check('とても大きな数は、e の書きかたにしない', [/e\+/.test(out), out.includes('Studio.Wait(9007199254740991)')], [false, true]);
  }
  const { eventNameOk } = require('../js/model/yaya.js');
  check('YAYA の言葉・ローカル変数の形・元からある関数・yaya_base の大域変数・#globaldefine の名前をふくむものも使えない',
    ['if', 'others', '_x', 'STRLEN', 'reference', 'reference3', 'OnTALK_INTERVALx', 'OnBoot', 'OnMyEvent'].map(eventNameOk),
    [false, false, false, false, false, false, false, true, true]);
  const warns = Lint.run(Model.project).filter((i) => /使えないので、このかたまりは書き出しません/.test(i.message)).map((i) => i.message);
  check('チェックタブで知らせる', warns.length, 2);
}

section('プログラムやファイルにさわる YAYA (Lint.riskyCode。「ためす」の前に確かめる)');
{
  Model.init({
    format: 'ikaga/1', meta: { name: 'R' }, variables: [],
    dics: [{ name: 'a.dic', text: 'A\n{\n\t_x = STRLEN("FDEL(1)") // EXECUTE(1)\n\tFDEL("x")\n\tFDEL("y")\n}\n' }],
    scripts: [{ id: 's1', kind: 'event', event: 'OnBoot', blocks: [
      { type: 'say', who: 0, text: { type: 'yaya_expr', code: 'MKDIR("x")' }, nl: 0 },
      { type: 'yaya_call', name: 'LOADLIB', a: '', b: '' },
      { type: 'yaya_call', name: 'Hand.Hi', a: '', b: '' },
      { type: 'yaya_expr', code: 'EVAL("1")', disabled: true },
    ] }],
  });
  const risky = Lint.riskyCode(Model.project).map((r) => [r.name, r.dic || r.block.type, r.line || 0]);
  check('辞書（文字列とコメントの中も見る。名前ごとに 1 か所）と、YAYA の式・関数をよぶブロック（無効にしたものも）',
    risky, [['FDEL', 'a.dic', 3], ['EXECUTE', 'a.dic', 3], ['MKDIR', 'yaya_expr', 0], ['LOADLIB', 'yaya_call', 0], ['EVAL', 'yaya_expr', 0]]);
  const warns = Lint.run(Model.project).filter((i) => /プログラムやファイルにさわる/.test(i.message)).map((i) => i.message);
  check('チェックタブに、どこで何をよんでいるかが出る', warns.length, 5);

  // 人からもらったファイルで、確かめをすりぬけようとする書きかた
  const { riskyCalls, dicDefines } = require('../js/model/dics.js');
  const names = (text, defines) => riskyCalls(text, defines).map((r) => r.name + '@' + r.line);
  check('行の頭に書いた文・( が次の行・/ でつないだ名前',
    [names('OnBoot\n{\nEXECUTE("calc.exe")\n}'), names('A\n{\n\tEXECUTE /\n\t("x")\n}'), names('A\n{\n\t_x = EXEC/\nUTE("x")\n}')],
    [['EXECUTE@3'], ['EXECUTE@3'], ['EXECUTE@3']]);
  check('#define で名前を書きかえたもの（ほかの辞書の #globaldefine も）',
    [names('#define RUN EXECUTE\nA\n{\n\tRUN("x")\n}', dicDefines(['#define RUN EXECUTE'])),
      names('A\n{\n\tGO("x")\n}', dicDefines(['#globaldefine GO EXE', '#globaldefine EXE EXECUTE']))],
    [['EXECUTE@1'], ['EXECUTE@3']]);
  check('yaya_base やしくみの、上のものをよぶ関数と、SAORI を止める印',
    names('A\n{\n\tCALLBYNAME("x")\n\tFUNCTIONLOAD("x")\n\tStudio.noSaori = 0\n\tAyaTest.Eval("x")\n}'),
    ['CALLBYNAME@3', 'FUNCTIONLOAD@4', 'Studio.noSaori@5', 'AyaTest.Eval@6']);
  check('ふつうの文は知らせない', names('A\n{\n\t_x = STRLEN("EXECUTED") + EXECUTE_COUNT\n\tStudio.Say(0, "x")\n}'), []);

  Model.init({
    format: 'ikaga/1', meta: { name: 'R2' }, variables: [], dics: [],
    scripts: [
      { id: 's1', kind: 'event', event: 'OnBoot', blocks: [
        { type: 'say', who: 0, text: 'hi', nl: 0, surface: { type: 'yaya_expr', code: 'EXECUTE("a")' } },
        { type: 'call', target: { type: 'yaya_call', name: 'FUNCTIONLOAD', a: '', b: '' } },
      ] },
      { id: 's2', kind: 'talk', name: 'hidden', disabled: true, blocks: [{ type: 'yaya_call', name: 'Studio.YayaExpr', a: '', b: '' }] },
    ],
  });
  check('ブロックの形にない欄にはめたものと、無効にしたトークの中も見る',
    Lint.riskyCode(Model.project).map((r) => r.name), ['EXECUTE', 'FUNCTIONLOAD', 'Studio.YayaExpr']);
}

section('yaya_base としくみの関数で、RISKY_FUNCTIONS をよぶものは、それ自体も RISKY_FUNCTIONS にあるか、決まったものだけをよぶ');
{
  const fs = require('fs');
  const path = require('path');
  const { RISKY_FUNCTIONS } = require('../js/model/dics.js');
  // 渡された文字ではなく、決まった名前・決まったファイルだけに使っているもの（中を読んで確かめたもの）
  const FIXED = new Set([
    // studio_runtime.dic
    'Studio.Log', 'Studio.TalkOk', 'Studio.RunOne', 'Studio.CallIndex', 'Studio.Saori',
    // studio_preview.dic（「ためす」の入り口。どのかたまりを動かすかは ISFUNC で確かめた名前だけ）
    'OnStudioPreview',
    // yaya_base
    'SHIORI3FW.AssembleReferenceHeader', 'ChainTalk', 'SHIORI3FW.Lint.Run', 'SHIORI3FW.Lint.ReadTexts', 'request',
    'SHIORI3FW.TranslateEvent', 'SHIORI3FW.MakeReferenceAndPassThruInsVariable', 'SHIORI3FW.MakeValueexVariable',
    'SHIORI3FW.GetGhostNameFromDescriptTxt', 'SHIORI3FW.GetCharsetFromDescriptTxt', 'SHIORI3FW.InternalSaoriAvailable',
    'GET_PROPERTY', 'SHIORI3FW.SaoriUnloadAll', 'SHIORI3EV.On_hwnd', 'SHIORI3EV.OnNotifySelfInfo', 'SHIORI3EV.OnShellChanged',
    'SHIORI3EV.OnBalloonChange', 'SHIORI3EV.OnAITalkNewEvent', 'SHIORI3EV.On_enable_log', 'DUMP', 'load', 'unload',
    'SHIORI3FW.Dl2ToDll', 'SHIORI3FW.SendGETVersion',
  ]);
  const root = path.join(__dirname, '..', '..');
  const files = [
    ...fs.readdirSync(path.join(root, 'third_party', 'yaya-dic', 'yaya_base')).filter((f) => f.endsWith('.dic'))
      .map((f) => path.join(root, 'third_party', 'yaya-dic', 'yaya_base', f)),
    path.join(root, 'studio', 'res', 'yaya', 'studio_runtime.dic'),
    path.join(root, 'studio', 'res', 'yaya', 'studio_preview.dic'),
  ];
  const missing = [];
  for (const file of files) {
    let fn = '';
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const head = /^([A-Za-z_][A-Za-z0-9_.]*)\s*(?::.*)?$/.exec(line);
      if (head && !/^(if|else|elseif|while|for|foreach|switch|case|when|others)$/.test(head[1])) { fn = head[1]; continue; }
      const code = line.replace(/\/\/.*$/, '');
      if (!fn || RISKY_FUNCTIONS.has(fn) || FIXED.has(fn)) continue;
      for (const name of RISKY_FUNCTIONS) {
        if (new RegExp('(^|[^A-Za-z0-9_.])' + name.replace(/\./g, '\\.') + '\\s*\\(').test(code)) {
          missing.push(`${path.basename(file)}: ${fn} → ${name}`);
        }
      }
    }
  }
  check('漏れ', [...new Set(missing)], []);
}

section('辞書でよんでいる、どこにも無い関数 (dicIssues。段階 9-1)');
{
  const { dicIssues } = require('../js/model/dics.js');
  const found = (dics, opts) => {
    const out = [];
    dicIssues({ dics }, (level, msg, hint, where) => { if (/どこにも無い関数/.test(msg)) out.push([level, where.dic, where.line, msg.match(/「([^」]+)」は/)[1]]); }, opts);
    return out;
  };
  const text = 'Greet\n{\n\t_n = STRLEN("a(b") + Helper(1) // Nope0(1)\n\tStudio.Event("OnBoot")\n\tif (_n) { Nope1(2) }\n\tSHIORI3FW.RegisterTempVar("x")\n\tNope1(3)\n\tOnBoot()\n}\nHelper\n{\n\t1\n}\n';
  check('元からある関数・辞書の関数・しくみ・yaya_base・ブロックのイベントはよい。無いものは最初の 1 か所だけ（コメントと文字列はのぞく）',
    found([{ name: 'a.dic', text }], { blockEvents: ['OnBoot'] }), [['warn', 'a.dic', 5, 'Nope1']]);
  check('ほかの辞書の関数もよい', found([{ name: 'a.dic', text: 'A\n{\n\tB()\n}\n' }, { name: 'b.dic', text: 'B\n{\n\t1\n}\n' }]), []);
  check('つないでいるあいだと、読めない辞書では見ない',
    [found([{ name: 'a.dic', text: 'A\n{\n\tX()\n}\n' }], { linked: true }).length, found([{ name: 'a.dic', text: 'A\n{\n\tX(\n}\n' }]).length], [0, 0]);
}

section('ゴーストの辞書を読みこむときの名前 (importDicName)');
{
  const { importDicName, dicNameOk } = require('../js/model/dics.js');
  const names = [importDicName('dic/aitalk.dic', []), importDicName('Talk.dic', ['talk.dic', 'talk_2.dic']),
    importDicName('studio_runtime.dic', []), importDicName('a:b.dic', []), importDicName('readme', [])];
  check('フォルダの区切り・かぶり（大文字小文字も）・スタジオのファイル・使えない文字・.dic の無い名前',
    names, ['dic_aitalk.dic', 'Talk_3.dic', 'imported_studio_runtime.dic', 'a_b.dic', 'readme.dic']);
  const long = 'x'.repeat(70) + '.dic';
  names.push(importDicName(long, [importDicName(long, [])]));
  check('どれも辞書の名前に使える（長い名前に _2 を付けても 64 字まで）', [names.every(dicNameOk), names[5].length, names[5].endsWith('_2.dic')], [true, 64, true]);
  const odd = [importDicName('aitalk~1.dic', []), importDicName('a,b.dic', []), importDicName('nul.dic', [])];
  check('~ と , は _ にし、機械の名前には _ を前に付ける', [odd, odd.every(dicNameOk)],
    [['aitalk_1.dic', 'a_b.dic', '_nul.dic'], true]);
}

section('「元にもどす」に積む前に、画面の側のものを書きもどす (Model.onCommit。辞書の画面のブロック)');
{
  // 辞書の画面は、ブロックをプロジェクトの外に持ち、変わったら辞書のテキストに書きます（panels/dictionary.js）。
  // ここでは「外のもの」を out にして、act・pushUndo が積む前に書きもどすことと、元にもどすで前にもどることを見ます
  Model.init({ format: 'ikaga/1', meta: { name: 'D' }, dics: [{ name: 'a.dic', text: 'A' }], scripts: [] });
  const out = { text: 'A' };
  Model.commitHooks.length = 0;
  Model.onCommit(() => { Model.project.dics[0].text = out.text; });
  Model.act(() => { out.text = 'B'; });
  check('act: 外で変えたものが、プロジェクトに入る', Model.project.dics[0].text, 'B');
  const snap = Model.clone(Model.project);
  out.text = 'C';
  Model.pushUndo(snap);
  check('pushUndo: 外で変えたものを書きもどしてからくらべるので、記録が積まれる', [Model.project.dics[0].text, Model.undoStack.length], ['C', 2]);
  Model.undo();
  check('元にもどすと、前のテキスト', Model.project.dics[0].text, 'B');
  Model.commitHooks.length = 0;
}

// ------------------------------------------------------------------ おしまい
if (failed) {
  console.log(`${red}[editor] ${failed} か所ちがいます（${checked} か所中）。${off}`);
  process.exit(1);
}
console.log(`${green}[editor] ${checked} か所すべて期待どおりです。${off}`);
