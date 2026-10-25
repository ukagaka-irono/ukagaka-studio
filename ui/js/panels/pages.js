/* 伺かスタジオ - いちばん大きな切りかえ（トーク・セリフ・辞書・キャラと絵・ゴースト情報・書き出し・ヘルプ）
 *
 * 上のバーのすぐ下のボタン（.mode-tab）で、画面全体を .page ごと切りかえます。
 * ヘルプにはボタンが無く、上のバーの ？ で開きます（もう一度押すと、前の画面にもどる）。
 *
 * 見えていない画面は描きなおしません（main.js の renderAll）。そのため、切りかえたら
 * onShow() にわたした関数を呼んで、その画面を描いてもらいます。
 */

import { $ } from '../core/dom.js';

const listeners = [];
let current = 'talk';
let beforeHelp = 'talk';

function show(name) {
  if (!document.querySelector(`.page[data-page="${name}"]`)) return;
  if (name === 'help' && current !== 'help') beforeHelp = current;
  current = name;
  for (const p of document.querySelectorAll('.page')) p.classList.toggle('is-active', p.dataset.page === name);
  for (const b of document.querySelectorAll('.mode-tab')) {
    const on = b.dataset.page === name;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  const help = $('#btn-help');
  if (help) help.classList.toggle('is-active', name === 'help');
  for (const fn of listeners) fn(name);
}

/** 画面を切りかえたあとに呼んでほしい関数を登録する（引数は画面の名前） */
function onShow(fn) { listeners.push(fn); }

function init() {
  for (const b of document.querySelectorAll('.mode-tab')) b.addEventListener('click', () => show(b.dataset.page));
  const help = $('#btn-help');
  if (help) help.addEventListener('click', () => show(current === 'help' ? beforeHelp : 'help'));
}

export const Pages = { init, show, onShow, get current() { return current; } };
