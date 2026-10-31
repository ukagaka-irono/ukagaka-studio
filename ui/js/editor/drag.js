/* 伺かスタジオ - ブロックのドラッグ＆ドロップ
 *
 * ブロックを置く場所（「ルート」）は、トークの画面のキャンバスと、辞書の画面のキャンバス（panels/dictionary.js）の 2 つです。
 * ルートは、パレット・キャンバス・ごみ箱と、かたまりの並び（scripts）を持ちます。押したところのルートで、ドラッグのあいだ動きます。
 */

import { BLOCKS, createBlock, getDef, isReporter } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { toast } from '../core/toast.js';
import { Render } from './render.js';
import { t } from '../i18n/i18n.js';

const SNAP_STACK = 46;   // スタック接続の吸着距離(px)
const SNAP_SLOT = 34;    // スロット吸着距離(px)

const D = {
  ws: null, canvas: null, layer: null, palette: null, trash: null,
  root: null,
  zoom: 1,
  selected: null,
  pending: null,
  drag: null,
  marker: null,
  onDrop: null,
};

// ------------------------------------------------------------------ roots
const ROOTS = [];
let mainRoot = null;

/**
 * ブロックを置く場所を足す。
 *   { ws, canvas, palette, trash, zoom, scripts(): かたまりの並び, removeScript(s), uniqueName(name) }
 */
function addRoot(root) {
  ROOTS.push(Object.assign({ zoom: 1 }, root));
}

function useRoot(root) {
  if (D.root === root) return;
  if (D.root) select(null);
  D.root = root;
  D.ws = root.ws;
  D.canvas = root.canvas;
  D.palette = root.palette;
  D.trash = root.trash;
  D.zoom = root.zoom;
}

const inside = (el, target) => !!(el && target && el.contains(target));

/** target をふくむルート（右クリックのメニューが、置く先のかたまりの並びを知るため。editor/contextmenu.js） */
function rootFor(target) {
  return ROOTS.find((r) => inside(r.ws, target)) || null;
}

function toCanvas(clientX, clientY) {
  const r = D.ws.getBoundingClientRect();
  return {
    x: (clientX - r.left + D.ws.scrollLeft) / D.zoom,
    y: (clientY - r.top + D.ws.scrollTop) / D.zoom,
  };
}

function isFormTarget(target) {
  return !!(target.closest && target.closest('input, select, textarea, button, .blk-btn'));
}

// ---------------------------------------------------------------- select
function select(blockEl) {
  if (D.selected && D.selected.el && D.selected.el.isConnected) {
    D.selected.el.classList.remove('selected');
  }
  if (!blockEl) { D.selected = null; return; }
  blockEl.classList.add('selected');
  D.selected = { el: blockEl, block: blockEl._blk, stack: blockEl._stack, index: blockEl._index };
}

/**
 * 描きなおしたあと、えらんでいたブロック（帽子ならそのかたまり）を、新しい見た目の上でえらびなおす。
 * キャンバスは変わるたびに作りなおすので、こうしないと何かを変えるたびに選択が外れます。
 * 消えていれば、えらんでいない状態にします。
 */
function reselect() {
  const s = D.selected;
  if (!s || !D.canvas) return;
  if (s.el && s.el.isConnected) return;               // 描きなおしていない
  let found = null;
  for (const el of D.canvas.querySelectorAll('.blk')) {
    if (s.block ? el._blk === s.block : (el._isHat && s.el && el._script === s.el._script)) { found = el; break; }
  }
  select(found);
}

/**
 * えらんでいるものの「すぐ下」。ブロックならその次、帽子ならかたまりのいちばん上です。
 * えらんでいないとき・下につなげられないもの（欄の中のブロックなど）のときは null。
 */
function insertTarget() {
  const s = D.selected;
  if (!s || !s.el || !s.el.isConnected) return null;
  if (s.el._isHat && s.el._script) return s.el._script.folded ? null : { stack: s.el._script.blocks, index: 0 };
  if (Array.isArray(s.stack)) return { stack: s.stack, index: s.index + 1 };
  return null;
}

// ------------------------------------------------------------ drag start
function pickPayload(target, clientX, clientY) {
  // パレットの部品から（中のブロックをまとめて。使っている変数も持っていき、置いた先に無ければ足す）
  const partEl = target.closest && target.closest('.palette-part');
  if (partEl && inside(D.palette, partEl) && partEl._palettePart) {
    const part = partEl._palettePart;
    return { type: 'blocks', blocks: Model.clone(part.blocks), vars: part.variables || [], sourceEl: partEl, scale: 1 };
  }

  // パレットから
  const paletteBlk = target.closest && target.closest('.blk');
  if (paletteBlk && inside(D.palette, paletteBlk)) {
    if (paletteBlk._paletteHat) {
      // パレットで見えている内容（なでなでブロックの既定値など）をそのまま持ってくる
      const script = Object.assign({
        kind: paletteBlk._paletteHat,
        event: 'OnBoot',
        name: paletteBlk._paletteHat === 'talk' ? t('トーク') : t('あたらしいトーク'),
        weight: 1,
      }, Model.clone(paletteBlk._paletteScript || {}), { blocks: [] });
      delete script.id;
      return { type: 'newScript', script, sourceEl: paletteBlk.parentElement, scale: 1 };
    }
    const block = Model.clone(paletteBlk._paletteBlock || createBlock(paletteBlk._paletteKey));
    if (!block) return null;
    const isRep = isReporter(block);
    return {
      type: isRep ? 'reporter' : 'blocks',
      blocks: [block],
      sourceEl: paletteBlk,
      scale: 1,
    };
  }

  // キャンバスから
  const blk = target.closest && target.closest('.blk');
  if (!blk || !inside(D.canvas, blk)) return null;

  if (blk._isHat) {
    return { type: 'moveScript', script: blk._script, sourceEl: blk.parentElement, scale: D.zoom };
  }

  const block = blk._blk;
  if (!block) return null;

  if (isReporter(block)) {
    const slot = blk._slot;
    return { type: 'reporter', blocks: [block], fromSlot: slot, sourceEl: blk, scale: D.zoom };
  }

  const stack = blk._stack;
  const index = blk._index;
  if (!Array.isArray(stack)) return null;
  return { type: 'blocks', blocks: null, fromStack: stack, fromIndex: index, sourceEl: blk, scale: D.zoom };
}

function startDrag(payload, clientX, clientY, grab) {
  const project = Model.project;
  const snapshot = Model.clone(project);

  // モデルから切り離す（切り離した状態で再描画してから、ドラッグ用の見た目を作る）
  let blocks = payload.blocks;
  if (payload.type === 'blocks' && !blocks) {
    blocks = payload.fromStack.splice(payload.fromIndex);
  } else if (payload.type === 'reporter' && payload.fromSlot) {
    const owner = payload.fromSlot._slotOwner;
    const arg = payload.fromSlot._slotArg;
    if (Array.isArray(owner)) {
      owner[arg] = '';   // 欄のならび（辞書のブロックの引数など）は、欄を残してからにする
    } else {
      const def = getDef(owner) || BLOCKS[({ event: '@event', talk: '@talk', function: '@function', yfunc: 'y_func' })[owner.kind]];
      const argDef = def && def.args ? def.args[arg] : null;
      owner[arg] = argDef && argDef.mode !== 'bool' ? (argDef.def == null ? '' : argDef.def) : null;
    }
  } else if (payload.type === 'moveScript') {
    // 位置だけ変わるので、モデルはそのまま
  }

  let tempScript;
  if (payload.type === 'moveScript') {
    tempScript = payload.script;
  } else if (payload.type === 'newScript') {
    tempScript = payload.script;
  } else {
    tempScript = { kind: 'loose', blocks: blocks };
  }

  if (payload.type !== 'moveScript' && payload.type !== 'newScript') payload.blocks = blocks;
  if (payload.type === 'moveScript' || payload.type === 'blocks' || payload.type === 'reporter') {
    Model.emit();
  }

  const el = Render.buildScriptEl(tempScript, project, { noPosition: true, noTools: true });
  el.style.position = 'absolute';
  el.style.transformOrigin = '0 0';
  el.style.transform = 'scale(' + D.zoom + ')';
  D.layer.appendChild(el);

  const ratio = D.zoom / (payload.scale || 1);
  D.drag = {
    payload,
    tempScript,
    el,
    snapshot,
    grabX: grab.x * ratio,
    grabY: grab.y * ratio,
    candidate: null,
  };
  document.body.style.cursor = 'grabbing';
  moveDrag(clientX, clientY);
}

function moveDrag(clientX, clientY) {
  const d = D.drag;
  if (!d) return;
  const left = clientX - d.grabX;
  const top = clientY - d.grabY;
  d.el.style.left = left + 'px';
  d.el.style.top = top + 'px';

  const overPalette = isOver(D.palette, clientX, clientY);
  const overTrash = isOver(D.trash, clientX, clientY);
  D.trash.classList.toggle('hot', overTrash || overPalette);

  let candidate = null;
  if (!overPalette && !overTrash && isOver(D.ws, clientX, clientY)) {
    candidate = d.payload.type === 'reporter'
      ? findSlotCandidate(d, clientX, clientY)
      : (d.payload.type === 'moveScript' || d.payload.type === 'newScript'
        ? null
        : findStackCandidate(d, left, top));
  }
  d.candidate = candidate;
  showMarker(candidate);
}

function isOver(el, x, y) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// ---------------------------------------------------------- 接続先さがし
function findStackCandidate(d, clientLeft, clientTop) {
  const p = toCanvas(clientLeft, clientTop);
  const payloadBlocks = d.payload.blocks || [];
  const lastDef = payloadBlocks.length ? getDef(payloadBlocks[payloadBlocks.length - 1]) : null;
  const endsWithCap = !!lastDef && lastDef.shape === 'cap';

  let best = null;
  const stacks = D.canvas.querySelectorAll('.stack');
  for (const stackEl of stacks) {
    const arr = stackEl._stack;
    if (!Array.isArray(arr)) continue;
    const kids = Array.from(stackEl.children).filter((c) => c.classList.contains('blk'));

    for (let i = 0; i <= arr.length; i++) {
      if (i > 0) {
        const prevDef = getDef(arr[i - 1]);
        if (prevDef && prevDef.shape === 'cap') continue;      // cap の後ろにはつなげない
      }
      if (endsWithCap && i < arr.length) continue;             // cap の後ろにブロックは残せない

      let pt;
      if (i < kids.length) {
        const r = kids[i].getBoundingClientRect();
        pt = toCanvas(r.left, r.top);
      } else if (kids.length) {
        const r = kids[kids.length - 1].getBoundingClientRect();
        pt = toCanvas(r.left, r.bottom - 6 * D.zoom);
      } else {
        const r = stackEl.getBoundingClientRect();
        pt = toCanvas(r.left, r.top);
      }
      const dx = p.x - pt.x;
      const dy = p.y - pt.y;
      const dist = Math.sqrt(dx * dx * 0.55 + dy * dy);   // 縦方向を重視
      if (dist < SNAP_STACK && (!best || dist < best.dist)) {
        best = { kind: 'stack', stack: arr, index: i, point: pt, dist, stackEl };
      }
    }
  }
  return best;
}

function findSlotCandidate(d, clientX, clientY) {
  const block = d.payload.blocks[0];
  const def = getDef(block);
  const isBool = def && def.shape === 'boolean';
  const r0 = d.el.getBoundingClientRect();
  const px = r0.left + 12;
  const py = r0.top + r0.height / 2;

  let best = null;
  for (const slot of D.canvas.querySelectorAll('.slot')) {
    if (slot.classList.contains('filled')) continue;
    if (slot._slotMode === 'bool' && !isBool) continue;
    if (slot._slotLiteral) continue;      // YAYA の式・関数の名前の欄には、ブロックをはめない
    const r = slot.getBoundingClientRect();
    const cx = r.left + Math.min(20, r.width / 2);
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < SNAP_SLOT && (!best || dist < best.dist)) {
      best = { kind: 'slot', slot, dist };
    }
  }
  return best;
}

function showMarker(candidate) {
  if (!D.marker) {
    D.marker = Render.div('drop-marker');
    D.marker.style.display = 'none';
    D.canvas.appendChild(D.marker);
  }
  if (!candidate) { D.marker.style.display = 'none'; return; }
  if (candidate.kind === 'slot') {
    D.marker.style.display = 'none';
    highlightSlot(candidate.slot);
    return;
  }
  highlightSlot(null);
  D.marker.style.display = 'block';
  D.marker.style.left = candidate.point.x + 'px';
  D.marker.style.top = (candidate.point.y - 3) + 'px';
  const width = Math.max(80, candidate.stackEl.offsetWidth || 120);
  D.marker.style.width = width + 'px';
}

let hotSlot = null;
function highlightSlot(slot) {
  if (hotSlot && hotSlot !== slot) hotSlot.classList.remove('drop-target');
  hotSlot = slot;
  if (slot) slot.classList.add('drop-target');
}

// -------------------------------------------------------------- drag end
function finishDrag(clientX, clientY) {
  const d = D.drag;
  if (!d) return;
  D.drag = null;
  document.body.style.cursor = '';
  D.trash.classList.remove('hot');
  highlightSlot(null);
  if (D.marker) D.marker.style.display = 'none';
  d.el.remove();

  const payload = d.payload;
  const deleting = isOver(D.palette, clientX, clientY) || isOver(D.trash, clientX, clientY);

  if (deleting) {
    if (payload.type === 'moveScript') D.root.removeScript(payload.script);
    // それ以外はすでにモデルから外れているので、置かなければ消える
    Model.pushUndo(d.snapshot);
    Model.emit();
    toast(t('ブロックを削除しました'));
    return;
  }

  const pos = toCanvas(parseFloat(d.el.style.left), parseFloat(d.el.style.top));

  if (payload.type === 'moveScript') {
    payload.script.x = Math.max(0, Math.round(pos.x));
    payload.script.y = Math.max(0, Math.round(pos.y));
    Model.pushUndo(d.snapshot);
    Model.emit();
    return;
  }

  if (payload.type === 'newScript') {
    payload.script.x = Math.max(0, Math.round(pos.x));
    payload.script.y = Math.max(0, Math.round(pos.y));
    payload.script.id = Model.uid('s');
    if (payload.script.kind === 'function' || payload.script.kind === 'talk' || payload.script.kind === 'yfunc') {
      payload.script.name = D.root.uniqueName(payload.script.name);
    }
    D.root.scripts().push(payload.script);
    Model.pushUndo(d.snapshot);
    Model.emit();
    return;
  }

  if (payload.type === 'reporter') {
    const c = d.candidate;
    if (c && c.kind === 'slot') {
      c.slot._slotOwner[c.slot._slotArg] = payload.blocks[0];
    } else {
      D.root.scripts().push({
        id: Model.uid('s'), kind: 'loose', blocks: payload.blocks,
        x: Math.max(0, Math.round(pos.x)), y: Math.max(0, Math.round(pos.y)),
      });
    }
    Model.pushUndo(d.snapshot);
    Model.emit();
    return;
  }

  // 通常のブロック
  const c = d.candidate;
  if (c && c.kind === 'stack') {
    c.stack.splice(c.index, 0, ...payload.blocks);
  } else {
    D.root.scripts().push({
      id: Model.uid('s'), kind: 'loose', blocks: payload.blocks,
      x: Math.max(0, Math.round(pos.x)), y: Math.max(0, Math.round(pos.y)),
    });
  }
  // 部品なら、使っている変数のうち、このプロジェクトに無いものを足す
  const added = (payload.vars || []).filter((v) => v && v.name && Model.addVariable(v.name, v.value)).map((v) => v.name);
  cleanupEmptyScripts();
  Model.pushUndo(d.snapshot);
  Model.emit();
  if (added.length) toast(t('変数「{names}」も足しました', { names: added.join(', ') }));
}

/** names にない名前にする（base・base2・base3 …） */
function uniqueIn(names, base) {
  if (!names.includes(base)) return base;
  let i = 2;
  while (names.includes(base + i)) i++;
  return base + i;
}
const uniqueName = (base) => uniqueIn(Model.functionNames(), base);

/** 中身の無くなったはみ出しのかたまりを消す（いまのルートの） */
function cleanupEmptyScripts() {
  const list = (D.root || mainRoot).scripts();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].kind === 'loose' && !(list[i].blocks && list[i].blocks.length)) list.splice(i, 1);
  }
}

// --------------------------------------------------------------- pointer
function onPointerDown(e) {
  if (e.button === 2) return;                       // 右クリックはメニュー（開いているメニューは contextmenu.js が閉じます）

  const root = ROOTS.find((r) => inside(r.palette, e.target) || inside(r.canvas, e.target));
  if (!root) return;
  useRoot(root);
  const inPalette = inside(root.palette, e.target);
  const inCanvas = inside(root.canvas, e.target);
  // 打っている欄（ブロックの文字の欄・メモ）の外を押したら、打つのを終える（元にもどす記録もそこで積まれます）。
  // 下で preventDefault するので、何もしないと欄からフォーカスが外れません
  const active = document.activeElement;
  if (active && active !== document.body && isFormTarget(active) && !active.contains(e.target)) active.blur();
  if (isFormTarget(e.target)) return;

  if (e.button === 1 || (!e.target.closest('.blk') && inCanvas)) {
    // 背景ドラッグ = キャンバス移動
    D.pending = {
      pan: true, startX: e.clientX, startY: e.clientY,
      sl: D.ws.scrollLeft, st: D.ws.scrollTop,
    };
    select(null);
    e.preventDefault();
    return;
  }

  const payload = pickPayload(e.target, e.clientX, e.clientY);
  if (!payload) return;

  const rect = (payload.sourceEl || e.target).getBoundingClientRect();
  D.pending = {
    payload,
    startX: e.clientX,
    startY: e.clientY,
    grab: { x: e.clientX - rect.left, y: e.clientY - rect.top },
    blockEl: e.target.closest('.blk'),
  };
  e.preventDefault();
}

function onPointerMove(e) {
  if (D.drag) { moveDrag(e.clientX, e.clientY); return; }
  const p = D.pending;
  if (!p) return;
  if (p.pan) {
    D.ws.scrollLeft = p.sl - (e.clientX - p.startX);
    D.ws.scrollTop = p.st - (e.clientY - p.startY);
    return;
  }
  if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < 4) return;
  startDrag(p.payload, e.clientX, e.clientY, p.grab);
  D.pending = null;
}

function onPointerUp(e) {
  if (D.drag) { finishDrag(e.clientX, e.clientY); D.pending = null; return; }
  const p = D.pending;
  D.pending = null;
  if (!p || p.pan) return;
  if (p.blockEl && inside(D.canvas, p.blockEl)) select(p.blockEl);
}

// ----------------------------------------------------------------- setup
function init(opts) {
  D.layer = opts.layer;
  // トークの画面のキャンバス
  addRoot({
    ws: opts.workspace, canvas: opts.canvas, palette: opts.palette, trash: opts.trash,
    scripts: () => Model.project.scripts,
    removeScript: (s) => Model.removeScript(s),
    uniqueName,
  });
  mainRoot = ROOTS[ROOTS.length - 1];
  useRoot(mainRoot);

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
}

// 拡大・縮小はトークの画面のキャンバスだけ（editor/zoom.js）
function setZoom(z) {
  if (mainRoot) mainRoot.zoom = z;
  if (D.root === mainRoot) D.zoom = z;
}
function getSelected() { return D.selected; }

export const Drag = { init, addRoot, rootFor, setZoom, select, reselect, getSelected, insertTarget, uniqueName, uniqueIn, cleanupEmptyScripts, D };
