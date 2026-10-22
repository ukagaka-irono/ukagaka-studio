/* 伺かスタジオ - ブロックを YAYA の辞書に訳す（段階 3-2）
 *
 * 書き出す ghost.json の形（栞が読むもの）を受けとって、YAYA の辞書 studio_program.dic の
 * 中身を作ります。かたまり 1 つが YAYA の関数 1 つになり、ブロックは
 * Studio.Say(0, 'こんにちは', 1) のような 1 行になります。
 *
 * 動きの決まり（数と文字の扱い・どのかたまりを選ぶか・既定の反応など）は、ここではなく
 * しくみの辞書 studio/res/yaya/studio_runtime.dic の Studio.〜 にあります。ここは「ブロックを
 * その呼び出しに置きかえる」ことだけをします。もとの如何栞（shiori/src/interp.cpp）と
 * 同じ答えになることは、shiori\test\yaya\ のテストが両方を動かして確かめます。
 *
 * DOM を触らないので、node のテストからそのまま使えます。
 */

/** yaya_base（third_party/yaya-dic/yaya_base）の #globaldefine の名前。
 *  YAYA は、この名前を文字列の中でも置きかえてしまうので、人の書いた文に出てきたら
 *  文字列を 2 つに分けて、置きかえられないようにします（shiori\test\yaya\ が、この一覧が
 *  yaya_base とそろっているかを見ます）。 */
export const YAYA_DEFINES = [
  'AYAINFO_VERSION', 'AYAINFO_CHARSET', 'AYAINFO_PATH', 'AYAINFO_NAME', 'AYAINFO_AUTHOR',
  'SETSEPARATOR', 'TONUMBER2', 'TOSTRING2', 'TONUMBER', 'TOSTRING', 'ISFUNCTION',
  'BINSTRTONUM', 'HEXSTRTONUM', 'ERASEVARIABLE', 'MSTRLEN', 'MSTRSTR', 'MSUBSTR', 'MERASE',
  'MINSERT', 'NAMETOVALUE', 'CALLBYNAME', 'TALK_INTERVAL', 'COM_RATIO',
  'SHIORI3FW.IGLIST_ACCEL', 'SHIORI3FW.IGLIST_MAX', 'SHIORI3FW.RES_REF_MAX',
  'SHIORI3FW.AUTO_DATA_CONVERT', 'SHIORI3FW.REF_ACCEL', 'SHIORI3FW.ENABLE_DELAYED_EVAL',
  'CHAIN{{', 'CHAIN}}', '{{CHAIN', '}}CHAIN',
];

/** ブロックが無くても、しくみの辞書が答えるイベント（既定の反応・なで・入力・選択肢・毎秒） */
export const RUNTIME_EVENTS = [
  'OnBoot', 'OnFirstBoot', 'OnClose', 'OnCloseAll', 'OnMouseDoubleClick', 'OnNadeNade',
  'OnMouseMove', 'OnSecondChange', 'OnUserInput', 'OnChoiceSelect', 'OnAnchorSelect',
  'OnUpdateComplete', 'OnUpdateFailure',
];

/** yaya_base が自分で持っている名前。イベントの関数にすると、受け口そのものが壊れます */
const RESERVED_EVENT = ['OnRequest'];
const RESERVED_PREFIX = ['OnSHIORI3FW.', 'OnSystemLoad', 'OnSystemUnload', 'OnGhostLoad',
  'OnGhostUnload', 'OnGhostEventTranslate', 'OnTranslateInternal', 'SHIORI3'];

/** 書き出すゴーストの yaya.txt（はじめて作るとき） */
export function yayaTxt() {
  return [
    'charset, UTF-8',
    'dicdir, yaya_base',
    'dic, studio_runtime.dic',
    'dic, studio_program.dic',
    '',
  ].join('\r\n');
}

// ------------------------------------------------------------- JSON の読みかた
// 如何栞の JValue と同じ決まり（shiori/src/json.cpp）。書き出しのときに決まる値に使います。

function trimC(s) {
  let b = 0;
  let e = s.length;
  while (b < e && s.charCodeAt(b) <= 32) b++;
  while (e > b && s.charCodeAt(e - 1) <= 32) e--;
  return s.slice(b, e);
}

/** 文字の頭の数を読む（C の strtod と同じく、読めたところまで） */
function strToNum(s) {
  const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(trimC(String(s)));
  return m ? parseFloat(m[0]) : 0;
}

/** 数の書きかた（整数なら小数点なし。そうでなければ C の %.10g） */
export function numToStr(v) {
  if (Number.isNaN(v)) return '0';
  if (v === 0) return '0';
  if (!Number.isFinite(v)) return v > 0 ? '1.#INF' : '-1.#INF';
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toFixed(0);
  const [mant, expStr] = v.toExponential(9).split('e');
  const exp = parseInt(expStr, 10);
  const strip = (x) => (x.includes('.') ? x.replace(/0+$/, '').replace(/\.$/, '') : x);
  if (exp < -4 || exp >= 10) {
    const sign = exp < 0 ? '-' : '+';
    return `${strip(mant)}e${sign}${String(Math.abs(exp)).padStart(3, '0')}`;
  }
  return strip(v.toFixed(9 - exp));
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function asStr(v, def = '') {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return numToStr(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return def;
}

function asNum(v, def = 0) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return strToNum(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return def;
}

function roundInt(v) {
  return Math.trunc(v < 0 ? v - 0.5 : v + 0.5);
}

function asInt(v, def = 0) {
  if (v === null || v === undefined) return def;
  return roundInt(asNum(v, def));
}

function asBool(v, def = false) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '' && v !== '0' && v.toLowerCase() !== 'false';
  return def;
}

// ------------------------------------------------------------- YAYA の書きかた

/** 人の書いた文を、YAYA の文字列にする。' と制御文字と #globaldefine の名前をよける */
export function yayaStr(s) {
  s = String(s);
  if (s === '') return "''";
  const parts = [];
  let run = '';
  const flush = () => {
    if (!run) return;
    // #globaldefine の名前が丸ごと入らないように、名前の 1 文字目のすぐあとで切る
    let rest = run;
    for (;;) {
      let at = -1;
      for (const name of YAYA_DEFINES) {
        const k = rest.indexOf(name);
        if (k >= 0 && (at < 0 || k < at)) at = k;
      }
      if (at < 0) break;
      parts.push(`'${rest.slice(0, at + 1)}'`);
      rest = rest.slice(at + 1);
    }
    if (rest) parts.push(`'${rest}'`);
    run = '';
  };
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === "'") { flush(); parts.push('"\'"'); }
    else if (c < 0x20 || c === 0x7f) { flush(); parts.push(`CHR(${c})`); }
    else run += ch;
  }
  flush();
  return parts.join(' + ');
}

/** 数を YAYA の小数の書きかたにする（YAYA は 1e20 のような書きかたを読めないので、そのときは TOREAL） */
function yayaNum(n) {
  if (!Number.isFinite(n)) return '0.0';
  let s;
  if (Number.isInteger(n) && Math.abs(n) < 1e15) s = `${n.toFixed(0)}.0`;
  else {
    s = String(n);
    if (/e/i.test(s)) return `TOREAL('${s}')`;
    if (!s.includes('.')) s += '.0';
  }
  return n < 0 ? `(${s})` : s;
}

function yayaInt(n) {
  return n < 0 ? `(${n})` : String(n);
}

/** 関数名に使える形にする（英数字と _ のほかは _xHHHH_ に） */
function safeName(s) {
  return String(s).replace(/[^A-Za-z0-9_]/g, (c) => `_x${c.codePointAt(0).toString(16)}_`);
}

/** イベントの名前が、そのまま YAYA の関数名にできるか */
function eventNameOk(ev) {
  if (!ev || /^[0-9]/.test(ev)) return false;
  if (/[\s!"#$%&'()*+,\-/:;<=>?@[\\\]^`{|}~]/.test(ev)) return false;
  if (RESERVED_EVENT.includes(ev)) return false;
  return !RESERVED_PREFIX.some((p) => ev.startsWith(p));
}

const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ');

// ------------------------------------------------------------- 式

function blockType(b) {
  if (!isObj(b)) return '';
  return asStr(b.type) || asStr(b.op);
}

/** 値になるブロック（または数・文字そのもの）を、YAYA の式にする */
function expr(node) {
  if (node === null || node === undefined) return "''";
  if (typeof node === 'number') return yayaNum(node);
  if (typeof node === 'boolean') return node ? '1.0' : '0.0';
  if (typeof node === 'string') return yayaStr(node);
  if (Array.isArray(node)) return "''";
  const type = blockType(node);
  switch (type) {
    case 'num': return yayaNum(asNum(node.value, 0));
    case 'text': return yayaStr(asStr(node.value));
    case 'bool': return asBool(node.value, false) ? '1.0' : '0.0';
    case 'var': return `Studio.Get(${yayaStr(asStr(node.name))})`;
    case 'ref': return `Studio.Ref(${yayaInt(asInt(node.index, 0))})`;
    case 'sys': return `Studio.Sys(${yayaStr(asStr(node.key))})`;
    case 'random': return `Studio.Random(${expr(node.min)}, ${expr(node.max)})`;
    case 'arith': {
      const op = asStr(node.op, '+');
      const a = numExpr(node.a);
      const b = numExpr(node.b);
      if (op === '+' || op === '-' || op === '*') return `(${a} ${op} ${b})`;
      if (op === '/') return `Studio.Div(${a}, ${b})`;
      if (op === '%') return `Studio.Mod(${a}, ${b})`;
      if (op === 'min') return `Studio.Min(${a}, ${b})`;
      if (op === 'max') return `Studio.Max(${a}, ${b})`;
      return '0.0';
    }
    case 'round': {
      const op = asStr(node.op, 'round');
      if (op === 'floor') return `FLOOR(${numExpr(node.a)})`;
      if (op === 'ceil') return `CEIL(${numExpr(node.a)})`;
      if (op === 'abs') return `Studio.Abs(${expr(node.a)})`;
      return `Studio.Round(${expr(node.a)})`;
    }
    case 'compare': return `Studio.Cmp(${expr(node.a)}, ${yayaStr(asStr(node.op, '='))}, ${expr(node.b)})`;
    case 'logic': {
      // and でなければ or（如何栞と同じ）
      const op = asStr(node.op, 'and');
      return `Studio.${op === 'and' ? 'And' : 'Or'}(${expr(node.a)}, ${expr(node.b)})`;
    }
    case 'not': return `Studio.Not(${expr(node.a)})`;
    case 'join': return `Studio.Join(${expr(node.a)}, ${expr(node.b)})`;
    case 'contains': return `Studio.Contains(${expr(node.a)}, ${expr(node.b)})`;
    case 'length': return `Studio.Len(${expr(node.a)})`;
    case 'saori': return `Studio.Saori(${[yayaInt(asInt(node.value, -1)), expr(node.file), ...saoriArgs(node)].join(', ')})`;
    case 'chance': return `Studio.Chance(${expr(node.a)})`;
    default: return "''";
  }
}

/** 数として使う式（数そのものなら、そのまま書く） */
function numExpr(node) {
  if (typeof node === 'number') return yayaNum(node);
  return `Studio.N(${expr(node)})`;
}

/** 整数の欄（だれ・表情・回数など）。書いていなければ def */
function intArg(node, def) {
  if (node === null || node === undefined) return yayaInt(def);
  if (typeof node !== 'object') return yayaInt(asInt(node, def));
  if (Array.isArray(node)) return '0';
  return `Studio.Int(${expr(node)})`;
}

function saoriArgs(b) {
  const out = [];
  for (const k of ['a', 'b', 'c']) {
    if (b[k] === undefined || b[k] === null) continue;
    out.push(expr(b[k]));
  }
  return out;
}

// ------------------------------------------------------------- 文

/** ブロックの並びを、YAYA の行の並びにする */
function stmts(blocks, ind, ctx) {
  const out = [];
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) out.push(...stmt(b, ind, ctx));
  return out;
}

function stmt(b, ind, ctx) {
  if (!isObj(b)) return [];
  if (asBool(b.disabled, false)) return [];
  const type = blockType(b);
  const L = (s) => ind + s;
  const stop = [L('if Studio.stop { return }')];
  switch (type) {
    case 'say': {
      const args = [intArg(b.who, 0), expr(b.text), asBool(b.nl, true) ? '1' : '0'];
      if (b.surface !== undefined && b.surface !== null) args.push(intArg(b.surface, 0));
      return [L(`Studio.Say(${args.join(', ')})`)];
    }
    case 'surface': return [L(`Studio.Surface(${intArg(b.who, 0)}, ${intArg(b.id, 0)})`)];
    case 'chara': return [L(`Studio.Chara(${intArg(b.id, 0)})`)];
    case 'newline': return [L(`Studio.Newline(${intArg(b.count, 1)})`)];
    case 'wait': return [L(`Studio.Wait(${intArg(b.ms, 500)})`)];
    case 'click_wait': return [L('Studio.ClickWait')];
    case 'clear': return [L('Studio.Clear')];
    case 'raw': return [L(`Studio.Raw(${expr(b.text)})`)];
    case 'anim': return [L(`Studio.Anim(${intArg(b.id, 0)})`)];
    case 'balloon': return [L(`Studio.Balloon(${intArg(b.id, 0)})`)];
    case 'sound': return [L(`Studio.Sound(${expr(b.file)})`)];
    case 'link': return [L(`Studio.Link(${expr(b.url)}, ${expr(b.label)})`)];
    case 'choice': return [L(`Studio.Choice(${expr(b.label)}, ${expr(b.target)})`)];
    case 'communicate':
      return [L(`Studio.Communicate(${intArg(b.who, 0)}, ${expr(b.text)}, ${expr(b.to)})`)];
    case 'ask': return [L(`Studio.Ask(${yayaStr(asStr(b.into))}, ${expr(b.initial)})`)];
    case 'change_ghost': return [L(`if Studio.ChangeGhost(${expr(b.name)}) { return }`)];
    case 'open_browser': return [L(`Studio.OpenBrowser(${expr(b.url)})`)];
    case 'raise': return [L(`Studio.Raise(${expr(b.event)}, ${expr(b.a)})`)];
    case 'later': return [L(`Studio.Later(${expr(b.name)}, ${intArg(b.sec, 10)})`)];
    case 'saori_call': {
      const args = [yayaStr(asStr(b.into)), yayaInt(asInt(b.value, -1)), expr(b.file), ...saoriArgs(b)];
      return [L(`Studio.SaoriCall(${args.join(', ')})`)];
    }
    case 'update': return [L('Studio.Update')];
    case 'end': return [L('Studio.End'), L('return')];
    case 'stop': return [L('Studio.Stop'), L('return')];
    case 'close': return [L('Studio.Close'), L('return')];
    case 'set': {
      const name = asStr(b.name);
      return name ? [L(`Studio.Set(${yayaStr(name)}, ${expr(b.value)})`)] : [];
    }
    case 'change': {
      const name = asStr(b.name);
      return name ? [L(`Studio.Change(${yayaStr(name)}, ${expr(b.value)})`)] : [];
    }
    case 'talk_interval': return [L(`Studio.TalkInterval(${intArg(b.sec, 180)})`)];
    case 'if':
      return [L(`if Studio.B(${expr(b.cond)}) {`), ...stmts(b.then, ind + '\t', ctx), L('}')];
    case 'if_else':
      return [
        L(`if Studio.B(${expr(b.cond)}) {`), ...stmts(b.then, ind + '\t', ctx),
        L('}'), L('else {'), ...stmts(b.else, ind + '\t', ctx), L('}'),
      ];
    case 'repeat': {
      const k = ++ctx.n;
      const count = b.count;
      const head = [];
      let limit;
      if (count === null || count === undefined || typeof count !== 'object') {
        limit = String(Math.min(asInt(count, 1), 5000));
      } else {
        head.push(L(`_n${k} = Studio.Count(${expr(count)})`));
        limit = `_n${k}`;
      }
      return [
        ...head,
        L(`for _i${k} = 0; _i${k} < ${limit}; _i${k}++ {`),
        L('\tif Studio.Tick { return }'),
        ...stmts(b.body, ind + '\t', ctx),
        L('}'),
      ];
    }
    case 'while': {
      const k = ++ctx.n;
      return [
        L(`_g${k} = 0`),
        L(`while _g${k} < Studio.MAX_LOOP {`),
        L(`\t_g${k}++`),
        L('\tif Studio.Tick { return }'),
        L(`\tif !Studio.B(${expr(b.cond)}) { break }`),
        ...stmts(b.body, ind + '\t', ctx),
        L('}'),
      ];
    }
    case 'random_one': {
      const branches = Array.isArray(b.branches) ? b.branches : [];
      if (!branches.length) return [];
      const k = ++ctx.n;
      const out = [L(`_r${k} = RAND(${branches.length})`)];
      branches.forEach((br, i) => {
        out.push(L(`${i ? 'elseif' : 'if'} _r${k} == ${i} {`), ...stmts(br, ind + '\t', ctx), L('}'));
      });
      return out;
    }
    case 'call_group': return [L(`Studio.CallGroup(${expr(b.group)})`), ...stop];
    case 'call': {
      const name = asStr(b.name);
      const target = name ? yayaStr(name) : `Studio.S(${expr(b.target)})`;
      return [L(`Studio.Call(${target})`), ...stop];
    }
    default:
      return [L(`// ${oneLine(type || '?')}: YAYA に訳せないブロックです`)];  // i18n-ignore
  }
}

// ------------------------------------------------------------- 書き出す形

/**
 * エディタのプロジェクトから、書き出す ghost.json の形（栞が読むもの）を作る。
 * exe の RuntimeProgramJson（studio/src/export_program.cpp）と同じ中身です
 * （同じになることは shiori\test\yaya\yaya.js が、書き出しテストの期待値と見くらべます）。
 */
export function programOf(project) {
  const p = isObj(project) ? project : {};
  const meta = isObj(p.meta) ? p.meta : {};
  const settings = isObj(p.settings) ? p.settings : {};
  const en = asStr(meta.lang) === 'en';
  const name = asStr(meta.name);

  const m = {
    name: trimC(name) ? name : (en ? 'New Ghost' : 'あたらしいゴースト'), // i18n-ignore
    sakuraName: asStr(meta.sakuraName, en ? 'Sakura' : 'さくら'), // i18n-ignore
    keroName: asStr(meta.keroName, en ? 'Kero' : 'うにゅう'), // i18n-ignore
    craftman: asStr(meta.craftman, ''),
    craftmanUrl: asStr(meta.craftmanUrl, ''),
    version: asStr(meta.version, '1.0.0'),
  };
  if (en) m.lang = 'en';

  const variables = [];
  for (const v of Array.isArray(p.variables) ? p.variables : []) {
    if (!isObj(v) || !asStr(v.name)) continue;
    variables.push({ name: asStr(v.name), value: v.value === undefined ? null : v.value });
  }

  const scripts = [];
  for (const src of Array.isArray(p.scripts) ? p.scripts : []) {
    if (!isObj(src)) continue;
    const kind = asStr(src.kind);
    if (kind !== 'event' && kind !== 'talk' && kind !== 'function') continue;
    const one = { id: asStr(src.id), kind };
    if (kind === 'event') {
      const ev = asStr(src.event);
      one.event = ev;
      // くりかえしの間隔（毎秒でよければ書かない）
      const every = asInt(src.everySec, 1);
      if (every > 1) one.everySec = every;
      // イベントの絞り込み。今のイベントに関係するものだけ書く
      const isMouse = ev.startsWith('OnMouse') || ev === 'OnNadeNade';
      const isComm = ev === 'OnCommunicate';
      const area = isMouse ? asStr(src.area) : '';
      const who = isMouse ? asInt(src.who, -1) : -1;
      const from = isComm ? asStr(src.from) : '';
      const contains = isComm ? asStr(src.contains) : '';
      if (area || who >= 0 || from || contains) {
        const f = {};
        if (area) f.area = area;
        if (who >= 0) f.who = who;
        if (from) f.from = from;
        if (contains) f.contains = contains;
        one.filter = f;
      }
    }
    if (kind === 'talk' || kind === 'function') one.name = asStr(src.name);
    if (kind === 'talk') {
      one.weight = asNum(src.weight, 1);
      const group = trimC(asStr(src.group));
      if (group) one.group = group;
    }
    if (asBool(src.disabled, false)) one.disabled = true;
    one.blocks = Array.isArray(src.blocks) ? src.blocks : [];
    scripts.push(one);
  }

  return {
    format: 'ikaga/1',
    meta: m,
    settings: {
      randomTalkInterval: asNum(settings.randomTalkInterval, 180),
      randomTalkEnabled: asBool(settings.randomTalkEnabled, true),
      noRepeatCount: asNum(settings.noRepeatCount, 0),
    },
    variables,
    scripts,
  };
}

// ------------------------------------------------------------- 全体

const TEXT = {
  ja: {
    head: [
      '伺かスタジオが、ブロックから書き出した辞書です（studio_program.dic）。', // i18n-ignore
      '書き出すたびに作りなおすので、手で直さないでください。手で書くものは、べつの辞書に。', // i18n-ignore
      'ブロックが使う Studio.〜 の関数は、studio_runtime.dic にあります。', // i18n-ignore
    ],
    program: 'ゴーストの情報・設定・かたまりの一覧・変数の初期値', // i18n-ignore
    events: 'イベント（SSP から呼ばれる入り口）', // i18n-ignore
    scripts: 'かたまり', // i18n-ignore
    skipped: (ev) => `イベント名「${ev}」は YAYA の関数名にできないので、書き出していません`, // i18n-ignore
    handwritten: (ev) => [
      `${ev} は手書きの辞書にもあるので、ここには入り口を書きません（両方あると YAYA が辞書を読めないため）。`, // i18n-ignore
      `ブロックも動かすときは、手書きの ${ev} の中で Studio.Event('${ev}') をよんでください。`, // i18n-ignore
    ],
    talk: (n) => `ランダムトーク「${n}」`, // i18n-ignore
    fn: (n) => `トーク「${n}」`, // i18n-ignore
    off: '（無効）', // i18n-ignore
  },
  en: {
    head: [
      'Dictionary exported from blocks by Ukagaka Studio (studio_program.dic).',
      'It is rewritten on every export, so do not edit it by hand; put hand-written code in another dictionary.',
      'The Studio.* functions the blocks use are in studio_runtime.dic.',
    ],
    program: 'ghost info, settings, the list of scripts and initial values of variables',
    events: 'events (entry points called by SSP)',
    scripts: 'scripts',
    skipped: (ev) => `the event name "${ev}" cannot be a YAYA function name, so it was not exported`,
    handwritten: (ev) => [
      `${ev} is also in a hand-written dictionary, so no entry is written here (with both, YAYA cannot read the dictionaries).`,
      `To run the blocks too, call Studio.Event('${ev}') inside the hand-written ${ev}.`,
    ],
    talk: (n) => `random talk "${n}"`,
    fn: (n) => `talk "${n}"`,
    off: ' (disabled)',
  },
};

/** 変数の初期値（如何栞の Vars::fromJson と同じ読みかた） */
function initialValue(v) {
  if (typeof v === 'string') return yayaStr(v);
  if (typeof v === 'boolean') return v ? '1.0' : '0.0';
  return yayaNum(asNum(v, 0));
}

/**
 * 書き出す ghost.json の形（format / meta / settings / variables / scripts）から、
 * studio_program.dic の中身を作る。
 */
export function toYaya(program, options = {}) {
  // 手書きの辞書にある関数の名前（手書きの YAYA ゴーストにつないだとき）。同じ名前のイベントは手書きを優先します
  const handwritten = new Set(Array.isArray(options.handwritten) ? options.handwritten : []);
  const p = isObj(program) ? program : {};
  const meta = isObj(p.meta) ? p.meta : {};
  const settings = isObj(p.settings) ? p.settings : {};
  const en = asStr(meta.lang) === 'en';
  const T = en ? TEXT.en : TEXT.ja;
  const scripts = (Array.isArray(p.scripts) ? p.scripts : []).filter(isObj);

  const bar = '//' + '='.repeat(78);
  const sec = (title) => ['', '//' + '-'.repeat(78), `// ${title}`, '//' + '-'.repeat(78)];
  // 1 行目の印で、スタジオが書いたファイルだと見分けます（手書きのゴーストにつないだとき、印の無いものは上書きしない）
  const lines = ['// ukagaka-studio: generated', bar, ...T.head.map((s) => `// ${s}`), bar];

  // 関数名（id から。重なったら _2, _3 …）
  const used = new Set();
  const fnOf = scripts.map((s) => {
    const base = `Studio.Script.${safeName(asStr(s.id)) || 'noid'}`;
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}_${i}`;
    used.add(name);
    return name;
  });

  // ---- ゴーストの情報・かたまりの一覧
  lines.push(...sec(T.program), 'Studio.Program.Init : void', '{');
  lines.push(`\tStudio.meta.name = ${yayaStr(asStr(meta.name))}`);
  lines.push(`\tStudio.meta.sakuraName = ${yayaStr(asStr(meta.sakuraName, en ? 'Sakura' : 'さくら'))}`); // i18n-ignore
  lines.push(`\tStudio.meta.lang = ${yayaStr(en ? 'en' : '')}`);
  lines.push(`\tStudio.set.interval = ${asInt(settings.randomTalkInterval, 180)}`);
  lines.push(`\tStudio.set.enabled = ${asBool(settings.randomTalkEnabled, true) ? 1 : 0}`);
  lines.push(`\tStudio.set.noRepeat = ${asInt(settings.noRepeatCount, 0)}`);
  scripts.forEach((s, i) => {
    const kind = asStr(s.kind, 'event');
    const f = isObj(s.filter) ? s.filter : {};
    const args = [
      yayaStr(asStr(s.id)), yayaStr(fnOf[i]), yayaStr(kind), yayaStr(asStr(s.event)),
      yayaStr(asStr(s.name)), yayaStr(asStr(s.group)), yayaNum(asNum(s.weight, 1)),
      yayaInt(asInt(s.everySec, 0)), yayaStr(asStr(f.area)), yayaInt(asInt(f.who, -1)),
      yayaStr(asStr(f.from)), yayaStr(asStr(f.contains)), asBool(s.disabled, false) ? '1' : '0',
    ];
    lines.push(`\tStudio.Def(${args.join(', ')})`);
  });
  const vars = p.variables;
  if (Array.isArray(vars)) {
    for (const v of vars) {
      if (!isObj(v)) continue;
      const name = asStr(v.name);
      if (name) lines.push(`\tStudio.InitVar(${yayaStr(name)}, ${initialValue(v.value)})`);
    }
  } else if (isObj(vars)) {
    for (const [name, value] of Object.entries(vars)) {
      lines.push(`\tStudio.InitVar(${yayaStr(name)}, ${initialValue(value)})`);
    }
  }
  lines.push('}');

  // ---- イベントの入り口
  const events = [...RUNTIME_EVENTS];
  for (const s of scripts) {
    if (asStr(s.kind, 'event') !== 'event') continue;
    const ev = asStr(s.event);
    if (ev && !events.includes(ev)) events.push(ev);
  }
  lines.push(...sec(T.events));
  for (const ev of events) {
    if (!eventNameOk(ev)) {
      lines.push('', `// ${oneLine(T.skipped(ev))}`);
      continue;
    }
    if (handwritten.has(ev)) {
      lines.push('', ...T.handwritten(ev).map((s) => `// ${oneLine(s)}`));
      continue;
    }
    lines.push('', ev, '{', `\tStudio.Event(${yayaStr(ev)})`, '}');
  }

  // ---- かたまり
  lines.push(...sec(T.scripts));
  scripts.forEach((s, i) => {
    const kind = asStr(s.kind, 'event');
    let title;
    if (kind === 'talk') title = T.talk(asStr(s.name));
    else if (kind === 'function') title = T.fn(asStr(s.name));
    else title = asStr(s.event);
    if (asBool(s.disabled, false)) title += T.off;
    const body = stmts(s.blocks, '\t', { n: 0 });
    lines.push('', `// ${oneLine(title)}  (${oneLine(asStr(s.id))})`, `${fnOf[i]} : void`, '{', ...body, '}');
  });
  lines.push('');
  return lines.join('\r\n');
}
