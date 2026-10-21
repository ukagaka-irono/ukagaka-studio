/* 伺かスタジオ - 「新規」で作るゴーストのひな形 */

import { Model } from './model.js';

export function sampleProject() {
  const p = Model.newProject();
  p.meta.name = 'あたらしいゴースト';
  p.variables = [{ name: '好感度', value: 0 }];
  p.scripts = [
    {
      id: 'sample_boot', kind: 'event', event: 'OnFirstBoot', x: 60, y: 40,
      blocks: [
        { type: 'surface', who: 0, id: 0 },
        { type: 'say', who: 0, text: 'はじめまして。', nl: 1 },
        { type: 'say', who: 1, text: 'よろしくね。', nl: 1 },
      ],
    },
    {
      id: 'sample_boot2', kind: 'event', event: 'OnBoot', x: 60, y: 260,
      blocks: [
        { type: 'change', name: '好感度', value: 1 },
        { type: 'say', who: 0, text: 'おかえりなさい。', nl: 1 },
      ],
    },
    {
      id: 'sample_click', kind: 'event', event: 'OnMouseDoubleClick', x: 60, y: 440,
      blocks: [
        {
          type: 'random_one',
          branches: [
            [{ type: 'say', who: 0, text: 'なあに？', nl: 1 }],
            [{ type: 'say', who: 0, text: 'どうしたの？', nl: 1 }],
          ],
        },
      ],
    },
    {
      id: 'sample_nade', kind: 'event', event: 'OnNadeNade', area: 'Head', who: 0,
      x: 60, y: 620,
      blocks: [
        { type: 'change', name: '好感度', value: 3 },
        { type: 'surface', who: 0, id: 1 },
        { type: 'say', who: 0, text: 'えへへ、くすぐったい。', nl: 1 },
      ],
    },
    {
      id: 'sample_talk', kind: 'talk', name: '天気の話', weight: 1, x: 480, y: 40,
      blocks: [
        { type: 'say', who: 0, text: 'いい天気だね。', nl: 1 },
        { type: 'say', who: 1, text: 'そうだね。', nl: 1 },
      ],
    },
  ];
  return p;
}
