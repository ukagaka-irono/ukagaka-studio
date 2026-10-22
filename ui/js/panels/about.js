/* 伺かスタジオ - ヘルプの「このソフトについて」
 *
 * もとになったプロジェクト「なし栞 + なしスタジオ」の表示を、README だけでなくアプリの中にも出します
 * （なしライセンス 1.1 の 3 節。書きかえたものを配るときは、もとのプロジェクトの場所と作者名を、分かるところに書く）。
 * 表示の文はライセンスがすすめる形のまま出すので、英語の画面でも訳しません（README.en.md と同じ）。
 * README と同じ文であることは、ui\test\editor.js が見ます。
 */

import { $ } from '../core/dom.js';
import { t } from '../i18n/i18n.js';

export const ORIGIN_URL = 'https://github.com/miyagawa-yukinterface/nashi-shiori-studio';

/** もとにしたプロジェクトの表示（README・LICENSE と同じ 3 行） */
export const ORIGIN_NOTICE = [
  'このソフトウェアは「なし栞 + なしスタジオ」をもとにしています。',   // i18n-ignore（ライセンスの表示なので訳さない）
  ORIGIN_URL,
  '作者: 月見里　彩葉 (miyagawa-yukinterface)',                      // i18n-ignore
].join('\n');

export const About = {
  /** state は起動したときに exe からもらったもの（/api/state。版が入っています） */
  init(state) {
    $('#about-notice').textContent = ORIGIN_NOTICE;
    const version = state && state.version;
    $('#about-version').textContent = version ? t('版 {version}', { version }) : '';
    // 外のページは exe が既定のブラウザに渡します（http / https だけ。studio/src/webview.cpp）
    $('#btn-about-origin').addEventListener('click', () => window.open(ORIGIN_URL, '_blank'));
  },
};
