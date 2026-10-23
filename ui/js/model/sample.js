/* 伺かスタジオ - 「新規」で作るゴーストのひな形（ひな形ウィザード。panels/starter.js）
 *
 * starterProject(opts) は、えらんだ部品だけを入れたプロジェクトを作ります。DOM を触らないので、
 * node のテスト（ui\test\editor.js）からも使えます。どの組みあわせでも、チェックタブに引っかからない形にします。
 */

import { Model } from './model.js';
import { t, getLang } from '../i18n/i18n.js';

// 入れられる部品（ウィザードのチェックの並び）。on は最初からチェックしておくもの
export const STARTER_PARTS = [
  { key: 'greet', label: () => t('起動したときのあいさつ（はじめての起動も）'), on: true },
  { key: 'close', label: () => t('終了するときのあいさつ'), on: true },
  { key: 'click', label: () => t('ダブルクリックされたときの反応'), on: true },
  { key: 'nade', label: () => t('頭をなでられたときの反応（好感度つき）'), on: true },
  { key: 'talks', label: () => t('ランダムトーク 3 つ'), on: true },
  { key: 'alarm', label: () => t('お昼の 12 時のアラーム'), on: false },
  { key: 'anniv', label: () => t('今日を記念日にする（毎年、今日の日づけに話す）'), on: false },
  { key: 'menu', label: () => t('SSP の右クリックメニューに「おはなしして」'), on: false },
];

const say = (who, text) => ({ type: 'say', who, text, nl: 1 });

/**
 * えらんだ部品でプロジェクトを作る。
 *   opts.name / sakuraName / keroName / craftman … 名前（空ならいつもの名前）
 *   opts.parts … { greet: true, … }（無ければ STARTER_PARTS の on のもの）
 *   opts.today … 記念日にする日（Date。テスト用。無ければ今日）
 */
export function starterProject(opts = {}) {
  const p = Model.newProject();
  p.meta.lang = getLang();   // ゴーストの言語は、作りはじめたときの画面の言語
  const name = String(opts.name || '').trim();
  const sakura = String(opts.sakuraName || '').trim();
  const kero = String(opts.keroName || '').trim();
  if (name) p.meta.name = name;
  if (sakura) p.meta.sakuraName = sakura;
  if (kero) p.meta.keroName = kero;
  if (String(opts.craftman || '').trim()) p.meta.craftman = String(opts.craftman).trim();
  const parts = opts.parts || Object.fromEntries(STARTER_PARTS.map((x) => [x.key, x.on]));
  const today = opts.today instanceof Date ? opts.today : new Date();

  const like = t('好感度');
  const scripts = [];
  // 左の列にイベント、右の列にランダムトーク。高さは、ブロックの数からだいたいで決めます（あとで「整列」できます）
  const col = { event: { x: 60, y: 40 }, talk: { x: 560, y: 40 } };
  const add = (s) => {
    const c = s.kind === 'talk' ? col.talk : col.event;
    s.x = c.x;
    s.y = c.y;
    c.y += 90 + 46 * JSON.stringify(s.blocks).split('"type"').length;
    scripts.push(s);
  };

  if (parts.greet) {
    add({ id: 'starter_firstboot', kind: 'event', event: 'OnFirstBoot', blocks: [
      { type: 'surface', who: 0, id: 0 },
      say(0, t('はじめまして。{name}です。', { name: p.meta.sakuraName })),
      say(1, t('{name}だよ。よろしくね。', { name: p.meta.keroName })),
    ] });
    add({ id: 'starter_boot', kind: 'event', event: 'OnBoot', blocks: [
      { type: 'change', name: like, value: 1 },
      say(0, t('おかえりなさい。')),
    ] });
  }
  if (parts.close) {
    add({ id: 'starter_close', kind: 'event', event: 'OnClose', blocks: [
      say(0, t('またね。')),
      say(1, t('おつかれさま。')),
    ] });
  }
  if (parts.click) {
    add({ id: 'starter_click', kind: 'event', event: 'OnMouseDoubleClick', blocks: [
      { type: 'random_one', branches: [[say(0, t('なあに？'))], [say(0, t('どうしたの？'))]] },
    ] });
  }
  if (parts.nade) {
    add({ id: 'starter_nade', kind: 'event', event: 'OnNadeNade', area: 'Head', who: 0, blocks: [
      { type: 'change', name: like, value: 3 },
      { type: 'surface', who: 0, id: 1 },
      { type: 'if_else',
        cond: { type: 'compare', op: '>', a: { type: 'var', name: like }, b: 10 },
        then: [say(0, t('えへへ、もっとなでて。'))],
        else: [say(0, t('えへへ、くすぐったい。'))] },
    ] });
  }
  if (parts.talks) {
    add({ id: 'starter_talk1', kind: 'talk', name: t('天気の話'), weight: 1, group: '', blocks: [
      say(0, t('いい天気だね。')), say(1, t('そうだね。')),
    ] });
    add({ id: 'starter_talk2', kind: 'talk', name: t('おやつの話'), weight: 1, group: '', blocks: [
      say(0, t('おなかすいたなあ。')), say(1, t('さっき食べたでしょ。')),
    ] });
    add({ id: 'starter_talk3', kind: 'talk', name: t('ひまの話'), weight: 1, group: '', blocks: [
      say(0, t('ひまだなあ。')),
    ] });
  }
  if (parts.alarm) {
    add({ id: 'starter_alarm', kind: 'event', event: 'OnStudioAlarm', hour: 12, minute: 0, blocks: [
      say(0, t('お昼の時間だよ。')),
    ] });
  }
  if (parts.anniv) {
    add({ id: 'starter_anniv', kind: 'event', event: 'OnStudioAnniversary',
      month: today.getMonth() + 1, day: today.getDate(), blocks: [
        say(0, t('今日は、はじめて会った日だね。')),
      ] });
  }
  if (parts.menu) {
    add({ id: 'starter_menu', kind: 'event', event: 'OnStudioMenu', menu: t('おはなしして'), blocks: [
      { type: 'random_one', branches: [[say(0, t('なにを話そうかな。'))], [say(0, t('今日もいい日だね。'))]] },
    ] });
  }

  // 好感度は、使う部品があるときだけ
  p.variables = parts.greet || parts.nade ? [{ name: like, value: 0 }] : [];
  // ランダムトークを入れないときは、自動でしゃべらない（しゃべるものが無いので）
  if (!parts.talks) p.settings.randomTalkEnabled = false;
  p.scripts = scripts;
  return Model.normalize(p);
}

/** 起動したときと、ウィザードを使わないときのひな形（最初からチェックしてある部品） */
export function sampleProject() {
  return starterProject();
}
