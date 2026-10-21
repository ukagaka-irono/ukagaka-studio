/* 伺かスタジオ - 画面の言語の切りかえ（上のバーの「English」／「日本語」）
 *
 * ボタンには、切りかえた先の言語の名前を、その言語で書きます（いまの言語が読めない人でも見つけられるように）。
 *
 * 言語は起動したときに 1 度だけ決まるので（i18n/i18n.js）、切りかえたら画面を読みなおします。
 * 読みなおすと開いているプロジェクトが消えてしまうので、いまの中身を（保存していない変更もふくめて）
 * sessionStorage にあずけ、読みなおしたあとの起動で受けとります（main.js の boot）。
 * 元にもどす記録は引きつぎません。
 */

import { $ } from '../core/dom.js';
import { Session } from '../core/session.js';
import { Model } from '../model/model.js';
import { getLang, setLang, t } from '../i18n/i18n.js';
import { Pages } from './pages.js';

const CARRY = 'ikaga.carry';

function switchTo(next) {
  const carry = { project: Model.project, dirty: Model.dirty, name: Session.projectName, page: Pages.current };
  try {
    sessionStorage.setItem(CARRY, JSON.stringify(carry));
  } catch {
    // あずけられないとき（絵をたくさん入れて大きくなったプロジェクトなど）
    if (Model.dirty && !confirm(t('保存していない変更は消えます。言語を切りかえますか？'))) return;
  }
  Model.dirty = false;   // 読みなおすときの「このページを離れますか」を出さない
  setLang(next);
}

/** 言語を切りかえる前にあずけたもの。無ければ null。1 度だけ受けとれます */
function takeCarried() {
  try {
    const raw = sessionStorage.getItem(CARRY);
    sessionStorage.removeItem(CARRY);
    const carry = raw ? JSON.parse(raw) : null;
    return carry && carry.project && typeof carry.project === 'object' ? carry : null;
  } catch {
    return null;
  }
}

function init() {
  const btn = $('#btn-lang');
  if (!btn) return;
  const next = getLang() === 'ja' ? 'en' : 'ja';
  btn.textContent = next === 'en' ? 'English' : '日本語';   // i18n-ignore（切りかえた先の言語で書く）
  btn.title = next === 'en' ? 'Switch to English（画面を英語にする）' : '日本語にする（Switch to Japanese）';   // i18n-ignore（両方の言語で書く）
  btn.setAttribute('lang', next);
  btn.addEventListener('click', () => switchTo(next));
}

export const Language = { init, takeCarried };
