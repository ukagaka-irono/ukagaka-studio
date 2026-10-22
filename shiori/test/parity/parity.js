/* ブロックの意味のテスト（一致テスト）
 *
 *   node shiori\test\parity\parity.js            見くらべる
 *   node shiori\test\parity\parity.js --update   いまの YAYA の答えを期待値として保存しなおす
 *
 * 一致テストのゴースト（ghost.json。ブロックごとに 1 つの OnP** イベント）を YAYA に訳して動かし、
 *
 *   1. SSP と同じ動かしかた（イベントとして順に投げる）の答えが、期待値（expected.json）と同じか
 *   2. 「ためす」と同じ動かしかた（yaya_host.exe で、かたまりを 1 つずつまっさらな状態から）の答えが、1 と同じか
 *
 * を見ます。expected.json は、如何栞（段階 3-6 で外したもの）が出していた答えを、外す前に写したものです。
 * OnP25（いまごろ・季節・曜日の名前）は時計で答えが変わるので、ここでその場で作ります。
 *
 * 新しいブロックを足したら、ghost.json にも「毎回おなじ結果になる形」で足し、
 * 出てきた答えを目で確かめてから --update してください（足し忘れは node tools\check-blocks.js が止めます）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const host = require('../lib/host');

const here = __dirname;
const { red, green, dim, off } = host.COLOR;
const update = process.argv.includes('--update');

const program = JSON.parse(fs.readFileSync(path.join(here, 'ghost.json'), 'utf8'));
const expectedPath = path.join(here, 'expected.json');
const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
const cases = (program.scripts || []).filter((s) => s.kind === 'event' && /^OnP\d+$/.test(s.event || ''));

function fail(msg) {
  console.error(`${red}[parity] ${msg}${off}`);
  process.exit(2);
}

/** OnP25 の答え（いまの時計で。ゴーストの言語は日本語） */
function clockAnswer() {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMonth() + 1;
  const daypart = h < 5 ? '夜' : h < 11 ? '朝' : h < 17 ? '昼' : h < 22 ? '夕方' : '夜';
  const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  const week = '日月火水木金土'[d.getDay()];
  return { value: `\\0${daypart}${season}\\n${week}\\n\\e`, commTo: '' };
}

/** 長い出力は、ちがいはじめたところの前後だけ見せる（画面が流れてしまわないように） */
function around(s, k) {
  const from = Math.max(0, k - 24);
  const to = Math.min(s.length, k + 40);
  return (from > 0 ? '…' : '') + s.slice(from, to) + (to < s.length ? `…（ぜんぶで ${s.length} 文字）` : '');
}

function diffLines(label, a, b) {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  return `        ${dim}${k} 文字目から違います${off}\n        ${label[0]}: ${around(a, k)}\n        ${label[1]}: ${around(b, k)}`;
}

async function main() {
  if (!cases.length) fail('ghost.json に OnP** のかたまりがありません。');
  const noId = cases.filter((s) => !s.id);
  if (noId.length) fail(`id の無いかたまりがあります: ${noId.map((s) => s.event).join(', ')}（「ためす」は id で選びます）`);

  // ---------------------------------------------------- 1. SSP と同じ動かしかた
  const specs = cases.map((s) => (s.refs && s.refs.length ? `${s.event}:${s.refs.join(',')}` : s.event));
  const ssp = await host.runYayaProgram('parity', program, specs);
  if (ssp.length !== cases.length) fail(`YAYA の応答が ${ssp.length} 件で、かたまりの数 ${cases.length} と合いません。`);

  if (update) {
    const out = { _comment: expected._comment, cases: {} };
    cases.forEach((s, i) => {
      if (s.event !== 'OnP25') out.cases[s.event] = { value: ssp[i].value, commTo: ssp[i].commTo };
    });
    fs.writeFileSync(expectedPath, JSON.stringify(out, null, 2) + '\n');
    console.log(`${dim}  保存 expected.json（${Object.keys(out.cases).length} 件）${off}`);
  }

  let bad = 0;
  for (let i = 0; i < cases.length; i++) {
    const s = cases[i];
    const note = (s._ || '').trim();
    const want = s.event === 'OnP25' ? clockAnswer() : (expected.cases || {})[s.event];
    const got = ssp[i];
    const problems = [];
    if (!want) {
      problems.push(`        期待値がありません（目で確かめてから --update で作れます）\n        出た: ${got.value}`);
    } else {
      if (got.value !== want.value) problems.push(diffLines(['期待値', 'YAYA  '], want.value, got.value));
      if (got.commTo !== want.commTo) problems.push(`        話しかけ先  期待値: "${want.commTo}" / YAYA: "${got.commTo}"`);
    }

    // ---------------------------------------------------- 2. 「ためす」と同じ動かしかた
    const tr = await host.runYayaPreview('parity-try', program, s.id, { refs: s.refs || [], sys: {} });
    // SSP への応答は、改行を \n にして 1 行にしています
    const trScript = (tr.script || '').replace(/\r/g, '').replace(/\n/g, '\\n');
    if (tr.error) problems.push(`        「ためす」がエラー: ${tr.error}`);
    else {
      if (trScript !== got.value) problems.push(diffLines(['ためす', 'SSP   '], trScript, got.value));
      if (tr.commTo !== got.commTo) problems.push(`        話しかけ先  ためす: "${tr.commTo}" / SSP: "${got.commTo}"`);
    }

    if (!problems.length) {
      console.log(`${green}  OK  ${off}${s.event}  ${dim}${note}${off}`);
      continue;
    }
    bad++;
    console.log(`${red}  ちがう ${s.event}${off}  ${dim}${note}${off}`);
    for (const p of problems) console.log(p);
  }

  console.log('');
  if (bad) {
    console.log(`${red}[parity] ${cases.length} 件中 ${bad} 件がちがいます。${off}`);
    console.log(`${dim}        訳しかた（ui/js/model/yaya.js）か、しくみの辞書（studio/res/yaya/studio_runtime.dic）を見てください。`
      + `わざと変えたのなら --update で期待値を作りなおします。${off}`);
    process.exit(1);
  }
  console.log(`${green}[parity] ${cases.length} 件が期待どおりで、「ためす」と SSP の答えも同じです。${off}`);
}

main().catch((e) => fail(e.stack || e.message));
