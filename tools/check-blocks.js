/* ブロックの「そろい」を見はる道具
 *
 *   node tools\check-blocks.js
 *
 * ブロックを 1 つ足すときは、いくつものファイルに同じことを書きます。
 * どれか 1 つ忘れても、ふつうのテストは緑のまま通ってしまいます
 * （書き忘れたブロックは、誰もためしていないので、誰も気づきません）。
 *
 * この道具は ui\js\model\blocks.js を「正」として、ほかのファイルがついてきているかを
 * 機械的に見ます。ビルドは要らないので、ブロックを足したら、まずこれを走らせてください。
 * くわしい手順は docs\maintenance.md にあります。
 *
 * ブロックを動かすのは YAYA です。ブロックは ui/js/model/yaya.js が YAYA の文に訳し、
 * 情報ブロックなどのしくみは studio/res/yaya/studio_runtime.dic にあります（「ためす」も同じものを使います）。
 * ここで見るのは「書き忘れ」だけで、中身が合っているかは一致テストとふるまいテストが見ます。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', off: '\x1b[0m' };

const DOC = 'docs\\blocks.md';
const DOC_EN = 'docs\\en\\blocks.md';   // 英語版（日本語版と同じく、すべてのブロックの行が要ります）
const DEFS = 'ui\\js\\model\\blocks.js';
const YAYA_JS = 'ui\\js\\model\\yaya.js';                  // ブロックを YAYA の文に訳すところ
const YAYA_RT = 'studio\\res\\yaya\\studio_runtime.dic';   // YAYA で動くしくみ（情報ブロックなど）

// ------------------------------------------------------------------ 承知ずみ
// 「そろっていない」けれど、そういうものだと決めたもの。
// ここに足すときは、なぜそうなのかを必ず書いてください。
const KNOWN = {
  // 手書きの ghost.json だけで使える type（エディタのパレットには出していない）
  types: {
    num: 'ブロックではなく、数そのもの（yaya.js が直に読む）',
    text: 'ブロックではなく、文字そのもの',
    bool: 'ブロックではなく、はい／いいえそのもの',
    stop: '「ここでトークをおわる」(end) があるので、パレットには出していない',
  },
  // 実装だけが知っている演算。手書きの ghost.json むけの別名・おまけ。
  ops: {
    'arith#min': 'おまけ（パレットには出していない）',
    'arith#max': 'おまけ（パレットには出していない）',
    'compare#==': '= の別名',
    'compare#<>': '!= の別名',
    'compare#<=': 'パレットには出していないが、手書きなら使える',
    'compare#>=': 'パレットには出していないが、手書きなら使える',
  },
  // 「その他」の分岐で処理していて、名前が出てこないもの
  implicit: {
    'logic#or': 'and でなければ or、と書いてある',
    'round#round': '四捨五入が既定なので、名前を見ていない',
  },
};

// パレットの目じるしが、実際にはどのブロックを並べるか（render.js が展開します）
const PALETTE_EXPANDS = { '@vars': ['var'] };

// ------------------------------------------------------------------- 読みこみ
function read(rel) {
  return fs.readFileSync(path.join(root, rel.replace(/\\/g, path.sep)), 'utf8');
}

const src = {
  doc: read(DOC), docEn: read(DOC_EN), yaya: read(YAYA_JS), yayaRt: read(YAYA_RT),
};

globalThis.IKAGA_LANG = 'ja';   // ブロックの文は日本語のものを見ます（ui/js/i18n/i18n.js）
const N = require(path.join(root, DEFS.replace(/\\/g, path.sep)));
if (!N || !N.BLOCKS) {
  console.error(`${C.red}[そろい] ${DEFS} を読めませんでした。${C.off}`);
  process.exit(2);
}

// ------------------------------------------------------------------ 見つけかた
// どのファイルでも「名前を書いた 1 行」を探すだけにしています。
// 中身の書きかたを変えても壊れないように、関数の場所は当てにしません。
const has = {
  doc: (name) => src.doc.includes(`"type":"${name}"`) || src.doc.includes(`"type": "${name}"`),
  docEn: (name) => src.docEn.includes(`"type":"${name}"`) || src.docEn.includes(`"type": "${name}"`),
  yayaType: (name) => src.yaya.includes(`case '${name}':`),
  yayaKey: (name) => src.yayaRt.includes(`_key == '${name}'`),
  yayaOp: (name) => src.yaya.includes(`op === '${name}'`) || src.yayaRt.includes(`_op == '${name}'`),
};

// ------------------------------------------------- テストのゴーストが使っている型
const FIXTURES = [
  'shiori\\test\\parity\\ghost.json',
  'shiori\\test\\behavior\\main\\ghost.json',
  'shiori\\test\\behavior\\empty\\ghost.json',
];

const tested = { types: new Set(), ops: new Set(), keys: new Set() };
for (const rel of FIXTURES) {
  let data;
  try {
    data = JSON.parse(read(rel));
  } catch (e) {
    console.error(`${C.red}[そろい] ${rel} が JSON として読めません: ${e.message}${C.off}`);
    process.exit(2);
  }
  (function walk(v) {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    if (typeof v.type === 'string') {
      tested.types.add(v.type);
      if (typeof v.op === 'string') tested.ops.add(v.type + '#' + v.op);
      if (v.type === 'sys' && typeof v.key === 'string') tested.keys.add(v.key);
    }
    for (const k in v) walk(v[k]);
  })(data);
}

// ------------------------------------------------------------------- 結果ため
const problems = [];
const notes = [];
function bad(title, lines) { problems.push({ title, lines }); }

/** えらべる値の一覧を取り出す。取り出せなければ、どこが変わったのか言って止まる。 */
function options(defKey, argName) {
  const list = (((N.BLOCKS[defKey] || {}).args || {})[argName] || {}).options;
  if (!Array.isArray(list)) {
    console.error(`${C.red}[そろい] ${DEFS} の ${defKey} に ${argName} の options がありません。`
      + ` 形を変えたなら tools\\check-blocks.js も直してください。${C.off}`);
    process.exit(2);
  }
  return list;
}

// ============================================================ 1. ブロックの型
const defs = N.BLOCKS;
const blockTypes = [...new Set(
  Object.values(defs).map((d) => d.type).filter((t) => t && !t.startsWith('@'))
)].sort();

for (const t of blockTypes) {
  const miss = [];
  if (!has.doc(t)) miss.push(`${DOC} に  "type":"${t}"  の行がありません`);
  if (!has.docEn(t)) miss.push(`${DOC_EN} に  "type":"${t}"  の行がありません（英語版）`);
  if (!has.yayaType(t)) miss.push(`${YAYA_JS} に  case '${t}':  がありません（YAYA に訳せないので、動きません）`);
  if (!tested.types.has(t)) {
    miss.push(`どのテストのゴーストにも出てきません`
      + `（shiori\\test\\parity\\ghost.json に「毎回おなじ結果になる形」で足してください）`);
  }
  if (miss.length) bad(`ブロック「${t}」がそろっていません`, miss);
}

// 逆むき: 訳しかたはあるのに、ブロック定義に無いもの。
const implTypes = new Set();
for (const m of src.yaya.matchAll(/case '([a-z_][a-z0-9_]*)':/g)) implTypes.add(m[1]);
const implKeys = new Set();
for (const m of src.yayaRt.matchAll(/_key == '([a-z_][a-z0-9_]*)'/g)) implKeys.add(m[1]);
const strays = [...implTypes].filter((t) => !blockTypes.includes(t) && !KNOWN.types[t]).sort();
if (strays.length) {
  bad('実装にあるのに、ブロック定義がありません', strays.map(
    (t) => `"${t}" … ${DEFS} に def({ type: '${t}', … }) が無いので、エディタから置けません`
      + `（わざとなら tools\\check-blocks.js の KNOWN.types に理由つきで足してください）`
  ));
}

// ==================================================== 2. 情報ブロックの key
const sysKeys = options('sys', 'key').map((o) => o[1]);
for (const k of sysKeys) {
  const miss = [];
  if (!has.yayaKey(k)) miss.push(`${YAYA_RT} の Studio.Sys に  _key == '${k}'  がありません`);
  if (miss.length) bad(`情報ブロックの「${k}」がそろっていません`, miss);
}

// 逆むき: しくみは知っているのに、えらべない key
const hiddenKeys = [...implKeys].filter((k) => !sysKeys.includes(k)).sort();
if (hiddenKeys.length) {
  bad(`${YAYA_RT} は知っているのに、エディタでえらべない情報があります`, hiddenKeys.map(
    (k) => `"${k}" … ${DEFS} の sys ブロックの options に足してください`
  ));
}

// ============================================================== 3. 演算の種類
const opKeys = Object.keys(defs).filter((k) => k.includes('#'));
for (const key of opKeys) {
  const [type, op] = key.split('#');
  if (KNOWN.implicit[key]) continue;
  const miss = [];
  if (!has.yayaOp(op)) miss.push(`${YAYA_JS} か ${YAYA_RT} に、${op} の訳がありません`);
  if (miss.length) bad(`演算「${key}」がそろっていません`, miss);
}
// dropdown で選ぶ op（round）も同じように見る
for (const o of options('round', 'op')) {
  const op = o[1];
  const key = 'round#' + op;
  if (KNOWN.implicit[key]) continue;
  const miss = [];
  if (!has.yayaOp(op)) miss.push(`${YAYA_JS} の round に  op === '${op}'  がありません`);
  if (miss.length) bad(`演算「${key}」がそろっていません`, miss);
}

// ============================================================== 4. パレット
const palette = new Set();
for (const cat in N.PALETTE) {
  for (const item of N.PALETTE[cat]) {
    if (typeof item !== 'string') continue;
    if (PALETTE_EXPANDS[item]) { PALETTE_EXPANDS[item].forEach((k) => palette.add(k)); continue; }
    palette.add(item);
  }
}
const paletteMiss = [...palette].filter((k) => !defs[k]).sort();
if (paletteMiss.length) {
  bad('パレットに、定義の無いブロックが並んでいます', paletteMiss.map(
    (k) => `"${k}" … ${DEFS} の PALETTE から消すか、def({ … }) を足してください`
  ));
}
const notInPalette = Object.keys(defs).filter(
  (k) => !palette.has(k) && !defs[k].hat && !KNOWN.ops[defs[k].type + '#' + (defs[k].fixed || {}).op]
).sort();
if (notInPalette.length) {
  bad('定義したのに、パレットに出していないブロックがあります', notInPalette.map(
    (k) => `"${k}" … ${DEFS} の PALETTE に足してください（置けないので誰にも使えません）`
  ));
}

// ==================================================== 5. イベント名のつじつま
const eventNames = new Set(N.EVENTS.map((e) => e[1]).filter((e) => e !== '__custom__'));
const refOnly = Object.keys(N.EVENT_REFS).filter(
  (e) => !eventNames.has(e) && !e.includes('.')
).sort();
if (refOnly.length) {
  bad('EVENT_REFS にあるのに、えらべないイベントがあります', refOnly.map(
    (e) => `"${e}" … ${DEFS} の EVENTS に足すか、EVENT_REFS から消してください`
  ));
}

// ------------------------------------------------------------------ お知らせ
// 止めはしないけれど、知っておくと良いこと。
const untestedKeys = sysKeys.filter((k) => !tested.keys.has(k));
if (untestedKeys.length) {
  notes.push(`テストで動かしていない情報ブロック: ${untestedKeys.join(' / ')}`
    + `（時計まわりは毎回ちがう答えになるので、一致テストには乗せられません）`);
}
const untestedOps = opKeys.filter((k) => !tested.ops.has(k));
if (untestedOps.length) {
  notes.push(`テストで動かしていない演算: ${untestedOps.join(' / ')}`);
}

// ---------------------------------------------------------------------- 表示
console.log('');
for (const p of problems) {
  console.log(`${C.red}  ちがう ${p.title}${C.off}`);
  for (const l of p.lines) console.log(`        ${l}`);
}
for (const n of notes) console.log(`${C.yellow}  お知らせ${C.off} ${C.dim}${n}${C.off}`);

if (problems.length) {
  console.log('');
  console.log(`${C.red}[そろい] ${problems.length} 件そろっていません。`
    + ` docs\\maintenance.md の「ブロックを 1 つ足す」を見てください。${C.off}`);
  process.exit(1);
}

console.log(`${C.green}  OK  ${C.off}ブロック ${blockTypes.length} 種・`
  + `情報 ${sysKeys.length} 種・演算 ${opKeys.length} 種が、`
  + `YAYA への訳・説明・テストにそろっています`);
console.log(`${C.green}[そろい] ぜんぶそろっています。${C.off}`);
