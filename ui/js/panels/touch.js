/* 伺かスタジオ - 「ためす」の立ち絵をさわって、マウスのイベントをためす
 *
 * ステージの立ち絵をクリックすると OnMouseClick、ダブルクリックすると OnMouseDoubleClick、
 * 同じ場所の上で 8 回うごかすと OnNadeNade を、SSP と同じえらびかたで動かします
 * （exe の studio_preview.dic の「event:イベント名」。どのかたまりにするか・しぼり込み・ブロックが無いときの反応）。
 *
 * どこをさわったかは、その立ち絵の当たり判定で決めます。絵の上で描いたもの（shell.areas）があればそれを、
 * 無ければ exe が絵の大きさから作る自動のもの（/api/shell/areas。書き出しと同じ DefaultHitAreas）を使います。
 * Reference は SSP と同じ並び（x, y, ホイール, キャラ, 当たり判定の名前, ボタン）です。
 *
 * なでなでの数えかた（同じ場所で 8 回・1.5 秒あくとやりなおし）は、書き出したゴーストでは
 * しくみの辞書（studio_runtime.dic）が数えます。「ためす」は 1 回ずつ別に動かすので、ここで同じ数で数えます。
 */

import { Model } from '../model/model.js';
import { api } from '../core/api.js';
import { t } from '../i18n/i18n.js';
import { Run } from './run.js';

const NADE_COUNT = 8;       // 同じ場所でうごかす回数（studio_runtime.dic と同じ）
const NADE_GAP = 1500;      // これだけあくと、数えなおし（ミリ秒）
const DOUBLE_GAP = 280;     // この間にもう 1 回押したら、ダブルクリック

const defaultCache = new Map();   // "幅x高さ" → 自動の当たり判定

/** 立ち絵の当たり判定（描いたものか、自動のもの） */
async function areasFor(img) {
  const id = String(img.dataset.surface || '0');
  const drawn = ((Model.project.shell || {}).areas || {})[id];
  if (Array.isArray(drawn) && drawn.length) return drawn;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return [];
  const key = w + 'x' + h;
  if (!defaultCache.has(key)) {
    try {
      defaultCache.set(key, (await api(`/api/shell/areas?w=${w}&h=${h}`)).areas || []);
    } catch {
      defaultCache.set(key, []);   // exe の外（ブラウザでじかに開いたとき）は、場所なし
    }
  }
  return defaultCache.get(key);
}

/** マウスの位置を、絵のピクセルにする */
function pointOn(img, e) {
  const r = img.getBoundingClientRect();
  const sx = img.naturalWidth ? img.naturalWidth / r.width : 1;
  const sy = img.naturalHeight ? img.naturalHeight / r.height : 1;
  return { x: Math.round((e.clientX - r.left) * sx), y: Math.round((e.clientY - r.top) * sy) };
}

async function hitAt(img, e) {
  const p = pointOn(img, e);
  const area = (await areasFor(img)).find((a) => p.x >= Math.min(a.x1, a.x2) && p.x <= Math.max(a.x1, a.x2)
    && p.y >= Math.min(a.y1, a.y2) && p.y <= Math.max(a.y1, a.y2));
  return { x: p.x, y: p.y, area: area ? area.name : '' };
}

function refs(hit, who) {
  return [String(hit.x), String(hit.y), '0', String(who), hit.area, '0'];
}

function bind(img, who) {
  let clickTimer = null;
  let stroke = { area: '', count: 0, at: 0 };

  img.addEventListener('click', async (e) => {
    const hit = await hitAt(img, e);
    if (clickTimer) {                       // 2 回目 → ダブルクリック
      clearTimeout(clickTimer);
      clickTimer = null;
      Run.runEvent('OnMouseDoubleClick', refs(hit, who));
      return;
    }
    clickTimer = setTimeout(() => {
      clickTimer = null;
      Run.runEvent('OnMouseClick', refs(hit, who));
    }, DOUBLE_GAP);
  });

  img.addEventListener('mousemove', async (e) => {
    const hit = await hitAt(img, e);
    img.title = hit.area ? t('{area}（クリック・ダブルクリック・なでるとためせます）', { area: hit.area })
      : t('立ち絵をクリック・ダブルクリック・なでると、そのイベントをためせます');
    if (!hit.area) { stroke = { area: '', count: 0, at: 0 }; return; }
    const now = Date.now();
    if (hit.area !== stroke.area || now - stroke.at > NADE_GAP) stroke = { area: hit.area, count: 0, at: now };
    stroke.count++;
    stroke.at = now;
    if (stroke.count >= NADE_COUNT) {
      stroke = { area: '', count: 0, at: 0 };
      Run.runEvent('OnNadeNade', refs(hit, who));
    }
  });
}

function init() {
  for (const who of [0, 1]) {
    const img = document.getElementById('chara-' + who);
    if (img) bind(img, who);
  }
}

export const Touch = { init, NADE_COUNT };
