/* 伺かスタジオ - 選択肢のつながりの図（段階 7-7）
 *
 * キャンバスの下の「つながり」と、何もないところの右クリックから開きます。つながりを集めるのは model/graph.js の choiceGraph で、
 * ここでは SVG に描きます。選択肢は実線（見出しを添える）、「よぶ」「◯秒後によぶ」は点線、無いトークは赤い箱です。
 * 箱を押すと、そのかたまりへ動きます。
 */

import { Model } from '../model/model.js';
import { choiceGraph } from '../model/graph.js';
import { $ } from '../core/dom.js';
import { provide } from '../core/commands.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Dialog } from './dialog.js';
import { Pages } from './pages.js';
import { Search } from './search.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 200, H = 34, COL = 270, ROW = 62, PAD = 16;

function svgEl(tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

/** 箱に入るように、文字を切りつめる */
function fit(text, max) {
  if (Render.measureText(text) <= max) return text;
  let s = text;
  while (s.length > 1 && Render.measureText(s + '…') > max) s = s.slice(0, -1);
  return s + '…';
}

function open() {
  const g = choiceGraph(Model.project);
  const body = Render.div('graph');
  if (!g.edges.length) {
    body.appendChild(Render.div('hint', t('選択肢も「よぶ」も、まだありません。選択肢の行き先や、よぶトークを決めると、ここにつながりが出ます。')));
    Dialog.modal(t('選択肢のつながり'), body, [{ label: t('閉じる') }]);
    return;
  }
  body.appendChild(Render.div('hint', t('実線は選択肢、点線は「よぶ」「◯秒後によぶ」です。赤い箱は、無いトークです。箱を押すと、そのかたまりへ動きます。')));

  const pos = new Map(g.nodes.map((n) => [n.id, { x: PAD + n.depth * COL, y: PAD + n.row * ROW, n }]));
  const width = PAD * 2 + (Math.max(...g.nodes.map((n) => n.depth)) * COL) + W;
  const height = PAD * 2 + (Math.max(...g.nodes.map((n) => n.row)) * ROW) + H;
  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'graph-svg' });
  svg.appendChild(svgEl('defs')).appendChild(Object.assign(svgEl('marker', {
    id: 'graph-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse',
  }), {})).appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: 'graph-arrowhead' }));

  // 線（同じ 2 つの間に何本もあるときは、少しずつずらす）
  const seen = new Map();
  for (const e of g.edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    const key = e.from + '>' + e.to;
    const k = seen.get(key) || 0;
    seen.set(key, k + 1);
    const off = k * 8;
    let d;
    if (e.from === e.to) {
      d = `M${a.x + W - 30},${a.y + H} c 0,30 40,30 40,0`;          // 自分へもどる
    } else if (b.x > a.x) {
      const x1 = a.x + W, y1 = a.y + H / 2 + off, x2 = b.x, y2 = b.y + H / 2 + off;
      d = `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`;
    } else {
      // 左（同じ列）へもどる線は、箱の下をまわる
      const x1 = a.x + W / 2 + off, y1 = a.y + H, x2 = b.x + W / 2 + off, y2 = b.y + H;
      const low = Math.max(y1, y2) + 28 + off;
      d = `M${x1},${y1} C${x1},${low} ${x2},${low} ${x2},${y2}`;
    }
    svg.appendChild(svgEl('path', { d, class: 'graph-edge is-' + e.kind, 'marker-end': 'url(#graph-arrow)' }));
    if (e.kind === 'choice' && e.label && e.from !== e.to) {
      const mx = (a.x + W + b.x) / 2;
      const my = b.x > a.x ? (a.y + b.y + H) / 2 + off - 4 : Math.max(a.y, b.y) + H + 22 + off;
      const label = fit(e.label, 110);
      const lw = Render.measureText(label) + 10;
      svg.appendChild(svgEl('rect', { x: mx - lw / 2, y: my - 11, width: lw, height: 16, rx: 4, class: 'graph-label-bg' }));
      svg.appendChild(svgEl('text', { x: mx, y: my + 1, 'text-anchor': 'middle', class: 'graph-label' }, label));
    }
  }

  // 箱
  for (const { x, y, n } of pos.values()) {
    const grp = svgEl('g', { class: 'graph-node' + (n.missing ? ' is-missing' : ''), transform: `translate(${x},${y})` });
    const title = n.missing ? t('（無い）{name}', { name: n.name }) : Model.scriptTitle(n.script);
    grp.appendChild(svgEl('rect', { width: W, height: H, rx: 8 }));
    grp.appendChild(svgEl('text', { x: 10, y: H / 2 + 4 }, fit(title, W - 20)));
    grp.appendChild(svgEl('title', {}, title));
    if (n.script) {
      grp.addEventListener('click', () => {
        Dialog.closeModal();
        Pages.show('talk');
        setTimeout(() => Search.jumpTo({ script: n.script }), 120);   // キャンバスを描いてから
      });
    }
    svg.appendChild(grp);
  }
  const scroll = Render.div('graph-scroll');
  scroll.appendChild(svg);
  body.appendChild(scroll);
  Dialog.modal(t('選択肢のつながり'), body, [{ label: t('閉じる') }], { wide: true });
}

function init() {
  provide({ showGraph: open });
  $('#btn-graph').addEventListener('click', open);
}

export const Graph = { init, open };
