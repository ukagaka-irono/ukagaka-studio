/* YAYA の文を読む・書くところのテスト（ui/js/model/yayatext.js。段階 8-1）
 *
 *   node ui\test\yayatext.js
 *
 *   1. YAYA の構文（https://yaya-shiori.github.io/yaya-docs/grammar/ の例）が、まちがいなく読めて、決まった木になるか
 *   2. 書いたものをもう一度読んで書くと、同じテキストになるか（ブロックとテキストを行き来しても、くずれない）
 *   3. 本物の辞書（yaya_base・studio_runtime.dic・手書きのテスト用ゴースト・書き出しの見本）が、ひとつ残らず読めるか
 *   4. 読めない関数があっても、ほかの関数は読み、読めない関数は書いたままの文字で残るか
 *   5. 辞書のブロック（ui/js/model/yblocks.js。段階 8-4）にして、もどしても同じ辞書になるか。どの構文にもブロックがあるか
 *
 * 書いた辞書を本物の yaya.dll で動かして、もとの辞書と同じ答えになるかは、shiori\test\yaya\yaya.js が見ます。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const { parseYaya, printYaya, parseExpr, printExpr } = require('../js/model/yayatext.js');
const YB = require('../js/model/yblocks.js');
const COLOR = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', off: '\x1b[0m' };
const { red, green, dim, off } = COLOR;

let failed = 0;
let checks = 0;
function check(what, got, want) {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) { console.log(`${green}  OK  ${off}${what}`); return; }
  failed++;
  console.log(`${red}  だめ ${what}${off}`);
  console.log(`        ほしい: ${b}`);
  console.log(`        出た  : ${a}`);
}
const section = (s) => console.log(`${dim}  ---- ${s}${off}`);

/** 木をブロックにして、もどして書いたテキスト（ブロックは JSON にして、プロジェクトに入れたのと同じにする） */
const viaBlocks = (dic) => printYaya(YB.viewToAst(JSON.parse(JSON.stringify(YB.astToView(dic)))).dic);
/** 読んで、まちがいが無く、書いて読みなおしても、ブロックにしてもどしても同じテキストになるか。木を返す */
function roundTrip(what, text) {
  const a = parseYaya(text);
  const p1 = printYaya(a.dic);
  const b = parseYaya(p1);
  const p2 = printYaya(b.dic);
  check(`${what}（読める・書きなおしても、ブロックにしても同じ）`, [a.errors, b.errors, p1 === p2, viaBlocks(a.dic) === p1], [[], [], true, true]);
  return a.dic;
}
const body = (dic, k = 0) => dic.items.filter((x) => x.type === 'func')[k].body.items;
// 式の形を短く（bin は [op, 左, 右]、名前と数と文字はそのまま）
function shape(e) {
  if (!e) return null;
  switch (e.type) {
    case 'bin': return [e.op, shape(e.left), shape(e.right)];
    case 'name': return e.name;
    case 'num': return '#' + e.raw;
    case 'str': return e.quote + e.raw + e.quote;
    case 'call': return { call: e.name, args: e.args.map(shape) };
    case 'ref': return ['&', shape(e.expr)];
    case 'index': return { index: shape(e.target), args: e.args.map(shape) };
    case 'unary': return [e.op + '()', shape(e.expr)];
    case 'incdec': return e.prefix ? [e.op + 'x', shape(e.expr)] : ['x' + e.op, shape(e.expr)];
    case 'list': return { list: e.items.map(shape) };
    case 'paren': return { paren: shape(e.expr) };
    case 'heredoc': return '<<' + e.quote + e.raw + e.quote + '>>';
    default: return e.type;
  }
}

// ================================================================== 1. 構文
section('関数と出力（選択方式・入れ子・出力確定子）');
{
  const d = roundTrip('選択方式つきの関数', 'request : nonoverlap\n{\n\t"Hello World"\n\t"こんにちは世界"\n}\n');
  const f = d.items[0];
  check('関数の名前と選択方式', [f.name, f.mode, f.body.items.length], ['request', 'nonoverlap', 2]);
  const d2 = roundTrip('出力確定子', 'request\n{\n\t"Hello"\n\t"Perfect"\n\t--\n\t" Wor"\n\t--\n\t"ld"\n}\n');
  check('-- は文になる', body(d2).map((s) => s.type), ['expr', 'expr', 'sep', 'expr', 'sep', 'expr']);
  const d3 = roundTrip('入れ子と、入れ子の選択方式', 'request\n{\n\tnonoverlap : {\n\t\t"a"\n\t\t"b"\n\t}\n\t{\n\t\t"c"\n\t}\n\t"d"\n}\n');
  check('入れ子の選択方式', body(d3).map((s) => [s.type, s.mode || null]), [['block', 'nonoverlap'], ['block', null], ['expr', null]]);
  const d4 = roundTrip('if のあとの選択方式つきの入れ子', 'request\n{\n\tif 1 ; nonoverlap : {\n\t\t"a"\n\t}\n}\n');
  check('if の中身が選択方式つきの入れ子', body(d4)[0].branches[0].body.mode, 'nonoverlap');
  const d5 = roundTrip('_pool と melt_', 'OnTest : _pool_nonoverlap\n{\n\t"x"\n\tmelt_nonoverlap : {\n\t\t("red", "green")\n\t}\n}\n');
  check('_pool と melt_ の選択方式', [d5.items[0].mode, body(d5)[1].mode], ['_pool_nonoverlap', 'melt_nonoverlap']);
  const d6 = roundTrip('1 行に詰めて書いた関数', 'request{"Hello World"}\n');
  check('1 行の関数', body(d6).map((s) => shape(s.expr)), ['"Hello World"']);
  const d7 = roundTrip('セミコロンで区切った文', 'request\n{\n\tanswer = 1 + 2; "答えは" + answer + "です。";;\n}\n');
  check('セミコロンで 2 つの文', body(d7).length, 2);
  const d8 = roundTrip('parallel と void', 'foo\n{\n\tparallel ("A", "B", "C")\n\tvoid bar()\n}\n');
  check('parallel・void は前に付く', body(d8).map((s) => s.prefix), ['parallel', 'void']);
}

section('値（数・文字列・ヒアドキュメント・行のつなぎ）');
{
  const d = roundTrip('いろいろな数', 'n\n{\n\t10\n\t0b1010\n\t0xa\n\t3.14\n\t-1.5\n}\n');
  check('数は書いたまま', body(d).map((s) => shape(s.expr)), ['#10', '#0b1010', '#0xa', '#3.14', ['-()', '#1.5']]);
  const d2 = roundTrip('" と \' の重ね書き', 's\n{\n\t"1""2"\n\t\'1\'\'2\'\n\t\'1\'\'2"3\'\n\t"%(_i)の%(SQRT(_i))"\n}\n');
  check('文字列は中身を書いたまま', body(d2).map((s) => shape(s.expr)), ['"1""2"', "'1''2'", "'1''2\"3'", '"%(_i)の%(SQRT(_i))"']);
  const d3 = roundTrip('ヒアドキュメント', 'h\n{\n\t_s = <<"\n行1\n%(_x)\n">>\n\t<<\'\n行2\n\'>>\n}\n');
  check('ヒアドキュメントは中身ごと', body(d3).map((s) => shape(s.expr)), [['=', '_s', '<<"\n行1\n%(_x)\n">>'], "<<'\n行2\n'>>"]);
  const d4 = parseYaya('j\n{\n\t"ABCD/\n    EFG"\n\treq/\nuest\n}\n');
  check('行末の / で次の行とつなぐ（頭の空白は消す）', body(d4.dic).map((s) => shape(s.expr)), ['"ABCDEFG"', 'request']);
  const d5 = parseYaya('k\n{\n\t"a" // おわり /\n\t"b"\n}\n');
  check('// のコメントの行末の / では、つながない', body(d5.dic).map((s) => [shape(s.expr), s.trail || null]), [['"a"', '// おわり /'], ['"b"', null]]);
}

section('演算（強さ・左結合・代入・配列・ハッシュ・&）');
{
  const e = (s) => shape(parseExpr(s));
  check('掛け算が先', e('1 + 2 * 3'), ['+', '#1', ['*', '#2', '#3']]);
  check('かっこが先', e('(1 + 2) * 3'), ['*', { paren: ['+', '#1', '#2'] }, '#3']);
  check('代入も左から結びつく（i = j = 10 は (i = j) = 10）', e('i = j = 10'), ['=', ['=', 'i', 'j'], '#10']);
  check('比較・論理の強さ', e('a == 1 && b != 2 || !c'), ['||', ['&&', ['==', 'a', '#1'], ['!=', 'b', '#2']], ['!()', 'c']]);
  check('_in_ と !_in_', [e('"or" _in_ "World"'), e('x !_in_ y')], [['_in_', '"or"', '"World"'], ['!_in_', 'x', 'y']]);
  check('複合代入と :=', [e('a += 1'), e('a ,= ("x", 1)'), e('a := 1'), e('a +:= 2')],
    [['+=', 'a', '#1'], [',=', 'a', { paren: { list: ['"x"', '#1'] } }], [':=', 'a', '#1'], ['+:=', 'a', '#2']]);
  check(', は代入より弱い（i = 100, "test" は (i = 100), "test"）', e('i = 100, "test"'), { list: [['=', 'i', '#100'], '"test"'] });
  check('前置と後置の ++ --', [e('_i++'), e('--_i')], [['x++', '_i'], ['--x', '_i']]);
  check('配列の要素・区切り・範囲・つなげた [ ]', [e('_a[1]'), e('_s[2, "is"]'), e('_ar[2][1, "|"]'), e('name[1, 3]')],
    [{ index: '_a', args: ['#1'] }, { index: '_s', args: ['#2', '"is"'] }, { index: { index: '_ar', args: ['#2'] }, args: ['#1', '"|"'] },
      { index: 'name', args: ['#1', '#3'] }]);
  check('配列とハッシュ', [e('(IARRAY, 100)'), e('IHASH("a", 1)["a"]')],
    [{ paren: { list: ['IARRAY', '#100'] } }, { index: { call: 'IHASH', args: ['"a"', '#1'] }, args: ['"a"'] }]);
  check('引数の &（書きもどし）', e('foo(1, &_v, &_a[1])'), { call: 'foo', args: ['#1', ['&', '_v'], ['&', { index: '_a', args: ['#1'] }]] });
  check('引数なしのかっこ', e('IHASH()'), { call: 'IHASH', args: [] });
  check('ブロックから作った木には、要るかっこを足して書く',
    printExpr({ type: 'bin', op: '*', left: { type: 'bin', op: '+', left: { type: 'num', raw: '1' }, right: { type: 'num', raw: '2' } }, right: { type: 'num', raw: '3' } }),
    '(1 + 2) * 3');
  check('- -x と + +x は、--x・++x にしない', ['_z = - -_y', '_z = + +_y', '_z = -(-1)'].map((s) => printExpr(parseExpr(s))),
    ['_z = - -_y', '_z = + +_y', '_z = -(-1)']);
}

section('フロー制御');
{
  const d = roundTrip('if・elseif・else（{ } を省いた形も）',
    'r\n{\n\tif !i\n\t\t"0"\n\telseif i == 5 {\n\t\t"5"\n\t}\n\t// ほか\n\telse\n\t\t"?"\n}\n');
  const s = body(d)[0];
  check('if の形', [s.type, s.branches.length, !!s.else, s.elseComments], ['if', 2, true, ['// ほか']]);
  const d2 = roundTrip('case・when・others（列挙・範囲・1 行）',
    'c\n{\n\tcase name {\n\twhen "P3", "P4"\n\t\t"a"\n\twhen "P5"-"PX" {\n\t\t"b"\n\t}\n\twhen -1; "neg"\n\twhen 1-5; "range"\n\tothers;        "unknown"\n\t}\n}\n');
  const c = body(d2)[0];
  check('when のラベル', c.whens.map((w) => w.labels.map((l) => [l.from.raw, l.to ? l.to.raw : null])),
    [[['P3', null], ['P4', null]], [['P5', 'PX']], [['-1', null]], [['1', '5']]]);
  check('others', !!c.others, true);
  const d3 = roundTrip('switch', 'w\n{\n\tswitch id {\n\t\t"0"\n\t\t{\n\t\t\t"2a"\n\t\t\t"2b"\n\t\t}\n\t}\n}\n');
  check('switch の形', [body(d3)[0].type, body(d3)[0].body.items.length], ['switch', 2]);
  const d4 = roundTrip('while・for・foreach（かっこあり・なし）',
    'l\n{\n\twhile _i < 11 {\n\t\t_i++\n\t}\n\tfor _i = 1; _i < 11; _i++ {\n\t\t"x"\n\t}\n\tfor (_i = 0; _i < 3; _i++) {\n\t\tbreak\n\t}\n\tforeach _str; _i {\n\t\tcontinue\n\t}\n\tforeach (_h; _k, _v) {\n\t\t_s += _k\n\t}\n}\n');
  check('ループの形', body(d4).map((x) => [x.type, x.wrapped || false, x.vars || null]),
    [['while', false, null], ['for', false, null], ['for', true, null], ['foreach', false, ['_i']], ['foreach', true, ['_k', '_v']]]);
  const d5 = roundTrip('return（値あり・なし）', 'to_rad\n{\n\tif GETTYPE(_argv[0]) == 3 {\n\t\t-1\n\t\treturn\n\t}\n\treturn _argv[0] * 2.0\n}\n');
  check('return の形', [body(d5)[0].branches[0].body.items[1], shape(body(d5)[1].expr)],
    [{ type: 'return', expr: null }, ['*', { index: '_argv', args: ['#0'] }, '#2.0']]);
}

section('コメントとプリプロセス');
{
  const d = roundTrip('コメントと #define・#ifdef',
    '#define TALK_INTERVAL 180\n// 関数の前のコメント\n/* ながい\n   コメント */\nOnBoot\n{\n#ifdef __AYA_SYSTEM_YAYA6__\n\t"6" // うしろのコメント\n#else\n\t"5"\n#endif\n}\n');
  check('いちばん外の並び', d.items.map((x) => x.type), ['directive', 'comment', 'comment', 'func']);
  check('関数の中の #ifdef と、うしろのコメント', body(d).map((s) => [s.type, s.trail || null]),
    [['directive', null], ['expr', '// うしろのコメント'], ['directive', null], ['expr', null], ['directive', null]]);
  const d2 = roundTrip('関数のあいだの空行は 1 行にまとめる', 'a\n{\n\t1\n}\n\n\n\nb\n{\n\t2\n}\n');
  check('空行', d2.items.map((x) => x.type), ['func', 'blank', 'func']);
}

// ================================================================== 2・3. 本物の辞書
section('本物の辞書がひとつ残らず読めて、書きなおしてもくずれない');
{
  const base = path.join(root, 'third_party', 'yaya-dic', 'yaya_base');
  const files = fs.readdirSync(base).filter((f) => f.endsWith('.dic')).map((f) => path.join(base, f))
    .concat([
      path.join(root, 'studio', 'res', 'yaya', 'studio_runtime.dic'),
      path.join(root, 'studio', 'res', 'yaya', 'studio_preview.dic'),
      path.join(root, 'shiori', 'test', 'yaya', 'handwritten', 'ghost', 'master', 'hand.dic'),
    ]);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const a = parseYaya(text);
    const p1 = printYaya(a.dic);
    const p2 = printYaya(parseYaya(p1).dic);
    const count = (s, re) => (s.match(re) || []).length;
    const funcs = a.dic.items.filter((x) => x.type === 'func').length;
    check(`${path.relative(root, f)}（関数 ${funcs} こ。ブロックにしても同じ）`,
      [a.errors.length, a.dic.items.filter((x) => x.type === 'raw').length, p1 === p2, count(text, /\/\//g) === count(p1, /\/\//g),
        viaBlocks(a.dic) === p1],
      [0, 0, true, true, true]);
  }
}

section('yaya_base の関数の一覧（model/dics.js。辞書の関数のかぶりを見るのに使う）がそろっているか');
{
  const { YAYA_BASE_FUNCTIONS } = require('../js/model/dics.js');
  const base = path.join(root, 'third_party', 'yaya-dic', 'yaya_base');
  const names = new Set();
  for (const f of fs.readdirSync(base).filter((x) => x.endsWith('.dic'))) {
    for (const it of parseYaya(fs.readFileSync(path.join(base, f), 'utf8')).dic.items) if (it.type === 'func') names.add(it.name);
  }
  check(`yaya_base の関数（${names.size} こ）と一覧が同じ`, [...names].sort(), [...YAYA_BASE_FUNCTIONS].sort());
}

section('色分け（highlightYaya。辞書の画面のテキストエディタ）');
{
  const { highlightYaya } = require('../js/model/yayatext.js');
  const text = '#define X 1\nOnBoot : nonoverlap\n{\n\tif _i > 0x1f { "a""b" } // c\n\t/* d\n\te */ foo(1)\n\t_s = <<\'\n\tx\n\'>>\n}';
  const hl = highlightYaya(text);
  check('つなげると、もとのテキストの行にもどる', hl.map((l) => l.map((s) => s[1]).join('')).join('\n'), text);
  const kinds = (row) => hl[row].filter((s) => s[0]).map((s) => `${s[0]}:${s[1].trim()}`);
  check('# の行', kinds(0), ['dir:#define X 1']);
  check('行の頭の関数の名前と、選択方式', kinds(1), ['def:OnBoot']);
  check('言葉・数・文字列・コメント', kinds(3), ['kw:if', 'num:0x1f', 'str:"a""b"', 'com:// c']);
  check('複数行のコメントと、( が続く名前', [kinds(4), kinds(5)], [['com:/* d'], ['com:e */', 'call:foo', 'num:1']]);
  check('ヒアドキュメントは文字列の色', [kinds(6), kinds(7), kinds(8)], [["str:<<'"], ['str:x'], ["str:'>>"]]);
  check('打っている途中（閉じていない文字列）でも投げない', highlightYaya('a\n{\n\t"abc\n}').length, 4);
}

// ================================================================== 4. 読めない関数
section('読めない関数があっても、ほかを読み、書いたままで残す');
{
  const bad = 'bad\n{\n\tif {\n\t}\n\t"x"\n}';
  const r = parseYaya(`good\n{\n\t"ok"\n}\n${bad}\ngood2 { "y" }\n`);
  check('まちがいは 1 つ・行番号つき（if の条件が無い 7 行目）', r.errors.map((e) => [e.line, e.code]), [[7, 'unexpected']]);
  check('読めない関数は書いたままの文字', r.dic.items.map((x) => (x.type === 'raw' ? x.text : x.type)), ['func', bad, 'func']);
  check('書きもどすと、読めない関数もそのまま', printYaya(r.dic), `good\n{\n\t"ok"\n}\n${bad}\ngood2\n{\n\t"y"\n}\n`);
  const r2 = parseYaya('a\n{\n\t"とじていない\n}\n');
  check('とじていない文字列も、まちがいとして知らせる', r2.errors.map((e) => e.code), ['unterminated_string']);
}

// ================================================================== 5. 辞書のブロック
section('辞書のブロック（yblocks.js）');
{
  const { BLOCKS } = require('../js/model/blocks.js');
  const yTypes = Object.keys(BLOCKS).filter((k) => k.startsWith('y_')).sort();
  // 本物の辞書と、構文の例に出てくるブロック
  const seen = new Set();
  const walk = (x) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      if (typeof x.type === 'string' && x.type.startsWith('y_')) seen.add(x.type);
      if (x.kind === 'yfunc') seen.add('y_func');
      Object.values(x).forEach(walk);
    }
  };
  const base = path.join(root, 'third_party', 'yaya-dic', 'yaya_base');
  const dics = fs.readdirSync(base).filter((f) => f.endsWith('.dic')).map((f) => fs.readFileSync(path.join(base, f), 'utf8'));
  dics.push(fs.readFileSync(path.join(root, 'shiori', 'test', 'yaya', 'handwritten', 'ghost', 'master', 'hand.dic'), 'utf8'));
  const extra = 'f\n{\n\tg(&(_a[0]))\n}\nbad\n{\n\tif {\n}\n';
  for (const text of dics.concat([extra])) walk(YB.astToView(parseYaya(text).dic));
  check('どのブロックも、本物の辞書か例のどこかに出てくる（使われないブロックが無い）', yTypes.filter((k) => !seen.has(k)), []);
  check('構文のブロックは 30 こ', yTypes.length, 30);
  // ブロックの説明（docs/blocks.md と英語版）の「辞書のブロック」の表に、どのブロックも書いてあるか（段階 9-4）
  const docs = ['blocks.md', path.join('en', 'blocks.md')].map((f) => fs.readFileSync(path.join(root, 'docs', f), 'utf8'));
  check('ブロックの説明（日本語・英語）に、どの辞書のブロックの行もある', docs.map((d) => yTypes.filter((k) => !d.includes('| `' + k + '` |'))), [[], []]);
  check('読めない関数は「読めない YAYA」のブロックで、書いたままもどる', viaBlocks(parseYaya(extra).dic), printYaya(parseYaya(extra).dic));

  // 欄に書いた文字
  const one = (blocks) => printYaya(YB.viewToAst({ scripts: [{ kind: 'yfunc', name: 'F', mode: '', blocks }] }).dic);
  check('欄の文字は YAYA の式として読む', one([{ type: 'y_out', value: '"a" + _b', prefix: '' }]), 'F\n{\n\t"a" + _b\n}\n');
  check('関数をよぶ引数の & は、そのまま', one([{ type: 'y_out', value: { type: 'y_call', name: 'F2', args: ['&_x', '1'] }, prefix: 'void' }]),
    'F\n{\n\tvoid F2(&_x, 1)\n}\n');
  check('もし・そうでなくて・そうでなければ（あいだのコメントはその節に・} のうしろのコメントは次の行に）',
    one([{ type: 'y_if', cond: '_a', body: [{ type: 'y_out', value: '1' }] }, { type: 'y_comment', text: '// b' },
      { type: 'y_elseif', cond: '_b', body: [] }, { type: 'y_else', body: [{ type: 'y_break' }], trail: '// c' }]),
    'F\n{\n\tif _a {\n\t\t1\n\t}\n\t// b\n\telseif _b {\n\t}\n\telse {\n\t\tbreak\n\t}\n\t// c\n}\n');
  const err = (blocks) => { try { one(blocks); return null; } catch (e) { return e.code; } };
  check('まちがい: からの欄・読めない式・前に「もし」が無い・case の外の when・名前でない関数名',
    [err([{ type: 'y_out', value: '' }]), err([{ type: 'y_out', value: '1 +' }]), err([{ type: 'y_else', body: [] }]),
      err([{ type: 'y_when', labels: '1', body: [] }]), err([{ type: 'y_out', value: { type: 'y_call', name: 'a b', args: [] } }])],
    ['empty_slot', 'bad_expr', 'orphan_else', 'outside_case', 'bad_name']);
  check('関数の外にはみ出したブロックは、数えて辞書には入れない',
    YB.viewToAst({ scripts: [{ kind: 'loose', blocks: [{ type: 'y_out', value: '1' }] }] }).loose, 1);
  const two = { scripts: [
    { kind: 'yfunc', name: 'B', mode: '', blocks: [], x: 24, y: 200 },
    { kind: 'loose', blocks: [{ type: 'y_comment', text: '// c' }], x: 300, y: 10 },
    { kind: 'yfunc', name: 'A', mode: '', blocks: [], x: 24, y: 100 },
  ] };
  check('かたまりは上から順に書く（関数の外に置いたコメントだけのかたまりは、関数の外のコメント）',
    printYaya(YB.viewToAst(two).dic), '// c\nA\n{\n}\nB\n{\n}\n');

  // YAYA に元からある関数の一覧が、本物の辞書でよばれている名前をみな知っているか
  const defined = new Set();
  const called = new Set();
  const calls = (x) => {
    if (Array.isArray(x)) x.forEach(calls);
    else if (x && typeof x === 'object') { if (x.type === 'call') called.add(x.name); Object.values(x).forEach(calls); }
  };
  for (const text of dics) {
    const d = parseYaya(text).dic;
    d.items.forEach((it) => it.type === 'func' && defined.add(it.name));
    calls(d);
  }
  const sys = new Set(Object.values(YB.YAYA_SYSTEM_FUNCTIONS).flat());
  check(`YAYA の関数の一覧は ${sys.size} こ`, sys.size, 197);
  check('本物の辞書でよばれる、辞書に無い関数は、みな一覧にある（Studio.〜 はスタジオの辞書）',
    [...called].filter((n) => !defined.has(n) && !sys.has(n) && !n.startsWith('Studio.')).sort(), []);
}

console.log('');
if (failed) {
  console.log(`${red}[yayatext] ${failed} か所ちがいます（${checks} か所中）。${off}`);
  process.exit(1);
}
console.log(`${green}[yayatext] ${checks} か所すべて期待どおりです。${off}`);
