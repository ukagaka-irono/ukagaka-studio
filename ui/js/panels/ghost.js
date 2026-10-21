/* 伺かスタジオ - 「ゴースト」タブの入力欄（名前・作者・しゃべる間隔・仮シェルの色） */

import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';
import { Shell } from './shell.js';

/** プロジェクトの値を入力欄へうつす（打っている最中の欄はさわらない） */
function render() {
  const m = Model.project.meta;
  const s = Model.project.settings;
  const sh = Model.project.shell;
  setVal('#ghost-name', m.name);
  setVal('#meta-name', m.name);
  setVal('#meta-sakura', m.sakuraName);
  setVal('#meta-kero', m.keroName);
  setVal('#meta-craftman', m.craftman);
  setVal('#meta-url', m.craftmanUrl);
  setVal('#meta-homeurl', m.homeUrl);
  setVal('#meta-version', m.version);
  setVal('#meta-desc', m.description);
  setVal('#set-talk-interval', s.randomTalkInterval);
  setVal('#set-no-repeat', s.noRepeatCount == null ? 0 : s.noRepeatCount);
  $('#set-talk-enabled').checked = s.randomTalkEnabled !== false;
  setVal('#shell-balloon-color', sh.balloonColor);
  $('#shell-balloon-on').checked = !!sh.balloonEnabled;
  setVal('#shell-sakura-color', sh.sakuraColor);
  setVal('#shell-sakura-cloth', sh.sakuraCloth);
  setVal('#shell-kero-color', sh.keroColor);
  setVal('#shell-kero-cloth', sh.keroCloth);
  Shell.refreshShell();
}

function setVal(sel, v) {
  const el = $(sel);
  if (!el) return;
  if (document.activeElement === el) return;
  el.value = v == null ? '' : v;
}

function init() {
  const bind = (sel, apply, onLive) => {
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
  };
  bind('#ghost-name', (v) => { Model.project.meta.name = v; });
  bind('#meta-name', (v) => { Model.project.meta.name = v; });
  bind('#meta-sakura', (v) => { Model.project.meta.sakuraName = v; });
  bind('#meta-kero', (v) => { Model.project.meta.keroName = v; });
  bind('#meta-craftman', (v) => { Model.project.meta.craftman = v; });
  bind('#meta-url', (v) => { Model.project.meta.craftmanUrl = v; });
  bind('#meta-homeurl', (v) => { Model.project.meta.homeUrl = v.trim(); });
  bind('#meta-version', (v) => { Model.project.meta.version = v; });
  bind('#meta-desc', (v) => { Model.project.meta.description = v; });
  bind('#set-talk-interval', (v) => { Model.project.settings.randomTalkInterval = Number(v) || 0; });
  bind('#set-no-repeat', (v) => { Model.project.settings.noRepeatCount = Math.max(0, Number(v) || 0); });
  bind('#set-talk-enabled', (v) => { Model.project.settings.randomTalkEnabled = !!v; });
  bind('#shell-balloon-on', (v) => { Model.project.shell.balloonEnabled = !!v; });
  bind('#shell-balloon-color', (v) => { Model.project.shell.balloonColor = v; });
  bind('#shell-sakura-color', (v) => { Model.project.shell.sakuraColor = v; }, Shell.refreshShell);
  bind('#shell-sakura-cloth', (v) => { Model.project.shell.sakuraCloth = v; }, Shell.refreshShell);
  bind('#shell-kero-color', (v) => { Model.project.shell.keroColor = v; }, Shell.refreshShell);
  bind('#shell-kero-cloth', (v) => { Model.project.shell.keroCloth = v; }, Shell.refreshShell);
}

export const Ghost = { init, render };
