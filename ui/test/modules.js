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
 *   3. どのファイルを最初に読みこんでも落ちないか
 *      （構文まちがい・無い名前の import・おたがいに import しあうところの読みこみ順）
 *   4. import した `Xxx.yyy(...)` の呼び先が、ほんとうにあるか
 *
 * を見ます。4 は、ファイルを分けたときの**移し忘れ**を捕まえるためのものです。
 * 中身が正しいかまでは見ません（それは動かして確かめてください）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const jsDir = path.join(root, 'ui', 'js');
const C = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', off: '\x1b[0m' };

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

// ---------------------------------------------- 子: 1 つのファイルを最初に読みこむ
// node ui\test\modules.js --entry app.js
// 読みこみ順の問題は「どれを最初に読んだか」で出たり出なかったりするので、
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
    console.log(String(e && e.message || e) + (at ? `  (ui\\js\\${at})` : ''));
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

/** import 文を拾う: [{ from: 'app.js', names: ['App', '$'] }] */
function importsOf(src) {
  const list = [];
  for (const m of src.matchAll(/^import\s+(?:\{([^}]*)\}\s+from\s+)?'\.\/([^']+)';/gm)) {
    const names = (m[1] || '').split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.split(/\s+as\s+/).pop());
    list.push({ from: m[2], names });
  }
  return list;
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
const onDisk = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
const sources = {};
for (const f of onDisk) sources[f] = withoutComments(fs.readFileSync(path.join(jsDir, f), 'utf8'));

const reached = [];
const missing = [];
(function walk(f, from) {
  if (reached.includes(f)) return;
  if (!sources[f]) { missing.push(`ui\\js\\${from} が import している ${f} がありません`); return; }
  reached.push(f);
  for (const imp of importsOf(sources[f])) walk(imp.from, f);
})('main.js', 'index.html');
if (missing.length) bad('import している先のファイルがありません', missing);

const orphans = onDisk.filter((f) => !reached.includes(f));
if (orphans.length) {
  bad('ui/js/ にあるのに、main.js からたどれません',
    orphans.map((f) => `ui\\js\\${f} … どこかで import するか、要らなければ消してください`));
}

// --------------------------------------------- 3. どれを最初に読んでも落ちないか
for (const f of reached) {
  const r = spawnSync(process.execPath, [__filename, '--entry', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    bad(`ui\\js\\${f} を最初に読みこむと落ちます`,
      [(r.stdout || r.stderr || '').trim().split('\n')[0]]);
  }
}

// -------------------------------------------- 4. Xxx.yyy(...) の行き先を確かめる
// ここだけは同じプロセスで全部読みこんで、公開されている中身を見ます。
// 呼び出し（うしろに括弧があるもの）だけを見ます。あとから代入する値は見ません。
stubDom();
const loaded = {};
let loadedOk = true;
for (const f of reached) {
  try {
    loaded[f] = require(path.join(jsDir, f));
  } catch (e) {
    loadedOk = false;   // 3 で名指ししてあります
  }
}

const dangling = [];
if (loadedOk) {
  for (const f of reached) {
    const src = sources[f];
    for (const imp of importsOf(src)) {
      const mod = loaded[imp.from] || {};
      for (const name of imp.names) {
        const obj = mod[name];
        if (!obj || typeof obj !== 'object') continue;   // 関数や配列は Node が見てくれる
        const call = new RegExp(`(?<![\\w$.])${name.replace('$', '\\$')}\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g');
        for (const m of src.matchAll(call)) {
          if (typeof obj[m[1]] === 'function') continue;
          const line = src.slice(0, m.index).split('\n').length;
          const has = Object.keys(obj).filter((k) => typeof obj[k] === 'function');
          dangling.push(`ui\\js\\${f}:${line}  ${name}.${m[1]} がありません`
            + `（${imp.from} の ${name} が公開しているのは: ${has.join(', ') || 'なし'}）`);
        }
      }
    }
  }
}
if (dangling.length) bad('呼んでいる先がありません（分けたときの移し忘れ）', dangling);

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

console.log(`${C.green}  OK  ${C.off}main.js から ${reached.length} ファイルをたどれます `
  + `${C.dim}(${reached.join(' → ')})${C.off}`);
console.log(`${C.green}  OK  ${C.off}どのファイルを最初に読みこんでも落ちません`);
console.log(`${C.green}  OK  ${C.off}呼び出し先はすべてそろっています`);
console.log(`${C.green}[modules] 画面のコードは、読みこみのかぎり問題ありません。${C.off}`);
