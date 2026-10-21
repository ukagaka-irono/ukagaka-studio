/* 伺かスタジオ - 「新規」で作るゴーストのひな形 */

import { Model } from './model.js';
import { t, getLang } from '../i18n/i18n.js';

export function sampleProject() {
  const p = Model.newProject();
  p.meta.name = t('あたらしいゴースト');
  p.meta.lang = getLang();   // ゴーストの言語は、作りはじめたときの画面の言語
  p.variables = [{ name: t('好感度'), value: 0 }];
  p.scripts = [
    {
      id: 'sample_boot', kind: 'event', event: 'OnFirstBoot', x: 60, y: 40,
      blocks: [
        { type: 'surface', who: 0, id: 0 },
        { type: 'say', who: 0, text: t('はじめまして。'), nl: 1 },
        { type: 'say', who: 1, text: t('よろしくね。'), nl: 1 },
      ],
    },
    {
      id: 'sample_boot2', kind: 'event', event: 'OnBoot', x: 60, y: 260,
      blocks: [
        { type: 'change', name: t('好感度'), value: 1 },
        { type: 'say', who: 0, text: t('おかえりなさい。'), nl: 1 },
      ],
    },
    {
      id: 'sample_click', kind: 'event', event: 'OnMouseDoubleClick', x: 60, y: 440,
      blocks: [
        {
          type: 'random_one',
          branches: [
            [{ type: 'say', who: 0, text: t('なあに？'), nl: 1 }],
            [{ type: 'say', who: 0, text: t('どうしたの？'), nl: 1 }],
          ],
        },
      ],
    },
    {
      id: 'sample_nade', kind: 'event', event: 'OnNadeNade', area: 'Head', who: 0,
      x: 60, y: 720,
      blocks: [
        { type: 'change', name: t('好感度'), value: 3 },
        { type: 'surface', who: 0, id: 1 },
        { type: 'say', who: 0, text: t('えへへ、くすぐったい。'), nl: 1 },
      ],
    },
    {
      id: 'sample_talk', kind: 'talk', name: t('天気の話'), weight: 1, x: 480, y: 40,
      blocks: [
        { type: 'say', who: 0, text: t('いい天気だね。'), nl: 1 },
        { type: 'say', who: 1, text: t('そうだね。'), nl: 1 },
      ],
    },
  ];
  return p;
}
