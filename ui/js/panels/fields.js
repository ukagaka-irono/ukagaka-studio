/* 伺かスタジオ - 入力欄とプロジェクトをつなぐ小さな道具（ゴースト情報・キャラと絵の画面） */

import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';

/** プロジェクトの値を入力欄へうつす（打っている最中の欄はさわらない） */
export function setVal(sel, v) {
  const el = $(sel);
  if (!el) return;
  if (document.activeElement === el) return;
  if (el.type === 'checkbox') el.checked = !!v;
  else el.value = v == null ? '' : v;
}

/**
 * 入力欄の変更をプロジェクトに書きこむ。元にもどす記録は、欄に入ったときの形で 1 つだけ取ります。
 * onLive をわたすと、色を動かしている最中（input）も、そのつど書きこんで呼びます。
 */
export function bindField(sel, apply, onLive) {
  const el = $(sel);
  let snap = null;
  el.addEventListener('focus', () => { snap = Model.clone(Model.project); });
  el.addEventListener('change', () => {
    if (!snap) snap = Model.clone(Model.project);
    apply(el.type === 'checkbox' ? el.checked : el.value);
    if (onLive) onLive();
    Model.pushUndo(snap);
    snap = null;
  });
  if (onLive) {
    // 色を動かしている最中もそのまま描き直す（元にもどす記録は change のときだけ）
    el.addEventListener('input', () => {
      apply(el.type === 'checkbox' ? el.checked : el.value);
      onLive();
    });
  }
}
