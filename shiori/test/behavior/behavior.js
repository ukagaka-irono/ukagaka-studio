/* 栞のふるまいテスト
 *
 *   node shiori\test\behavior\behavior.js
 *
 * parity.js が「ブロック 1 つ 1 つの意味」を見るのに対して、こちらは
 * **栞だけが持っている判断**を見ます。プレビューには無い部分です。
 *
 *   ・同じイベントに複数あるとき、どれを選ぶか（しぼり込みの優先）
 *   ・ブロックが無いイベントの既定の反応（英語のゴーストなら英語で）
 *   ・英語のゴーストでは「いまごろ」「季節」「曜日の名前」が英語の値になること
 *   ・OnClose に \- が必ず付くこと、\e が補われること
 *   ・「◯秒ごと」の間引き
 *   ・OnMouseMove を数えて OnNadeNade を作ること
 *   ・ゴースト間通信の届け先と、話しかけ合いの打ち切り
 *
 * ふるまいを変えたら、ここの期待値も直してください。
 */
'use strict';

const host = require('../lib/host');

const { red, green, dim, off } = host.COLOR;
const { scenarios, checkScenario } = require('./scenarios');

// ---------------------------------------------------------------------- 実行
let failed = 0;
let checked = 0;

for (const sc of scenarios) {
  let got;
  try {
    got = host.run(sc.dir, sc.steps.map((s) => s[0]));
  } catch (e) {
    console.log(`${red}  だめ ${sc.name}${off}\n        ${e.message}`);
    failed++;
    continue;
  }

  const { problems, counted } = checkScenario(sc, got);
  checked += counted;

  if (problems.length) {
    failed++;
    console.log(`${red}  だめ ${sc.name}${off}`);
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
