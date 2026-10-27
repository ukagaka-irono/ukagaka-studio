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
 *   5. ブロックとかたまりのメモ（// のコメントになる）が、動きを変えないか
 *   6. ブロックの変数と起動回数が、YAYA の保存（yaya_variable.cfg）で次の起動に残るか。記録（studio_debug.txt）
 *   7. 記念日とアラームが、いまの時刻で動き、記念日は同じ日に 2 回動かないか（起動しなおしても）
 *   8. ランダムトークの時間帯・季節のしぼり込みが、いまの時刻で効くか
 *   9. 続きものが、起動するたびに 1 話ずつ進み、おわったら はじめから／もう話さない になるか
 *  10. 「100 回引く」（draw:回数）が、えらばれやすさ・しぼり込み・続けて出さない決まりのとおりに数えるか
 *  11. 辞書を読んで整えて書いたもの（ui/js/model/yayatext.js）が、もとの辞書と同じに動くか（yaya_base・しくみの辞書・訳した辞書）
 *  12. プロジェクトの YAYA の辞書を exe で書き出したゴーストが動き、辞書のイベントが先・ブロックから辞書の関数をよべるか
 *  13. いまある YAYA ゴーストの辞書を読みこむとき、yaya.txt の辞書（dicdir の中も）を UTF-8 にして読み、yaya_base とスタジオのファイルは読まないか
 *  14. 「ためす」でプロジェクトの辞書の関数を動かせるか（call:。イベントの情報は reference に入る）。ブロックのかたまりも、いっしょに動くか
 *  15. セリフに「:chain=」という文字があっても、答えがそのまま届くか（yaya_base の印として読まれず、= は全角の ＝ になる）
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

  // ---- 4b. 「ためす」で立ち絵をさわったとき（event:イベント名 は SSP と同じえらびかた） ------
  {
    const touch = {
      format: 'ikaga/1', meta: { name: 'さわる' },
      scripts: [
        { id: 'a', kind: 'event', event: 'OnMouseDoubleClick', blocks: [{ type: 'say', who: 0, text: 'どこか', nl: 0 }] },
        { id: 'b', kind: 'event', event: 'OnMouseDoubleClick', filter: { area: 'Head', who: 0 },
          blocks: [{ type: 'say', who: 0, text: 'あたま', nl: 0 }] },
      ],
    };
    const r = (refs) => host.runYayaPreview('touch', touch, 'event:OnMouseDoubleClick', { refs });
    const head = await r(['10', '20', '0', '0', 'Head', '0']);
    const face = await r(['10', '20', '0', '0', 'Face', '0']);
    const none = await host.runYayaPreview('touch', touch, 'event:OnMouseClick', { refs: ['1', '1', '0', '0', '', '0'] });
    checks++;
    if (head.script !== '\\0あたま\\e' || face.script !== '\\0どこか\\e' || none.error || typeof none.script !== 'string') {
      fails.push(`「ためす」で立ち絵をさわったとき\n      Head → ${head.script} / Face → ${face.script} / ブロックの無いイベント → ${JSON.stringify(none)}`);
    } else {
      ok('「ためす」で立ち絵をさわると、しぼり込みをふくめて SSP と同じえらびかたで動きます');
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

  // ---- 5. メモは動きを変えないか -----------------------------------------------
  // 一致テストのゴーストの、すべてのかたまりとブロックにメモを付けて、付けないときと同じ答えになるかを見ます。
  // メモは // のコメントとして訳されるので、行の終わりの / （YAYA のふつうの行なら「つぎの行につづく」）や
  // #globaldefine の名前・*/ が入っていても、つぎの行のブロックをのみこまないことを確かめます。
  {
    const { toYaya, programOf } = await host.yayaTranslator();
    const raw = readJson(path.join(PARITY, 'ghost.json'));   // refs（イベントの情報）は raw のほうにだけあります
    const plain = programOf(raw);
    const noted = JSON.parse(JSON.stringify(plain));
    const NOTE = 'メモ /\n  TALK_INTERVAL のあと */ /* も /\n\n3 行目 //';
    let count = 0;
    (function walk(v) {
      if (Array.isArray(v)) {
        for (const x of v) {
          if (x && typeof x === 'object' && !Array.isArray(x) && typeof x.type === 'string') { x.note = NOTE; count++; }
          walk(x);
        }
        return;
      }
      if (v && typeof v === 'object') for (const k in v) walk(v[k]);
    })(noted.scripts.map((s) => s.blocks));
    for (const s of noted.scripts) s.note = NOTE;
    const cases = raw.scripts.filter((s) => /^OnP\d+$/.test(s.event || '') && s.event !== 'OnP25');   // OnP25 は時計で変わる
    const specs = cases.map((s) => (s.refs && s.refs.length ? `${s.event}:${s.refs.join(',')}` : s.event));
    const a = await host.runYayaProgram('notes-plain', plain, specs);
    const b = await host.runYayaProgram('notes', noted, specs);
    const dic = toYaya(noted);
    checks++;
    const diff = cases.filter((s, i) => JSON.stringify(a[i]) !== JSON.stringify(b[i])).map((s) => s.event);
    if (a.length !== cases.length || b.length !== cases.length || diff.length) {
      fails.push(`メモを付けると答えが変わりました: ${diff.join(', ') || `${a.length} / ${b.length} 件`}（shiori\\test\\yaya\\work\\notes\\）`);
    } else if (!dic.includes('\n// メモ: メモ /\r') || !dic.includes('\t// メモ: 3 行目 //\r')) {
      fails.push('メモが、訳した辞書に // のコメントとして入っていません');
    } else {
      ok('メモは YAYA のコメントになり、動きを変えません', `${count} ブロック・${cases.length} 件`);
    }
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

  // ---- 7. 記念日とアラーム（段階 5-9） --------------------------------------------
  // YAYA の GETTIME は PC の時計なので、いまの時刻からゴーストを作る。分がまたいでもよいように、
  // アラームは「いまの分」と「次の分」の 2 つ（どちらも同じセリフ）
  {
    const now = new Date();
    const next = new Date(now.getTime() + 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const say = (text) => [{ type: 'say', who: 0, nl: 0, text }];
    const timed = {
      format: 'ikaga/1',
      meta: { name: '時刻テスト' },
      settings: { randomTalkEnabled: false },
      variables: [],
      scripts: [
        { id: 'al1', kind: 'event', event: 'OnStudioAlarm', when: `${pad(now.getHours())}:${pad(now.getMinutes())}`, blocks: say('アラーム') },
        { id: 'al2', kind: 'event', event: 'OnStudioAlarm', when: `${pad(next.getHours())}:${pad(next.getMinutes())}`, blocks: say('アラーム') },
        { id: 'an', kind: 'event', event: 'OnStudioAnniversary', when: `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, blocks: say('記念日') },
        { id: 'off', kind: 'event', event: 'OnStudioAnniversary', when: `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
          disabled: true, blocks: say('でない') },
      ],
    };
    const tick = 'OnSecondChange:0,1,0,1';
    const a = await host.runYayaProgram('timed', timed, [tick, tick]);
    const b = await host.runYayaProgram('timed', timed, [tick], true);
    expect('記念日とアラームが、分が変わったときに動く', (a[0] || {}).value, '\\0記念日\\0アラーム\\e');
    expect('同じ分のうちは、もう動かない', (a[1] || {}).status, '204 No Content');
    expect('起動しなおしても、同じ日の記念日は動かない（アラームは動く）', (b[0] || {}).value, '\\0アラーム\\e');
    if ((a[0] || {}).value === '\\0記念日\\0アラーム\\e' && (b[0] || {}).value === '\\0アラーム\\e') {
      ok('記念日とアラームが動き、記念日は 1 日 1 回です');
    }
  }

  // ---- 8. ランダムトークの時間帯・季節（段階 6-1） ------------------------------------
  // いまの時間帯・季節のトークと、ちがう時間帯・季節のトーク。いまのものだけが出るはず
  {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMonth() + 1;
    const part = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night';
    const season = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
    const otherPart = part === 'morning' ? 'night' : 'morning';
    const otherSeason = season === 'spring' ? 'autumn' : 'spring';
    const say = (text) => [{ type: 'say', who: 0, nl: 0, text }];
    const talks = {
      format: 'ikaga/1',
      meta: { name: '時間帯テスト' },
      settings: { randomTalkEnabled: true, randomTalkInterval: 1, noRepeatCount: 0 },
      variables: [],
      scripts: [
        { id: 'p1', kind: 'talk', name: 'いま', weight: 1, when: part, blocks: say('いま') },
        { id: 'p2', kind: 'talk', name: 'ちがう時間帯', weight: 1, when: otherPart, blocks: say('ちがう') },
        { id: 's1', kind: 'talk', name: 'いまの季節', weight: 1, when: season, blocks: say('いま') },
        { id: 's2', kind: 'talk', name: 'ちがう季節', weight: 1, when: otherSeason, blocks: say('ちがう') },
      ],
    };
    const got = await host.runYayaProgram('talkwhen', talks, ['OnSecondChange:0,1', 'OnSecondChange:0,1', 'OnSecondChange:0,1', 'OnSecondChange:0,1']);
    const values = got.map((r) => r.value);
    expect('いまの時間帯・季節のトークだけが出る', JSON.stringify(values), JSON.stringify(['\\0いま\\e', '\\0いま\\e', '\\0いま\\e', '\\0いま\\e']));
    if (values.every((v) => v === '\\0いま\\e')) ok('ランダムトークの時間帯・季節のしぼり込みが効きます', `${part} / ${season}`);
  }

  // ---- 9. 続きもの（段階 6-2） --------------------------------------------------
  {
    const say = (text) => [{ type: 'say', who: 0, nl: 0, text }];
    const serial = (end) => ({
      format: 'ikaga/1',
      meta: { name: '続きものテスト' },
      settings: { randomTalkEnabled: false },
      variables: [],
      scripts: [{ id: 'e', kind: 'event', event: 'OnTalk', blocks: [
        { type: 'serial', name: 'はなし', end, episodes: [say('1'), say('2'), say('3')] },
      ] }],
    });
    // 起動ごとに 1 回ずつ（はじめの起動だけ 2 回よんで、同じ起動のうちは進まないことも見る）
    const run = async (end) => {
      const seen = [];
      for (let boot = 0; boot < 5; boot++) {
        const steps = boot === 0 ? ['OnBoot', 'OnTalk', 'OnTalk'] : ['OnBoot', 'OnTalk'];
        const got = await host.runYayaProgram(`serial-${end}`, serial(end), steps, boot > 0);
        seen.push(...got.slice(1).map((r) => (r.status.startsWith('204') ? '-' : r.value.replace(/\\[0e]/g, ''))));
      }
      return seen.join(' ');
    };
    const loop = await run('loop');
    const stop = await run('stop');
    expect('続きもの（はじめから）', loop, '1 1 2 3 1 2');
    expect('続きもの（もう話さない）', stop, '1 1 2 3 - -');
    if (loop === '1 1 2 3 1 2' && stop === '1 1 2 3 - -') ok('続きものが起動ごとに 1 話ずつ進み、おわったあとも決めたとおりです');
  }

  // ---- 10. 「100 回引く」（段階 7-5） ---------------------------------------------
  // 続けて出さない数が 1 なので、えらばれやすさ 3 と 1 でも「あ」「い」が交互に出る。重み 0 と、条件に合わないものは出ない
  {
    const say = (text) => [{ type: 'say', who: 0, nl: 0, text }];
    const draw = {
      format: 'ikaga/1',
      meta: { name: '引くテスト' },
      settings: { randomTalkEnabled: true, randomTalkInterval: 180, noRepeatCount: 1 },
      variables: [{ name: 'x', value: 0 }],
      scripts: [
        { id: 'a', kind: 'talk', name: 'あ', weight: 3, blocks: say('あ') },
        { id: 'i', kind: 'talk', name: 'い', weight: 1, blocks: say('い') },
        { id: 'zero', kind: 'talk', name: 'ゼロ', weight: 0, blocks: say('ゼロ') },
        { id: 'cond', kind: 'talk', name: '条件', weight: 5,
          cond: { type: 'compare', op: '>', a: { type: 'var', name: 'x' }, b: 5 }, blocks: say('条件') },
      ],
    };
    const r = await host.runYayaPreview('draw', draw, 'draw:400', {});
    const got = JSON.stringify([r.draws && r.draws.a, r.draws && r.draws.i, r.draws && r.draws.zero, r.draws && r.draws.cond, r.none]);
    expect('100 回引く（交互・重み 0 と条件に合わないものは出ない）', got, JSON.stringify([200, 200, undefined, undefined, 0]));
    // 変数を「ためす」の続きで渡すと、条件に合うものも出る
    const r2 = await host.runYayaPreview('draw', draw, 'draw:10', { vars: { x: 10 } });
    expect('いまの変数で条件を見る', (r2.draws && r2.draws.cond) > 0, true);
    if (got === JSON.stringify([200, 200, undefined, undefined, 0]) && r2.draws && r2.draws.cond > 0) {
      ok('「100 回引く」が、SSP と同じえらびかたで数えます');
    }
  }

  // ---- 11. 整えて書いた辞書が、もとの辞書と同じに動くか（段階 8-1） ------------------
  // 一致テストのゴーストを、もとの辞書と、読んで整えて書きなおした辞書（yaya_base もしくみの辞書も訳した辞書も）の両方で動かし、
  // 答えが 1 つ残らず同じかを見ます。書きなおすと字下げや空白は変わりますが、動きは変わらないはずです
  {
    const { parseYaya, printYaya } = require(path.join(host.root, 'ui', 'js', 'model', 'yayatext.js'));
    const { toYaya, yayaTxt } = await host.yayaTranslator();
    const printed = (text) => printYaya(parseYaya(text).dic).replace(/\n/g, '\r\n');
    const program = readJson(path.join(PARITY, 'ghost.json'));
    const cases = program.scripts.filter((s) => s.kind === 'event' && /^OnP\d+$/.test(s.event || ''));
    const specs = cases.map((s) => (s.refs && s.refs.length ? `${s.event}:${s.refs.join(',')}` : s.event));
    const orig = await host.runYayaProgram('printed-orig', program, specs);

    const dir = path.join(__dirname, 'work', 'printed');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const base = path.join(host.root, 'third_party', 'yaya-dic', 'yaya_base');
    const pbase = path.join(dir, 'yaya_base_printed');
    fs.cpSync(base, pbase, { recursive: true });
    let dics = 0;
    for (const f of fs.readdirSync(pbase).filter((x) => x.endsWith('.dic'))) {
      fs.writeFileSync(path.join(pbase, f), printed(fs.readFileSync(path.join(base, f), 'utf8')));
      dics++;
    }
    fs.writeFileSync(path.join(dir, 'yaya.txt'), yayaTxt().replace('dicdir, yaya_base', 'dicdir, yaya_base_printed'));
    fs.writeFileSync(path.join(dir, 'studio_runtime.dic'),
      printed(fs.readFileSync(path.join(host.root, 'studio', 'res', 'yaya', 'studio_runtime.dic'), 'utf8')));
    fs.writeFileSync(path.join(dir, 'studio_program.dic'), printed(toYaya(program)));
    const saori = path.join(host.root, 'shiori', 'dist', 'slow_saori.dll');
    if (fs.existsSync(saori)) fs.copyFileSync(saori, path.join(dir, 'slow_saori.dll'));
    const got = host.runYaya(dir, specs);

    const same = cases.filter((s, i) => got[i] && orig[i] && got[i].value === orig[i].value && got[i].commTo === orig[i].commTo).length;
    const diff = cases.map((s, i) => (got[i] && orig[i] && got[i].value === orig[i].value ? null : s.event)).filter(Boolean);
    expect(`整えて書いた辞書（yaya_base ${dics} こ・しくみ・訳した辞書）で、一致テストの答えが同じ（ちがったもの: ${diff.join(', ') || 'なし'}）`,
      same, cases.length);
    if (same === cases.length) ok('整えて書きなおした辞書も、もとの辞書と同じに動きます', `${cases.length} 件`);
  }

  // ---- 12. プロジェクトの YAYA の辞書（段階 8-2） -----------------------------------
  // exe と同じ書き出し（export_host.exe）で書き出して、そのまま YAYA で動かす。辞書の関数は「手書き」として訳す（書き出しの画面と同じ）
  {
    const { dicFunctionNames } = require(path.join(host.root, 'ui', 'js', 'model', 'dics.js'));
    const { toYaya, programOf } = await host.yayaTranslator();
    const exportHost = path.join(host.root, 'studio', 'test', 'export_host.exe');
    const fixture = path.join(host.root, 'studio', 'test', 'fixture', 'dics.json');
    const project = readJson(fixture);
    const dir = path.join(__dirname, 'work', 'dics');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const dicFile = path.join(dir, 'studio_program.dic.in');
    fs.writeFileSync(dicFile, toYaya(programOf(project), { handwritten: dicFunctionNames(project) }));
    require('child_process').execFileSync(exportHost, [fixture, '--write', dir, '--dic', dicFile]);
    const master = path.join(dir, 'ghost', 'master');
    const got = host.runYaya(master, ['OnBoot', 'OnCallDic']);
    expect('辞書の OnBoot が、ブロックの OnBoot より先に動く', (got[0] || {}).value, '\\0辞書の起動\\e');
    // 「YAYA の関数をよぶ」は、関数の答えをそのまま出す（\0 は付けない）
    expect('ブロックから、辞書の関数をよべる', (got[1] || {}).value, 'やあ\\e');
    // Windows はファイル名の大文字小文字を区別しないので、Talk.DIC は中身で見る（talk.dic のほうが入っていること）
    expect('使えない名前の辞書は書き出さない（フォルダの外・スタジオのファイル・大文字小文字だけちがう 2 つめ）',
      [fs.existsSync(path.join(dir, 'ghost', 'evil.dic')), fs.existsSync(path.join(master, 'evil.dic')),
        fs.readFileSync(path.join(master, 'studio_runtime.dic'), 'utf8').includes('Evil2'),
        fs.readFileSync(path.join(master, 'talk.dic'), 'utf8').includes('Evil3')].join(','), 'false,false,false,false');
    if ((got[0] || {}).value === '\\0辞書の起動\\e' && (got[1] || {}).value === 'やあ\\e') {
      ok('プロジェクトの辞書を書き出したゴーストが動き、辞書のイベントが先・ブロックから辞書の関数をよべます');
    }
  }

  // ---- 13. いまある YAYA ゴーストの辞書を読みこむ（段階 8-6） ---------------------------
  {
    const exportHost = path.join(host.root, 'studio', 'test', 'export_host.exe');
    const dir = path.join(__dirname, 'work', 'import');
    const master = path.join(dir, 'ghost', 'master');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(master, 'dic'), { recursive: true });
    fs.writeFileSync(path.join(master, 'descript.txt'), 'charset,UTF-8\r\ntype,ghost\r\nname,よみこみ\r\n');
    // ゴーストの外を指す行（.. のファイルとフォルダ）と、同じ辞書をもう一度書いた行は読まない
    fs.writeFileSync(path.join(dir, '..', 'outside.txt'), 'Outside\n{\n\t"外"\n}\n');
    fs.mkdirSync(path.join(dir, '..', 'outside-dir'), { recursive: true });
    fs.writeFileSync(path.join(dir, '..', 'outside-dir', 'out.dic'), 'OutDir\n{\n\t"外"\n}\n');
    fs.writeFileSync(path.join(master, 'yaya.txt'),
      'dic, yaya_base/shiori3.dic\r\ndic, aya_talk.dic\r\ndicdir, dic\r\ndic, studio_runtime.dic\r\n' +
      'dic, ..\\..\\..\\outside.txt\r\ndicdir, ..\\..\\..\\outside-dir\r\ndic, AYA_TALK.dic\r\ndic, dic/../aya_talk.dic\r\n');
    // Shift_JIS・CRLF の辞書（「こんにちは」）と、BOM つき UTF-8 の辞書
    const sjis = Buffer.from([0x82, 0xB1, 0x82, 0xF1, 0x82, 0xC9, 0x82, 0xBF, 0x82, 0xCD]);
    fs.writeFileSync(path.join(master, 'aya_talk.dic'),
      Buffer.concat([Buffer.from('OnBoot\r\n{\r\n\t"'), sjis, Buffer.from('"\r\n}\r\n')]));
    fs.writeFileSync(path.join(master, 'dic', 'sub.dic'), '﻿Sub\n{\n\t"さぶ"\n}\n');
    fs.writeFileSync(path.join(master, 'studio_runtime.dic'), '// ukagaka-studio: generated\n');
    const out = require('child_process').execFileSync(exportHost, ['--dics', dir], { encoding: 'utf8' });
    expect('ゴーストの辞書を読みこむ（Shift_JIS も UTF-8 に・改行は LF・dicdir の中も・yaya_base とスタジオのファイル、ゴーストの外、同じ辞書の 2 回めは読まない）', out,
      '== aya_talk.dic\nOnBoot\n{\n\t"こんにちは"\n}\n== dic/sub.dic\nSub\n{\n\t"さぶ"\n}\n');
    if (out.startsWith('== aya_talk.dic')) ok('いまある YAYA ゴーストの辞書を、UTF-8 にして読みこめます');
  }

  // ---- 14. 「ためす」で辞書の関数を動かす（段階 8-7） ------------------------------------
  {
    const dics = [{ name: 'try.dic', text: 'OnBoot\n{\n\t"\\0辞書の起動\\e"\n}\nGreet\n{\n\t"\\0" + reference[0] + "/" + reference0 + "\\e"\n}\n' }];
    const boot = await host.runYayaPreview('preview-dic', program, 'call:OnBoot', {}, dics);
    const greet = await host.runYayaPreview('preview-dic', program, 'call:Greet', { refs: ['abc'] }, dics);
    const none = await host.runYayaPreview('preview-dic', program, 'call:Nope', {}, dics);
    const block = await host.runYayaPreview('preview-dic', program, 'p06', { vars: { 'あたい': 100 } }, dics);
    expect('「ためす」で辞書の OnBoot を動かす', boot.script, '\\0辞書の起動\\e');
    expect('辞書の関数は、イベントの情報を reference[0] と reference0 で読める', greet.script, '\\0abc/abc\\e');
    expect('無い関数はエラー', none.error, 'function_not_found');
    expect('辞書があっても、ブロックのかたまりは動く', block.vars && block.vars['初期値つき'], 7);
    if (boot.script === '\\0辞書の起動\\e' && greet.script === '\\0abc/abc\\e') ok('「ためす」で、プロジェクトの辞書の関数を動かせます');
  }

  // ---- 15. セリフの中の「:chain=」 -----------------------------------------------
  {
    const mark = {
      format: 'ikaga/1', meta: { name: '印のテスト' }, settings: { randomTalkEnabled: false }, variables: [],
      scripts: [{ id: 'm1', kind: 'event', event: 'OnTalk', blocks: [{ type: 'say', who: 0, nl: 0, text: 'a:chain=b' }] }],
    };
    const ran = await host.runYayaProgram('chain-mark', mark, ['OnBoot', 'OnTalk']);
    const tried = await host.runYayaPreview('chain-mark-try', mark, 'm1', {});
    expect('SSP に返す答えでは、= が全角になって、そのまま届く', (ran[1] || {}).value, '\\0a:chain\uff1db\\e');
    expect('「ためす」の答えも、そのまま届く', tried.script, '\\0a:chain\uff1db\\e');
    if ((ran[1] || {}).value === '\\0a:chain\uff1db\\e' && tried.script === '\\0a:chain\uff1db\\e') {
      ok('セリフに「:chain=」があっても、答えがそのまま届きます');
    }
  }

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
