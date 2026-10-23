/* 伺かスタジオ - 「ゴースト情報」の画面（名前・作者・しゃべる間隔・ネットワーク更新・サムネイルと readme）と、上のバーの名前 */

import { Model } from '../model/model.js';
import { $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { t } from '../i18n/i18n.js';
import { bindField, setVal } from './fields.js';

let shownThumb = null;   // いま見せているサムネイル（同じなら描きなおさない）

/** サムネイル（meta.thumbnail = { path, name, w, h, stamp }）を見せる */
function renderThumb() {
  const box = $('#thumb-preview');
  if (!box) return;
  const th = Model.project.meta.thumbnail;
  const key = th && th.path ? th.path + '|' + (th.stamp || '') : '';
  if (key === shownThumb) return;
  shownThumb = key;
  box.textContent = '';
  $('#btn-thumb-clear').disabled = !key;
  if (!key) {
    box.textContent = t('（えらんでいません）');
    return;
  }
  const img = document.createElement('img');
  img.src = '/api/shell/file?path=' + encodeURIComponent(th.path) + '&v=' + encodeURIComponent(th.stamp || '');
  img.alt = th.name || '';
  box.appendChild(img);
  const cap = document.createElement('div');
  cap.className = 'thumb-cap';
  cap.textContent = t('{name}（{w}×{h}）', { name: th.name || th.path, w: th.w, h: th.h });
  box.appendChild(cap);
}

async function pickThumb() {
  let r;
  try {
    r = await api('/api/shell/pick', { method: 'POST', body: {} });
  } catch (e) {
    toast(e.message, true);
    return;
  }
  const f = (r.files || [])[0];
  if (!f) return;
  Model.act(() => {
    Model.project.meta.thumbnail = { path: f.path, name: f.name, w: f.width, h: f.height, stamp: String(Date.now()) };
  });
  toast(t('サムネイルを「{name}」にしました', { name: f.name }));
}

function clearThumb() {
  if (!Model.project.meta.thumbnail) return;
  Model.act(() => { delete Model.project.meta.thumbnail; });
}

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
  setVal('#meta-readme', m.readme || '');
  renderThumb();
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
  bindField('#meta-readme', (v) => {
    if (v.trim()) Model.project.meta.readme = v;
    else delete Model.project.meta.readme;
  });
  $('#btn-thumb-pick').addEventListener('click', pickThumb);
  $('#btn-thumb-clear').addEventListener('click', clearThumb);
}

export const Ghost = { init, render };
