/* YAYA のテスト
 *
 *   node shiori\test\yaya\yaya.js
 *
 * ゴーストを動かす YAYA（third_party\yaya\）と、そのまわり（書き出し・手書きのゴースト・保存）を見ます。
 * ブロックの意味は shiori\test\parity\parity.js、栞の判断は shiori\test\behavior\behavior.js が見ます。
 *
 *   1. yaya.dll が、third_party\README.md に書いた公式のビルドのまま（SHA-256 が同じ）か
 *   2. test_host から読みこめて、受け口の辞書 yaya_base を通してイベントに答えるか（いちばん小さな辞書で）
 *   3. ブロックを訳すところ（ui\js\model\yaya.js）がよける #globaldefine の名前が、yaya_base とそろっているか
 *   4. 「ためす」の入り口が、初期値の上に続きの変数をかさね、無い id にエラーを返すか
 *      画面で作る書き出しの形が exe と同じか、exe の書き出したゴーストがそのまま動くか
 *      手書きの YAYA ゴーストにつないで書き出しても、手書きのファイルがバイトのままか
 *   6. ブロックの変数と起動回数が、YAYA の保存（yaya_variable.cfg）で次の起動に残るか。記録（studio_debug.txt）
 *
 * Windows 2000 で動くかは、check-imports.js が同じ yaya.dll を見ます。
 * 訳した辞書は shiori\test\yaya\work\ に残るので、ちがったときは開いて見られます。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const host = require('../lib/host');

const { red, green, dim, off } = host.COLOR;
const SMOKE = path.join(__dirname, 'smoke');
const PARITY = path.join(host.root, 'shiori', 'test', 'parity');

const fails = [];
let checks = 0;
function expect(label, got, want) {
  checks++;
  if (got !== want) fails.push(`${label}\n      期待: ${JSON.stringify(want)}\n      実際: ${JSON.stringify(got)}`);
}
function ok(msg, note) {
  console.log(`${green}  OK  ${off}${msg}${note ? ` ${dim}(${note})${off}` : ''}`);
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

async function main() {
  // ---- 1. 公式のビルドのままか -------------------------------------------------
  const readme = fs.readFileSync(path.join(host.root, 'third_party', 'README.md'), 'utf8');
  const m = readme.match(/`yaya\.dll` の SHA-256: `([0-9a-f]{64})`/);
  if (!m) {
    fails.push('third_party\\README.md に yaya.dll の SHA-256 が書いてありません');
  } else {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(host.yayaDll)).digest('hex');
    expect('yaya.dll が third_party\\README.md の SHA-256 と同じ', sha, m[1]);
  }

  // ---- 2. いちばん小さな辞書で動かす ------------------------------------------
  const res = host.runYaya(SMOKE, ['OnBoot', 'OnEcho:やっほー', 'OnMinuteChange']);
  expect('応答の数', res.length, 3);
  if (res.length === 3) {
    expect('OnBoot の状態', res[0].status, '200 OK');
    expect('OnBoot の Value', res[0].value, '\\0\\s[0]YAYA です。\\e');
    expect('OnEcho が Reference0 を受けとる', res[1].value, '\\0やっほー\\e');
    expect('関数が無いイベントは 204', res[2].status, '204 No Content');
  }
  if (!fails.length) ok('YAYA が動きます', '公式のビルドのまま・受け口の辞書を通して答える');

  // ---- 3. #globaldefine の名前 -------------------------------------------------
  const { YAYA_DEFINES } = await host.yayaTranslator();
  const baseDir = path.join(host.root, 'third_party', 'yaya-dic', 'yaya_base');
  const defined = new Set();
  for (const f of fs.readdirSync(baseDir).filter((n) => n.endsWith('.dic'))) {
    for (const line of fs.readFileSync(path.join(baseDir, f), 'utf8').split(/\r?\n/)) {
      const d = /^#globaldefine\s+(\S+)/.exec(line);
      if (d) defined.add(d[1]);
    }
  }
  const missingDefs = [...defined].filter((n) => !YAYA_DEFINES.includes(n));
  const extraDefs = YAYA_DEFINES.filter((n) => !defined.has(n));
  checks++;
  if (missingDefs.length || extraDefs.length) {
    fails.push('ui\\js\\model\\yaya.js の YAYA_DEFINES が yaya_base の #globaldefine とそろっていません'
      + (missingDefs.length ? `\n      足りない: ${missingDefs.join(' ')}` : '')
      + (extraDefs.length ? `\n      よけいな: ${extraDefs.join(' ')}` : ''));
  } else {
    ok('#globaldefine の名前をよけています', `${defined.size} 個`);
  }

  // ---- 4. 「ためす」の入り口（studio_preview.dic）の変数とエラー ----------------
  // 一致テストのゴーストの答えと「ためす」の答えの見くらべは、shiori\test\parity\parity.js がします
  const program = readJson(path.join(PARITY, 'ghost.json'));
  {
    checks++;
    const tr = await host.runYayaPreview('preview', program, 'p06', { vars: { 'あたい': 100 } });
    const missing = await host.runYayaPreview('preview', program, 'ないid', {});
    if (tr.vars['初期値つき'] !== 7 || tr.vars['あたい'] !== 7 || missing.error !== 'script_not_found') {
      fails.push(`「ためす」の変数とエラー\n      初期値つき=${tr.vars['初期値つき']} あたい=${tr.vars['あたい']} 無い id → ${missing.error}`);
    } else {
      ok('「ためす」は初期値の上に続きの変数をかさね、無い id にはエラーを返します');
    }
  }

  // ---- 4c. 書き出す形（ghost.json）を、画面と exe で同じに作るか -----------------
  {
    const { programOf } = await host.yayaTranslator();
    const fx = path.join(host.root, 'studio', 'test');
    let sameForm = 0;
    const forms = [['ghost.json', 'program.json'], ['en.json', 'en-program.json']];
    for (const [fixture, expected] of forms) {
      checks++;
      const raw = fs.readFileSync(path.join(fx, 'expected', expected), 'utf8');
      const want = JSON.stringify(JSON.parse(raw.slice(raw.indexOf('{'))));
      const got = JSON.stringify(programOf(readJson(path.join(fx, 'fixture', fixture))));
      if (got === want) sameForm++;
      else fails.push(`programOf(${fixture}) が、exe の書き出し（studio\\test\\expected\\${expected}）とちがいます`);
    }
    if (sameForm === forms.length) ok('画面で作る書き出しの形が、exe の書き出しと同じです', `${forms.length} 件`);
  }

  // ---- 4d. exe が書き出したゴーストが、そのまま YAYA で動くか ---------------------
  // export_host.exe（exe と同じ書き出し）で書き出したフォルダの ghost/master を、そのまま YAYA で動かし、
  // 同じプロジェクトを訳して動かしたものと同じ答えになるかを見ます
  {
    const exportHost = path.join(host.root, 'studio', 'test', 'export_host.exe');
    const fixture = path.join(host.root, 'studio', 'test', 'fixture', 'ghost.json');
    const project = readJson(fixture);
    const { toYaya, programOf } = await host.yayaTranslator();
    const dir = path.join(__dirname, 'work', 'export');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const dicFile = path.join(dir, 'studio_program.dic.in');
    fs.writeFileSync(dicFile, toYaya(programOf(project)));
    require('child_process').execFileSync(exportHost, [fixture, '--write', dir, '--dic', dicFile]);
    const master = path.join(dir, 'ghost', 'master');
    const events = [...new Set(programOf(project).scripts.filter((s) => s.kind === 'event').map((s) => s.event))];
    const specs = ['OnBoot', ...events.filter((e) => e !== 'OnBoot' && e !== 'OnSecondChange'), 'OnClose'];
    const exported = host.runYaya(master, specs);
    const direct = await host.runYayaProgram('export-direct', programOf(project), specs);
    checks++;
    // 材料にはランダムなブロックもあるので、答えの中身ではなく「答えたか（200 か 204 か）」をくらべ、
    // 辞書そのものはバイトで見くらべます
    const diff = specs.filter((s, i) => (exported[i] || {}).status !== (direct[i] || {}).status);
    const descript = fs.readFileSync(path.join(master, 'descript.txt'), 'utf8');
    const sameDic = fs.readFileSync(path.join(master, 'studio_program.dic'), 'utf8') === fs.readFileSync(dicFile, 'utf8');
    if (diff.length || !sameDic || !/^shiori,yaya\.dll$/m.test(descript) || !(exported[0] || {}).value) {
      fails.push(`書き出したゴーストを YAYA で動かした答えがちがいます: ${diff.join(' ') || '（辞書・descript.txt か OnBoot）'}`);
    } else {
      ok('exe が書き出したゴーストが、そのまま YAYA で動きます', `${specs.length} イベント`);
    }
  }

  // ---- 4e. 手書きの YAYA ゴーストにつなぐ（段階 3-5b） --------------------------
  // handwritten/ は YAYA のテンプレートで作ったような手書きのゴースト（辞書は Shift_JIS）。
  // project.json をそこにつないで書き出しても、手書きのファイルがバイトのまま変わらないこと、
  // 同じイベントは手書きが優先され、手書きから Studio.Event をよべばブロックも動くことを見ます
  {
    const exportHost = path.join(host.root, 'studio', 'test', 'export_host.exe');
    const { execFileSync } = require('child_process');
    const { toYaya, programOf } = await host.yayaTranslator();
    const src = path.join(__dirname, 'handwritten');
    const make = (name) => {
      const dir = path.join(__dirname, 'work', name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.cpSync(src, dir, { recursive: true });
      fs.rmSync(path.join(dir, 'project.json'));
      const master = path.join(dir, 'ghost', 'master');
      fs.copyFileSync(host.yayaDll, path.join(master, 'yaya.dll'));
      fs.cpSync(path.join(host.root, 'third_party', 'yaya-dic', 'yaya_base'), path.join(master, 'yaya_base'), { recursive: true });
      return { dir, master };
    };
    const run = (args) => {
      try {
        return { code: 0, out: execFileSync(exportHost, args, { encoding: 'utf8' }) };
      } catch (e) {
        return { code: e.status, out: String(e.stdout || '') };
      }
    };
    const hashes = (master) => {
      const out = {};
      const walk = (d, rel) => {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          const r = rel ? `${rel}/${ent.name}` : ent.name;
          if (ent.isDirectory()) walk(path.join(d, ent.name), r);
          else out[r] = crypto.createHash('sha256').update(fs.readFileSync(path.join(d, ent.name))).digest('hex');
        }
      };
      walk(master, '');
      return out;
    };

    const { dir, master } = make('hand');
    const before = hashes(master);
    const txtBefore = fs.readFileSync(path.join(master, 'yaya.txt'));
    const inspect = run(['--inspect', dir]).out;
    const functions = [...inspect.matchAll(/^function: (.+)$/gm)].map((m) => m[1].trim());
    checks++;
    const wantFns = ['OnBoot', 'OnHandDelegate', 'Hand.Helper', 'OnHandOnly', 'Hand.Greet'];
    if (functions.join(' ') !== wantFns.join(' ') || /^problem:/m.test(inspect) || !/^dic: hand\.dic\r?$/m.test(inspect)) {
      fails.push(`手書きのゴーストを調べた結果がちがいます\n      ${inspect.replace(/\r?\n/g, '\n      ')}`);
    }

    const project = readJson(path.join(src, 'project.json'));
    const dicFile = path.join(dir, 'studio_program.dic.in');
    fs.writeFileSync(dicFile, toYaya(programOf(project), { handwritten: functions }));
    const first = run(['--linked', dir, '--dic', dicFile]);
    const second = run(['--linked', dir, '--dic', dicFile]);
    const after = hashes(master);
    checks++;
    const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
    const txtAfter = fs.readFileSync(path.join(master, 'yaya.txt'));
    const block = txtAfter.slice(txtBefore.length).toString('utf8');
    if (first.code !== 0 || second.code !== 0 || changed.join(' ') !== 'yaya.txt'
        || !txtAfter.slice(0, txtBefore.length).equals(txtBefore)
        || (block.match(/ukagaka-studio: begin/g) || []).length !== 1
        || !/^dic, studio_program\.dic, UTF-8\r$/m.test(block) || /written: yaya\.txt/.test(second.out)) {
      fails.push(`つないだゴーストへの書き出しで、手書きのファイルが変わったか、yaya.txt の印の行がおかしい\n      変わったもの: ${changed.join(' ')}\n      1 回目: ${first.out.trim()}\n      2 回目: ${second.out.trim()}`);
    } else {
      ok('つないだ手書きのゴーストに書き出しても、手書きのファイルはバイトのままです', 'yaya.txt は印の行を足すだけ');
    }

    const got = host.runYaya(master, ['OnBoot', 'OnMouseDoubleClick:0,0,0,0,Head', 'OnHandDelegate', 'OnHandOnly',
      'OnBlockCallsHand'], true);
    // 最後は、ブロックが手書きの関数をよび（YAYA の関数をよぶ）、YAYA の式の値をしゃべる（無い関数は何もしない）
    const want = ['\\0\\s[0]手書きのOnBootです。\\e', '\\0ブロックのダブルクリック\\e',
      '\\0手書き：\\0ブロックの返事\\e', '\\0手書きだけのイベント\\e', '\\0てがきさん、こんにちは\\142\\e'];
    checks++;
    const vals = got.map((g) => g.value);
    if (vals.join(' | ') !== want.join(' | ')) {
      fails.push(`つないだゴーストの答え\n      出た  : ${vals.join(' | ')}\n      ほしい: ${want.join(' | ')}`);
    } else {
      ok('同じイベントは手書きが優先され、手書きから Studio.Event をよぶとブロックも動きます');
      ok('ブロックから手書きの関数と YAYA の式を使えます', '無い関数は何もしない');
    }

    // 書き出す前に止めるもの
    const cases = [
      ['印の無い studio_program.dic', (m) => fs.writeFileSync(path.join(m, 'studio_program.dic'), '// 人が書いた辞書\r\n'), 'not_studio_file'],
      ['yaya_base が無い', (m) => fs.rmSync(path.join(m, 'yaya_base'), { recursive: true }), 'yaya_base_missing'],
      ['古い yaya.dll', (m) => fs.writeFileSync(path.join(m, 'yaya.dll'), 'MZ old'), 'yaya_dll_old'],
    ];
    let stopped = 0;
    for (const [label, spoil, code] of cases) {
      checks++;
      const c = make('hand-ng');
      spoil(c.master);
      const keep = hashes(c.master);
      const r = run(['--linked', c.dir, '--dic', dicFile]);
      const same = JSON.stringify(hashes(c.master)) === JSON.stringify(keep);
      if (r.code === 0 || !r.out.includes(`error: ${code}`) || !same) {
        fails.push(`「${label}」のときに書き出しを止めませんでした（${r.out.trim()}）`);
      } else {
        stopped++;
      }
    }
    if (stopped === cases.length) ok('スタジオが動けない手書きのゴーストには、書き出す前に止めます', `${cases.length} 通り`);
  }

  // ---- 6. 保存して、次の起動に残るか -------------------------------------------
  const counter = {
    format: 'ikaga/1',
    meta: { name: '保存テスト' },
    settings: { randomTalkEnabled: false },
    variables: [{ name: '回数', value: 0 }],
    scripts: [{
      id: 'c', kind: 'event', event: 'OnCount',
      blocks: [
        { type: 'change', name: '回数', value: 1 },
        { type: 'say', who: 0, nl: 0, text: { type: 'join', a: { type: 'var', name: '回数' },
          b: { type: 'join', a: '/', b: { type: 'sys', key: 'boots' } } } },
      ],
    }],
  };
  const first = await host.runYayaProgram('save', counter, ['OnBoot', 'OnCount']);
  const logFile = path.join(__dirname, 'work', 'save', 'studio_debug.txt');
  checks++;
  if (fs.existsSync(logFile)) fails.push('studio_debug.txt が無いのに、記録が作られました');
  fs.writeFileSync(logFile, '');            // 伺かスタジオの「記録をはじめる」と同じ（空のファイルを置く）
  const second = await host.runYayaProgram('save', counter, ['OnBoot', 'OnCount'], true);
  checks++;
  const log = fs.readFileSync(logFile, 'utf8');
  if (!/^\[\d\d:\d\d:\d\d\] loaded（かたまり 1 こ）\r?$/m.test(log)) {
    fails.push(`記録（studio_debug.txt）に、読みこんだことが書かれていません:\n      ${JSON.stringify(log.slice(0, 200))}`);
  } else {
    ok('記録は studio_debug.txt があるときだけ書かれます');
  }
  expect('はじめての起動（回数/起動回数）', (first[1] || {}).value, '\\01/1\\e');
  expect('起動しなおしても、変数と起動回数が残る', (second[1] || {}).value, '\\02/2\\e');
  if ((second[1] || {}).value === '\\02/2\\e') ok('変数と起動回数が、次の起動に残ります');

  // ---- 表示 --------------------------------------------------------------------
  console.log('');
  if (fails.length) {
    for (const f of fails) console.log(`${red}  NG  ${off}${f}`);
    console.log(`${red}[yaya] ${fails.length} か所が期待とちがいます。${off}`);
    process.exit(1);
  }
  console.log(`${green}[yaya] ${checks} か所すべて期待どおりです。${off}`);
}

main().catch((e) => {
  console.error(`${red}[yaya] ${e.stack || e.message}${off}`);
  process.exit(2);
});
