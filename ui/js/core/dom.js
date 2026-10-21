/* 伺かスタジオ - 画面まわりの小さな道具 */

export const $ = (sel) => document.querySelector(sel);

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
