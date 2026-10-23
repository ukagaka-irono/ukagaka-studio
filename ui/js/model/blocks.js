/* 伺かスタジオ - ブロック定義
 * ここで定義した形が、そのまま ghost.json（栞が読むファイル）の形になります。
 */

import { t } from '../i18n/i18n.js';

// ------------------------------------------------------------ categories
// 色は ui/style.css の --cat-<id> にあります（明るい表示でも暗い表示でも同じ色）。
export const CATEGORIES = [
  { id: 'events',    name: t('イベント') },
  { id: 'talk',      name: t('セリフ') },
  { id: 'looks',     name: t('見た目') },
  { id: 'control',   name: t('制御') },
  { id: 'variables', name: t('変数') },
  { id: 'operators', name: t('演算') },
  { id: 'info',      name: t('情報') },
  { id: 'parts',     name: t('部品') },   // よく使う組みかた（editor/parts.js。どのプロジェクトからも使う）
];

// ランダムトークを出す時間帯・季節（studio_runtime.dic の Studio.TalkOk と同じ区切り）
export const TALK_WHEN = [
  [t('いつでも'), ''],
  [t('朝だけ（5〜10 時）'), 'morning'], [t('昼だけ（11〜16 時）'), 'afternoon'],
  [t('夕方だけ（17〜21 時）'), 'evening'], [t('夜だけ（22〜4 時）'), 'night'],
  [t('春だけ（3〜5 月）'), 'spring'], [t('夏だけ（6〜8 月）'), 'summer'],
  [t('秋だけ（9〜11 月）'), 'autumn'], [t('冬だけ（12〜2 月）'), 'winter'],
];

export const EVENTS = [
  [t('起動したとき'), 'OnBoot'],
  [t('はじめて起動したとき'), 'OnFirstBoot'],
  [t('決めた回数めの起動のとき'), 'OnStudioNthBoot'],
  [t('終了するとき'), 'OnClose'],
  [t('ダブルクリックされたとき'), 'OnMouseDoubleClick'],
  [t('クリックされたとき'), 'OnMouseClick'],
  [t('なでられたとき'), 'OnNadeNade'],
  [t('マウスが動いたとき'), 'OnMouseMove'],
  [t('ホイールを回されたとき'), 'OnMouseWheel'],
  [t('1時間ごと'), 'OnHourChange'],
  [t('1分ごと'), 'OnMinuteChange'],
  [t('毎日決めた時刻になったとき'), 'OnStudioAlarm'],
  [t('記念日になったとき'), 'OnStudioAnniversary'],
  [t('ずっとくりかえす'), 'OnSecondChange'],
  [t('選択肢がえらばれたとき'), 'OnChoiceSelect'],
  [t('話しかけられたとき'), 'OnCommunicate'],
  [t('SSP のメニューからえらばれたとき'), 'OnStudioMenu'],
  [t('他のゴーストから来たとき'), 'OnGhostChanged'],
  [t('他のゴーストへ行くとき'), 'OnGhostChanging'],
  [t('キーが押されたとき'), 'OnKeyPress'],
  [t('サーフェスがもどったとき'), 'OnSurfaceRestore'],
  [t('最小化されたとき'), 'OnWindowStateMinimize'],
  [t('最小化からもどったとき'), 'OnWindowStateRestore'],
  [t('更新をはじめたとき'), 'OnUpdateBegin'],
  [t('更新するものが見つかったとき'), 'OnUpdateReady'],
  [t('更新がおわったとき'), 'OnUpdateComplete'],
  [t('更新に失敗したとき'), 'OnUpdateFailure'],
  [t('SAORI の答えがとどいたとき'), 'OnSaoriDone'],
  [t('答えが返ってきたとき'), 'OnUserInput'],
  [t('答えをやめたとき'), 'OnUserInputCancel'],
  [t('その他（自分で書く）'), '__custom__'],
];

// マウス系＝「どこを・だれを」でしぼり込めるイベント
export const MOUSE_EVENTS = {
  OnMouseClick: 1, OnMouseDoubleClick: 1, OnMouseMove: 1,
  OnMouseWheel: 1, OnNadeNade: 1,
};

// 当たり判定の名前。仮シェルはこの名前で書き出しています。
export const AREAS = [
  [t('どこか'), ''], [t('あたま'), 'Head'], [t('かお'), 'Face'],
  [t('むね'), 'Bust'], [t('スカート'), 'Skirt'], [t('て'), 'Hand'],
];
export const WHO_ANY = [[t('どちらか'), -1], [t('さくら'), 0], [t('うにゅう'), 1]];

// Reference の意味（実行パネルのヒント用）
export const EVENT_REFS = {
  OnBoot: [t('シェル名')],
  OnFirstBoot: [t('消滅回数')],
  OnMouseDoubleClick: [t('X座標'), t('Y座標'), t('ホイール'), t('相手(0=本体/1=相方)'), t('当たった場所')],
  OnMouseClick: [t('X座標'), t('Y座標'), t('ホイール'), t('相手'), t('当たった場所'), t('ボタン')],
  OnMouseMove: [t('X座標'), t('Y座標'), t('ホイール'), t('相手'), t('当たった場所')],
  OnNadeNade: [t('X座標'), t('Y座標'), t('ホイール'), t('相手'), t('なでられた場所')],
  OnMouseWheel: [t('X座標'), t('Y座標'), t('回した量'), t('相手'), t('当たった場所')],
  OnSecondChange: [t('ウィンドウ'), t('しゃべってよいか'), t('累計秒数')],
  OnChoiceSelect: [t('えらばれたID')],
  OnKeyPress: [t('押されたキー')],
  OnGhostChanged: [t('前のゴースト名')],
  OnCommunicate: [t('相手の名前(通信ボックスなら user)'), t('言われたこと')],
  OnUpdateBegin: [t('ゴースト名'), t('フォルダの場所'), '', t('種類(ghost/shell/balloon…)')],
  OnUpdateReady: [t('更新するファイル数−1'), t('ファイル名(カンマ区切り)'), t('種類')],
  OnUpdateComplete: [t('none=変更なし / changed=更新した'), t('更新したファイル名'), '', t('種類')],
  OnUpdateFailure: [t('失敗したわけ(timeout など)'), t('できなかったファイル名'), '', t('種類')],
  'OnUpdate.OnDownloadBegin': [t('落としているファイル名'), t('何個目(0から)'), t('全部の数−1')],
  'OnUpdate.OnMD5CompareFailure': [t('ファイル名'), t('正しいMD5'), t('落ちてきたMD5')],
  OnSaoriDone: [t('よんだファイル名'), t('届いた答え')],
  OnUserInput: [t('たずねたときのID'), t('入力された内容')],
  OnUserInputCancel: [t('たずねたときのID'), t('close＝閉じた / timeout＝時間切れ')],
};

const WHO = [[t('さくら'), 0], [t('うにゅう'), 1]];
const YESNO_NL = [[t('改行する'), 1], [t('改行しない'), 0]];
const WEAR = [[t('着る'), 1], [t('ぬぐ'), 0]];

// --------------------------------------------------------------- helpers
const DEFS = {};
export const BLOCKS = DEFS;

function def(o) {
  DEFS[o.key || o.type] = o;
  o.key = o.key || o.type;
  o.parts = parseSpec(o.spec || '');
  return o;
}

// "%who が %text と話す" -> [{lbl}, {arg:'who'}, ...]
function parseSpec(spec) {
  const parts = [];
  let buf = '';
  for (let i = 0; i < spec.length; i++) {
    if (spec[i] === '%' && /[a-zA-Z_]/.test(spec[i + 1] || '')) {
      let j = i + 1;
      while (j < spec.length && /[a-zA-Z0-9_]/.test(spec[j])) j++;
      if (buf) { parts.push({ lbl: buf }); buf = ''; }
      parts.push({ arg: spec.slice(i + 1, j) });
      i = j - 1;
    } else {
      buf += spec[i];
    }
  }
  if (buf) parts.push({ lbl: buf });
  return parts;
}

/** 同じ type でも op ちがいで見た目が変わるブロック */
const OP_KEYED = { arith: 1, compare: 1, logic: 1 };
export const defKey = function (block) {
  if (!block || !block.type) return null;
  if (OP_KEYED[block.type] && block.op != null) return block.type + '#' + block.op;
  return block.type;
};
export const getDef = function (block) { return DEFS[defKey(block)] || null; };

export const createBlock = function (key) {
  const d = DEFS[key];
  if (!d) return null;
  const b = { type: d.type };
  if (d.fixed) Object.assign(b, d.fixed);
  for (const name in (d.args || {})) {
    const a = d.args[name];
    if (a.kind === 'sub') continue;
    b[name] = typeof a.def === 'function' ? a.def() : a.def;
  }
  for (const s of d.subs || []) b[s.key] = [];
  if (d.dynamic) b[d.dynamic] = [[], []];
  return b;
};

export const isReporter = function (block) {
  const d = getDef(block);
  return !!d && (d.shape === 'reporter' || d.shape === 'boolean');
};

// =========================================================== イベント(hat)
def({
  type: '@event', cat: 'events', shape: 'hat',
  spec: '%event',
  args: { event: { kind: 'eventname', def: 'OnBoot' } },
  hat: true, kind: 'event',
});
// マウス系イベントを選ぶと、この形に変わる（どこを・だれを、で絞り込める）
def({
  key: '@event.touch', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%who の %area が %event'),
  args: {
    who: { kind: 'dropdown', options: WHO_ANY, def: -1 },
    area: { kind: 'areaname', options: AREAS, def: '' },
    event: { kind: 'eventname', def: 'OnNadeNade' },
  },
  hat: true, kind: 'event',
});
// 「話しかけられたとき」を選ぶと、相手と内容でしぼり込める形に変わる
def({
  key: '@event.comm', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%from に %contains と %event'),
  args: {
    from: { kind: 'input', mode: 'text', def: '', long: true },
    contains: { kind: 'input', mode: 'text', def: '', long: true },
    event: { kind: 'eventname', def: 'OnCommunicate' },
  },
  hat: true, kind: 'event',
});
// 「SSP のメニューからえらばれたとき」を選ぶと、メニューに出す名前を入れる形に変わる。
// 書き出すと、SSP の右クリックメニュー（おすすめ）に、その名前の項目が出ます（model/yaya.js の On_sakura.recommendsites）
def({
  key: '@event.menu', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%menu を %event'),
  args: {
    menu: { kind: 'input', mode: 'text', def: t('あいさつ'), long: true },
    event: { kind: 'eventname', def: 'OnStudioMenu' },
  },
  hat: true, kind: 'event',
});
// 「毎日決めた時刻になったとき」（アラーム）と「記念日になったとき」を選ぶと、時刻・日づけを入れる形に変わる。
// 書き出すと when（'HH:MM' か 'MM-DD'）になり、studio_runtime.dic の Studio.RunTimed が、分が変わるたびに見ます
// 「決めた回数めの起動のとき」（段階 7-1）。その回数めの起動では、ふつうの「起動したとき」のかわりに動く
// （書き出すと when に回数が入り、studio_runtime.dic の Studio.RunNthBoot が見ます）
def({
  key: '@event.nthboot', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%event %nth 回目'),
  args: {
    event: { kind: 'eventname', def: 'OnStudioNthBoot' },
    nth: { kind: 'input', mode: 'number', def: 10 },
  },
  hat: true, kind: 'event',
});
// 「キーが押されたとき」を選ぶと、キーでしぼり込める形に変わる（段階 7-2）。キーは、キーに書いてある文字（a・f1 など。
// 大文字と小文字は区別しない）か、Windows の仮想キーコードの数（Esc なら 27）。空ならどのキーでも
def({
  key: '@event.key', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%event（キー %key）'),
  args: {
    event: { kind: 'eventname', def: 'OnKeyPress' },
    key: { kind: 'input', mode: 'text', def: 'f1' },
  },
  hat: true, kind: 'event',
});
def({
  key: '@event.alarm', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%event %hour 時 %minute 分'),
  args: {
    event: { kind: 'eventname', def: 'OnStudioAlarm' },
    hour: { kind: 'input', mode: 'number', def: 12 },
    minute: { kind: 'input', mode: 'number', def: 0 },
  },
  hat: true, kind: 'event',
});
def({
  key: '@event.anniv', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%event %month 月 %day 日'),
  args: {
    event: { kind: 'eventname', def: 'OnStudioAnniversary' },
    month: { kind: 'input', mode: 'number', def: 1 },
    day: { kind: 'input', mode: 'number', def: 1 },
  },
  hat: true, kind: 'event',
});
// 「ずっとくりかえす」を選ぶと、間隔を指定できる形に変わる
def({
  key: '@event.every', type: '@event', cat: 'events', shape: 'hat',
  spec: t('%event %everySec 秒ごと'),
  args: {
    event: { kind: 'eventname', def: 'OnSecondChange' },
    everySec: { kind: 'input', mode: 'number', def: 5 },
  },
  hat: true, kind: 'event',
});
def({
  type: '@talk', cat: 'events', shape: 'hat',
  spec: t('ランダムトーク「%name」 えらばれやすさ %weight まとまり %group %when もし %cond'),
  args: {
    name: { kind: 'input', mode: 'text', def: t('トーク'), long: true },
    weight: { kind: 'input', mode: 'number', def: 1 },
    group: { kind: 'input', mode: 'text', def: '', long: true },
    // しぼり込み（段階 6-1）。時間帯か季節のどれか 1 つと、条件のブロック（空ならいつでも）
    when: { kind: 'dropdown', options: TALK_WHEN, def: '' },
    cond: { kind: 'input', mode: 'bool' },
  },
  hat: true, kind: 'talk',
});
def({
  type: '@function', cat: 'events', shape: 'hat',
  spec: t('「%name」がよばれたとき'),
  args: { name: { kind: 'input', mode: 'text', def: t('あたらしいトーク'), long: true } },
  hat: true, kind: 'function',
});

// ============================================================== セリフ
def({
  type: 'say', cat: 'talk', shape: 'stack',
  spec: t('%who が %text と話す %nl'),
  args: {
    who: { kind: 'dropdown', options: WHO, def: 0 },
    // marks: 欄の横に「☺」を出し、{表情:1}・{待つ:500} の印を入れられるようにする（段階 7-3。訳すのは model/yaya.js）
    text: { kind: 'input', mode: 'text', def: t('こんにちは。'), long: true, marks: true },
    nl: { kind: 'dropdown', options: YESNO_NL, def: 1 },
  },
});
def({
  type: 'newline', cat: 'talk', shape: 'stack',
  spec: t('%count 回 改行する'),
  args: { count: { kind: 'input', mode: 'number', def: 1 } },
});
def({ type: 'click_wait', cat: 'talk', shape: 'stack', spec: t('クリックされるまで待つ') });
def({ type: 'clear', cat: 'talk', shape: 'stack', spec: t('バルーンの文字を消す') });
def({
  type: 'choice', cat: 'talk', shape: 'stack',
  spec: t('選択肢「%label」→ %target を出す'),
  args: {
    label: { kind: 'input', mode: 'text', def: t('うん'), long: true },
    target: { kind: 'funcname', def: '' },
  },
});
def({
  type: 'link', cat: 'talk', shape: 'stack',
  spec: t('リンク「%label」→ %url を出す'),
  args: {
    label: { kind: 'input', mode: 'text', def: t('ホームページ'), long: true },
    url: { kind: 'input', mode: 'text', def: 'https://', long: true },
  },
});
def({
  type: 'communicate', cat: 'talk', shape: 'stack',
  spec: t('%who が %to に %text と話しかける'),
  args: {
    who: { kind: 'dropdown', options: WHO, def: 0 },
    to: { kind: 'input', mode: 'text', def: '', long: true },
    text: { kind: 'input', mode: 'text', def: t('こんにちは。'), long: true },
  },
});
def({
  type: 'raw', cat: 'talk', shape: 'stack',
  spec: t('さくらスクリプト %text をそのまま出す'),
  args: { text: { kind: 'input', mode: 'text', def: '\\![raise,OnTest]', long: true } },
});

// ============================================================== 見た目
def({
  type: 'surface', cat: 'looks', shape: 'stack',
  spec: t('%who の表情を %id 番にする'),
  args: {
    who: { kind: 'dropdown', options: WHO, def: 0 },
    id: { kind: 'input', mode: 'number', def: 0 },
  },
});
// さくら(0) と うにゅう(1) のほかに、3 人目以降を出したいとき
def({
  type: 'chara', cat: 'looks', shape: 'stack',
  spec: t('これから %id 番のキャラが話す'),
  args: { id: { kind: 'input', mode: 'number', def: 2 } },
});
// SERIKO のアニメーション。中身は「ゴースト」タブの「うごき」で作ります。
def({
  type: 'anim', cat: 'looks', shape: 'stack',
  spec: t('うごき %id を再生する'),
  args: { id: { kind: 'input', mode: 'number', def: 0 } },
});
// 着せ替え（MAYUNA の bind）。種類と名前は、キャラと絵の「うごき」で着せ替えにしたものと同じにします
def({
  type: 'dress', cat: 'looks', shape: 'stack',
  spec: t('着せ替え %category の %part を %on'),
  args: {
    category: { kind: 'input', mode: 'text', def: t('服') },
    part: { kind: 'input', mode: 'text', def: t('セーラー') },
    on: { kind: 'dropdown', options: WEAR, def: 1 },
  },
});
def({
  type: 'balloon', cat: 'looks', shape: 'stack',
  spec: t('バルーンを %id 番にする'),
  args: { id: { kind: 'input', mode: 'number', def: 0 } },
});
def({
  type: 'sound', cat: 'looks', shape: 'stack',
  spec: t('音 %file を鳴らす'),
  args: { file: { kind: 'input', mode: 'text', def: 'sound.wav', long: true } },
});

// ================================================================ 制御
def({
  type: 'wait', cat: 'control', shape: 'stack',
  spec: t('%ms ミリ秒待つ'),
  args: { ms: { kind: 'input', mode: 'number', def: 500 } },
});
def({
  type: 'if', cat: 'control', shape: 'c',
  spec: t('もし %cond なら'),
  args: { cond: { kind: 'input', mode: 'bool' } },
  subs: [{ key: 'then' }],
});
def({
  type: 'if_else', cat: 'control', shape: 'c',
  spec: t('もし %cond なら'),
  args: { cond: { kind: 'input', mode: 'bool' } },
  subs: [{ key: 'then' }, { key: 'else', label: t('そうでなければ') }],
});
def({
  type: 'repeat', cat: 'control', shape: 'c',
  spec: t('%count 回くりかえす'),
  args: { count: { kind: 'input', mode: 'number', def: 3 } },
  subs: [{ key: 'body' }],
});
def({
  type: 'while', cat: 'control', shape: 'c',
  spec: t('%cond の間くりかえす'),
  args: { cond: { kind: 'input', mode: 'bool' } },
  subs: [{ key: 'body' }],
});
def({
  type: 'random_one', cat: 'control', shape: 'c',
  spec: t('つぎのどれかをランダムに'),
  dynamic: 'branches',
});
// 続きもののトーク（段階 6-2）。動くたびに、いまの話を出す。話が進むのは、起動しなおしてからはじめて動いたとき。
// どこまで進んだかは、続きものの名前ごとに保存します（studio_runtime.dic の Studio.Serial）
def({
  type: 'serial', cat: 'control', shape: 'c',
  spec: t('続きもの %name 第1話（起動するたびに次の話へ。おわったら %end）'),
  args: {
    name: { kind: 'input', mode: 'text', def: t('連続トーク'), literal: true },
    end: { kind: 'dropdown', options: [[t('はじめから'), 'loop'], [t('もう話さない'), 'stop']], def: 'loop' },
  },
  dynamic: 'episodes',
  dynamicLabel: (i) => t('第{n}話', { n: i + 1 }),
});
def({
  type: 'call', cat: 'control', shape: 'stack',
  spec: t('%name をよぶ'),
  args: { name: { kind: 'funcname', def: '' } },
});
// 同じ「まとまり」に入れたランダムトークから、1 つえらんでよぶ
def({
  type: 'call_group', cat: 'control', shape: 'stack',
  spec: t('%group のトークをどれかよぶ'),
  args: { group: { kind: 'input', mode: 'text', def: '', long: true } },
});
def({
  type: 'talk_interval', cat: 'control', shape: 'stack',
  spec: t('ランダムトークの間隔を %sec 秒にする'),
  args: { sec: { kind: 'input', mode: 'number', def: 180 } },
});
// 使う人に文字を入力してもらい、答えを変数に入れる（\![open,inputbox,…]）。
// 質問そのものは、ふつうのセリフブロックで先に言っておきます。
def({
  type: 'ask', cat: 'control', shape: 'stack',
  spec: t('たずねて、答えを %into に入れる（はじめから %initial と書いておく）'),
  args: {
    into: { kind: 'varname', def: '' },
    initial: { kind: 'input', mode: 'text', def: '', long: true },
  },
});
def({
  type: 'later', cat: 'control', shape: 'stack',
  spec: t('%sec 秒後に %name をよぶ'),
  args: {
    sec: { kind: 'input', mode: 'number', def: 30 },
    name: { kind: 'funcname', def: '' },
  },
});
def({
  type: 'raise', cat: 'control', shape: 'stack',
  spec: t('イベント %event を自分で起こす（情報 %a を付ける）'),
  args: {
    event: { kind: 'input', mode: 'text', def: 'OnBoot', long: true },
    a: { kind: 'input', mode: 'text', def: '', long: true },
  },
});
def({
  type: 'change_ghost', cat: 'control', shape: 'cap',
  spec: t('%name に交代する'),
  args: { name: { kind: 'input', mode: 'text', def: 'random', long: true } },
});
def({
  type: 'open_browser', cat: 'control', shape: 'stack',
  spec: t('%url をブラウザで開く'),
  args: { url: { kind: 'input', mode: 'text', def: 'https://', long: true } },
});

// つないだ手書きの YAYA ゴーストの関数をよんで、答えをそのまましゃべる。
// 関数の名前の欄には、ブロックははめられません
def({
  type: 'yaya_call', cat: 'control', shape: 'stack',
  spec: t('YAYA の関数 %name を %a %b でよぶ'),
  args: {
    // pick: つないだ手書きのゴーストの関数から、えらべるようにする（editor/render.js）
    name: { kind: 'input', mode: 'text', def: '', literal: true, pick: 'yayaFunctions' },
    a: { kind: 'input', mode: 'text', def: '', long: true },
    b: { kind: 'input', mode: 'text', def: '', long: true },
  },
});
// 外部モジュール（SAORI）を呼んで、答えを「つぎのイベントで」変数に入れ、OnSaoriDone を起こす。
// YAYA には別のスレッドが無いので、呼ぶときは答えを待ちます（1.x の如何栞では別のスレッドで動いていました）。
def({
  type: 'saori_call', cat: 'control', shape: 'stack',
  spec: t('%file を %a %b でよぶ（答えを待たずに %into に入れる）%value'),
  args: {
    file: { kind: 'input', mode: 'text', def: 'saori.dll', long: true },
    a: { kind: 'input', mode: 'text', def: '', long: true },
    b: { kind: 'input', mode: 'text', def: '', long: true },
    into: { kind: 'varname', def: '' },
    value: {
      kind: 'dropdown', def: -1,
      options: [[t('（答え）'), -1], [t('0番目の値'), 0], [t('1番目の値'), 1], [t('2番目の値'), 2]],
    },
  },
});

// ネットワーク更新をはじめる（\![updatebymyself]）。
// ゴーストの設定の「更新のありか」が空だと、SSP は何もできません。
def({ type: 'update', cat: 'control', shape: 'stack', spec: t('ネットワーク更新をする') });
def({ type: 'end', cat: 'control', shape: 'cap', spec: t('ここでトークをおわる') });
def({ type: 'close', cat: 'control', shape: 'cap', spec: t('ゴーストを終了する') });

// ================================================================ 変数
def({
  type: 'set', cat: 'variables', shape: 'stack',
  spec: t('%name を %value にする'),
  args: {
    name: { kind: 'varname', def: '' },
    value: { kind: 'input', mode: 'text', def: 0 },
  },
});
def({
  type: 'change', cat: 'variables', shape: 'stack',
  spec: t('%name を %value ずつ変える'),
  args: {
    name: { kind: 'varname', def: '' },
    value: { kind: 'input', mode: 'number', def: 1 },
  },
});
def({
  type: 'var', cat: 'variables', shape: 'reporter',
  spec: '%name',
  args: { name: { kind: 'varname', def: '' } },
});

// ================================================================ 演算
const arith = (op, label) => def({
  key: 'arith#' + op, type: 'arith', cat: 'operators', shape: 'reporter',
  spec: '%a ' + label + ' %b', fixed: { op },
  args: {
    a: { kind: 'input', mode: 'number', def: '' },
    b: { kind: 'input', mode: 'number', def: '' },
  },
});
arith('+', '＋'); arith('-', '−'); arith('*', '×'); arith('/', '÷'); arith('%', t('のあまり'));

const compare = (op, label) => def({
  key: 'compare#' + op, type: 'compare', cat: 'operators', shape: 'boolean',
  spec: '%a ' + label + ' %b', fixed: { op },
  args: {
    a: { kind: 'input', mode: 'text', def: '' },
    b: { kind: 'input', mode: 'text', def: 50 },
  },
});
compare('<', '＜'); compare('=', '＝'); compare('>', '＞'); compare('!=', '≠');

def({
  key: 'logic#and', type: 'logic', cat: 'operators', shape: 'boolean',
  spec: t('%a かつ %b'), fixed: { op: 'and' },
  args: { a: { kind: 'input', mode: 'bool' }, b: { kind: 'input', mode: 'bool' } },
});
def({
  key: 'logic#or', type: 'logic', cat: 'operators', shape: 'boolean',
  spec: t('%a または %b'), fixed: { op: 'or' },
  args: { a: { kind: 'input', mode: 'bool' }, b: { kind: 'input', mode: 'bool' } },
});
def({
  type: 'not', cat: 'operators', shape: 'boolean',
  spec: t('%a ではない'),
  args: { a: { kind: 'input', mode: 'bool' } },
});
def({
  type: 'random', cat: 'operators', shape: 'reporter',
  spec: t('%min から %max までのランダムな数'),
  args: {
    min: { kind: 'input', mode: 'number', def: 1 },
    max: { kind: 'input', mode: 'number', def: 10 },
  },
});
def({
  type: 'chance', cat: 'operators', shape: 'boolean',
  spec: t('%a ％のかくりつ'),
  args: { a: { kind: 'input', mode: 'number', def: 50 } },
});
def({
  type: 'join', cat: 'operators', shape: 'reporter',
  spec: t('%a と %b をつなげる'),
  args: {
    a: { kind: 'input', mode: 'text', def: t('こんにちは'), long: true },
    b: { kind: 'input', mode: 'text', def: t('さん'), long: true },
  },
});
def({
  type: 'contains', cat: 'operators', shape: 'boolean',
  spec: t('%a に %b がふくまれる'),
  args: {
    a: { kind: 'input', mode: 'text', def: '', long: true },
    b: { kind: 'input', mode: 'text', def: '', long: true },
  },
});
def({
  type: 'length', cat: 'operators', shape: 'reporter',
  spec: t('%a の文字数'),
  args: { a: { kind: 'input', mode: 'text', def: '', long: true } },
});
def({
  type: 'round', cat: 'operators', shape: 'reporter',
  spec: t('%a を %op'),
  args: {
    a: { kind: 'input', mode: 'number', def: '' },
    op: {
      kind: 'dropdown', def: 'round',
      options: [[t('四捨五入'), 'round'], [t('切り捨て'), 'floor'], [t('切り上げ'), 'ceil'], [t('絶対値に'), 'abs']],
    },
  },
});

// 外部モジュール（SAORI）。ゴーストのフォルダに置いた 32bit の DLL を呼びます。
// 手書きの YAYA の式の値（段階 3-5c）。式の欄は、そこに書いた文字だけを使います（ブロックははめられません。
// ほかのゴーストから来た言葉などが、YAYA のコードとして動かないように）
def({
  type: 'yaya_expr', cat: 'operators', shape: 'reporter',
  spec: t('YAYA の式 %code の値'),
  args: { code: { kind: 'input', mode: 'text', def: '', long: true, literal: true } },
});
def({
  type: 'saori', cat: 'operators', shape: 'reporter',
  spec: t('%file を %a %b でよんだ答え %value'),
  args: {
    file: { kind: 'input', mode: 'text', def: 'saori.dll', long: true },
    a: { kind: 'input', mode: 'text', def: '', long: true },
    b: { kind: 'input', mode: 'text', def: '', long: true },
    value: {
      kind: 'dropdown', def: -1,
      options: [[t('（答え）'), -1], [t('0番目の値'), 0], [t('1番目の値'), 1], [t('2番目の値'), 2]],
    },
  },
});

// ================================================================ 情報
def({
  type: 'sys', cat: 'info', shape: 'reporter',
  spec: '%key',
  args: {
    key: {
      kind: 'dropdown', def: 'hour',
      options: [
        [t('いまの時'), 'hour'], [t('いまの分'), 'minute'], [t('いまの秒'), 'second'],
        [t('いまの年'), 'year'], [t('いまの月'), 'month'], [t('いまの日'), 'day'],
        [t('いまの曜日(0=日)'), 'weekday'], [t('いまの曜日(名前)'), 'weekdayname'],
        [t('いまごろ(朝/昼/夕方/夜)'), 'daypart'], [t('いまの季節'), 'season'],
        [t('起動してからの秒数'), 'uptime'], [t('起動してからの分数'), 'uptimemin'],
        [t('起動した回数'), 'boots'], [t('今回のトーク回数'), 'talks'],
        [t('前に出したトーク'), 'lasttalk'],
        [t('ゴースト名'), 'ghostname'], [t('シェル名'), 'shellname'],
        [t('話しかけてきた相手'), 'commfrom'], [t('言われたこと'), 'commtext'],
      ],
    },
  },
});
def({
  type: 'ref', cat: 'info', shape: 'reporter',
  spec: t('イベントの情報 %index'),
  args: {
    index: {
      kind: 'dropdown', def: 0,
      options: [[t('0番目'), 0], [t('1番目'), 1], [t('2番目'), 2], [t('3番目'), 3], [t('4番目'), 4], [t('5番目'), 5]],
    },
  },
});

// ------------------------------------------------------------- palette
export const PALETTE = {
  events: [
    { note: t('ゴーストの動きは、ここからはじまります。キャンバスにドラッグしてください。') },
    '@event', '@event.touch', '@event.every', '@event.nthboot', '@event.alarm', '@event.anniv', '@event.key', '@event.comm', '@event.menu',
    '@talk', '@function',
  ],
  talk: ['say', 'newline', 'click_wait', 'clear', 'choice', 'link', 'communicate', 'raw'],
  looks: ['surface', 'chara', 'anim', 'dress', 'balloon', 'sound'],
  control: ['wait', 'if', 'if_else', 'repeat', 'while', 'random_one', 'serial', 'call',
    'call_group', 'talk_interval', 'ask', 'later', 'raise', 'update', 'saori_call', 'yaya_call',
    'open_browser', 'end', 'close', 'change_ghost'],
  variables: [{ button: 'add-var', label: t('＋ 変数をつくる') }, '@vars', 'set', 'change'],
  operators: ['arith#+', 'arith#-', 'arith#*', 'arith#/', 'arith#%',
    'compare#<', 'compare#=', 'compare#>', 'compare#!=',
    'logic#and', 'logic#or', 'not', 'random', 'chance',
    'join', 'contains', 'length', 'round', 'saori', 'yaya_expr'],
  info: [
    { note: t('イベントの情報＝ダブルクリックの座標など、イベントごとの追加データです。') },
    'sys', 'ref',
  ],
  parts: [
    { note: t('よく使う組みかたを、ブロックの右クリックの「ここから下を部品にする」で保存できます。どのプロジェクトにも置けます。') },
    // 部品のファイル（段階 7-4。editor/parts.js）
    { button: 'parts-export', label: t('部品をファイルに書き出す') },
    { button: 'parts-import', label: t('部品のファイルを読みこむ') },
    '@parts',
  ],
};
