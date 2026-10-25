/* 伺かスタジオ - 画面の状態（プロジェクトの外のもの）
 *
 * プロジェクトの中身（ghost.json になるもの）は model/model.js の Model が持ち、
 * 元にもどす・保存していない印もそちらにあります。
 * ここに置くのは、保存しない「いまの画面の状態」だけです。
 */

export const Session = {
  state: null,              // 起動時に /api/state からもらったもの
  projectName: '',          // 上書き保存するときの名前（空なら名前を聞く）
  dicName: null,            // 「辞書」の画面でえらんでいる辞書の名前（panels/dictionary.js）
  dicCategory: 'y-func',    // 「辞書」の画面のパレットでえらんでいるカテゴリ（model/yblocks.js の YPALETTE）
  zoom: 1,
  category: 'events',       // パレットで選んでいるカテゴリ
  vars: {},                 // 「ためす」で覚えている変数（ゴーストのセーブにあたるもの）
  clipboard: null,          // コピーしたブロック（Ctrl+C / Ctrl+V。localStorage にも置きます。editor/clipboard.js）
  clipboardVars: [],        // コピーしたブロックが使っている変数（名前と初期値。はりつけた先に無ければ足す）
  playToken: 0,             // ステージの再生を、新しいものに切りかえるための番号
  ssp: null,                // いちばん最近たしかめた SSP の状態
  yayaGhost: null,          // つないだ手書きの YAYA ゴーストを調べた結果（panels/yayalink.js）
};
