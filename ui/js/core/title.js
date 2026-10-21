/* 伺かスタジオ - ウィンドウのタイトル（保存していなければ ● を付ける） */

import { Model } from '../model/model.js';
import { t } from '../i18n/i18n.js';

export function updateTitle() {
  document.title = (Model.dirty ? '● ' : '') +
    t('{name} - 伺かスタジオ', { name: Model.project.meta.name || t('あたらしいゴースト') });
}
