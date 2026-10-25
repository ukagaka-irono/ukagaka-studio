/* 伺かスタジオ - YAYA の文を読む（パーサー）と、整えて書く（プリンター）（段階 8-1）
 *
 * 辞書（.dic）のテキストを木（AST）にし、木からテキストにもどします。YAYA の構文をすべてあつかいます
 * （https://yaya-shiori.github.io/yaya-docs/grammar/ の「関数」「値と変数」「演算」「配列」「文字列内埋め込み要素の展開」
 * 「フロー制御」「プリプロセス」）。DOM を触らないので、node のテスト（ui\test\yayatext.js）からそのまま使えます。
 *
 * 決めごと
 * - 読んだテキストを、なるべくそのまま書きもどせるようにします。文字列・数・かっこ・コメント・#define などの行・
 *   空行（1 行にまとめる）はそのまま残し、字下げ（タブ）と、if などの { } だけを決まった形にそろえます。
 * - 文字列は、中身を書いたままの形（"" や '' の重ね書き、%(…) をふくむ）で持ちます。行末の / でつないだ行は、つないだ形で持ちます。
 * - 読めない関数があっても、ほかの関数は読みます。読めない関数は、書いたままの文字（raw）として残し、errors に行番号を入れます。
 *
 * 木の形（type ごと）
 *   dic        { items: [ func | directive | comment | blank | raw ] }
 *   func       { name, mode, body: block, comments }           mode は「: 」のうしろ（nonoverlap・melt_nonoverlap など）か null
 *   block      { mode, items: [ 文 ] }                          mode は「nonoverlap : {」のときの nonoverlap
 *   文         expr { expr, prefix: null | 'parallel' | 'void' } ・ sep（--）・ if { branches: [{ cond, body, comments }], else, elseComments }
 *              case { expr, whens: [{ labels: [{ from, to }], body, comments }], others, othersComments } ・ switch { expr, body }
 *              while { cond, body } ・ for { init, cond, step, body } ・ foreach { expr, vars: [名前], body }
 *              break ・ continue ・ return { expr } ・ block ・ comment { text } ・ directive { text } ・ blank
 *   式         num { raw } ・ str { quote, raw } ・ heredoc { quote, raw } ・ name { name } ・ call { name, args }
 *              ref { expr }（引数の &）・ index { target, args } ・ unary { op, expr } ・ incdec { op, prefix, expr }
 *              bin { op, left, right } ・ list { items }（, で並べたもの）・ paren { expr }
 *   どの文にも、同じ行のうしろに書いたコメントを trail に持てます。
 */

// ------------------------------------------------------------------ 字句
const NAME_STOP = new Set([...' \t\r\n!"#$%&()*+,-/:;<=>?@[]`{|}~\'']);
const OPS = ['+:=', '-:=', '*:=', '/:=', '%:=', ':=', '+=', '-=', '*=', '/=', '%=', ',=', '==', '!=', '>=', '<=',
  '&&', '||', '++', '--', '+', '-', '*', '/', '%', '<', '>', '=', '!', '&', ',', ';', ':', '(', ')', '[', ']', '{', '}'];
export const KEYWORDS = new Set(['if', 'elseif', 'else', 'case', 'when', 'others', 'switch', 'while', 'for', 'break',
  'continue', 'return', 'foreach', 'void', 'parallel']);

class YayaError extends Error {
  constructor(code, line, detail) {
    super(code);
    this.code = code;
    this.line = line;
    this.detail = detail || '';
  }
}

/**
 * 行末の / で、次の行とつなぐ（次の行の頭の空白は消す）。YAYA は、字句に分けるより先にこれをします
 * （名前の途中でもつながる）。// のコメントの行末の / では、つなぎません（YAYA と同じ）。
 * { text, lineOf } を返します。lineOf[k] は、つないだあとの k+1 行目が、もとの何行目からはじまるか
 */
function joinLines(src) {
  const s = String(src).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let out = '';
  const lineOf = [1];
  let line = 1;
  let state = '';          // '' ・ '"' ・ "'" ・ '//' ・ '/*' ・ 'h"' ・ "h'"（ヒアドキュメント）
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\n') {
      line++;
      // ふつうの文字列とコメントは、行で終わる（ヒアドキュメントと /* */ は続く）
      if (state === '//' || state === '"' || state === "'") state = '';
      out += c;
      lineOf.push(line);
      continue;
    }
    if (state === 'h"' || state === "h'") {
      if (c === state[1] && s[i + 1] === '>' && s[i + 2] === '>') { out += c + '>>'; i += 2; state = ''; continue; }
      if (c === '/' && s[i + 1] === '\n') { i++; line++; while (s[i + 1] === ' ' || s[i + 1] === '\t') i++; continue; }
      out += c;
      continue;
    }
    if (state === '' && c === '<' && s[i + 1] === '<' && (s[i + 2] === '"' || s[i + 2] === "'")) {
      state = 'h' + s[i + 2];
      out += '<<' + s[i + 2];
      i += 2;
      continue;
    }
    if (state === '/*') {
      if (c === '*' && s[i + 1] === '/') { out += '*/'; i++; state = ''; continue; }
      out += c;
      continue;
    }
    if (state === '//') { out += c; continue; }
    if (c === '/' && s[i + 1] === '\n') {
      // つなぐ: / と改行と、次の行の頭の空白を消す
      i++;
      line++;
      while (s[i + 1] === ' ' || s[i + 1] === '\t') i++;
      continue;
    }
    if (state === '') {
      if (c === '/' && s[i + 1] === '/') { state = '//'; out += '//'; i++; continue; }
      if (c === '/' && s[i + 1] === '*') { state = '/*'; out += '/*'; i++; continue; }
      if (c === '"' || c === "'") state = c;
    } else if (c === state) {
      if (s[i + 1] === c) { out += c + c; i++; continue; }   // "" や '' は文字の中
      state = '';
    }
    out += c;
  }
  return { text: out, lineOf };
}

/**
 * テキストを字句にする。字句は { t: 種類, v: 値, line, sp: 前に空白があるか }。
 *   t … name / num / str / heredoc / op / nl（改行）/ comment / directive / eof
 * 行末の / は、先に joinLines でつないでおきます。line・endLine は、もとのテキストの行です。
 */
export function lex(text) {
  const joined = joinLines(text);
  const src = joined.text;
  const lastLine = String(text).replace(/\r\n?/g, '\n').split('\n').length;
  // つないだあとの k 行目が、もとの何行目から何行目か
  const startOf = (k) => joined.lineOf[k - 1] || lastLine;
  const endOf = (k) => (k < joined.lineOf.length ? joined.lineOf[k] - 1 : lastLine);
  try {
    const out = lexJoined(src);
    for (const x of out) { const s = x.line; x.line = startOf(s); x.endLine = endOf(x.endLine); }
    return out;
  } catch (e) {
    if (e instanceof YayaError) e.line = startOf(e.line);
    throw e;
  }
}

function lexJoined(src) {
  const out = [];
  let i = 0;
  let line = 1;
  let lineStart = true;   // 行のはじめ（# の行を見分ける）
  let sp = false;
  const n = src.length;
  // extra.line は字句のはじまりの行。endLine は終わりの行（複数行のコメントやヒアドキュメント）
  const push = (t, v, extra) => { out.push(Object.assign({ t, v, line, endLine: line, sp }, extra || {})); sp = false; lineStart = false; };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; sp = true; continue; }
    if (c === '\n') { push('nl', '\n'); i++; line++; lineStart = true; continue; }
    if (lineStart && c === '#') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      push('directive', src.slice(i, j).replace(/\r$/, ''));
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      push('comment', src.slice(i, j).replace(/\r$/, ''));
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const j = end < 0 ? n : end + 2;
      const body = src.slice(i, j);
      const startLine = line;
      line += (body.match(/\n/g) || []).length;
      push('comment', body.replace(/\r/g, ''), { block: true, line: startLine });
      i = j;
      continue;
    }
    if (c === '<' && src[i + 1] === '<' && (src[i + 2] === '"' || src[i + 2] === "'")) {
      const q = src[i + 2];
      const close = q + '>>';
      const end = src.indexOf(close, i + 3);
      if (end < 0) throw new YayaError('unterminated_heredoc', line);
      const raw = src.slice(i + 3, end).replace(/\r/g, '');
      const startLine = line;
      line += (raw.match(/\n/g) || []).length;
      push('heredoc', raw, { quote: q, line: startLine });
      i = end + 3;
      continue;
    }
    if (c === '"' || c === "'") {
      const startLine = line;
      let j = i + 1;
      let raw = '';
      for (;;) {
        if (j >= n || src[j] === '\n') throw new YayaError('unterminated_string', line);
        if (src[j] === c) {
          if (src[j + 1] === c) { raw += c + c; j += 2; continue; }   // "" や '' は、文字の " や '
          break;
        }
        raw += src[j];
        j++;
      }
      push('str', raw, { quote: c, line: startLine });
      i = j + 1;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_]/.test(src[j])) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) {
        j++;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      push('num', src.slice(i, j));
      i = j;
      continue;
    }
    // !_in_（名前の文字が続かないとき）
    if (c === '!' && src.startsWith('_in_', i + 1) && (i + 5 >= n || NAME_STOP.has(src[i + 5]))) {
      push('op', '!_in_');
      i += 5;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) { push('op', op); i += op.length; continue; }
    if (!NAME_STOP.has(c)) {
      let j = i;
      while (j < n && !NAME_STOP.has(src[j])) j++;
      push('name', src.slice(i, j));
      i = j;
      continue;
    }
    throw new YayaError('bad_char', line, c);
  }
  out.push({ t: 'eof', v: '', line, endLine: line, sp: false });
  return out;
}

// ------------------------------------------------------------------ 構文
// 二項演算子の強さ（大きいほど先に結びつく）。YAYA はどれも左から結びつきます（代入も）
const BIN = {
  ',': 1,
  '+=': 2, '-=': 2, '*=': 2, '/=': 2, '%=': 2, '+:=': 2, '-:=': 2, '*:=': 2, '/:=': 2, '%:=': 2, ',=': 2,
  '=': 3, ':=': 3,
  '||': 4, '&&': 5,
  '==': 6, '!=': 6, '>=': 6, '<=': 6, '>': 6, '<': 6, '_in_': 6, '!_in_': 6,
  '+': 7, '-': 7, '*': 8, '/': 8, '%': 8,
};
export const BIN_PREC = BIN;
const UNARY_PREC = 9;

class Parser {
  constructor(tokens) {
    this.tk = tokens;
    this.p = 0;
    this.depth = 0;    // ( [ の中では、改行で式を終わらせない
  }
  peek(k = 0) { return this.tk[this.p + k]; }
  next() { return this.tk[this.p++]; }
  is(t, v) { const x = this.peek(); return x.t === t && (v === undefined || x.v === v); }
  isOp(v) { return this.is('op', v); }
  expectOp(v) {
    const x = this.next();
    if (x.t !== 'op' || x.v !== v) throw new YayaError('expected', x.line, v);
    return x;
  }
  // 改行と ; を読みとばす（数を返す。空行を見分けるため）
  skipNl() {
    let nl = 0;
    while (this.is('nl') || this.isOp(';')) { if (this.is('nl')) nl++; this.p++; }
    return nl;
  }
  // 式の中: ( [ の中だけ改行をとばす
  skipInner() { if (this.depth > 0) while (this.is('nl') || this.is('comment')) this.p++; }

  // ---- 式
  expr(minPrec = 1) {
    let left = this.unary();
    for (;;) {
      this.skipInner();
      const x = this.peek();
      let op = null;
      if (x.t === 'op' && BIN[x.v] !== undefined) op = x.v;
      else if (x.t === 'name' && x.v === '_in_') op = '_in_';
      if (op === null || BIN[op] < minPrec) break;
      this.p++;
      this.skipInner();
      if (op === ',') {
        const items = [left, this.expr(BIN[','] + 1)];
        for (;;) {
          this.skipInner();
          if (!this.isOp(',')) break;
          this.p++;
          this.skipInner();
          items.push(this.expr(BIN[','] + 1));
        }
        left = { type: 'list', items };
        continue;
      }
      const right = this.expr(BIN[op] + 1);   // 左から結びつく
      left = { type: 'bin', op, left, right };
    }
    return left;
  }
  unary() {
    const x = this.peek();
    if (x.t === 'op' && (x.v === '!' || x.v === '-' || x.v === '+')) {
      this.p++;
      return { type: 'unary', op: x.v, expr: this.unaryOperand() };
    }
    if (x.t === 'op' && (x.v === '++' || x.v === '--')) {
      this.p++;
      return { type: 'incdec', op: x.v, prefix: true, expr: this.unaryOperand() };
    }
    return this.postfix(this.primary());
  }
  unaryOperand() {
    return this.unary();
  }
  postfix(node) {
    for (;;) {
      const x = this.peek();
      if (x.t === 'op' && x.v === '[') {
        this.p++;
        this.depth++;
        this.skipInner();
        const args = [];
        if (!this.isOp(']')) {
          args.push(this.expr(BIN[','] + 1));
          for (;;) {
            this.skipInner();
            if (!this.isOp(',')) break;
            this.p++;
            this.skipInner();
            args.push(this.expr(BIN[','] + 1));
          }
        }
        this.skipInner();
        this.depth--;
        this.expectOp(']');
        node = { type: 'index', target: node, args };
        continue;
      }
      if (x.t === 'op' && (x.v === '++' || x.v === '--')) {
        // 行に -- だけ（出力確定子）とまちがえないよう、式のうしろの -- は後置とみなす
        this.p++;
        node = { type: 'incdec', op: x.v, prefix: false, expr: node };
        continue;
      }
      return node;
    }
  }
  primary() {
    const x = this.next();
    switch (x.t) {
      case 'num': return { type: 'num', raw: x.v };
      case 'str': return { type: 'str', quote: x.quote, raw: x.v };
      case 'heredoc': return { type: 'heredoc', quote: x.quote, raw: x.v };
      case 'name': {
        if (KEYWORDS.has(x.v)) throw new YayaError('unexpected', x.line, x.v);
        if (this.isOp('(')) {
          this.p++;
          this.depth++;
          this.skipInner();
          const args = [];
          if (!this.isOp(')')) {
            args.push(this.arg());
            for (;;) {
              this.skipInner();
              if (!this.isOp(',')) break;
              this.p++;
              this.skipInner();
              args.push(this.arg());
            }
          }
          this.skipInner();
          this.depth--;
          this.expectOp(')');
          return { type: 'call', name: x.v, args };
        }
        return { type: 'name', name: x.v };
      }
      case 'op':
        if (x.v === '(') {
          this.depth++;
          this.skipInner();
          const inner = this.isOp(')') ? { type: 'list', items: [] } : this.expr(1);
          this.skipInner();
          this.depth--;
          this.expectOp(')');
          return { type: 'paren', expr: inner };
        }
        throw new YayaError('unexpected', x.line, x.v);
      default:
        throw new YayaError('unexpected', x.line, x.v || x.t);
    }
  }
  arg() {
    if (this.isOp('&')) { this.p++; return { type: 'ref', expr: this.expr(BIN[','] + 1) }; }
    return this.expr(BIN[','] + 1);
  }

  // ---- 文
  // 文の終わり: 改行・;・}・ファイルの終わり・同じ行のうしろのコメント
  atEnd() {
    const x = this.peek();
    return x.t === 'nl' || x.t === 'eof' || x.t === 'comment' || (x.t === 'op' && (x.v === ';' || x.v === '}'));
  }
  endStmt(stmt) {
    if (this.is('comment') && this.peek().line === this.tk[this.p - 1].endLine && !this.peek().block) {
      stmt.trail = this.next().v;
    }
    if (!this.atEnd() && !this.isOp('{')) throw new YayaError('expected_end', this.peek().line, this.peek().v);
    return stmt;
  }
  // { … } か、1 つの文（{ } を省いたとき）
  body() {
    // 「if 1 ; nonoverlap : {」や、次の行の文
    this.skipNl();
    if (this.isOp('{')) return this.block(null);
    // { } を省いた 1 つの文。その前のコメントの行は、中身にふくめる
    const items = [];
    while (this.is('comment')) { items.push({ type: 'comment', text: this.next().v }); this.skipNl(); }
    if (this.isOp('{')) {
      const b = this.block(null);
      b.items = items.concat(b.items);
      return b;
    }
    const one = this.statement();
    // 「if 1 ; nonoverlap : {」は、その入れ子が中身そのもの
    if (one && one.type === 'block' && one.mode && !items.length) return one;
    if (one) items.push(one);
    return { type: 'block', mode: null, items };
  }
  block(mode) {
    this.expectOp('{');
    const items = [];
    for (;;) {
      const nl = this.skipNl();
      if (this.isOp('}')) { this.p++; break; }     // } の直前の空行は持たない（ブロックにすると置き場が無いため）
      if (nl >= 2 && items.length) items.push({ type: 'blank' });
      if (this.is('eof')) throw new YayaError('unclosed_block', this.peek().line);
      const s = this.statement();
      if (s) items.push(s);
    }
    return { type: 'block', mode, items };
  }
  // 条件などの式（行の終わりか { まで）
  headExpr() {
    const e = this.expr(1);
    return e;
  }
  statement() {
    const x = this.peek();
    if (x.t === 'comment') { this.p++; return { type: 'comment', text: x.v }; }
    if (x.t === 'directive') { this.p++; return { type: 'directive', text: x.v }; }
    if (x.t === 'op' && x.v === '{') return this.block(null);
    // -- だけの行は出力確定子
    if (x.t === 'op' && x.v === '--' && this.isEndAt(1)) { this.p++; return this.endStmt({ type: 'sep' }); }
    // nonoverlap : { のような、えらびかたつきの入れ子
    if (x.t === 'name' && this.peek(1).t === 'op' && this.peek(1).v === ':' && this.peek(2).t === 'op' && this.peek(2).v === '{') {
      this.p += 2;
      return this.block(x.v);
    }
    if (x.t === 'name' && KEYWORDS.has(x.v)) {
      switch (x.v) {
        case 'if': return this.ifStmt();
        case 'case': return this.caseStmt();
        case 'switch': {
          this.p++;
          const e = this.headExpr();
          this.skipNl();
          return { type: 'switch', expr: e, body: this.block(null) };
        }
        case 'while': {
          this.p++;
          const cond = this.headExpr();
          return { type: 'while', cond, body: this.body() };
        }
        case 'for': return this.forStmt();
        case 'foreach': return this.foreachStmt();
        case 'break': case 'continue': this.p++; return this.endStmt({ type: x.v });
        case 'return': {
          this.p++;
          const e = this.atEnd() ? null : this.expr(1);
          return this.endStmt({ type: 'return', expr: e });
        }
        case 'parallel': case 'void': {
          this.p++;
          const e = this.expr(1);
          return this.endStmt({ type: 'expr', prefix: x.v, expr: e });
        }
        default: throw new YayaError('unexpected', x.line, x.v);
      }
    }
    const e = this.expr(1);
    return this.endStmt({ type: 'expr', prefix: null, expr: e });
  }
  isEndAt(k) {
    const x = this.peek(k);
    return x.t === 'nl' || x.t === 'eof' || x.t === 'comment' || (x.t === 'op' && (x.v === ';' || x.v === '}'));
  }
  // elseif・else・when・others の前のコメントは、その節にあずける
  lookPast(words) {
    let k = 0;
    const comments = [];
    for (;;) {
      const x = this.peek(k);
      if (x.t === 'nl' || (x.t === 'op' && x.v === ';')) { k++; continue; }
      if (x.t === 'comment') { comments.push(x.v); k++; continue; }
      if (x.t === 'name' && words.includes(x.v)) return { k, word: x.v, comments };
      return null;
    }
  }
  ifStmt() {
    this.p++;
    const branches = [{ cond: this.headExpr(), body: this.body(), comments: [] }];
    let elseBody = null;
    let elseComments = [];
    for (;;) {
      const look = this.lookPast(['elseif', 'else']);
      if (!look) break;
      this.p += look.k + 1;
      if (look.word === 'elseif') {
        branches.push({ cond: this.headExpr(), body: this.body(), comments: look.comments });
      } else {
        elseBody = this.body();
        elseComments = look.comments;
        break;
      }
    }
    return { type: 'if', branches, else: elseBody, elseComments };
  }
  caseStmt() {
    const at = this.next();
    const e = this.headExpr();
    this.skipNl();
    if (!this.isOp('{')) throw new YayaError('case_without_brace', at.line);
    this.p++;
    const whens = [];
    let others = null;
    let othersComments = [];
    let comments = [];
    for (;;) {
      this.skipNl();
      const x = this.peek();
      if (x.t === 'op' && x.v === '}') { this.p++; break; }
      if (x.t === 'eof') throw new YayaError('unclosed_block', x.line);
      if (x.t === 'comment') { comments.push(x.v); this.p++; continue; }
      if (x.t === 'name' && x.v === 'when') {
        this.p++;
        const labels = [this.label()];
        while (this.isOp(',')) { this.p++; labels.push(this.label()); }
        whens.push({ labels, body: this.body(), comments });
        comments = [];
        continue;
      }
      if (x.t === 'name' && x.v === 'others') {
        this.p++;
        others = this.body();
        othersComments = comments;
        comments = [];
        continue;
      }
      throw new YayaError('expected_when', x.line, x.v);
    }
    const node = { type: 'case', expr: e, whens, others, othersComments };
    if (comments.length) node.endComments = comments;
    return node;
  }
  // when のラベル: 即値か、即値-即値（範囲）。数には - を付けられる
  label() {
    const lit = () => {
      let sign = '';
      if (this.isOp('-') || this.isOp('+')) sign = this.next().v;
      const x = this.next();
      if (x.t === 'num') return { type: 'num', raw: sign + x.v };
      if ((x.t === 'str') && !sign) return { type: 'str', quote: x.quote, raw: x.v };
      throw new YayaError('bad_label', x.line, x.v);
    };
    const from = lit();
    if (this.isOp('-')) { this.p++; return { from, to: lit() }; }
    return { from, to: null };
  }
  forStmt() {
    this.p++;
    // ヘッダ全体を ( ) で囲んだ形（Tc603-6 以降）と、囲まない形
    let wrapped = false;
    if (this.isOp('(') && this.headerWrapped()) { this.p++; this.depth++; wrapped = true; this.skipInner(); }
    const init = this.expr(1);
    this.skipInner();
    this.expectOp(';');
    this.skipInner();
    const cond = this.expr(1);
    this.skipInner();
    this.expectOp(';');
    this.skipInner();
    const step = this.expr(1);
    if (wrapped) { this.skipInner(); this.depth--; this.expectOp(')'); }
    const node = { type: 'for', init, cond, step, body: this.body() };
    if (wrapped) node.wrapped = true;
    return node;
  }
  foreachStmt() {
    this.p++;
    let wrapped = false;
    if (this.isOp('(') && this.headerWrapped()) { this.p++; this.depth++; wrapped = true; this.skipInner(); }
    const e = this.expr(1);
    this.skipInner();
    this.expectOp(';');
    this.skipInner();
    const vars = [this.varName()];
    if (this.isOp(',')) { this.p++; vars.push(this.varName()); }
    if (wrapped) { this.skipInner(); this.depth--; this.expectOp(')'); }
    const node = { type: 'foreach', expr: e, vars, body: this.body() };
    if (wrapped) node.wrapped = true;
    return node;
  }
  varName() {
    const x = this.next();
    if (x.t !== 'name' || KEYWORDS.has(x.v)) throw new YayaError('expected_var', x.line, x.v);
    return x.v;
  }
  // for ( … ; … ; … ) のように、( がヘッダ全体を囲んでいるか（; が ( の中にあれば囲んでいる）
  headerWrapped() {
    let depth = 0;
    for (let k = this.p; k < this.tk.length; k++) {
      const x = this.tk[k];
      if (x.t === 'op' && (x.v === '(' || x.v === '[')) depth++;
      else if (x.t === 'op' && (x.v === ')' || x.v === ']')) { depth--; if (depth === 0) return false; }
      else if (x.t === 'op' && x.v === ';' && depth === 1) return true;
      else if (x.t === 'op' && x.v === '{') return false;
      else if (x.t === 'eof') return false;
    }
    return false;
  }

  // ---- 辞書のいちばん外の関数
  func() {
    const head = this.next();
    if (head.t !== 'name') throw new YayaError('expected_function', head.line, head.v);
    let mode = null;
    if (this.isOp(':')) {
      this.p++;
      const m = this.next();
      if (m.t !== 'name') throw new YayaError('expected_mode', m.line, m.v);
      mode = m.v;
    }
    this.skipNl();
    const comments = [];
    while (this.is('comment')) { comments.push(this.next().v); this.skipNl(); }
    if (!this.isOp('{')) throw new YayaError('expected', this.peek().line, '{');
    const body = this.block(null);
    const node = { type: 'func', name: head.v, mode, body };
    if (comments.length) node.comments = comments;
    if (this.is('comment') && this.peek().line === this.tk[this.p - 1].endLine && !this.peek().block) node.trail = this.next().v;
    return node;
  }
}

/**
 * いちばん外を、関数ごとのかたまりに分ける（読めない関数があっても、ほかを読むため）。
 * { と } の数をかぞえて切り、それぞれを読みます。
 */
function splitTop(tokens) {
  const parts = [];
  let k = 0;
  const n = tokens.length;
  while (k < n && tokens[k].t !== 'eof') {
    const x = tokens[k];
    if (x.t === 'nl' || (x.t === 'op' && x.v === ';')) {
      let nl = 0;
      while (k < n && (tokens[k].t === 'nl' || (tokens[k].t === 'op' && tokens[k].v === ';'))) { if (tokens[k].t === 'nl') nl++; k++; }
      if (nl >= 2) parts.push({ kind: 'blank' });
      continue;
    }
    if (x.t === 'comment') { parts.push({ kind: 'comment', text: x.v }); k++; continue; }
    if (x.t === 'directive') { parts.push({ kind: 'directive', text: x.v }); k++; continue; }
    // 関数: 最初の { から、数が合う } まで
    const start = k;
    let depth = 0;
    let opened = false;
    while (k < n && tokens[k].t !== 'eof') {
      const y = tokens[k];
      if (y.t === 'op' && y.v === '{') { depth++; opened = true; }
      if (y.t === 'op' && y.v === '}') { depth--; if (opened && depth <= 0) { k++; break; } }
      if (!opened && y.t === 'nl') {
        // { より前の改行: 関数名と { のあいだの改行やコメントは続ける。{ の無い行が続いたら、そこで切る
        let j = k;
        while (j < n && (tokens[j].t === 'nl' || tokens[j].t === 'comment')) j++;
        if (!(tokens[j] && tokens[j].t === 'op' && tokens[j].v === '{')) { k = j; break; }
      }
      k++;
    }
    // 同じ行のうしろのコメントも、この関数にふくめる
    if (tokens[k] && tokens[k].t === 'comment' && !tokens[k].block && tokens[k].line === tokens[k - 1].endLine) k++;
    const endLine = tokens[k - 1] ? tokens[k - 1].endLine : 0;
    parts.push({ kind: 'func', tokens: tokens.slice(start, k).concat([{ t: 'eof', v: '', line: endLine, endLine, sp: false }]) });
  }
  return parts;
}

/** 字句から、書いたままの文字をおおよそ作りなおす（読めない関数を raw として残すため） */
function tokensText(src, tokens) {
  const lines = String(src).replace(/^﻿/, '').replace(/\r/g, '').split('\n');
  const real = tokens.filter((x) => x.t !== 'eof');
  if (!real.length) return '';
  const first = real[0].line;
  const last = Math.max(...real.map((x) => x.endLine));
  return lines.slice(first - 1, last).join('\n');
}

/**
 * 辞書のテキストを読む。{ dic, errors: [{ line, code, detail }] } を返す。
 * 読めない関数は { type: 'raw', text } として残します（errors にも入る）
 */
export function parseYaya(text) {
  let tokens;
  try {
    tokens = lex(text);
  } catch (e) {
    if (!(e instanceof YayaError)) throw e;
    return { dic: { type: 'dic', items: [{ type: 'raw', text: String(text).replace(/\r/g, '') }] }, errors: [{ line: e.line, code: e.code, detail: e.detail }] };
  }
  const items = [];
  const errors = [];
  for (const part of splitTop(tokens)) {
    if (part.kind === 'blank') { if (items.length) items.push({ type: 'blank' }); continue; }
    if (part.kind === 'comment') { items.push({ type: 'comment', text: part.text }); continue; }
    if (part.kind === 'directive') { items.push({ type: 'directive', text: part.text }); continue; }
    const parser = new Parser(part.tokens);
    try {
      const f = parser.func();
      parser.skipNl();
      if (!parser.is('eof')) throw new YayaError('expected_end', parser.peek().line, parser.peek().v);
      items.push(f);
    } catch (e) {
      if (!(e instanceof YayaError)) throw e;
      errors.push({ line: e.line, code: e.code, detail: e.detail });
      items.push({ type: 'raw', text: tokensText(text, part.tokens) });
    }
  }
  while (items.length && items[items.length - 1].type === 'blank') items.pop();
  return { dic: { type: 'dic', items }, errors };
}

/** 式 1 つを読む（ブロックの欄などで使う）。読めなければ Error（code・line）を投げます */
export function parseExpr(text) {
  const p = new Parser(lex(text));
  p.skipNl();
  const e = p.expr(1);
  p.skipNl();
  if (!p.is('eof')) throw new YayaError('expected_end', p.peek().line, p.peek().v);
  return e;
}

// ------------------------------------------------------------------ 書く
const quoteStr = (q, raw) => q + raw + q;

/** 式をテキストにする。parent の強さより弱い式には、かっこを足します（ブロックから作った木のため） */
export function printExpr(e, parentPrec = 0) {
  if (!e) return '';
  switch (e.type) {
    case 'num': return e.raw;
    case 'str': return quoteStr(e.quote, e.raw);
    case 'heredoc': return '<<' + e.quote + e.raw + e.quote + '>>';
    case 'name': return e.name;
    case 'call': return e.name + '(' + e.args.map((a) => printExpr(a, BIN[','] + 1)).join(', ') + ')';
    case 'ref': return '&' + printExpr(e.expr, UNARY_PREC);
    case 'index': return printExpr(e.target, 99) + '[' + e.args.map((a) => printExpr(a, BIN[','] + 1)).join(', ') + ']';
    case 'paren': return '(' + printExpr(e.expr, 0) + ')';
    case 'unary': {
      const s = e.op + printExpr(e.expr, UNARY_PREC);
      return parentPrec > UNARY_PREC ? '(' + s + ')' : s;
    }
    case 'incdec': {
      const inner = printExpr(e.expr, 99);
      const s = e.prefix ? e.op + inner : inner + e.op;
      return parentPrec > UNARY_PREC ? '(' + s + ')' : s;
    }
    case 'list': {
      const s = e.items.map((a) => printExpr(a, BIN[','] + 1)).join(', ');
      return parentPrec > BIN[','] ? '(' + s + ')' : s;
    }
    case 'bin': {
      const prec = BIN[e.op];
      const s = printExpr(e.left, prec) + ' ' + e.op + ' ' + printExpr(e.right, prec + 1);
      return prec < parentPrec ? '(' + s + ')' : s;
    }
    default: return '';
  }
}

function printLabel(l) {
  const one = (x) => (x.type === 'num' ? x.raw : quoteStr(x.quote, x.raw));
  return l.to ? one(l.from) + '-' + one(l.to) : one(l.from);
}

function printBlockInner(block, ind, out) {
  for (const s of block.items) printStmt(s, ind, out);
}

function printBody(block, ind, out, head) {
  if (block.mode) {
    // えらびかたつきの入れ子を、if などの中身にしたとき（「if 1 ; nonoverlap : {」）
    out.push(`${ind}${head} ; ${block.mode} : {`);
    printBlockInner(block, ind + '\t', out);
    out.push(`${ind}}`);
    return;
  }
  out.push(`${ind}${head} {`);
  printBlockInner(block, ind + '\t', out);
  out.push(`${ind}}`);
}

function withTrail(line, s) { return s.trail ? line + ' ' + s.trail : line; }

function printStmt(s, ind, out) {
  switch (s.type) {
    case 'blank': out.push(''); return;
    case 'comment': out.push(ind + s.text); return;
    case 'directive': out.push(s.text); return;
    case 'sep': out.push(withTrail(ind + '--', s)); return;
    case 'break': case 'continue': out.push(withTrail(ind + s.type, s)); return;
    case 'return': out.push(withTrail(ind + (s.expr ? 'return ' + printExpr(s.expr) : 'return'), s)); return;
    case 'expr': out.push(withTrail(ind + (s.prefix ? s.prefix + ' ' : '') + printExpr(s.expr), s)); return;
    case 'block': {
      out.push(ind + (s.mode ? `${s.mode} : {` : '{'));
      printBlockInner(s, ind + '\t', out);
      out.push(ind + '}');
      return;
    }
    case 'if': {
      s.branches.forEach((b, i) => {
        for (const c of b.comments || []) out.push(ind + c);
        printBody(b.body, ind, out, (i ? 'elseif ' : 'if ') + printExpr(b.cond));
      });
      if (s.else) {
        for (const c of s.elseComments || []) out.push(ind + c);
        printBody(s.else, ind, out, 'else');
      }
      return;
    }
    case 'case': {
      out.push(`${ind}case ${printExpr(s.expr)} {`);
      for (const w of s.whens) {
        for (const c of w.comments || []) out.push(ind + '\t' + c);
        printBody(w.body, ind + '\t', out, 'when ' + w.labels.map(printLabel).join(', '));
      }
      if (s.others) {
        for (const c of s.othersComments || []) out.push(ind + '\t' + c);
        printBody(s.others, ind + '\t', out, 'others');
      }
      for (const c of s.endComments || []) out.push(ind + '\t' + c);
      out.push(ind + '}');
      return;
    }
    case 'switch': printBody(s.body, ind, out, 'switch ' + printExpr(s.expr)); return;
    case 'while': printBody(s.body, ind, out, 'while ' + printExpr(s.cond)); return;
    case 'for': {
      const h = `${printExpr(s.init)}; ${printExpr(s.cond)}; ${printExpr(s.step)}`;
      printBody(s.body, ind, out, s.wrapped ? `for (${h})` : `for ${h}`);
      return;
    }
    case 'foreach': {
      const h = `${printExpr(s.expr)}; ${s.vars.join(', ')}`;
      printBody(s.body, ind, out, s.wrapped ? `foreach (${h})` : `foreach ${h}`);
      return;
    }
    case 'raw': out.push(s.text); return;
    default: return;
  }
}

/** 木を、辞書のテキストにする（改行は \n。書き出すときに \r\n にします） */
export function printYaya(dic) {
  const out = [];
  for (const item of (dic && dic.items) || []) {
    switch (item.type) {
      case 'blank': out.push(''); break;
      case 'comment': out.push(item.text); break;
      case 'directive': out.push(item.text); break;
      case 'raw': out.push(item.text); break;
      case 'func': {
        out.push(withTrail(item.mode ? `${item.name} : ${item.mode}` : item.name, {}));
        for (const c of item.comments || []) out.push(c);
        out.push('{');
        printBlockInner(item.body, '\t', out);
        out.push(item.trail ? '} ' + item.trail : '}');
        break;
      }
      default: break;
    }
  }
  return out.join('\n') + (out.length ? '\n' : '');
}

// ------------------------------------------------------------------ 色分け（段階 8-3。辞書の画面のテキストエディタ）
/**
 * テキストを行ごとの色分けにする。[[ [種類, 文字], … ], …]（1 行ずつ）を返し、まちがいがあっても投げません（打っている途中も色を付けるため）。
 *   種類 … 'kw'（if などの言葉）・'str'（文字列とヒアドキュメント）・'com'（コメント）・'num'（数）・'dir'（# の行）・
 *          'def'（行の頭に書いた関数の名前）・'call'（( が続く名前）・''（そのほか）
 * 文字をつなげると、もとのテキストの行にもどります。
 */
export function highlightYaya(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let state = '';   // '' ・ 'com'（/* の中）・'h"' ・ "h'"（ヒアドキュメントの中）・'"' ・ "'"（/ でつないだ文字列の中）
  for (const line of lines) {
    const spans = [];
    const add = (cls, s) => {
      if (!s) return;
      const last = spans[spans.length - 1];
      if (last && last[0] === cls) last[1] += s; else spans.push([cls, s]);
    };
    let i = 0;
    const n = line.length;
    if (state === '' && /^\s*#/.test(line)) { add('dir', line); out.push(spans); continue; }
    while (i < n) {
      if (state === 'com') {
        const end = line.indexOf('*/', i);
        if (end < 0) { add('com', line.slice(i)); i = n; break; }
        add('com', line.slice(i, end + 2)); i = end + 2; state = ''; continue;
      }
      if (state === 'h"' || state === "h'") {
        const end = line.indexOf(state[1] + '>>', i);
        if (end < 0) { add('str', line.slice(i)); i = n; break; }
        add('str', line.slice(i, end + 3)); i = end + 3; state = ''; continue;
      }
      if (state === '"' || state === "'") {
        let j = i;
        while (j < n && !(line[j] === state && line[j + 1] !== state)) j += line[j] === state ? 2 : 1;
        if (j >= n) { add('str', line.slice(i)); i = n; if (!line.endsWith('/')) state = ''; break; }
        add('str', line.slice(i, j + 1)); i = j + 1; state = ''; continue;
      }
      const c = line[i];
      if (c === '/' && line[i + 1] === '/') { add('com', line.slice(i)); i = n; break; }
      if (c === '/' && line[i + 1] === '*') { state = 'com'; add('com', '/*'); i += 2; continue; }
      if (c === '<' && line[i + 1] === '<' && (line[i + 2] === '"' || line[i + 2] === "'")) {
        state = 'h' + line[i + 2]; add('str', line.slice(i, i + 3)); i += 3; continue;
      }
      if (c === '"' || c === "'") { state = c; add('str', c); i++; continue; }
      if (c >= '0' && c <= '9') {
        let j = i + 1;
        while (j < n && /[0-9A-Za-z_.]/.test(line[j])) j++;
        add('num', line.slice(i, j)); i = j; continue;
      }
      if (!NAME_STOP.has(c)) {
        let j = i;
        while (j < n && !NAME_STOP.has(line[j])) j++;
        const word = line.slice(i, j);
        let k = j;
        while (line[k] === ' ' || line[k] === '\t') k++;
        let cls = '';
        if (KEYWORDS.has(word) || word === '_in_') cls = 'kw';
        else if (i === 0) cls = 'def';
        else if (line[k] === '(') cls = 'call';
        add(cls, word); i = j; continue;
      }
      add('', c);
      i++;
    }
    // 行の終わり: ふつうの文字列は、/ でつないでいなければ終わる
    if ((state === '"' || state === "'") && !line.endsWith('/')) state = '';
    out.push(spans);
  }
  return out;
}

/** 木から位置などを落とした、見くらべるための形（テスト用） */
export function stripAst(node) {
  return JSON.parse(JSON.stringify(node));
}
