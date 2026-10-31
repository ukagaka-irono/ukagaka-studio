/* 栞のふるまいテストの場面（behavior.js が、ブロックを YAYA に訳して動かします）
 *
 * 場面ごとに、ゴースト（dir の ghost.json）と、投げるイベントと、ほしい答えを書きます。
 * ふるまいを変えたら、ここの期待値も直してください。
 */
'use strict';

const path = require('path');

const EMPTY = path.join(__dirname, 'empty');
const EMPTY_EN = path.join(__dirname, 'empty-en');
const VALUES_EN = path.join(__dirname, 'values-en');
const MAIN = path.join(__dirname, 'main');
const TALKS = path.join(__dirname, 'talks');
const MENU = path.join(__dirname, 'menu');
const TALK_FILTER = path.join(__dirname, 'talkfilter');
const TALK_GROUP = path.join(__dirname, 'talkgroup');
const NTH_BOOT = path.join(__dirname, 'nthboot');
const KEY_PRESS = path.join(__dirname, 'keypress');

// 応答 1 件に対する期待。文字列なら Value の完全一致。
//   { value } Value / { commTo } 話しかけ先 / { status } 応答の種類
//   { valueOneOf: [...] } どれか 1 つに当たればよい（既定の反応がランダムなもの）
//   null なら見ない
const scenarios = [
  {
    name: 'ブロックが無いゴーストの、既定の反応',
    dir: EMPTY,
    steps: [
      ['OnFirstBoot', '\\0\\s[0]はじめまして。\\nなしこです。\\nよろしくね。\\e'],
      ['OnBoot', '\\0\\s[0]おかえりなさい。\\e'],
      ['OnMouseDoubleClick:0,0,0,0,Head', {
        valueOneOf: ['\\0\\s[0]なに？\\e', '\\0\\s[0]呼んだ？\\e', '\\0\\s[0]どうしたの？\\e'],
      }],
      ['OnMinuteChange', { status: '204 No Content', value: '' }],
      ['OnClose', '\\0\\s[0]またね。\\-'],
    ],
  },
  {
    name: '英語のゴースト（meta.lang が en）の、既定の反応',
    dir: EMPTY_EN,
    steps: [
      ['OnFirstBoot', "\\0\\s[0]Nice to meet you.\\nI'm Ikaga.\\nLet's get along!\\e"],
      ['OnBoot', '\\0\\s[0]Welcome back.\\e'],
      ['OnMouseDoubleClick:0,0,0,0,Head', {
        valueOneOf: ['\\0\\s[0]What is it?\\e', '\\0\\s[0]Did you call me?\\e', "\\0\\s[0]What's up?\\e"],
      }],
      ['OnNadeNade:0,0,0,0,Bust', "\\0\\s[2]...Please don't touch me so much.\\e"],
      ['OnClose', '\\0\\s[0]See you.\\-'],
    ],
  },
  {
    name: '英語のゴーストでは「いまごろ」「季節」「曜日の名前」が英語の値になる',
    dir: VALUES_EN,
    steps: [
      ['OnBoot', { valueOneOf: ['morning', 'afternoon', 'evening', 'night'].map((v) => `\\0${v}\\e`) }],
      ['OnMouseDoubleClick:0,0,0,0,Head', { valueOneOf: ['spring', 'summer', 'autumn', 'winter'].map((v) => `\\0${v}\\e`) }],
      ['OnClose', {
        valueOneOf: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((v) => `\\0${v}\\-`),
      }],
    ],
  },
  {
    name: '終了のとき \\- が必ず付く／ふつうのイベントには \\e が付く',
    dir: MAIN,
    steps: [
      ['OnBoot', '\\0おきた\\e'],
      ['OnClose', '\\0ばいばい\\-'],
    ],
  },
  {
    name: 'しぼり込み — あたま用があれば、条件なしより優先される',
    dir: MAIN,
    steps: [
      ['OnNadeNade:0,0,0,0,Head', '\\0あたま\\e'],
      ['OnNadeNade:0,0,0,0,Bust', '\\0どこか\\e'],
    ],
  },
  {
    name: 'ゴースト間通信 — 細かい条件ほど先に選ばれる',
    dir: MAIN,
    steps: [
      // 相手＋言葉（いちばん細かい）
      ['OnCommunicate:みかん,ねえねえ', { value: '\\0みかんだ\\e', commTo: 'みかん' }],
      // 言葉だけ（相手が違うので、いちばん細かいものは外れる）
      ['OnCommunicate:さくら,こんにちは', { value: '\\0あいさつ\\e', commTo: '' }],
      // どれにも当てはまらないので、条件なし
      ['OnCommunicate:だれか,やあ', { value: '\\0だれか\\e', commTo: '' }],
    ],
  },
  {
    name: '話しかけ合いは 8 往復で打ち切る（しゃべりは続く）',
    dir: MAIN,
    steps: (() => {
      const out = [];
      for (let i = 1; i <= 10; i++) {
        out.push(['OnCommunicate:みかん,ねえ', {
          value: '\\0みかんだ\\e',
          commTo: i <= 8 ? 'みかん' : '',
          // 世代数は初回が 0 で、返すたびに増える。打ち切ったあとは付かない。
          age: i <= 8 ? String(i - 1) : '',
        }]);
      }
      return out;
    })(),
  },
  {
    name: '「◯秒ごと」は間引かれる（3 秒ごとなら 7 回たたいて 2 回）',
    dir: MAIN,
    steps: [
      ['OnSecondChange:0,1,1', { status: '204 No Content' }],
      ['OnSecondChange:0,1,2', { status: '204 No Content' }],
      ['OnSecondChange:0,1,3', { value: '\\01\\e' }],
      ['OnSecondChange:0,1,4', { status: '204 No Content' }],
      ['OnSecondChange:0,1,5', { status: '204 No Content' }],
      ['OnSecondChange:0,1,6', { value: '\\02\\e' }],
      ['OnSecondChange:0,1,7', { status: '204 No Content' }],
    ],
  },
  {
    name: 'マウスが同じ場所で 8 回続いたら、なでられたことにする',
    dir: MAIN,
    steps: (() => {
      const out = [];
      for (let i = 1; i <= 8; i++) {
        out.push(['OnMouseMove:0,0,0,0,Head',
          i < 8 ? { status: '204 No Content' } : { value: '\\0あたま\\e' }]);
      }
      return out;
    })(),
  },
  {
    name: '当たり判定の外は、なでたことにしない',
    dir: MAIN,
    steps: (() => {
      const out = [];
      for (let i = 1; i <= 10; i++) out.push(['OnMouseMove:0,0,0,0,', { status: '204 No Content' }]);
      return out;
    })(),
  },
  {
    name: 'まとまりからトークをよぶ — まとまりに入っているものだけが出る',
    dir: MAIN,
    steps: [
      ['OnGroupTest', { value: '\\0おやすみ\\e' }],
      ['OnGroupTest', { value: '\\0おやすみ\\e' }],
    ],
  },
  {
    name: 'たずねる — 返ってきた答えを、栞が変数に入れる',
    dir: MAIN,
    steps: [
      ['OnAskTest', { value: '\\![open,inputbox,ikaga:こたえ,-1,]\\e' }],
      // SSP は OK が押されると OnUserInput を送ってくる
      ['OnUserInput:ikaga:こたえ,ミヤガワ', { status: '204 No Content' }],
      ['OnShowAnswer', { value: '\\0ミヤガワ\\e' }],
      // 知らない ID のときは、変数をいじらない
      ['OnUserInput:よそのID,べつのこたえ', { status: '204 No Content' }],
      ['OnShowAnswer', { value: '\\0ミヤガワ\\e' }],
    ],
  },
  {
    name: '◯秒後によぶ — 時間が来たら動く',
    dir: MAIN,
    steps: [
      ['OnLaterTest', { status: '204 No Content' }],   // 予約するだけ
      ['OnSecondChange:0,1,1', { status: '204 No Content' }],
      ['OnSecondChange:0,1,2', { status: '204 No Content' }],
      ['OnSecondChange:0,1,3', { value: '\\01\\e' }],   // これはいつもの「3 秒ごと」
      ['OnSecondChange:0,1,4', { status: '204 No Content' }],
      ['OnSecondChange:0,1,5', { value: '\\0おまたせ\\e' }],
      ['OnSecondChange:0,1,6', { value: '\\02\\e' }],   // 一度きり。あとはいつもどおり
      ['OnSecondChange:0,1,7', { status: '204 No Content' }],
    ],
  },
  {
    name: '本物の SAORI — 待つ呼び出しと、待たない呼び出しの両方',
    dir: MAIN,
    steps: [
      // 待つほう。SAORI が返した Result: がそのままセリフになる
      ['OnSaoriSync', { value: '\\0すぐ\\e' }],
      // 待たないほう。呼んだ時点では何も出ない
      ['OnSaoriReal', { status: '204 No Content' }],
      ['!sleep:600', null],
      ['OnSecondChange:0,1,1', { value: '\\0とどいた:slow_saori.dll\\e' }],
      ['OnShowAnswer', { value: '\\0ぬるい\\e' }],
    ],
  },
  {
    name: 'おそい SAORI の途中で終了しても、栞は落ちない',
    dir: MAIN,
    steps: [
      // 6.5 秒かかる呼び出しを始めてから、すぐ unload（＋ FreeLibrary）する。
      // 栞が消えるのと、SAORI の答えが返ってくるのが重なる場面です。ここで落ちないことを見ます。
      ['OnSaoriVerySlow', { status: '204 No Content' }],
      ['!unload', null],
      ['!sleep:3000', null],
    ],
  },
  {
    name: '待たない SAORI — 答えが届くと変数に入り、つぎの秒に知らせる',
    dir: MAIN,
    steps: [
      // 呼んだ時点では何も出ない（別のスレッドで動いている）
      ['OnSaoriTest', { status: '204 No Content' }],
      ['!sleep:400', null],
      // 届いた答えは OnSaoriDone として、つぎの「ずっとくりかえす」で知らせる
      ['OnSecondChange:0,1,1', '\\0とどいた:nai.dll\\e'],
      // 一度きり。つぎの秒は、いつもの「3 秒ごと」に戻る
      ['OnSecondChange:0,1,2', { status: '204 No Content' }],
      ['OnSecondChange:0,1,3', { value: '\\01\\e' }],
    ],
  },
  {
    name: 'ネットワーク更新 — 結果だけ知らせ、途中経過と「変わりなし」は黙る',
    dir: EMPTY,
    steps: [
      ['OnUpdateBegin:なしこ,C:\\ghost,,ghost', { status: '204 No Content' }],
      ['OnUpdateReady:2,a.txt,ghost', { status: '204 No Content' }],
      ['OnUpdate.OnDownloadBegin:a.txt,0,2', { status: '204 No Content' }],
      ['OnUpdateComplete:none,,,ghost', { status: '204 No Content' }],
      ['OnUpdateComplete:changed,a.txt,,ghost',
        '\\0\\s[0]更新できたよ。\\n新しくなったところは、つぎに起動したときからだよ。\\e'],
      ['OnUpdateFailure:timeout,a.txt,,ghost',
        '\\0\\s[0]更新できなかったみたい。\\n（timeout）\\e'],
      // 自分でやめたときは黙る
      ['OnUpdateFailure:artificial,,,ghost', { status: '204 No Content' }],
    ],
  },
  {
    name: 'ランダムトーク — 間隔ごとに出て、直前に出したものは避ける／しゃべれないときは出さない',
    dir: TALKS,
    steps: [
      ['OnSecondChange:0,1,1', { status: '204 No Content' }],
      ['OnSecondChange:0,1,2', '\\0あ\\e'],
      ['OnSecondChange:0,1,3', { status: '204 No Content' }],
      ['OnSecondChange:0,1,4', '\\0い\\e'],      // 「あ」を避けるので、重み 0 の「い」
      ['OnSecondChange:0,1,5', { status: '204 No Content' }],
      ['OnSecondChange:0,1,6', '\\0あ\\e'],
      // しゃべれないとき（Reference1 が 0）は、時間が来ても出さない
      ['OnSecondChange:0,0,7', { status: '204 No Content' }],
      ['OnSecondChange:0,0,8', { status: '204 No Content' }],
      ['OnSecondChange:0,1,9', '\\0い\\e'],
      // 無効にしたトーク（う）は、ランダムでも、名前や id で「よぶ」ブロックからも動かない
      ['OnCallOff', '\\0え\\e'],
    ],
  },
  {
    name: '何も出力しないブロックは 204／選択肢の行き先が呼ばれる',
    dir: MAIN,
    steps: [
      ['OnEmptyOut', { status: '204 No Content', value: '' }],
      ['OnChoiceTest', '\\q[はい,こたえ]\\e'],
      ['OnChoiceSelect:こたえ', '\\0えらばれた\\e'],
    ],
  },
  {
    name: 'ランダムトークのしぼり込み — 条件に合うトークだけが出る',
    dir: TALK_FILTER,
    steps: [
      ['OnSecondChange:0,1,1', { status: '204 No Content' }],
      ['OnSecondChange:0,1,2', '\\0ふつう\\e'],
      ['OnSet', { status: '204 No Content' }],
      ['OnSecondChange:0,1,3', { status: '204 No Content' }],
      ['OnSecondChange:0,1,4', '\\0なかよし\\e'],
    ],
  },
  {
    name: 'キーのしぼり込み — キーの文字（大文字と小文字は区別しない）かキーコードで、決めたキーのものが先',
    dir: KEY_PRESS,
    steps: [
      ['OnKeyPress:f1,112', '\\0ヘルプ\\e'],
      ['OnKeyPress:escape,27', '\\0エスケープ\\e'],
      ['OnKeyPress:a,65', '\\0なにか\\e'],
    ],
  },
  {
    name: '決めた回数めの起動 — その回だけ、ふつうの起動のかわりに動く',
    dir: NTH_BOOT,
    steps: [
      ['OnBoot', '\\0ふつう\\e'],
      ['OnBoot', '\\0にかいめ\\e'],
      ['OnBoot', '\\0ふつう\\e'],
      ['OnBoot', '\\0ふつう\\e'],
    ],
  },
  {
    name: 'まとまりからよぶときも、しぼり込みを見る',
    dir: TALK_GROUP,
    steps: [
      ['OnCallG', '\\0Gふつう\\e'],
      ['OnSet', { status: '204 No Content' }],
      ['OnCallG', '\\0Gなかよし\\e'],
    ],
  },
  {
    name: 'SSP のメニューの項目 — おすすめに出し、えらんだ項目のかたまりだけが動く',
    dir: MENU,
    steps: [
      ['sakura.recommendsites', 'あいさつ\x01script:\\![raise,OnStudioMenu,m_hello]\x01\x01\x02'
        + 'おやつ\x01script:\\![raise,OnStudioMenu,m_snack]\x01\x01'],
      ['OnStudioMenu:m_snack', '\\0おやつだ\\e'],
      ['OnStudioMenu:m_hello', '\\0こんにちは\\e'],
      ['OnStudioMenu:m_off', { status: '204 No Content', value: '' }],
      ['OnStudioMenu:nai', { status: '204 No Content', value: '' }],
    ],
  },
];

/** 1 場面ぶんの答え合わせ。{ problems: [...], counted: 見たか所の数 } を返す */
function checkScenario(sc, got) {
  let counted = 0;
  const problems = [];
  sc.steps.forEach(([spec, want], i) => {
    const res = got[i];
    if (!res) { problems.push(`${spec}: 応答がありません`); return; }
    const exp = typeof want === 'string' ? { value: want } : want;
    if (!exp) return;
    counted++;

    if (exp.valueOneOf) {
      if (!exp.valueOneOf.includes(res.value)) {
        problems.push(`${spec}\n          出た  : ${res.value}`
          + `\n          どれか: ${exp.valueOneOf.join(' / ')}`);
      }
      return;
    }
    if (exp.value !== undefined && res.value !== exp.value) {
      problems.push(`${spec}\n          出た    : ${res.value}\n          ほしい  : ${exp.value}`);
    }
    if (exp.commTo !== undefined && res.commTo !== exp.commTo) {
      problems.push(`${spec}  話しかけ先  出た: "${res.commTo}" / ほしい: "${exp.commTo}"`);
    }
    if (exp.status !== undefined && res.status !== exp.status) {
      problems.push(`${spec}  応答の種類  出た: "${res.status}" / ほしい: "${exp.status}"`);
    }
    if (exp.age !== undefined && res.age !== exp.age) {
      problems.push(`${spec}  世代数  出た: "${res.age}" / ほしい: "${exp.age}"`);
    }
  });

  return { problems, counted };
}

module.exports = { scenarios, checkScenario };
