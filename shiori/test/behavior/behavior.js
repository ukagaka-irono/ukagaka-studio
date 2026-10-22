/* 栞のふるまいテスト
 *
 *   node shiori\test\behavior\behavior.js
 *
 * parity.js が「ブロック 1 つ 1 つの意味」を見るのに対して、こちらは
 * **栞だけが持っている判断**を見ます（しくみの辞書 studio/res/yaya/studio_runtime.dic の仕事です）。
 *
 *   ・同じイベントに複数あるとき、どれを選ぶか（しぼり込みの優先）
 *   ・ブロックが無いイベントの既定の反応（英語のゴーストなら英語で）
 *   ・英語のゴーストでは「いまごろ」「季節」「曜日の名前」が英語の値になること
 *   ・OnClose に \- が必ず付くこと、\e が補われること
 *   ・「◯秒ごと」の間引き、ランダムトーク、「◯秒後によぶ」
 *   ・OnMouseMove を数えて OnNadeNade を作ること
 *   ・ゴースト間通信の届け先と、話しかけ合いの打ち切り
 *   ・入力ボックスの答え、選択肢の行き先、SAORI、ネットワーク更新の知らせ
 *
 * 場面は scenarios.js にあります。各場面のゴースト（ghost.json）を YAYA に訳して、
 * shiori\test\yaya\work\behavior<番号>\ で動かします。ふるまいを変えたら、場面の期待値も直してください。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const host = require('../lib/host');

const { red, green, dim, off } = host.COLOR;
const { scenarios, checkScenario } = require('./scenarios');

async function main() {
  let failed = 0;
  let checked = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i];
    let got;
    try {
      const program = JSON.parse(fs.readFileSync(path.join(sc.dir, 'ghost.json'), 'utf8'));
      got = await host.runYayaProgram(`behavior${i + 1}`, program, sc.steps.map((s) => s[0]));
    } catch (e) {
      console.log(`${red}  だめ ${sc.name}${off}\n        ${e.message}`);
      failed++;
      continue;
    }

    const { problems, counted } = checkScenario(sc, got);
    checked += counted;

    if (problems.length) {
      failed++;
      console.log(`${red}  だめ ${sc.name}${off}  ${dim}(work\\behavior${i + 1})${off}`);
      for (const p of problems) console.log(`        ${p}`);
    } else {
      console.log(`${green}  OK  ${off}${sc.name}  ${dim}(${sc.steps.length} 回)${off}`);
    }
  }

  console.log('');
  if (failed) {
    console.log(`${red}[behavior] ${scenarios.length} 場面中 ${failed} 場面がだめでした。${off}`);
    process.exit(1);
  }
  console.log(`${green}[behavior] ${scenarios.length} 場面・${checked} か所すべて期待どおりです。${off}`);
}

main().catch((e) => {
  console.error(`${red}[behavior] ${e.stack || e.message}${off}`);
  process.exit(2);
});
