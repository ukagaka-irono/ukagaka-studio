/* 伺かスタジオ - キャンバスの上のかたまり（複製・削除・あたらしいトーク・整列） */

import { getDef } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { t } from '../i18n/i18n.js';

/** いま見えているキャンバスの、左寄りのまんなか（あたらしいかたまりを置く場所） */
function viewCenter() {
  const ws = $('#workspace');
  return {
    x: Math.round((ws.scrollLeft + 80) / Session.zoom),
    y: Math.round((ws.scrollTop + ws.clientHeight / 2) / Session.zoom),
  };
}

/**
 * いま見えているキャンバスの中で、ほかのかたまりと重ならない場所（左上から、たて・よこの順にさがす）。
 * キャンバスの上に浮かんでいるもの（はじめてガイド・右下のボタン・ごみ箱）の下にも置きません。
 * 見えているところに空きが無ければ、その下をさがします（見えるところまで動かすのは、置いた側の仕事）。
 * キャンバスの下のはしまで埋まっていたら、viewCenter() にします。
 */
function freeSpot(w = 320, h = 160) {
  const ws = $('#workspace');
  if (!ws || !ws.clientWidth) return viewCenter();
  const z = Session.zoom;
  const left = ws.scrollLeft / z + 40;
  const top = ws.scrollTop / z + 40;
  const right = Math.max(left, (ws.scrollLeft + ws.clientWidth) / z - w - 20);
  const bottom = Math.max(top, (ws.scrollTop + ws.clientHeight) / z - h - 20);
  const boxes = [...document.querySelectorAll('#canvas > .script')].map((el) => ({
    l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight,
  }));
  const wr = ws.getBoundingClientRect();
  for (const el of document.querySelectorAll('#workspace-wrap > :not(#workspace):not(#canvas-hint)')) {
    if (!el.offsetWidth) continue;   // 閉じているもの
    const r = el.getBoundingClientRect();
    boxes.push({
      l: (r.left - wr.left + ws.scrollLeft) / z, t: (r.top - wr.top + ws.scrollTop) / z,
      r: (r.right - wr.left + ws.scrollLeft) / z, b: (r.bottom - wr.top + ws.scrollTop) / z,
    });
  }
  const GAP = 24;
  const hit = (x, y) => boxes.some((b) => x < b.r + GAP && b.l - GAP < x + w && y < b.b + GAP && b.t - GAP < y + h);
  for (let x = left; x <= right; x += 40) {
    for (let y = top; y <= bottom; y += 40) {
      if (!hit(x, y)) return { x: Math.round(x), y: Math.round(y) };
    }
  }
  const end = $('#canvas').offsetHeight - h - 20;
  for (let y = bottom + 40; y <= end; y += 40) {
    for (let x = left; x <= right; x += 40) {
      if (!hit(x, y)) return { x: Math.round(x), y: Math.round(y) };
    }
  }
  return viewCenter();
}

function duplicateScript(script) {
  Model.act(() => {
    const copy = Model.clone(script);
    copy.id = Model.uid('s');
    copy.x = (script.x || 0) + 40;
    copy.y = (script.y || 0) + 40;
    if (copy.kind === 'function' || copy.kind === 'talk') {
      let base = copy.name || t('コピー');
      let n = 2;
      while (Model.functionNames().includes(base + n)) n++;
      copy.name = base + n;
    }
    Model.project.scripts.push(copy);
  });
  toast(t('複製しました'));
}

function deleteScript(script) {
  const count = (script.blocks || []).length;
  if (count && !confirm(t('「{title}」を削除しますか？', { title: Model.scriptTitle(script) }))) return;
  Model.act(() => Model.removeScript(script));
  toast(t('削除しました'));
}

/** 名前を聞いてトークを作る。作った名前か null を返す */
function promptNewFunction() {
  const name = prompt(t('あたらしいトークの名前は？'), t('あたらしいトーク'));
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();
  if (Model.functionNames().includes(trimmed)) {
    toast(t('その名前はもう使われています'), true);
    return null;
  }
  const at = viewCenter();
  Model.act(() => Model.addScript('function', { name: trimmed, x: at.x, y: at.y }));
  toast(t('「{name}」を作りました。ブロックをつなげてください', { name: trimmed }));
  return trimmed;
}

/**
 * かたまりを、イベント・トーク・よばれるトークの順に、上から下・左から右へならべなおす。
 * 大きさは、キャンバスに描いてあるものを測ります（長いセリフのかたまりが、となりの列に
 * はみ出さないように）。描いていないとき（ほかの画面にいるとき）は、だいたいの大きさで並べます。
 * 列は、いま見えているキャンバスの高さ（せまくても 900px）で折りかえします。
 */
function tidy() {
  const sizes = new Map();
  for (const el of document.querySelectorAll('#canvas > .script')) {
    if (el._script && el.offsetWidth) sizes.set(el._script, { w: el.offsetWidth, h: el.offsetHeight });
  }
  const ws = $('#workspace');
  const limit = Math.max(900, ws && ws.clientHeight ? ws.clientHeight / Session.zoom - 40 : 0);
  const GAP_Y = 40, GAP_X = 60;

  Model.act(() => {
    let x = 60, y = 40, colW = 0;
    const order = { event: 0, talk: 1, function: 2, loose: 3 };
    const sorted = Model.project.scripts.slice().sort(
      (a, b) => (order[a.kind] || 0) - (order[b.kind] || 0)
    );
    for (const s of sorted) {
      const size = sizes.get(s) || { w: 420, h: estimateHeight(s) };
      // この列に入りきらなければ、となりの列へ（列のはじめのかたまりは、大きくてもそのまま置く）
      if (y > 40 && y + size.h > limit) { y = 40; x += colW + GAP_X; colW = 0; }
      s.x = x; s.y = y;
      y += size.h + GAP_Y;
      colW = Math.max(colW, size.w);
    }
    Model.project.scripts = sorted;
  });
}

function estimateHeight(script) {
  let n = 1;
  const walk = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const b of arr) {
      n++;
      const d = getDef(b);
      if (!d) continue;
      for (const s of d.subs || []) { n += 1; walk(b[s.key]); }
      if (d.dynamic && Array.isArray(b[d.dynamic])) { b[d.dynamic].forEach((x) => { n += 1; walk(x); }); }
    }
  };
  walk(script.blocks);
  return n * 40;
}

function init() {
  $('#btn-tidy').addEventListener('click', () => { tidy(); toast(t('整列しました')); });
}

export const Scripts = { init, duplicateScript, deleteScript, promptNewFunction, tidy, freeSpot, viewCenter };
