/* 伺かスタジオ - 明るい／暗い表示の切りかえ
 *
 * 色は style.css のトークン（light-dark(明るい, 暗い)）が持っていて、どちらを使うかは
 * color-scheme で決まります。ここでは html の data-theme を付け外しするだけです。
 *
 *   'system' … Windows の設定に合わせる（data-theme なし）
 *   'light' / 'dark' … 固定する
 *
 * えらんだものは、この PC の WebView2 の保存場所（localStorage）に覚えます。
 * exe にも知らせて、ウィンドウのタイトルバーの色をそろえます（studio/src/main.cpp）。
 */

import { $ } from './dom.js';

const KEY = 'ikaga.theme';
const MODES = ['system', 'light', 'dark'];
const LABELS = {
  system: { icon: '◐', title: '表示: Windows の設定に合わせる（押すと「明るい」に）' },
  light:  { icon: '☀', title: '表示: 明るい（押すと「暗い」に）' },
  dark:   { icon: '☾', title: '表示: 暗い（押すと「Windows の設定に合わせる」に）' },
};

let mode = 'system';
let media = null;

function load() {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.indexOf(v) >= 0 ? v : 'system';
  } catch { return 'system'; }
}

function save(v) {
  try { localStorage.setItem(KEY, v); } catch { /* 覚えられなくても、いまの表示は変わる */ }
}

/** いま実際に暗いか */
function isDark() {
  if (mode !== 'system') return mode === 'dark';
  return !!(media && media.matches);
}

function apply() {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);

  const btn = $('#btn-theme');
  if (btn) {
    btn.textContent = LABELS[mode].icon;
    btn.title = LABELS[mode].title;
  }
  // exe のタイトルバー。ブラウザで直接開いたときは何もしない
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage(isDark() ? 'theme:dark' : 'theme:light');
  }
}

function set(next) {
  mode = MODES.indexOf(next) >= 0 ? next : 'system';
  save(mode);
  apply();
}

function init() {
  mode = load();
  if (window.matchMedia) {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    // Windows の設定が変わったとき（「合わせる」のときだけ効きます）
    media.addEventListener('change', () => { if (mode === 'system') apply(); });
  }
  apply();
  const btn = $('#btn-theme');
  if (btn) btn.addEventListener('click', () => set(MODES[(MODES.indexOf(mode) + 1) % MODES.length]));
}

export const Theme = { init, set, isDark, get mode() { return mode; } };
