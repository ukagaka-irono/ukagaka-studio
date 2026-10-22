/* 伺かスタジオ - exe の中の API を呼ぶ
 *
 * 画面からの要求は WebView2 の中で exe が受けとります（studio/src/api.cpp）。
 * X-Ikaga ヘッダは、自分の画面からの要求だという印です。
 *
 * exe はエラーを文ではなく、コードで返します（{ "error": "bad_json", "detail": 補足 }）。
 * ここで、画面の言語の文にします。exe にエラーを足したら、下の ERRORS にも足してください
 * （足し忘れは ui\test\i18n.js が見つけます）。
 */

import { t } from '../i18n/i18n.js';

// exe のエラーのコード → 画面に出す文。d は exe が付ける補足（ファイル名・SSP の返事など）
const ERRORS = {
  bad_json: () => t('JSON が壊れています'),
  bad_origin: () => t('この画面からの要求ではないので、受け付けませんでした'),
  unknown_endpoint: (d) => t('知らない API です: {detail}', { detail: d }),
  no_project: () => t('プロジェクトがありません'),
  project_not_found: () => t('プロジェクトが見つかりません'),
  version_not_found: () => t('その前の版が見つかりません'),
  no_name: () => t('名前がありません'),
  save_failed: () => t('保存できませんでした'),
  no_path: () => t('パスがありません'),
  read_failed: (d) => t('読み込めませんでした: {detail}', { detail: d }),
  json_unreadable: (d) => t('JSON を読めませんでした: {detail}', { detail: d }),
  not_found: () => t('見つかりません'),
  export_failed: () => t('書き出しに失敗しました'),
  mkdir_failed: () => t('フォルダを作れませんでした'),
  write_failed: (d) => t('書き込みに失敗しました: {detail}', { detail: d }),
  nar_write_failed: () => t('.nar を書き込めませんでした'),
  image_unreadable: () => t('画像が読めません'),
  script_not_found: (d) => t('そのかたまりが見つかりません: {detail}', { detail: d }),
  no_dic: () => t('YAYA の辞書がありません'),
  yaya_failed: (d) => t('YAYA で動かせませんでした: {detail}', { detail: d }),
  not_shell_folder: (d) => t('シェルのフォルダではないようです（surfaces.txt も surface の絵もありません）: {detail}', { detail: d }),
  not_yaya_ghost: (d) => t('YAYA のゴーストではないようです（yaya.txt がありません）: {detail}', { detail: d }),
  yaya_dll_missing: () => t('ゴーストに yaya.dll がありません'),
  yaya_dll_old: () => t('ゴーストの yaya.dll が古いので、スタジオのしくみが動きません（YAYA 6 系にしてください）'),
  yaya_base_missing: () => t('ゴーストが YAYA のシステム辞書 yaya_base を使っていません'),
  yaya_base_old: () => t('ゴーストの yaya_base が古いので、スタジオのしくみが動きません'),
  not_studio_file: (d) => t('{file} は人が書いたファイルのようなので、上書きしません', { file: d }),
  ssp_exe_not_found: () => t('ssp.exe が見つかりません。SSP の場所を指定してください。'),
  ssp_not_found: () => t('SSP が見つかりません。SSP の場所を指定してください。'),
  no_script: () => t('スクリプトがありません'),
  no_event: () => t('イベント名がありません'),
  no_sentence: () => t('話しかける内容がありません'),
  net_init_failed: () => t('ネットワーク機能を初期化できませんでした'),
  ssp_unreachable: () => t('SSP につながりません（SSP が起動しているか、SSTP を受け付ける設定かを確認してください）'),
  ssp_send_failed: () => t('SSP へ送信できませんでした'),
  ssp_no_response: () => t('SSP から応答がありませんでした'),
  ssp_rejected: (d) => t('SSP が受け付けませんでした: {detail}', { detail: d }),
};

/** 表にあるコードの一覧（ui\test\i18n.js が、exe の返すコードと見くらべます） */
export const ERROR_CODES = Object.keys(ERRORS);

/** exe が返したエラーを、画面に出す文にする */
export function errorText(data, status) {
  const code = data && data.error;
  if (!code) return t('通信エラー ({status})', { status });
  const make = ERRORS[code];
  if (make) return make(data.detail || '');
  return data.detail ? `${code}: ${data.detail}` : code;   // 表に無いコードは、そのまま出す
}

export async function api(path, options) {
  const opt = Object.assign({ headers: {} }, options || {});
  opt.headers['X-Ikaga'] = '1';
  if (opt.body && typeof opt.body !== 'string') {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(opt.body);
  }
  const res = await fetch(path, opt);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(errorText(data, res.status));
    err.code = data.error || '';
    throw err;
  }
  return data;
}
