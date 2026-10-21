/* 伺かスタジオ - キャンバスの上のかたまり（複製・削除・あたらしいトーク・整列） */

import { getDef } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';

/** いま見えているキャンバスの、左寄りのまんなか（あたらしいかたまりを置く場所） */
function viewCenter() {
  const ws = $('#workspace');
  return {
    x: Math.round((ws.scrollLeft + 80) / Session.zoom),
    y: Math.round((ws.scrollTop + ws.clientHeight / 2) / Session.zoom),
  };
}

function duplicateScript(script) {
  Model.act(() => {
    const copy = Model.clone(script);
    copy.id = Model.uid('s');
    copy.x = (script.x || 0) + 40;
    copy.y = (script.y || 0) + 40;
    if (copy.kind === 'function' || copy.kind === 'talk') {
      let base = copy.name || 'コピー';
      let n = 2;
      while (Model.functionNames().includes(base + n)) n++;
      copy.name = base + n;
    }
    Model.project.scripts.push(copy);
  });
  toast('複製しました');
}

function deleteScript(script) {
  const count = (script.blocks || []).length;
  if (count && !confirm(`「${Model.scriptTitle(script)}」を削除しますか？`)) return;
  Model.act(() => Model.removeScript(script));
  toast('削除しました');
}

/** 名前を聞いてトークを作る。作った名前か null を返す */
function promptNewFunction() {
  const name = prompt('あたらしいトークの名前は？', 'あたらしいトーク');
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();
  if (Model.functionNames().includes(trimmed)) {
    toast('その名前はもう使われています', true);
    return null;
  }
  const at = viewCenter();
  Model.act(() => Model.addScript('function', { name: trimmed, x: at.x, y: at.y }));
  toast(`「${trimmed}」を作りました。ブロックをつなげてください`);
  return trimmed;
}

function tidy() {
  Model.act(() => {
    let x = 60, y = 40, colW = 0;
    const order = { event: 0, talk: 1, function: 2, loose: 3 };
    const sorted = Model.project.scripts.slice().sort(
      (a, b) => (order[a.kind] || 0) - (order[b.kind] || 0)
    );
    for (const s of sorted) {
      s.x = x; s.y = y;
      y += estimateHeight(s) + 40;
      colW = Math.max(colW, 420);
      if (y > 2400) { y = 40; x += colW + 60; colW = 0; }
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
  $('#btn-tidy').addEventListener('click', () => { tidy(); toast('整列しました'); });
}

export const Scripts = { init, duplicateScript, deleteScript, promptNewFunction, tidy };
