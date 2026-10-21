/* 画面の言葉（日本語・英語）の点検
 *
 *   node ui\test\i18n.js
 *
 * 画面の言葉は t('日本語の文') を通します（ui/js/i18n/i18n.js）。日本語の文がそのまま鍵なので、
 * 文を書きかえたり、t() で包み忘れたりすると、英語の画面でそこだけ日本語のまま残ります。ここでは
 *
 *   1. ui/js/ に、t() で包んでいない日本語の文が無いか
 *      （画面に出さない文は、その行に // i18n-ignore と書けば見のがします）
 *   2. t() に、文字そのものではなく変数を渡していないか（それだと 3・4 で見られないため）
 *   3. en.js の訳が、どこにも使われていない文のものになっていないか（文を書きかえたあとの残り）
 *   4. 訳に、元の文と同じ {差しこみ} と %欄 がそろっているか
 *   5. exe（studio/src）が返すエラーのコードが、すべて画面の表（ui/js/core/api.js）にあるか
 *
 * を見ます。訳がまだ無い文の数は、お知らせとして出すだけです（無いものは日本語のまま出ます）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const jsDir = path.join(root, 'ui', 'js');
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', off: '\x1b[0m' };
const JP = /[぀-ヿ㐀-鿿]/;

const problems = [];
function bad(title, lines) { if (lines.length) problems.push({ title, lines }); }

/** ui/js/ の下の .js（i18n/ は辞書としくみなので見ない） */
function listJs(dir, prefix) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) { if (prefix + ent.name !== 'i18n') out.push(...listJs(path.join(dir, ent.name), prefix + ent.name + '/')); }
    else if (ent.name.endsWith('.js')) out.push(prefix + ent.name);
  }
  return out.sort();
}

/**
 * JS を、文字列とテンプレート文字列の場所がわかるところまで読む。
 * コメントと正規表現の中は飛ばします。[{ kind: 'str'|'tpl', start, end }]
 */
function lex(src) {
  const toks = [];
  let i = 0;
  let last = '';
  const regexAfter = '(,=:[!&|?{};+-*%<>~^';
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      toks.push({ kind: 'str', start: i, end: j + 1 });
      i = j + 1; last = c; continue;
    }
    if (c === '`') {
      let j = i + 1; let depth = 0;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (depth === 0 && src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === '}') depth--;
        j++;
      }
      toks.push({ kind: 'tpl', start: i, end: j + 1 });
      i = j + 1; last = '`'; continue;
    }
    if (c === '/' && (last === '' || regexAfter.includes(last) || /\breturn\s*$/.test(src.slice(Math.max(0, i - 8), i)))) {
      let j = i + 1; let cls = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) break;
        j++;
      }
      i = j + 1;
      while (/[a-z]/.test(src[i] || '')) i++;
      last = 'r'; continue;
    }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return toks;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;
const lineText = (src, idx) => { const a = src.lastIndexOf('\n', idx) + 1; const b = src.indexOf('\n', idx); return src.slice(a, b < 0 ? src.length : b); };
/** 'あいう\n' のような文字列リテラルを、実際の文字に（エスケープをほどく） */
const unquote = (lit) => Function(`"use strict"; return (${lit});`)();

// ------------------------------------------------------- 1・2. ui/js/ を読む
const catalog = new Map();          // 文 → 使っているところ
const unwrapped = [];
const dynamic = [];
for (const rel of listJs(jsDir, '')) {
  const src = fs.readFileSync(path.join(jsDir, rel), 'utf8');
  const where = (idx) => `ui\\js\\${rel.replace(/\//g, '\\')}:${lineOf(src, idx)}`;
  for (const tk of lex(src)) {
    const lit = src.slice(tk.start, tk.end);
    const before = src.slice(0, tk.start).replace(/\s+$/, '');
    if (/\bt\($/.test(before)) {
      if (tk.kind !== 'str') { dynamic.push(`${where(tk.start)}  t() に \`…\` を渡しています。'…{名前}…' と { 名前: 値 } に分けてください`); continue; }
      const key = unquote(lit);
      if (!catalog.has(key)) catalog.set(key, where(tk.start));
      continue;
    }
    if (!JP.test(lit)) continue;
    if (lineText(src, tk.start).includes('i18n-ignore')) continue;
    unwrapped.push(`${where(tk.start)}  ${lit.length > 60 ? lit.slice(0, 60) + '…' : lit}`);
  }
  // t( のあとが文字列でないもの（変数を渡している）
  for (const m of src.matchAll(/(?<![\w$.])t\(\s*([^'"\s])/g)) {
    if (m[1] === '`') continue;     // 上で名指し済み
    if (lineText(src, m.index).includes('i18n-ignore')) continue;
    dynamic.push(`${where(m.index)}  t() に文字そのものではないものを渡しています`);
  }
}
bad('t() で包んでいない日本語の文があります（画面に出さないなら、その行に // i18n-ignore）', unwrapped);
bad('t() には文字そのものを渡してください（英語の訳の点検ができなくなるため）', dynamic);

// -------------------------------------------------- index.html に直に書いた文
// i18n.js の translateDom() と同じ切りかた（字のかたまりごと・空白をまとめる）にします。
{
  const html = fs.readFileSync(path.join(root, 'ui', 'index.html'), 'utf8')
    .replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const ent = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }[k]));
  const key = (s) => ent(s).replace(/\s+/g, ' ').trim();
  for (const m of html.matchAll(/>([^<]+)</g)) {
    const k = key(m[1]);
    if (k && JP.test(k) && !catalog.has(k)) catalog.set(k, 'ui\\index.html');
  }
  for (const m of html.matchAll(/\s(?:title|placeholder|alt|aria-label)="([^"]*)"/g)) {
    const k = key(m[1]);
    if (k && JP.test(k) && !catalog.has(k)) catalog.set(k, 'ui\\index.html');
  }
}

// --------------------------------------------------------- 3・4. 英語の辞書
const { en } = require(path.join(jsDir, 'i18n', 'en.js'));
const stale = [];
const slots = [];
const slotsOf = (s) => (String(s).match(/\{\w+\}|%[A-Za-z_]\w*/g) || []).sort().join(' ');
for (const [ja, eng] of Object.entries(en)) {
  if (!catalog.has(ja)) { stale.push(`${JSON.stringify(ja)} … どこにも使われていません（元の文を書きかえたなら、訳の鍵もそろえてください）`); continue; }
  if (typeof eng === 'string' && eng !== '' && slotsOf(ja) !== slotsOf(eng)) {
    slots.push(`${JSON.stringify(ja)} … 日本語は [${slotsOf(ja)}]、英語は [${slotsOf(eng)}]`);
  }
}
bad('英語の辞書に、使われていない文の訳が残っています', stale);
bad('英語の訳と元の文で、{差しこみ} や %欄 がそろっていません', slots);

// -------------------------------------------------- 5. exe が返すエラーのコード
// exe（studio/src）はエラーを文ではなくコードで返し、画面が core/api.js の表で文にします。
// 表に無いコードは、画面にコードのまま出てしまいます。
let errorCodes = 0;
{
  const { ERROR_CODES } = require(path.join(jsDir, 'core', 'api.js'));
  const srcDir = path.join(root, 'studio', 'src');
  const used = new Map();
  const patterns = [
    /JsonError\(res,\s*\d+,\s*"([a-z_]+)"/g,              // JsonError(res, 400, "bad_json")
    /\?\s*"([a-z_]+)"\s*:\s*r\.error/g,                  // r.error.empty() ? "export_failed" : r.error
    /\b(?:r|out)\.error\s*=\s*"([a-z_]+)"/g,             // r.error = "mkdir_failed"（書き出し・SSTP・ためす）
  ];
  for (const name of fs.readdirSync(srcDir).filter((n) => n.endsWith('.cpp')).sort()) {
    const src = fs.readFileSync(path.join(srcDir, name), 'utf8');
    for (const re of patterns) {
      for (const m of src.matchAll(re)) if (!used.has(m[1])) used.set(m[1], name);
    }
  }
  bad('exe が返すエラーのコードに、画面の文がありません（ui/js/core/api.js の ERRORS に足してください）',
    [...used].filter(([code]) => !ERROR_CODES.includes(code)).map(([code, file]) => `${code} … studio\\src\\${file}`));
  bad('画面のエラーの表に、exe がどこからも返さないコードが残っています',
    ERROR_CODES.filter((code) => !used.has(code)));
  errorCodes = used.size;
}

// ---------------------------------------------------------------------- 表示
console.log('');
for (const p of problems) {
  console.log(`${C.red}  ちがう ${p.title}${C.off}`);
  for (const l of p.lines) console.log(`        ${l}`);
}
if (problems.length) {
  console.log('');
  console.log(`${C.red}[i18n] ${problems.length} 件おかしいところがあります。${C.off}`);
  process.exit(1);
}
const translated = [...catalog.keys()].filter((k) => typeof en[k] === 'string' && en[k] !== '').length;
console.log(`${C.green}  OK  ${C.off}画面の日本語はすべて t() を通っています ${C.dim}(${catalog.size} 文)${C.off}`);
console.log(`${C.green}  OK  ${C.off}英語の辞書に、古い訳や欄のずれはありません`);
console.log(`${C.green}  OK  ${C.off}exe が返すエラーのコードは、すべて画面の文になります ${C.dim}(${errorCodes} 個)${C.off}`);
console.log(`${C.yellow}  お知らせ${C.off} ${C.dim}英語の訳があるのは ${translated} / ${catalog.size} 文です（無いものは日本語のまま出ます）${C.off}`);
console.log(`${C.green}[i18n] 画面の言葉は、点検のかぎり問題ありません。${C.off}`);
