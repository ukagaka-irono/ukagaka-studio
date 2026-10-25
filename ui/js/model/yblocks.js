/* 伺かスタジオ - 辞書のブロック（YAYA の構文と 1 対 1。段階 8-4）
 *
 * YAYA の辞書の木（model/yayatext.js の parseYaya）を、ブロックの並び（「ビュー」）にし、ビューを木にもどします。
 * どの構文にもブロックがあり、木 → ブロック → 木 で同じ木にもどります（ui\test\yayatext.js が、本物の辞書ぜんぶで確かめます）。
 * ふつうのブロック（model/blocks.js）とは別の型（y_ ではじまる）で、スタジオのしくみ（Studio.〜）には訳さず、
 * printYaya で YAYA の文にもどします。描きかたは、ふつうのブロックと同じ（editor/render.js）です。
 *
 * ビュー
 *   { scripts: [ { id, kind: 'yfunc', name, mode, blocks, comments?, trail?, gap?, x, y }
 *              | { id, kind: 'ytop', blocks: [y_comment | y_directive | y_raw], gap?, x, y } ] }
 *   gap … その前に空行がある・trail … 同じ行のうしろのコメント（どのブロックにも付けられる）
 *
 * 式の欄
 *   数・文字列・ヒアドキュメント・名前（変数か関数）は、欄にそのまま YAYA の文字で書きます（"こんにちは"・10・_x・IARRAY）。
 *   演算・関数をよぶ・[ ]・かっこ・& などは、欄にはめるブロックです。欄に書いた文字は、YAYA の式として読みます。
 *
 * DOM を触らないので、node のテスト（ui\test\yayatext.js）からそのまま使えます。
 */

import { registerBlock as def } from './blocks.js';
import { parseExpr, printExpr, parseYaya, lex, BIN_PREC } from './yayatext.js';
import { t } from '../i18n/i18n.js';

// YAYA に元からある関数（https://yaya-shiori.github.io/yaya-docs/ の「システム関数一覧」。見出しの区切りごと。
// 一覧には無く、関数ごとのページだけにある DIRECTSSTP と LINT.〜 も入れています）
export const YAYA_SYSTEM_FUNCTIONS = {
  'A-C': [
    'ACOS', 'ANY', 'APPEND_RUNTIME_DIC', 'ARRAYDEDUP', 'ARRAYSIZE', 'ASEARCH', 'ASEARCHEX', 'ASIN', 'ASORT', 'ATAN',
    'BINSTRTOI', 'BITWISE_AND', 'BITWISE_NOT', 'BITWISE_OR', 'BITWISE_SHIFT', 'BITWISE_XOR', 'CEIL', 'CHARSETIDTOTEXT',
    'CHARSETLIB', 'CHARSETLIBEX', 'CHARSETTEXTTOID', 'CHR', 'CHRCODE', 'CLEARERRORLOG', 'COS', 'COSH', 'CUTSPACE', 'CVAUTO',
    'CVAUTOEX', 'CVINT', 'CVREAL', 'CVSTR',
  ],
  'D-F': [
    'DICLOAD', 'DICUNLOAD', 'DIRECTSSTP', 'DUMPJSON', 'DUMPTOML', 'DUMPVAR', 'DUMPXML', 'DUMPYAML', 'ERASE', 'ERASEVAR', 'EVAL', 'EXECUTE',
    'EXECUTE_WAIT', 'FATTRIB', 'FCHARSET', 'FCLOSE', 'FCOPY', 'FDEL', 'FDIGEST', 'FENUM', 'FLOOR', 'FMOVE', 'FOPEN', 'FREAD',
    'FREADBIN', 'FREADENCODE', 'FREADHTML', 'FREADJSON', 'FREADTOML', 'FREADXML', 'FREADYAML', 'FRENAME', 'FSEEK', 'FSIZE',
    'FSTATUS', 'FTELL', 'FUNCDECL_ERASE', 'FUNCDECL_READ', 'FUNCDECL_WRITE', 'FUNCTIONEX', 'FWRITE', 'FWRITE2', 'FWRITEBIN',
    'FWRITEDECODE', 'FWRITEJSON', 'FWRITETOML', 'FWRITEXML', 'FWRITEYAML',
  ],
  'G-I': [
    'GETCALLSTACK', 'GETDELIM', 'GETENV', 'GETERRORLOG', 'GETFUNCINFO', 'GETFUNCLIST', 'GETLASTERROR', 'GETMEMINFO',
    'GETSECCOUNT', 'GETSETTING', 'GETSTRBYTES', 'GETSYSTEMFUNCLIST', 'GETTICKCOUNT', 'GETTIME', 'GETTIMEZONE', 'GETTYPE',
    'GETTYPEEX', 'GETVARLIST', 'HAN2ZEN', 'HASH_EXIST', 'HASH_KEYS', 'HASH_SIZE', 'HASH_SPLIT', 'HASH_VALUES', 'HEXSTRTOI',
    'IARRAY', 'IHASH', 'INSERT', 'ISEVALUABLE', 'ISFUNC', 'ISGLOBALDEFINE', 'ISINTSTR', 'ISREALSTR', 'ISVAR',
  ],
  'J-P': [
    'LETTONAME', 'LICENSE', 'LINT.GetFuncUsedBy', 'LINT.GetGlobalVarLetted', 'LINT.GetGlobalVarUsedBy',
    'LINT.GetLocalVarLetted', 'LINT.GetLocalVarUsedBy', 'LINT.GetUserDefFuncUsedBy', 'LINT.GetVarRefs', 'LOADLIB', 'LOG', 'LOG10', 'LOGGING', 'LSO', 'MKDIR', 'OUTPUTNUM', 'PARSEHEADER', 'PARSEHTML',
    'PARSEJSON', 'PARSETOML', 'PARSEXML', 'PARSEYAML', 'POW', 'PROCESSGLOBALDEFINE',
  ],
  'Q-S': [
    'RAND', 'READFMO', 'REPLACE', 'REQUESTLIB', 'RESTOREVAR', 'RE_ASEARCH', 'RE_ASEARCHEX', 'RE_GETLEN', 'RE_GETPOS',
    'RE_GETSTR', 'RE_GREP', 'RE_MATCH', 'RE_OPTION', 'RE_REPLACE', 'RE_REPLACEEX', 'RE_SEARCH', 'RE_SPLIT', 'RMDIR', 'ROUND',
    'SAVEVAR', 'SETDELIM', 'SETGLOBALDEFINE', 'SETLASTERROR', 'SETSETTING', 'SETTAMAHWND', 'SIN', 'SINH', 'SLEEP', 'SPLIT',
    'SPLITPATH', 'SQLCLOSE', 'SQLEXEC', 'SQLOPEN', 'SQLQUERY', 'SQRT', 'SRAND', 'STRDECODE', 'STRDIGEST', 'STRENCODE',
    'STRFORM', 'STRLEN', 'STRSTR', 'SUBSTR',
  ],
  'T-Z': [
    'TAN', 'TANH', 'TOAUTO', 'TOAUTOEX', 'TOBINSTR', 'TOHEXSTR', 'TOINT', 'TOLOWER', 'TOREAL', 'TOSTR', 'TOUPPER', 'TRANSLATE',
    'UNDEFFUNC', 'UNDEFGLOBALDEFINE', 'UNLOADLIB', 'ZEN2HAN',
  ],
};

export class YBlockError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail || '';
  }
}

// ------------------------------------------------------------------ ブロックの形
export const ASSIGN_OPS = ['=', ':=', '+=', '-=', '*=', '/=', '%=', '+:=', '-:=', '*:=', '/:=', '%:=', ',='];
const EXPR_OPS = Object.keys(BIN_PREC).filter((o) => o !== ',');
const opts = (list) => list.map((o) => [o, o]);
const MODES = () => [[t('ランダム（指定なし）'), ''], ...opts(['random', 'nonoverlap', 'sequential', 'array', 'void', 'all', 'last',
  '_pool', '_pool_nonoverlap', '_pool_sequential', 'melt_nonoverlap', 'melt_sequential'])];
// 式の欄（YAYA の式の文字か、式のブロック）
const X = (d = '') => ({ kind: 'input', mode: 'text', def: d, yexpr: true });
// 書いた文字だけの欄（名前・ラベルなど。ブロックははめられない）
const L = (d = '', long = false) => ({ kind: 'input', mode: 'text', def: d, literal: true, long });
// 何行にもなる、書いた文字だけの欄（/* */ のコメント・読めない YAYA）
const M = (d = '') => ({ kind: 'input', mode: 'text', def: d, literal: true, long: true, multiline: true });

def({ type: 'y_func', cat: 'events', shape: 'hat', spec: t('関数 %name えらびかた %mode'),
  args: { name: L('MyFunction'), mode: { kind: 'dropdown', options: MODES(), def: '' } }, hat: true, kind: 'yfunc' });
// 文
def({ type: 'y_out', cat: 'talk', shape: 'stack', spec: '%value %prefix',
  args: { value: X('""'), prefix: { kind: 'dropdown', def: '',
    options: [[t('を出力の候補にする'), ''], [t('をばらして出力の候補にする（parallel）'), 'parallel'], [t('を計算だけする（void）'), 'void']] } } });
def({ type: 'y_sep', cat: 'talk', shape: 'stack', spec: t('-- ここで区切って、前とうしろの出力をつなげる') });
def({ type: 'y_assign', cat: 'variables', shape: 'stack', spec: '%target %op %value',
  args: { target: X('_x'), op: { kind: 'dropdown', options: opts(ASSIGN_OPS), def: '=' }, value: X('0') } });
def({ type: 'y_incdec', cat: 'variables', shape: 'stack', spec: '%target %op',
  args: { target: X('_i'), op: { kind: 'dropdown', options: opts(['++', '--']), def: '++' } } });
def({ type: 'y_if', cat: 'control', shape: 'c', spec: t('もし %cond なら'), args: { cond: X('1') }, subs: [{ key: 'body' }] });
def({ type: 'y_elseif', cat: 'control', shape: 'c', spec: t('そうでなくて、もし %cond なら'), args: { cond: X('1') }, subs: [{ key: 'body' }] });
def({ type: 'y_else', cat: 'control', shape: 'c', spec: t('そうでなければ'), subs: [{ key: 'body' }] });
def({ type: 'y_case', cat: 'control', shape: 'c', spec: t('%expr によって分ける（case）'), args: { expr: X('_x') }, subs: [{ key: 'body' }] });
def({ type: 'y_when', cat: 'control', shape: 'c', spec: t('%labels のとき（when）'), args: { labels: L('"a"') }, subs: [{ key: 'body' }] });
def({ type: 'y_others', cat: 'control', shape: 'c', spec: t('どれでもないとき（others）'), subs: [{ key: 'body' }] });
def({ type: 'y_switch', cat: 'control', shape: 'c', spec: t('%expr 番目のものをえらぶ（switch）'), args: { expr: X('_n') }, subs: [{ key: 'body' }] });
def({ type: 'y_while', cat: 'control', shape: 'c', spec: t('%cond のあいだくりかえす（while）'), args: { cond: X('1') }, subs: [{ key: 'body' }] });
def({ type: 'y_for', cat: 'control', shape: 'c', spec: t('はじめに %init 、%cond のあいだ、%step しながらくりかえす（for）'),
  args: { init: X('_i = 0'), cond: X('_i < 3'), step: X('_i++') }, subs: [{ key: 'body' }] });
def({ type: 'y_foreach', cat: 'control', shape: 'c', spec: t('%expr のひとつずつを %vars に入れてくりかえす（foreach）'),
  args: { expr: X('_list'), vars: L('_v') }, subs: [{ key: 'body' }] });
def({ type: 'y_break', cat: 'control', shape: 'stack', spec: t('くりかえしをぬける（break）') });
def({ type: 'y_continue', cat: 'control', shape: 'stack', spec: t('くりかえしの先頭へもどる（continue）') });
def({ type: 'y_return', cat: 'control', shape: 'stack', spec: t('ここで関数を終わる（return） %value'), args: { value: X('') } });
def({ type: 'y_block', cat: 'control', shape: 'c', spec: t('この中からえらぶ えらびかた %mode'),
  args: { mode: { kind: 'dropdown', options: MODES(), def: '' } }, subs: [{ key: 'body' }] });
def({ type: 'y_comment', cat: 'parts', shape: 'stack', spec: '%text', args: { text: M('// ') } });
def({ type: 'y_directive', cat: 'parts', shape: 'stack', spec: '%text', args: { text: L('#define ', true) } });
def({ type: 'y_raw', cat: 'parts', shape: 'stack', spec: t('読めない YAYA %text'), args: { text: M() } });
// 式
def({ type: 'y_bin', cat: 'operators', shape: 'reporter', spec: '%a %op %b',
  args: { a: X(), op: { kind: 'dropdown', options: opts(EXPR_OPS), def: '+' }, b: X() } });
def({ type: 'y_unary', cat: 'operators', shape: 'reporter', spec: '%op %a',
  args: { op: { kind: 'dropdown', options: opts(['!', '-', '+']), def: '!' }, a: X() } });
def({ type: 'y_incdec_r', cat: 'operators', shape: 'reporter', spec: '%a %op',
  args: { a: X('_i'), op: { kind: 'dropdown', def: 'post++', options: [[t('++（使ってから 1 足す）'), 'post++'],
    [t('--（使ってから 1 引く）'), 'post--'], [t('++ を前に（1 足してから使う）'), 'pre++'], [t('-- を前に（1 引いてから使う）'), 'pre--']] } } });
def({ type: 'y_call', cat: 'operators', shape: 'reporter', spec: '%name ( %args )',
  args: { name: Object.assign(L('STRLEN'), { pick: 'yayaSystem' }), args: { kind: 'slots', item: X(), def: () => [] } } });
def({ type: 'y_index', cat: 'operators', shape: 'reporter', spec: '%target [ %args ]',
  args: { target: X('_a'), args: { kind: 'slots', item: X(), def: () => ['0'] } } });
def({ type: 'y_list', cat: 'operators', shape: 'reporter', spec: '%items', args: { items: { kind: 'slots', item: X(), def: () => ['', ''] } } });
def({ type: 'y_paren', cat: 'operators', shape: 'reporter', spec: '( %a )', args: { a: X() } });
def({ type: 'y_ref', cat: 'operators', shape: 'reporter', spec: '&%a', args: { a: X('_x') } });

/** 辞書の画面のパレット（カテゴリの名前・印の色・中身。中身の書きかたは model/blocks.js の PALETTE と同じ） */
export const YPALETTE = [
  { id: 'y-func', name: t('関数と出力'), cat: 'events', entries: ['y_func', 'y_out', 'y_sep', 'y_return'] },
  { id: 'y-vars', name: t('変数'), cat: 'variables', entries: ['y_assign', 'y_incdec'] },
  { id: 'y-flow', name: t('制御'), cat: 'control', entries: ['y_if', 'y_elseif', 'y_else', 'y_case', 'y_when', 'y_others',
    'y_switch', 'y_while', 'y_for', 'y_foreach', 'y_break', 'y_continue', 'y_block'] },
  { id: 'y-expr', name: t('式'), cat: 'operators', entries: [
    { note: t('数・文字列・変数の名前は、欄にそのまま書きます（"こんにちは"・10・_x）。欄の文字は YAYA の式として読みます。') },
    'y_bin', 'y_unary', 'y_incdec_r', 'y_call', 'y_index', 'y_list', 'y_paren', 'y_ref'] },
  { id: 'y-other', name: t('コメント'), cat: 'parts', entries: ['y_comment', 'y_directive'] },
];

/** 辞書のテキストに入るかたまりか（関数・関数の外のコメントと # の行だけのかたまり）。入らないものは「はみ出したブロック」 */
export function goesIntoText(s) {
  if (s.kind === 'yfunc' || s.kind === 'ytop') return true;
  return (s.blocks || []).length > 0 && s.blocks.every((b) => TOP_TYPES.has(b.type));
}
const TOP_TYPES = new Set(['y_comment', 'y_directive', 'y_raw']);

// ------------------------------------------------------------------ 木 → ブロック
const isLeaf = (e) => e.type === 'num' || e.type === 'str' || e.type === 'heredoc' || e.type === 'name';

/** 式を、欄に入れるもの（YAYA の文字か、式のブロック）にする */
export function exprToSlot(e) {
  if (!e) return '';
  if (isLeaf(e)) return printExpr(e);
  switch (e.type) {
    case 'ref': return isLeaf(e.expr) ? '&' + printExpr(e.expr) : { type: 'y_ref', a: exprToSlot(e.expr) };
    case 'bin': return { type: 'y_bin', op: e.op, a: exprToSlot(e.left), b: exprToSlot(e.right) };
    case 'unary': return { type: 'y_unary', op: e.op, a: exprToSlot(e.expr) };
    case 'incdec': return { type: 'y_incdec_r', op: (e.prefix ? 'pre' : 'post') + e.op, a: exprToSlot(e.expr) };
    case 'call': return { type: 'y_call', name: e.name, args: e.args.map(exprToSlot) };
    case 'index': return { type: 'y_index', target: exprToSlot(e.target), args: e.args.map(exprToSlot) };
    case 'list': return { type: 'y_list', items: e.items.map(exprToSlot) };
    case 'paren': return { type: 'y_paren', a: exprToSlot(e.expr) };
    default: return printExpr(e);
  }
}

function labelText(l) {
  const one = (x) => (x.type === 'num' ? x.raw : x.quote + x.raw + x.quote);
  return l.to ? one(l.from) + '-' + one(l.to) : one(l.from);
}

const withMeta = (b, s, gap) => {
  if (gap) b.gap = true;
  if (s && s.trail) b.trail = s.trail;
  return b;
};
const comments = (list) => (list || []).map((text) => ({ type: 'y_comment', text }));

/** 文の並びを、ブロックの並びにする */
export function stmtsToBlocks(items) {
  const out = [];
  let gap = false;
  for (const s of items || []) {
    if (s.type === 'blank') { gap = true; continue; }
    const push = (b) => { out.push(withMeta(b, s, gap)); gap = false; };
    switch (s.type) {
      case 'comment': push({ type: 'y_comment', text: s.text }); break;
      case 'directive': push({ type: 'y_directive', text: s.text }); break;
      case 'raw': push({ type: 'y_raw', text: s.text }); break;
      case 'sep': push({ type: 'y_sep' }); break;
      case 'break': push({ type: 'y_break' }); break;
      case 'continue': push({ type: 'y_continue' }); break;
      case 'return': push({ type: 'y_return', value: s.expr ? exprToSlot(s.expr) : '' }); break;
      case 'block': push({ type: 'y_block', mode: s.mode || '', body: stmtsToBlocks(s.items) }); break;
      case 'switch': push({ type: 'y_switch', expr: exprToSlot(s.expr), body: stmtsToBlocks(s.body.items) }); break;
      case 'while': push(bodyOf({ type: 'y_while', cond: exprToSlot(s.cond) }, s.body)); break;
      case 'for': {
        const b = bodyOf({ type: 'y_for', init: exprToSlot(s.init), cond: exprToSlot(s.cond), step: exprToSlot(s.step) }, s.body);
        if (s.wrapped) b.wrapped = true;
        push(b);
        break;
      }
      case 'foreach': {
        const b = bodyOf({ type: 'y_foreach', expr: exprToSlot(s.expr), vars: s.vars.join(', ') }, s.body);
        if (s.wrapped) b.wrapped = true;
        push(b);
        break;
      }
      case 'expr': {
        const e = s.expr;
        if (!s.prefix && e.type === 'bin' && ASSIGN_OPS.includes(e.op)) {
          push({ type: 'y_assign', target: exprToSlot(e.left), op: e.op, value: exprToSlot(e.right) });
        } else if (!s.prefix && e.type === 'incdec' && !e.prefix) {
          push({ type: 'y_incdec', target: exprToSlot(e.expr), op: e.op });
        } else {
          push({ type: 'y_out', value: exprToSlot(e), prefix: s.prefix || '' });
        }
        break;
      }
      case 'if': {
        s.branches.forEach((br, i) => {
          if (i) out.push(...comments(br.comments));
          const b = bodyOf({ type: i ? 'y_elseif' : 'y_if', cond: exprToSlot(br.cond) }, br.body);
          if (i) out.push(b); else push(b);
        });
        if (s.else) {
          out.push(...comments(s.elseComments));
          out.push(bodyOf({ type: 'y_else' }, s.else));
        }
        break;
      }
      case 'case': {
        const body = [];
        for (const w of s.whens) {
          body.push(...comments(w.comments));
          body.push(bodyOf({ type: 'y_when', labels: w.labels.map(labelText).join(', ') }, w.body));
        }
        if (s.others) {
          body.push(...comments(s.othersComments));
          body.push(bodyOf({ type: 'y_others' }, s.others));
        }
        body.push(...comments(s.endComments));
        push({ type: 'y_case', expr: exprToSlot(s.expr), body });
        break;
      }
      default: break;
    }
  }
  return out;
}

// if などの中身。「if 1 ; nonoverlap : {」のときは、えらびかたを bodyMode に持つ
function bodyOf(b, block) {
  b.body = stmtsToBlocks(block.items);
  if (block.mode) b.bodyMode = block.mode;
  return b;
}

function height(blocks) {
  let n = 0;
  (function walk(list) {
    for (const b of list || []) { n++; if (Array.isArray(b.body)) { n++; walk(b.body); } }
  })(blocks);
  return n;
}

/** 辞書の木を、ブロックのビューにする */
export function astToView(dic) {
  const scripts = [];
  let gap = false;
  let top = null;   // 続いている、関数の外のもの（コメント・# の行・読めない関数）
  let y = 40;
  const place = (s) => { s.x = 40; s.y = y; y += 70 + height(s.blocks) * 34; scripts.push(s); };
  for (const item of dic.items || []) {
    if (item.type === 'blank') { gap = true; continue; }
    if (item.type === 'func') {
      top = null;
      const s = { id: 'y' + scripts.length, kind: 'yfunc', name: item.name, mode: item.mode || '', blocks: stmtsToBlocks(item.body.items) };
      if (item.comments) s.comments = item.comments.slice();
      if (item.trail) s.trail = item.trail;
      if (gap) s.gap = true;
      gap = false;
      place(s);
      continue;
    }
    const b = item.type === 'comment' ? { type: 'y_comment', text: item.text }
      : item.type === 'directive' ? { type: 'y_directive', text: item.text } : { type: 'y_raw', text: item.text };
    if (!top) {
      top = { id: 'y' + scripts.length, kind: 'ytop', blocks: [b] };
      if (gap) top.gap = true;
      place(top);
    } else {
      if (gap) b.gap = true;
      top.blocks.push(b);
      y += 34;
    }
    gap = false;
  }
  return { scripts };
}

// ------------------------------------------------------------------ ブロック → 木
/** 名前の欄が、YAYA の名前 1 つか（関数の名前・関数をよぶ名前） */
function nameOf(v, what) {
  const s = String(v == null ? '' : v).trim();
  let tk = null;
  try { tk = lex(s); } catch { tk = null; }
  if (!tk || tk.length !== 2 || tk[0].t !== 'name') throw new YBlockError('bad_name', s || what);
  return s;
}

/** 欄に入れたものを、式にする。inArg なら & を付けられる（関数をよぶときの引数） */
export function slotToExpr(v, inArg = false) {
  if (v && typeof v === 'object') return blockToExpr(v);
  const s = v == null ? '' : String(v).trim();
  if (!s) throw new YBlockError('empty_slot');
  try {
    if (inArg && s[0] === '&') return { type: 'ref', expr: parseExpr(s.slice(1)) };
    return parseExpr(s);
  } catch (e) {
    if (e instanceof YBlockError) throw e;
    throw new YBlockError('bad_expr', s);
  }
}

function blockToExpr(b) {
  switch (b.type) {
    case 'y_bin': return { type: 'bin', op: b.op, left: slotToExpr(b.a), right: slotToExpr(b.b) };
    case 'y_unary': return { type: 'unary', op: b.op, expr: slotToExpr(b.a) };
    case 'y_incdec_r': {
      const m = /^(pre|post)(\+\+|--)$/.exec(String(b.op || ''));
      if (!m) throw new YBlockError('bad_op', b.op);
      return { type: 'incdec', op: m[2], prefix: m[1] === 'pre', expr: slotToExpr(b.a) };
    }
    case 'y_call': return { type: 'call', name: nameOf(b.name, 'call'), args: (b.args || []).map((a) => slotToExpr(a, true)) };
    case 'y_index': return { type: 'index', target: slotToExpr(b.target), args: (b.args || []).map((a) => slotToExpr(a)) };
    case 'y_list': return { type: 'list', items: (b.items || []).map((a) => slotToExpr(a)) };
    case 'y_paren': return { type: 'paren', expr: slotToExpr(b.a) };
    case 'y_ref': return { type: 'ref', expr: slotToExpr(b.a) };
    default: throw new YBlockError('not_expr', b.type);
  }
}

function labelsOf(text) {
  const r = parseYaya(`x\n{\ncase 1 {\nwhen ${text}\n1\n}\n}\n`);
  const f = r.dic.items[0];
  if (r.errors.length || !f || f.type !== 'func') throw new YBlockError('bad_labels', text);
  return f.body.items[0].whens[0].labels;
}

function varsOf(text) {
  const vars = String(text || '').split(',').map((v) => v.trim());
  if (vars.length < 1 || vars.length > 2) throw new YBlockError('bad_vars', text);
  vars.forEach((v) => nameOf(v, 'foreach'));
  return vars;
}

function blockBody(b) {
  return { type: 'block', mode: b.bodyMode || null, items: blocksToStmts(b.body) };
}

/** ブロックの並びを、文の並びにする */
export function blocksToStmts(blocks) {
  const out = [];
  for (const b of blocks || []) {
    if (!b || typeof b !== 'object') continue;
    // そうでなくて・そうでなければ は、すぐ前の「もし」につなぐ（あいだのコメントは、その節のコメントにする）
    if (b.type === 'y_elseif' || b.type === 'y_else') {
      let k = out.length - 1;
      while (k >= 0 && out[k].type === 'comment') k--;
      const prev = out[k];
      if (!prev || prev.type !== 'if' || prev.else) throw Object.assign(new YBlockError('orphan_else', b.type), { block: b });
      const cs = out.splice(k + 1).map((c) => c.text);
      if (b.type === 'y_elseif') prev.branches.push({ cond: slotToExpr(b.cond), body: blockBody(b), comments: cs });
      else { prev.else = blockBody(b); prev.elseComments = cs; }
      if (b.trail) out.push({ type: 'comment', text: b.trail });
      continue;
    }
    if (b.gap && out.length) out.push({ type: 'blank' });
    let s;
    try {
      s = blockToStmt(b);
    } catch (e) {
      if (e instanceof YBlockError && !e.block) e.block = b;   // どのブロックか（辞書の画面で、そのブロックに印を付ける）
      throw e;
    }
    out.push(s);
    // うしろのコメント。} のうしろのコメントは、YAYA の文を読むときと同じく、次の行のコメントにする
    if (b.trail && s.type !== 'comment' && s.type !== 'directive') {
      if (TRAILS.has(s.type)) s.trail = b.trail;
      else out.push({ type: 'comment', text: b.trail });
    }
  }
  return out;
}

const TRAILS = new Set(['expr', 'sep', 'break', 'continue', 'return', 'raw']);

function blockToStmt(b) {
  switch (b.type) {
    case 'y_comment': return { type: 'comment', text: String(b.text || '') };
    case 'y_directive': return { type: 'directive', text: String(b.text || '') };
    case 'y_raw': return { type: 'raw', text: String(b.text || '') };
    case 'y_sep': return { type: 'sep' };
    case 'y_break': return { type: 'break' };
    case 'y_continue': return { type: 'continue' };
    case 'y_return': {
      const v = b.value;
      const empty = v == null || (typeof v === 'string' && !v.trim());
      return { type: 'return', expr: empty ? null : slotToExpr(v) };
    }
    case 'y_out': return { type: 'expr', prefix: b.prefix || null, expr: slotToExpr(b.value) };
    case 'y_assign': return { type: 'expr', prefix: null, expr: { type: 'bin', op: b.op, left: slotToExpr(b.target), right: slotToExpr(b.value) } };
    case 'y_incdec': return { type: 'expr', prefix: null, expr: { type: 'incdec', op: b.op, prefix: false, expr: slotToExpr(b.target) } };
    case 'y_block': return { type: 'block', mode: b.mode || null, items: blocksToStmts(b.body) };
    case 'y_if': return { type: 'if', branches: [{ cond: slotToExpr(b.cond), body: blockBody(b), comments: [] }], else: null, elseComments: [] };
    case 'y_switch': return { type: 'switch', expr: slotToExpr(b.expr), body: { type: 'block', mode: null, items: blocksToStmts(b.body) } };
    case 'y_while': return { type: 'while', cond: slotToExpr(b.cond), body: blockBody(b) };
    case 'y_for': {
      const s = { type: 'for', init: slotToExpr(b.init), cond: slotToExpr(b.cond), step: slotToExpr(b.step), body: blockBody(b) };
      if (b.wrapped) s.wrapped = true;
      return s;
    }
    case 'y_foreach': {
      const s = { type: 'foreach', expr: slotToExpr(b.expr), vars: varsOf(b.vars), body: blockBody(b) };
      if (b.wrapped) s.wrapped = true;
      return s;
    }
    case 'y_case': {
      const node = { type: 'case', expr: slotToExpr(b.expr), whens: [], others: null, othersComments: [] };
      let cs = [];
      for (const w of b.body || []) {
        if (w.type === 'y_comment') { cs.push(String(w.text || '')); continue; }
        if (w.type === 'y_when') { node.whens.push({ labels: labelsOf(w.labels), body: blockBody(w), comments: cs }); cs = []; continue; }
        if (w.type === 'y_others') { node.others = blockBody(w); node.othersComments = cs; cs = []; continue; }
        throw new YBlockError('not_in_case', w.type);
      }
      if (cs.length) node.endComments = cs;
      return node;
    }
    case 'y_when': case 'y_others': throw new YBlockError('outside_case', b.type);
    default: throw new YBlockError('not_stmt', b.type);
  }
}

/**
 * ブロックのビューを、辞書の木にする。かたまりは上から（同じ高さなら左から）順に書きます。
 * 関数の外にはみ出したブロックは、数だけ返して木には入れません（コメントと # の行だけのかたまりは、関数の外のコメントにします）
 */
export function viewToAst(view) {
  const items = [];
  let loose = 0;
  const scripts = ((view && view.scripts) || []).slice().sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  for (const s of scripts) {
    if (s.kind === 'yfunc') {
      if (s.gap && items.length) items.push({ type: 'blank' });
      let name;
      try {
        name = nameOf(s.name, 'function');
      } catch (e) {
        e.block = s;   // 帽子（かたまり）に印を付ける
        throw e;
      }
      const f = { type: 'func', name, mode: s.mode ? String(s.mode) : null,
        body: { type: 'block', mode: null, items: blocksToStmts(s.blocks) } };
      if (s.comments && s.comments.length) f.comments = s.comments.slice();
      if (s.trail) f.trail = s.trail;
      items.push(f);
    } else if (goesIntoText(s)) {
      s.blocks.forEach((b, i) => {
        if ((i === 0 ? s.gap : b.gap) && items.length) items.push({ type: 'blank' });
        if (b.type === 'y_comment') items.push({ type: 'comment', text: String(b.text || '') });
        else if (b.type === 'y_directive') items.push({ type: 'directive', text: String(b.text || '') });
        else if (b.type === 'y_raw') items.push({ type: 'raw', text: String(b.text || '') });
        else loose++;
      });
    } else {
      loose += (s.blocks || []).length;
    }
  }
  return { dic: { type: 'dic', items }, loose };
}
