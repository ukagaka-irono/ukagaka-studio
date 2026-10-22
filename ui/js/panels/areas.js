/* 伺かスタジオ - 立ち絵の上で当たり判定を描く（「キャラと絵」の立ち絵の「当たり判定」）
 *
 * 立ち絵の上をドラッグして、四角い当たり判定を描きます。プロジェクトの shell.areas に
 * { 立ち絵の番号: [{ name, x1, y1, x2, y2 }] } の形で持ち（座標は絵の左上からのピクセル）、
 * 1 つでもあれば、その立ち絵の自動の当たり判定（あたま・かお…を絵の大きさから作るもの）のかわりに書き出します
 * （studio/src/export_shell.cpp の CustomCollisionLines）。
 * 名前は、マウス系の帽子ブロックの「場所」でえらべるようになります（editor/render.js の areaname）。
 */

import { Model } from '../model/model.js';
import { AREAS } from '../model/blocks.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Dialog } from './dialog.js';
import { shellUrl } from './surfaces.js';

const NAMES = AREAS.filter(([, v]) => v);   // あたま・かお・むね・スカート・て（「どこか」は外す）

function areasOf(id) {
  return ((Model.project.shell || {}).areas || {})[String(id)] || [];
}

/** この立ち絵の当たり判定を変える（空になったら、自動の当たり判定にもどす） */
function change(id, fn) {
  Model.act(() => {
    const sh = Model.project.shell;
    if (!sh.areas) sh.areas = {};
    const key = String(id);
    if (!Array.isArray(sh.areas[key])) sh.areas[key] = [];
    fn(sh.areas[key]);
    if (!sh.areas[key].length) delete sh.areas[key];
  });
}

/** まだ使っていない名前（あたま → かお → … の順。ぜんぶ使ったら Area2 など） */
function nextName(list) {
  const used = list.map((a) => a.name);
  const free = NAMES.find(([, v]) => !used.includes(v));
  if (free) return free[1];
  let n = 2;
  while (used.includes('Area' + n)) n++;
  return 'Area' + n;
}

function open(id, label) {
  const body = Render.div('areas-editor');
  body.appendChild(Render.div('hint',
    t('絵の上をドラッグすると、四角い当たり判定を描けます。1 つでも描くと、この立ち絵の自動の当たり判定のかわりになります。')));
  const stage = Render.div('areas-stage');
  const img = Render.el('img');
  img.src = shellUrl(id);
  img.alt = label;
  img.draggable = false;
  stage.appendChild(img);
  const layer = Render.div('areas-layer');
  stage.appendChild(layer);
  body.appendChild(stage);
  const list = Render.div('areas-list');
  body.appendChild(list);

  const scale = () => (img.naturalWidth ? img.clientWidth / img.naturalWidth : 1);
  const place = (el, a) => {
    const s = scale();
    el.style.left = Math.min(a.x1, a.x2) * s + 'px';
    el.style.top = Math.min(a.y1, a.y2) * s + 'px';
    el.style.width = Math.abs(a.x2 - a.x1) * s + 'px';
    el.style.height = Math.abs(a.y2 - a.y1) * s + 'px';
  };

  function draw() {
    layer.textContent = '';
    list.textContent = '';
    const areas = areasOf(id);
    if (!areas.length) list.appendChild(Render.div('hint', t('まだ描いていません（自動の当たり判定を使います）。')));
    areas.forEach((a, k) => {
      const r = Render.div('areas-rect');
      r.appendChild(Render.el('span', null, a.name));
      place(r, a);
      layer.appendChild(r);

      const row = Render.div('areas-row');
      const sel = Render.el('select');
      const opts = NAMES.slice();
      if (!opts.some(([, v]) => v === a.name)) opts.push([a.name, a.name]);
      for (const [text, v] of opts.concat([[t('ほかの名前…'), '__other__']])) {
        const o = Render.el('option', null, text);
        o.value = v;
        sel.appendChild(o);
      }
      sel.value = a.name;
      sel.addEventListener('change', () => {
        let name = sel.value;
        if (name === '__other__') name = (prompt(t('当たり判定の名前は？（英数字がおすすめです）'), a.name) || '').trim();
        if (!name) { sel.value = a.name; return; }
        change(id, (l) => { l[k].name = name; });
        draw();
      });
      row.appendChild(sel);
      for (const key of ['x1', 'y1', 'x2', 'y2']) {
        const inp = Render.el('input');
        inp.type = 'number';
        inp.value = a[key];
        inp.title = { x1: t('左'), y1: t('上'), x2: t('右'), y2: t('下') }[key];
        inp.addEventListener('change', () => { change(id, (l) => { l[k][key] = Math.round(Number(inp.value) || 0); }); draw(); });
        row.appendChild(inp);
      }
      const rm = Render.el('button', 'btn tiny', '−');
      rm.title = t('この当たり判定を消す');
      rm.addEventListener('click', () => { change(id, (l) => { l.splice(k, 1); }); draw(); });
      row.appendChild(rm);
      list.appendChild(row);
    });
  }

  // ドラッグで描く（座標は絵の大きさのピクセルにもどして持つ）
  let start = null;
  let ghost = null;
  const point = (e) => {
    const b = img.getBoundingClientRect();
    const s = scale();
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    return {
      x: Math.round(clamp((e.clientX - b.left) / s, img.naturalWidth || b.width)),
      y: Math.round(clamp((e.clientY - b.top) / s, img.naturalHeight || b.height)),
    };
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    start = point(e);
    ghost = Render.div('areas-rect is-ghost');
    layer.appendChild(ghost);
    place(ghost, { x1: start.x, y1: start.y, x2: start.x, y2: start.y });
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!start) return;
    const p = point(e);
    place(ghost, { x1: start.x, y1: start.y, x2: p.x, y2: p.y });
  });
  stage.addEventListener('pointerup', (e) => {
    if (!start) return;
    const p = point(e);
    const a = { x1: Math.min(start.x, p.x), y1: Math.min(start.y, p.y), x2: Math.max(start.x, p.x), y2: Math.max(start.y, p.y) };
    start = null;
    if (a.x2 - a.x1 >= 4 && a.y2 - a.y1 >= 4) change(id, (l) => { l.push(Object.assign({ name: nextName(l) }, a)); });
    draw();
  });

  img.addEventListener('load', draw);
  draw();
  Dialog.modal(t('{label}（{id} 番）の当たり判定', { label, id }), body, [
    { label: t('自動にもどす'), close: false, run: () => { change(id, (l) => { l.splice(0); }); draw(); } },
    { label: t('閉じる') },
  ]);
}

export const Areas = { open, nextName };
