/* 伺かスタジオ - ブロックのコピー・切り取り・はりつけ・複製・削除
 *
 * キーボード（shortcuts.js）と右クリックメニュー（contextmenu.js）の両方から使います。
 * どれも「どの列（stack）の何番目（index）か」を受けとります。
 * コピーしたものは Model.clone で切り離して持つので、あとから元を消しても平気です。
 *
 * プロジェクトをまたいでも使えます。コピーしたものは WebView2 の保存場所（localStorage）にも置くので、
 * 別のプロジェクトを開いても、言語を切りかえて読みなおしても、伺かスタジオを起動しなおしても、はりつけられます。
 * ブロックが使っている変数（名前と初期値）も一緒に持ち、はりつけた先のプロジェクトに無ければ足します。
 * 辞書の画面のブロック（y_ ではじまるもの。model/yblocks.js）は辞書の画面に、トークのブロックはトークの画面にだけはりつけます（段階 9-2）。
 */

import { Model } from '../model/model.js';
import { getDef } from '../model/blocks.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { t } from '../i18n/i18n.js';

const KEY = 'ikaga.clipboard';

/** ブロックの中で使っている変数の名前（変数の欄 kind: 'varname' を、はめこんだブロックの中までさがす） */
function usedVariables(block) {
  const names = [];
  (function walk(v) {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    const def = typeof v.type === 'string' ? getDef(v) : null;
    for (const k in v) {
      const arg = def && def.args ? def.args[k] : null;
      if (arg && arg.kind === 'varname' && typeof v[k] === 'string' && v[k].trim() && !names.includes(v[k])) names.push(v[k]);
      walk(v[k]);
    }
  })(block);
  return names;
}

/** コピーしたものを持つ（変数の初期値も、いまのプロジェクトから添える） */
function hold(block) {
  Session.clipboard = Model.clone(block);
  Session.clipboardVars = usedVariables(block)
    .map((name) => Model.project.variables.find((v) => v.name === name))
    .filter(Boolean)
    .map((v) => ({ name: v.name, value: v.value }));
  try {
    localStorage.setItem(KEY, JSON.stringify({ block: Session.clipboard, variables: Session.clipboardVars }));
  } catch { /* 置けなくても、この画面の中でははりつけられる */ }
}

/** コピーしたもの（この画面で無ければ、前にコピーして置いておいたもの） */
function held() {
  if (!Session.clipboard) {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && saved.block && typeof saved.block === 'object') {
        Session.clipboard = saved.block;
        Session.clipboardVars = Array.isArray(saved.variables) ? saved.variables : [];
      }
    } catch { /* 読めなければ、コピーしたものは無い */ }
  }
  return Session.clipboard;
}

/** はりつけた先に無い変数を足す（Model.act の中で呼ぶ）。足した名前を返す */
function addMissingVariables() {
  const added = [];
  for (const v of Session.clipboardVars || []) {
    if (v && v.name && Model.addVariable(v.name, v.value)) added.push(v.name);
  }
  return added;
}

function pastedToast(added) {
  toast(added.length
    ? t('はりつけました（変数「{names}」も足しました）', { names: added.join(', ') })
    : t('はりつけました'));
}

function copy(block) {
  if (!block) return false;
  hold(block);
  toast(t('ブロックをコピーしました'));
  return true;
}

function cut(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  hold(stack[index]);
  Model.act(() => { stack.splice(index, 1); });
  toast(t('ブロックを切り取りました'));
  return true;
}

/** コピーしたものが、はりつける画面とちがう種類なら知らせて true（dic … 辞書の画面にはりつける） */
function wrongPlace(dic) {
  const isDic = String((Session.clipboard || {}).type || '').startsWith('y_');
  if (isDic === !!dic) return false;
  toast(isDic ? t('辞書のブロックは、辞書の画面にはりつけます') : t('トークのブロックは、トークの画面にはりつけます'), true);
  return true;
}

/** stack の index の位置に、コピーしたものをはりつける（opts.dic … 辞書の画面の列） */
function paste(stack, index, opts = {}) {
  if (!held()) { toast(t('コピーしたブロックがありません'), true); return false; }
  if (wrongPlace(opts.dic)) return false;
  if (!Array.isArray(stack)) {
    toast(t('はりつける場所のブロックを、先にクリックしてください'), true);
    return false;
  }
  let added = [];
  Model.act(() => {
    stack.splice(index, 0, Model.clone(Session.clipboard));
    added = addMissingVariables();
  });
  pastedToast(added);
  return true;
}

/**
 * キャンバスの x, y に、コピーしたものを新しいかたまりとしてはりつける
 * （opts.scripts … 置く先のかたまりの並び。辞書の画面なら、そのブロックの並びと opts.dic）
 */
function pasteAt(x, y, opts = {}) {
  if (!held()) { toast(t('コピーしたブロックがありません'), true); return false; }
  if (wrongPlace(opts.dic)) return false;
  let added = [];
  Model.act(() => {
    (opts.scripts || Model.project.scripts).push({
      id: Model.uid('s'), kind: 'loose', blocks: [Model.clone(Session.clipboard)],
      x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)),
    });
    added = addMissingVariables();
  });
  pastedToast(added);
  return true;
}

function duplicate(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  Model.act(() => { stack.splice(index + 1, 0, Model.clone(stack[index])); });
  toast(t('ブロックを複製しました'));
  return true;
}

function remove(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  Model.act(() => { stack.splice(index, 1); });
  return true;
}

/** index から下を全部消す */
function removeFrom(stack, index) {
  if (!Array.isArray(stack) || !stack[index]) return false;
  Model.act(() => { stack.splice(index); });
  return true;
}

function toggleDisabled(block) {
  if (!block) return false;
  Model.act(() => {
    if (block.disabled) delete block.disabled;
    else block.disabled = true;
  });
  return true;
}

export const Clipboard = { copy, cut, paste, pasteAt, duplicate, remove, removeFrom, toggleDisabled, usedVariables };
