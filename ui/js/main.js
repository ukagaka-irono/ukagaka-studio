/* 伺かスタジオ - 画面の入り口
 *
 * index.html が読むのはこのファイルだけです。ほかは import でたどって読みこまれます。
 */

import { Model } from './model.js';
import { Dialog } from './dialog.js';
import './app.js';

// exe（studio/src/main.cpp）が、ウィンドウを閉じるときに呼ぶもの。
// 画面の外から触れるのはここに載せたものだけです。
window.IKAGA = { Model, Dialog };
