/* 伺かスタジオ - ウィンドウのタイトル（保存していなければ ● を付ける） */

import { Model } from '../model/model.js';

export function updateTitle() {
  document.title = (Model.dirty ? '● ' : '') +
    (Model.project.meta.name || 'なしゴースト') + ' - 伺かスタジオ';
}
