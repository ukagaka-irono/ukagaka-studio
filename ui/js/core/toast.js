/* 伺かスタジオ - 画面の下に出る短いお知らせ */

import { $ } from './dom.js';

let toastTimer = null;

export function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
