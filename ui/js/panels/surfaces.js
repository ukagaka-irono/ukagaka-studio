/* 伺かスタジオ - 立ち絵の絵を引く（「ためす」のステージと「キャラと絵」の画面の両方で使う） */

import { Model } from '../model/model.js';

/** 用意した立ち絵の一覧（{ id, path, name, w, h, stamp }） */
export function shellImages() {
  const sh = Model.project.shell || {};
  if (!Array.isArray(sh.images)) sh.images = [];
  return sh.images;
}

export function shellImageOf(surfaceId) {
  return shellImages().find((x) => Number(x.id) === Number(surfaceId)) || null;
}

// 仮シェルは exe 側で描いてもらう。色を URL に入れてあるので、
// 色を変えれば URL も変わり、そのまま描き直しになる。
export function shellUrl(surfaceId) {
  const img = shellImageOf(surfaceId);
  if (img && img.path) {
    return '/api/shell/file?path=' + encodeURIComponent(img.path) +
           '&v=' + encodeURIComponent(img.stamp || '');
  }
  const s = Model.project.shell || {};
  const kero = surfaceId >= 10;
  const hair = (kero ? s.keroColor : s.sakuraColor) || (kero ? '#8fd18a' : '#f08cae');
  const cloth = (kero ? s.keroCloth : s.sakuraCloth) || (kero ? '#e8b45c' : '#6e82c8');
  return '/api/shell?id=' + surfaceId +
         '&hair=' + encodeURIComponent(hair) +
         '&cloth=' + encodeURIComponent(cloth);
}

/** その番号に絵があるか（用意した画像か、仮シェルが描ける番号か） */
export function hasSurface(surfaceId) {
  const id = Number(surfaceId);
  return !!shellImageOf(id) || [0, 1, 2, 10, 11, 12].indexOf(id) >= 0;
}
