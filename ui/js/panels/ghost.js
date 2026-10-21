/* 伺かスタジオ - 「ゴースト情報」の画面（名前・作者・しゃべる間隔・ネットワーク更新）と、上のバーの名前 */

import { Model } from '../model/model.js';
import { bindField, setVal } from './fields.js';

/** プロジェクトの値を入力欄へうつす（打っている最中の欄はさわらない）。軽いので、いつ呼んでもよい */
function render() {
  const m = Model.project.meta;
  const s = Model.project.settings;
  setVal('#ghost-name', m.name);
  setVal('#meta-name', m.name);
  setVal('#meta-sakura', m.sakuraName);
  setVal('#meta-kero', m.keroName);
  setVal('#meta-craftman', m.craftman);
  setVal('#meta-url', m.craftmanUrl);
  setVal('#meta-homeurl', m.homeUrl);
  setVal('#meta-version', m.version);
  setVal('#meta-desc', m.description);
  setVal('#meta-lang', m.lang === 'en' ? 'en' : 'ja');
  setVal('#set-talk-interval', s.randomTalkInterval);
  setVal('#set-no-repeat', s.noRepeatCount == null ? 0 : s.noRepeatCount);
  setVal('#set-talk-enabled', s.randomTalkEnabled !== false);
}

function init() {
  bindField('#ghost-name', (v) => { Model.project.meta.name = v; });
  bindField('#meta-name', (v) => { Model.project.meta.name = v; });
  bindField('#meta-sakura', (v) => { Model.project.meta.sakuraName = v; });
  bindField('#meta-kero', (v) => { Model.project.meta.keroName = v; });
  bindField('#meta-craftman', (v) => { Model.project.meta.craftman = v; });
  bindField('#meta-url', (v) => { Model.project.meta.craftmanUrl = v; });
  bindField('#meta-homeurl', (v) => { Model.project.meta.homeUrl = v.trim(); });
  bindField('#meta-version', (v) => { Model.project.meta.version = v; });
  bindField('#meta-desc', (v) => { Model.project.meta.description = v; });
  bindField('#meta-lang', (v) => { Model.project.meta.lang = v === 'en' ? 'en' : 'ja'; });
  bindField('#set-talk-interval', (v) => { Model.project.settings.randomTalkInterval = Number(v) || 0; });
  bindField('#set-no-repeat', (v) => { Model.project.settings.noRepeatCount = Math.max(0, Number(v) || 0); });
  bindField('#set-talk-enabled', (v) => { Model.project.settings.randomTalkEnabled = !!v; });
}

export const Ghost = { init, render };
