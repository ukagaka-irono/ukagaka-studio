/* 伺かスタジオ - 「何かが済んだ」の知らせ（はじめてガイドが、進みぐあいを知るため）
 *
 *   Events.emit('ran')               知らせる側（例: panels/run.js）
 *   Events.on('ran', () => { … })    聞く側（例: panels/guide.js）
 *
 * 知らせる側は、だれが聞いているかを知りません。下の層から上の層へ「済んだ」を伝えるときにも使えます。
 * いま使っている名前: 'sample-opened'（お手本を開いた）、'ran'（ためした）、
 * 'exported'（フォルダか .nar に書き出した）、'installed'（SSP に入れた）。
 */

const handlers = new Map();

function on(name, fn) {
  if (!handlers.has(name)) handlers.set(name, []);
  handlers.get(name).push(fn);
}

function emit(name, detail) {
  for (const fn of handlers.get(name) || []) {
    try { fn(detail); } catch (e) { console.error(e); }   // 聞く側の失敗で、知らせた側の処理を止めない
  }
}

export const Events = { on, emit };
