/* 伺かスタジオ - プロジェクトのチェック（あぶないところ探し）
 *
 * 見つけたものは { level, message, hint, script, block } の配列で返します。
 * level は 'error'（動かない・たぶん間違い）と 'warn'（気になる）の 2 段階です。
 */

import { getDef } from './blocks.js';
import { Model } from './model.js';
import { t } from '../i18n/i18n.js';

const Lint = {};

function issue(list, level, message, hint, script, block) {
  list.push({ level, message, hint: hint || '', script: script || null, block: block || null });
}

/** スクリプトの中のブロックを、入れ子もふくめて順に見る */
function walk(script, visit) {
  const walkStack = (stack) => {
    if (!Array.isArray(stack)) return;
    for (const b of stack) {
      if (!b || typeof b !== 'object') continue;
      visit(b);
      walkInner(b);
    }
  };
  const walkInner = (b) => {
    const d = getDef(b);
    if (!d) return;
    for (const s of d.subs || []) walkStack(b[s.key]);
    if (d.dynamic && Array.isArray(b[d.dynamic])) b[d.dynamic].forEach(walkStack);
    for (const name in (d.args || {})) {
      const v = b[name];
      if (v && typeof v === 'object' && v.type) { visit(v); walkInner(v); }
    }
  };
  walkStack(script.blocks);
}

/** あるブロックの内側（くりかえしの中など）だけを見る */
function walkStackOnly(block, visit) {
  const d = getDef(block);
  if (!d) return;
  const stacks = [];
  for (const s of d.subs || []) stacks.push(block[s.key]);
  if (d.dynamic && Array.isArray(block[d.dynamic])) stacks.push(...block[d.dynamic]);
  for (const stack of stacks) {
    if (!Array.isArray(stack)) continue;
    for (const b of stack) {
      if (!b || typeof b !== 'object') continue;
      visit(b);
      walkStackOnly(b, visit);
    }
  }
}

/** メッセージ用のかたまり名。すでに「」が付いているものは足さない */
function nameOf(script) {
  const title = Model.scriptTitle(script);
  return title.charAt(0) === '「' ? title : '「' + title + '」';
}

function isEmptyText(v) {
  if (v == null) return true;
  if (typeof v === 'object') return false;      // 変数などが入っている
  return String(v).trim() === '';
}

// ctx.handwritten … つないだ手書きの YAYA ゴーストの辞書にある関数の名前（panels/yayalink.js）
Lint.run = function (project, ctx = {}) {
  const out = [];
  if (!project) return out;
  const handwritten = new Set(Array.isArray(ctx.handwritten) ? ctx.handwritten : []);

  const varNames = (project.variables || []).map((v) => v.name);
  const groups = (project.scripts || [])
    .filter((s) => s.kind === 'talk' && !s.disabled && String(s.group || '').trim())
    .map((s) => String(s.group).trim());
  const callable = (project.scripts || [])
    .filter((s) => s.kind === 'function' || s.kind === 'talk')
    .map((s) => s.name);
  const talkCount = (project.scripts || []).filter((s) => s.kind === 'talk').length;

  // ---- 名前のかぶり
  const seen = {};
  for (const s of project.scripts || []) {
    if (s.kind !== 'function' && s.kind !== 'talk') continue;
    const name = s.name || '';
    if (seen[name]) {
      issue(out, 'error', t('「{name}」という名前が 2 つあります', { name }),
        t('よぶときにどちらか一方しか使われません。名前を変えてください。'), s);
    }
    seen[name] = true;
  }

  // ---- スクリプトごと
  for (const s of project.scripts || []) {
    const title = nameOf(s);
    const blocks = Array.isArray(s.blocks) ? s.blocks : [];

    // 手書きの辞書にも同じイベントがあると、そちらが優先される（両方は書けない）
    if (s.kind === 'event' && !s.disabled && handwritten.has(s.event)) {
      issue(out, 'warn', t('{event} は、つないだゴーストの手書きの辞書にもあります', { event: s.event }),
        t("手書きが優先されるので、このかたまりは、手書きの {event} の中で Studio.Event('{event}') をよんだときだけ動きます。", { event: s.event }), s);
    }

    if (s.kind !== 'event' && s.kind !== 'talk' && s.kind !== 'function') {
      issue(out, 'warn', t('どこにもつながっていないブロックがあります'),
        t('帽子ブロック（◯◯のとき など）につなげないと動きません。'), s);
    } else if (!blocks.length) {
      issue(out, 'warn', t('{title}の中身がからっぽです', { title }),
        t('ブロックをつなげるか、いらなければ削除してください。'), s);
    }

    if (s.kind === 'event' && !String(s.event || '').trim()) {
      issue(out, 'error', t('イベント名が空のかたまりがあります'),
        t('イベントをえらぶか、名前を直接入力してください。'), s);
    }
    if ((s.kind === 'talk' || s.kind === 'function') && !String(s.name || '').trim()) {
      issue(out, 'error', t('名前のないトークがあります'),
        t('名前をつけないと、よび出せません。'), s);
    }
    if (s.kind === 'talk' && Number(s.weight) < 0) {
      issue(out, 'warn', t('{title}のえらばれやすさがマイナスです', { title }),
        t('0 として扱われるので、このトークは出ません。'), s);
    }

    // ---- 定常ループ（ずっとくりかえす）の重さ
    if (s.kind === 'event' && s.event === 'OnSecondChange') {
      const every = Math.max(1, Number(s.everySec) || 1);
      let count = 0;
      let hasLoop = false;
      walk(s, (b) => {
        count++;
        if (b.type === 'repeat' || b.type === 'while') hasLoop = true;
      });
      // 帽子のすぐ下にセリフがある＝条件なしで毎回しゃべる
      const speaksAlways = blocks.some(
        (b) => b && (b.type === 'say' || b.type === 'raw' || b.type === 'call' || b.type === 'choice')
      );
      if (every <= 1 && speaksAlways) {
        issue(out, 'warn', t('{title}は毎秒しゃべることになります', { title }),
          t('帽子ブロックの「◯秒ごと」を大きくするか、「もし」で条件をつけてください。'), s);
      } else if (every <= 1 && (hasLoop || count >= 10)) {
        issue(out, 'warn', t('{title}は毎秒これだけ動くので、重くなりがちです', { title }),
          t('「◯秒ごと」を 5 秒くらいにすると、体感は変わらずに軽くなります。'), s);
      }
    }

    walk(s, (b) => {
      // くりかえしの中で細かく待つと、長いスクリプトになって重くなる
      if (b.type === 'repeat' || b.type === 'while') {
        let tiny = null;
        walkStackOnly(b, (inner) => {
          if (inner.type === 'wait' && typeof inner.ms === 'number' && inner.ms > 0 && inner.ms <= 20) {
            tiny = inner;
          }
        });
        if (tiny) {
          issue(out, 'warn', t('{title}の「くりかえし」の中で、{ms} ミリ秒だけ待っています', { title, ms: tiny.ms }),
            t('待ちの数だけスクリプトが長くなります。回数を減らすか、待ちを長くしてください。'), s, tiny);
        }
      }
      if (!getDef(b)) {
        issue(out, 'error', t('{title}に、知らないブロック（{type}）が入っています', { title, type: b.type }),
          t('新しい版の伺かスタジオで作られたファイルかもしれません。'), s, b);
        return;
      }
      switch (b.type) {
        case 'say':
          if (isEmptyText(b.text)) {
            issue(out, 'warn', t('{title}に、なにも言わないセリフがあります', { title }),
              t('文章を入れるか、ブロックを削除してください。'), s, b);
          }
          break;
        case 'dress':
          if (isEmptyText(b.category) || isEmptyText(b.part)) {
            issue(out, 'warn', t('{title}に、種類か名前が空の「着せ替え」ブロックがあります', { title }),
              t('キャラと絵の「うごき」で着せ替えにしたものの、種類と名前を入れてください。'), s, b);
          }
          break;
        case 'raw':
          if (isEmptyText(b.text)) {
            issue(out, 'warn', t('{title}に、からっぽのさくらスクリプトがあります', { title }), '', s, b);
          }
          break;
        case 'communicate':
          if (isEmptyText(b.to)) {
            issue(out, 'error', t('{title}に、話しかける相手が空のブロックがあります', { title }),
              t('相手のゴースト名（本体の名前）を入れてください。「話しかけてきた相手」ブロックを入れると、言われた相手に返せます。'), s, b);
          }
          if (isEmptyText(b.text)) {
            issue(out, 'warn', t('{title}に、なにも言わずに話しかけるブロックがあります', { title }),
              t('文章がないと、相手には届きません。'), s, b);
          }
          break;
        case 'ask':
          if (isEmptyText(b.into)) {
            issue(out, 'error', t('{title}に、答えの入れ先が空の「たずねる」ブロックがあります', { title }),
              t('入れる変数を決めてください。決めないと、たずねても答えを使えません。'), s, b);
          } else if (varNames.indexOf(b.into) < 0) {
            issue(out, 'error', t('変数「{into}」がありません（{title}）', { into: b.into, title }),
              t('変数タブで作るか、別の変数にえらび直してください。'), s, b);
          } else if (/[,[\]]/.test(b.into)) {
            issue(out, 'error', t('変数「{into}」の名前は「たずねる」には使えません', { into: b.into }),
              t('カンマや角かっこが入っていると、SSP への命令が壊れます。名前を変えてください。'), s, b);
          }
          break;
        case 'call_group':
          if (isEmptyText(b.group)) {
            issue(out, 'error', t('{title}の「どれかよぶ」で、まとまりの名前が空です', { title }),
              t('ランダムトークの帽子ブロックで付けた「まとまり」の名前を入れてください。'), s, b);
          } else if (typeof b.group === 'string' && groups.indexOf(b.group.trim()) < 0) {
            issue(out, 'error', t('「{group}」というまとまりのトークがありません（{title}）', { group: b.group, title }),
              t('ランダムトークの帽子ブロックの「まとまり」に、同じ名前を入れてください。'), s, b);
          }
          break;
        case 'later':
          if (isEmptyText(b.name)) {
            issue(out, 'error', t('{title}の「◯秒後によぶ」で、行き先がえらばれていません', { title }), '', s, b);
          } else if (typeof b.name === 'string' && callable.indexOf(b.name) < 0) {
            issue(out, 'error', t('「{name}」というトークがありません（{title}）', { name: b.name, title }),
              t('名前を変えたときは、よび出し側も直してください。'), s, b);
          }
          break;
        case 'raise':
          if (isEmptyText(b.event)) {
            issue(out, 'warn', t('{title}に、イベント名が空の「自分で起こす」ブロックがあります', { title }),
              t('OnBoot のようなイベント名を入れてください。'), s, b);
          }
          break;
        case 'open_browser':
          if (isEmptyText(b.url)) {
            issue(out, 'warn', t('{title}に、ひらく先が空のブロックがあります', { title }), '', s, b);
          }
          break;
        case 'change_ghost':
          if (isEmptyText(b.name)) {
            issue(out, 'warn', t('{title}に、交代する相手が空のブロックがあります', { title }),
              t('ゴースト名か random を入れてください。'), s, b);
          }
          break;
        case 'saori_call':
          if (isEmptyText(b.file)) {
            issue(out, 'error', t('{title}に、よぶファイルが空の SAORI ブロックがあります', { title }),
              t('ゴーストのフォルダに置いた DLL の名前を入れてください。'), s, b);
          }
          if (isEmptyText(b.into)) {
            issue(out, 'warn', t('{title}に、答えの入れ先が空の SAORI ブロックがあります', { title }),
              t('答えを入れる変数を決めておかないと、届いた答えを使えません。（「SAORI の答えがとどいたとき」でも受け取れます）'), s, b);
          } else if (varNames.indexOf(b.into) < 0) {
            issue(out, 'error', t('変数「{into}」がありません（{title}）', { into: b.into, title }),
              t('変数タブで作るか、別の変数にえらび直してください。'), s, b);
          }
          break;
        case 'yaya_call': {
          // 手書きの YAYA の関数をよぶ。名前は書いた文字だけ（ブロックがはまっていたら動かない）
          const name = typeof b.name === 'string' ? b.name.trim() : '';
          if (b.name && typeof b.name === 'object') {
            issue(out, 'error', t('{title}の YAYA の関数の名前に、ブロックがはまっています', { title }),
              t('関数の名前は、書いた文字だけを使います（ブロックははめられません）。'), s, b);
          } else if (!name) {
            issue(out, 'error', t('{title}に、よぶ YAYA の関数の名前が空のブロックがあります', { title }),
              t('つないだ手書きの YAYA ゴーストの関数の名前を入れてください。'), s, b);
          } else if (!handwritten.size) {
            issue(out, 'warn', t('{title}に、手書きの YAYA の関数をよぶブロックがあります', { title }),
              t('手書きの YAYA ゴーストにつないだときだけ動きます（書き出しの画面でつなげます）。'), s, b);
          } else if (!handwritten.has(name)) {
            issue(out, 'warn', t('つないだゴーストの手書きの辞書に、関数「{name}」がありません（{title}）', { name, title }),
              t('名前をたしかめてください。無い関数をよんでも、ゴーストは何もしゃべりません。'), s, b);
          }
          break;
        }
        case 'yaya_expr':
          // 式は書いた文字だけ（外から来た言葉を YAYA のコードにしないため）
          if (b.code && typeof b.code === 'object') {
            issue(out, 'error', t('{title}の YAYA の式に、ブロックがはまっています', { title }),
              t('式は、書いた文字だけを使います（ブロックははめられません）。'), s, b);
          } else if (isEmptyText(b.code)) {
            issue(out, 'warn', t('{title}に、中身が空の YAYA の式があります', { title }),
              t('空の式は、いつも空の値になります。'), s, b);
          }
          break;
        case 'update':
          // 「更新のありか」が無いと、SSP は更新しようがない
          if (isEmptyText((project.meta || {}).homeUrl)) {
            issue(out, 'warn', t('{title}に、ネットワーク更新のブロックがあります', { title }),
              t('ゴーストの設定の「更新のありか」が空です。入れておかないと、SSP は更新できません。'), s, b);
          }
          break;
        case 'var': case 'set': case 'change':
          if (isEmptyText(b.name)) {
            issue(out, 'error', t('{title}に、変数をえらんでいないブロックがあります', { title }),
              t('変数タブで変数を作ってから、えらんでください。'), s, b);
          } else if (varNames.indexOf(b.name) < 0) {
            issue(out, 'error', t('変数「{name}」がありません（{title}）', { name: b.name, title }),
              t('変数タブで作るか、別の変数にえらび直してください。'), s, b);
          }
          break;
        case 'call':
          if (isEmptyText(b.name)) {
            issue(out, 'error', t('{title}の「よぶ」ブロックで、行き先がえらばれていません', { title }), '', s, b);
          } else if (callable.indexOf(b.name) < 0) {
            issue(out, 'error', t('「{name}」というトークがありません（{title}）', { name: b.name, title }),
              t('名前を変えたときは、よび出し側も直してください。'), s, b);
          }
          break;
        case 'choice':
          if (isEmptyText(b.target)) {
            issue(out, 'error', t('{title}の選択肢に、行き先がありません', { title }),
              t('えらんでも何も起きません。行き先のトークをえらんでください。'), s, b);
          } else if (callable.indexOf(b.target) < 0) {
            issue(out, 'error', t('選択肢の行き先「{target}」がありません（{title}）', { target: b.target, title }), '', s, b);
          }
          if (isEmptyText(b.label)) {
            issue(out, 'warn', t('{title}に、文字のない選択肢があります', { title }), '', s, b);
          }
          break;
        case 'link':
          if (isEmptyText(b.url) || String(b.url).trim() === 'https://') {
            issue(out, 'warn', t('{title}のリンクに、URL が入っていません', { title }), '', s, b);
          }
          break;
        case 'wait':
          if (Number(b.ms) > 60000) {
            issue(out, 'warn', t('{title}に、1 分より長く待つブロックがあります', { title }),
              t('長すぎるとゴーストが固まったように見えます。'), s, b);
          }
          break;
        default:
          break;
      }
    });
  }

  // ---- 設定まわり
  const st = project.settings || {};
  if (st.randomTalkEnabled !== false) {
    if (!talkCount) {
      issue(out, 'warn', t('自動でしゃべる設定なのに、ランダムトークが 1 つもありません'),
        t('イベントの「ランダムトーク」をキャンバスに置いてください。'));
    } else if (Number(st.randomTalkInterval) <= 0) {
      issue(out, 'warn', t('しゃべる間隔が 0 秒なので、自動ではしゃべりません'),
        t('ゴーストタブで秒数を入れてください。'));
    }
  }

  // ---- 使われていない変数
  const used = {};
  for (const s of project.scripts || []) {
    walk(s, (b) => {
      if ((b.type === 'var' || b.type === 'set' || b.type === 'change') && b.name) used[b.name] = true;
      if (b.type === 'saori_call' && b.into) used[b.into] = true;
      if (b.type === 'ask' && b.into) used[b.into] = true;
    });
  }
  for (const name of varNames) {
    if (!used[name]) {
      issue(out, 'warn', t('変数「{name}」はどこでも使われていません', { name }),
        t('いらなければ変数タブで削除できます。'));
    }
  }

  // エラーを先に、あとは見つけた順
  out.sort((a, b) => (a.level === b.level ? 0 : (a.level === 'error' ? -1 : 1)));
  return out;
};

Lint.countErrors = function (list) {
  return list.filter((x) => x.level === 'error').length;
};

export { Lint };
