/* 伺かスタジオ - exe の中の API を呼ぶ
 *
 * 画面からの要求は WebView2 の中で exe が受けとります（studio/src/api.cpp）。
 * X-Ikaga ヘッダは、自分の画面からの要求だという印です。
 */

import { t } from '../i18n/i18n.js';

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
  if (!res.ok) throw new Error(data.error || t('通信エラー ({status})', { status: res.status }));
  return data;
}
