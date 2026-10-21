/* YAYA を動かせるかのテスト（段階 3-1）
 *
 *   node shiori\test\yaya\yaya.js
 *
 * 如何栞と置きかえる YAYA（third_party\yaya\）が、ここで動くかを見ます。
 *
 *   ・yaya.dll が、third_party\README.md に書いた公式のビルドのまま（SHA-256 が同じ）か
 *   ・test_host から読みこめて、受け口の辞書 yaya_base を通してイベントに答えるか
 *     （ふつうの答え・Reference の受けわたし・答えが無いときの 204）
 *
 * Windows 2000 で動くかは、check-imports.js が同じ yaya.dll を見ます。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const host = require('../lib/host');

const { red, green, dim, off } = host.COLOR;
const SMOKE = path.join(__dirname, 'smoke');

const fails = [];
let checks = 0;
function expect(label, got, want) {
  checks++;
  if (got !== want) fails.push(`${label}\n      期待: ${JSON.stringify(want)}\n      実際: ${JSON.stringify(got)}`);
}

// ---- 公式のビルドのままか ----------------------------------------------------
const readme = fs.readFileSync(path.join(host.root, 'third_party', 'README.md'), 'utf8');
const m = readme.match(/`yaya\.dll` の SHA-256: `([0-9a-f]{64})`/);
if (!m) {
  fails.push('third_party\\README.md に yaya.dll の SHA-256 が書いてありません');
} else {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(host.yayaDll)).digest('hex');
  expect('yaya.dll が third_party\\README.md の SHA-256 と同じ', sha, m[1]);
}

// ---- 動かす ------------------------------------------------------------------
const res = host.runYaya(SMOKE, ['OnBoot', 'OnEcho:やっほー', 'OnMinuteChange']);
expect('応答の数', res.length, 3);
if (res.length === 3) {
  expect('OnBoot の状態', res[0].status, '200 OK');
  expect('OnBoot の Value', res[0].value, '\\0\\s[0]YAYA です。\\e');
  expect('OnEcho が Reference0 を受けとる', res[1].value, '\\0やっほー\\e');
  expect('関数が無いイベントは 204', res[2].status, '204 No Content');
}

// ---- 表示 --------------------------------------------------------------------
if (fails.length) {
  for (const f of fails) console.log(`${red}  NG  ${off}${f}`);
  console.log(`${red}[yaya] ${fails.length} か所が期待とちがいます。${off}`);
  process.exit(1);
}
console.log(`${green}  OK  ${off}YAYA が動きます ${dim}(公式のビルドのまま・受け口の辞書を通して答える)${off}`);
console.log(`${green}[yaya] ${checks} か所すべて期待どおりです。${off}`);
