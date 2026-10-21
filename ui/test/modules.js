/* 画面のコードが、読みこんだだけで壊れていないかを見る
 *
 *   node ui\test\modules.js
 *
 * ui/js/ は exe に埋め込まれるので、書きまちがえても
 * 「起動して、そのボタンを押すまで分からない」ことになります。
 * ここでは画面を出さずに、ES モジュールとして読みこんで、
 *
 *   1. index.html が入り口（js/main.js）だけを type="module" で読んでいるか
 *   2. ui/js/ のファイルが、すべて main.js から import でたどれるか（消し忘れ・つなぎ忘れ）
 *   3. import の向きが、層の決まりどおりか（下の層から上の層を import していないか）
 *   4. おたがいに import しあうところ（輪）が無いか
 *   5. どのファイルを最初に読みこんでも落ちないか（構文まちがい・無い名前の import）
 *   6. import した `Xxx.yyy(...)` の呼び先が、ほんとうにあるか
 *   7. style.css の色が、:root のトークンを通っているか（暗い表示で色がぬけないように）
 *
 * を見ます。6 は、ファイルを分けたときの**移し忘れ**を捕まえるためのものです。
 * 中身が正しいかまでは見ません（それは動かして確かめてください）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const jsDir = path.join(root, 'ui', 'js');
const C = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', off: '\x1b[0m' };

// ------------------------------------------------------------------ 層の決まり
// フォルダごとに、import してよい先。上から下へだけ向けます（docs/maintenance.md）。
// ui/js/ の直下（main.js・shortcuts.js）は「組み立て」で、どこでも import できますが、
// 直下のファイルを import できるのは main.js だけです。
const LAYERS = {
  model: ['model'],
  core: ['core', 'model'],
  editor: ['editor', 'core', 'model'],
  panels: ['panels', 'editor', 'core', 'model'],
};
const layerOf = (f) => (f.includes('/') ? f.split('/')[0] : '');

// 読みこむだけなら DOM はほとんど要らない。触られたものだけ用意する。
function stubDom() {
  const noop = () => {};
  const elStub = new Proxy({}, {
    get: (t, k) => (k === 'style' || k === 'classList' || k === 'dataset' ? elStub : noop),
    set: () => true,
  });
  global.document = {
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => elStub,
    body: elStub,
  };
  global.window = { addEventListener: noop, location: { href: '' } };
  // navigator は node が持っていて書きかえられないので、足りないところだけ補う
  if (!globalThis.navigator) global.navigator = { userAgent: 'node' };
  global.fetch = () => Promise.reject(new Error('テストでは通信しません'));
}

const win = (f) => 'ui\\js\\' + f.replace(/\//g, '\\');

// ---------------------------------------------- 子: 1 つのファイルを最初に読みこむ
// node ui\test\modules.js --entry panels/run.js
// 読みこみの問題は「どれを最初に読んだか」で出たり出なかったりするので、
// ファイルごとに別のプロセスで、まっさらな状態から読みこみます。
const entryAt = process.argv.indexOf('--entry');
if (entryAt >= 0) {
  stubDom();
  try {
    require(path.join(jsDir, process.argv[entryAt + 1]));
  } catch (e) {
    // どこで落ちたかを添える（スタックのうち ui/js/ の中の最初の 1 行）
    const at = String(e && e.stack || '').split('\n')
      .map((l) => (l.match(/ui\/js\/([^:]+\.js:\d+)/) || [])[1]).find(Boolean);
    console.log(String(e && e.message || e) + (at ? `  (${win(at)})` : ''));
    process.exit(1);
  }
  process.exit(0);
}

const problems = [];
function bad(title, lines) { problems.push({ title, lines: lines || [] }); }

/** 説明文に書いた「Shell.xxx() の形で呼びます」を拾わないよう、コメント行を空にする。
 *  行はずらさない（何行目かを言えるように、中身だけ消す）。 */
function withoutComments(src) {
  let inBlock = false;
  return src.split('\n').map((line) => {
    const t = line.trim();
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      return '';
    }
    if (t.startsWith('//') || t.startsWith('*')) return '';
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; return ''; }
    return line;
  }).join('\n');
}

/** import 文を拾う: [{ from: 'core/api.js', names: ['api'], line: 3 }]（from は ui/js/ からの位置） */
function importsOf(file, src) {
  const list = [];
  for (const m of src.matchAll(/^import\s+(?:\{([^}]*)\}\s+from\s+)?'(\.{1,2}\/[^']+)';/gm)) {
    const names = (m[1] || '').split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.split(/\s+as\s+/).pop());
    const from = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[2]));
    list.push({ from, names, line: src.slice(0, m.index).split('\n').length });
  }
  return list;
}

/** ui/js/ の下の .js をすべて（'panels/run.js' の形で） */
function listJs(dir, prefix) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) out.push(...listJs(path.join(dir, ent.name), prefix + ent.name + '/'));
    else if (ent.name.endsWith('.js')) out.push(prefix + ent.name);
  }
  return out.sort();
}

// ---------------------------------------------------------- 1. index.html の入り口
const html = fs.readFileSync(path.join(root, 'ui', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
const ENTRY_TAG = '<script type="module" src="js/main.js">';
if (scripts.length !== 1 || scripts[0] !== ENTRY_TAG) {
  bad('index.html が読むのは、入り口の 1 つだけにしてください',
    [`ほしい: ${ENTRY_TAG}</script>`, ...scripts.map((s) => `いま : ${s}`)]);
}

// ------------------------------------------------- 2. main.js からたどれるか
const onDisk = listJs(jsDir, '');
const sources = {};
const imports = {};
for (const f of onDisk) {
  sources[f] = withoutComments(fs.readFileSync(path.join(jsDir, f), 'utf8'));
  imports[f] = importsOf(f, sources[f]);
}

const reached = [];
const missing = [];
(function walk(f, from) {
  if (reached.includes(f)) return;
  if (!sources[f]) { missing.push(`${win(from)} が import している ${win(f)} がありません`); return; }
  reached.push(f);
  for (const imp of imports[f]) walk(imp.from, f);
})('main.js', 'index.html');
if (missing.length) bad('import している先のファイルがありません', missing);

const orphans = onDisk.filter((f) => !reached.includes(f));
if (orphans.length) {
  bad('ui/js/ にあるのに、main.js からたどれません',
    orphans.map((f) => `${win(f)} … どこかで import するか、要らなければ消してください`));
}

// ------------------------------------------------------------- 3. 層の向き
const wrongWay = [];
for (const f of reached) {
  const from = layerOf(f);
  for (const imp of imports[f]) {
    const to = layerOf(imp.from);
    if (!from) {
      if (!to && f !== 'main.js') wrongWay.push(`${win(f)}:${imp.line}  直下の ${imp.from} を import できるのは main.js だけです`);
      continue;
    }
    if (!LAYERS[from]) { wrongWay.push(`${win(f)}  ${from}/ は層の決まり（LAYERS）にありません`); break; }
    if (!LAYERS[from].includes(to)) {
      wrongWay.push(`${win(f)}:${imp.line}  ${from}/ から ${to || '直下'}/ の ${imp.from} は import できません`
        + `（${from}/ が使えるのは ${LAYERS[from].join(' / ')}）`);
    }
  }
}
if (wrongWay.length) {
  bad('import の向きが層の決まりとちがいます（上の層の操作は core/commands.js を通してください）', wrongWay);
}

// -------------------------------------------------------------- 4. 輪が無いか
const cycles = [];
{
  const state = {};        // undefined=まだ / 1=たどっている最中 / 2=おわり
  const stack = [];
  const seen = new Set();
  (function visitAll() {
    for (const f of reached) visit(f);
  })();
  function visit(f) {
    if (state[f] === 2 || !sources[f]) return;
    if (state[f] === 1) {
      const loop = stack.slice(stack.indexOf(f)).concat(f);
      const key = loop.slice(0, -1).sort().join('|');
      if (!seen.has(key)) { seen.add(key); cycles.push(loop.map(win).join(' → ')); }
      return;
    }
    state[f] = 1;
    stack.push(f);
    for (const imp of imports[f]) visit(imp.from);
    stack.pop();
    state[f] = 2;
  }
}
if (cycles.length) bad('おたがいに import しあっています（どちらかを下の層へ動かすか、core/commands.js を通してください）', cycles);

// --------------------------------------------- 5. どれを最初に読んでも落ちないか
for (const f of reached) {
  const r = spawnSync(process.execPath, [__filename, '--entry', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    bad(`${win(f)} を最初に読みこむと落ちます`,
      [(r.stdout || r.stderr || '').trim().split('\n')[0]]);
  }
}

// -------------------------------------------- 6. Xxx.yyy(...) の行き先を確かめる
// ここだけは同じプロセスで全部読みこんで、公開されている中身を見ます。
// 呼び出し（うしろに括弧があるもの）だけを見ます。あとから代入する値は見ません。
stubDom();
const loaded = {};
let loadedOk = true;
for (const f of reached) {
  try {
    loaded[f] = require(path.join(jsDir, f));
  } catch (e) {
    loadedOk = false;   // 5 で名指ししてあります
  }
}

const dangling = [];
if (loadedOk) {
  for (const f of reached) {
    const src = sources[f];
    for (const imp of imports[f]) {
      const mod = loaded[imp.from] || {};
      for (const name of imp.names) {
        const obj = mod[name];
        if (!obj || typeof obj !== 'object') continue;   // 関数や配列は Node が見てくれる
        const call = new RegExp(`(?<![\\w$.])${name.replace('$', '\\$')}\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g');
        for (const m of src.matchAll(call)) {
          if (typeof obj[m[1]] === 'function') continue;
          const line = src.slice(0, m.index).split('\n').length;
          const has = Object.keys(obj).filter((k) => typeof obj[k] === 'function');
          dangling.push(`${win(f)}:${line}  ${name}.${m[1]} がありません`
            + `（${imp.from} の ${name} が公開しているのは: ${has.join(', ') || 'なし'}）`);
        }
      }
    }
  }
}
if (dangling.length) bad('呼んでいる先がありません（分けたときの移し忘れ）', dangling);

// ------------------------------------------- 7. style.css の色はトークンを通す
// 色を直に書くと、暗い表示のときにそこだけ明るいまま残ります。:root（トークンを決めるところ）の
// 外では、ブロックの上に重ねる白と黒（#fff・rgba(0,0,0,…)・rgba(255,255,255,…)）だけを許します。
const styleColors = [];
{
  const css = fs.readFileSync(path.join(root, 'ui', 'style.css'), 'utf8');
  const lines = css.split('\n');
  let inRoot = false;
  lines.forEach((line, i) => {
    if (/^:root\s*\{/.test(line)) inRoot = true;
    if (inRoot) { if (/^\}/.test(line)) inRoot = false; return; }
    const code = line.replace(/\/\*.*?\*\//g, '');
    const found = (code.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [])
      .filter((c) => !/^#fff$/i.test(c)
        && !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/.test(c)
        && !/^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/.test(c));
    for (const c of found) styleColors.push(`ui\\style.css:${i + 1}  ${c} … :root にトークンを作って var(--…) で使ってください`);
  });
}
if (styleColors.length) bad('style.css に色が直に書いてあります', styleColors);

// ---------------------------------------------------------------------- 表示
console.log('');
for (const p of problems) {
  console.log(`${C.red}  ちがう ${p.title}${C.off}`);
  for (const l of p.lines) console.log(`        ${l}`);
}
if (problems.length) {
  console.log('');
  console.log(`${C.red}[modules] ${problems.length} 件おかしいところがあります。${C.off}`);
  process.exit(1);
}

const byLayer = {};
for (const f of reached) (byLayer[layerOf(f) || '直下'] = byLayer[layerOf(f) || '直下'] || []).push(f);
console.log(`${C.green}  OK  ${C.off}main.js から ${reached.length} ファイルをたどれます `
  + `${C.dim}(${Object.keys(byLayer).map((k) => `${k} ${byLayer[k].length}`).join(' / ')})${C.off}`);
console.log(`${C.green}  OK  ${C.off}import は上から下へだけ向いていて、輪がありません`);
console.log(`${C.green}  OK  ${C.off}どのファイルを最初に読みこんでも落ちません`);
console.log(`${C.green}  OK  ${C.off}呼び出し先はすべてそろっています`);
console.log(`${C.green}  OK  ${C.off}style.css の色はすべてトークンを通っています`);
console.log(`${C.green}[modules] 画面のコードは、読みこみのかぎり問題ありません。${C.off}`);
