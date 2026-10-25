/* 伺かスタジオ - このかたまりの YAYA を見る
 *
 * かたまりの帽子の右クリック「YAYA を見る」で、書き出したときにそのかたまりがなる YAYA の関数を出します。
 * 書き出すものと 1 字もちがわないように、同じ訳しかた（model/yaya.js の toYaya）から切り出します（scriptYaya）。
 * 手で YAYA を書くほうへ移っていく人が、ブロックと YAYA を見くらべるためのものです。
 * トークの画面の右の列の「YAYA」タブ（段階 8-7）は、キャンバスで最後に押したかたまりの YAYA を、ブロックを変えるたびに出しなおします。
 */

import { Model } from '../model/model.js';
import { programOf, scriptYaya } from '../model/yaya.js';
import { highlightYaya } from '../model/yayatext.js';
import { provide } from '../core/commands.js';
import { $, escapeHtml } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Dialog } from './dialog.js';
import { YayaLink } from './yayalink.js';

function open(script) {
  if (!script) return;
  const handwritten = YayaLink.handwrittenNow();
  const code = scriptYaya(programOf(Model.project), script.id, { handwritten });
  const body = Render.div('');
  if (code == null) {
    body.appendChild(Render.div('hint', t('帽子ブロックの無いかたまりは、書き出さないので YAYA になりません。')));
    Dialog.modal(t('YAYA を見る'), body, [{ label: t('閉じる') }]);
    return;
  }
  const how = script.kind === 'event'
    ? (handwritten.includes(script.event)
      ? t('{event} は手書きの辞書にもあるので、手書きのほうが動きます。ブロックも動かすときは、手書きの {event} の中で Studio.Event(\'{event}\') をよびます。', { event: script.event })
      : t('SSP から {event} が来ると、Studio.Event(\'{event}\') を通って、この関数がよばれます。', { event: script.event }))
    : t('トークや「◯◯をよぶ」ブロックから、この関数がよばれます。');
  body.appendChild(Render.div('hint', how + ' ' + t('Studio.〜 の中身は、しくみの辞書 studio_runtime.dic にあります。')));
  body.appendChild(Render.el('pre', 'yaya-view', code));
  Dialog.modal(t('YAYA を見る: {title}', { title: Model.scriptTitle(script) }), body, [
    {
      label: t('コピー'), close: false,
      run: async () => {
        try {
          await navigator.clipboard.writeText(code);
          toast(t('コピーしました'));
        } catch (e) { toast(e.message, true); }
      },
    },
    { label: t('閉じる') },
  ]);
}

// ------------------------------------------------------------ 右の列の「YAYA」タブ（段階 8-7）
let liveId = null;    // 見ているかたまり（キャンバスで最後に押したもの。まだ押していなければ、最初のかたまり）
let liveTimer = 0;
let liveCode = '';

function liveScript() {
  const list = Model.project.scripts.filter((s) => s.kind !== 'loose');
  return list.find((s) => s.id === liveId) || list[0] || null;
}

/** 色分けした YAYA（辞書の画面のテキストエディタと同じ色。model/yayatext.js の highlightYaya） */
function colored(code) {
  return highlightYaya(code).map((spans) => spans.map(([cls, s]) => (cls ? `<span class="syn-${cls}">${escapeHtml(s)}</span>` : escapeHtml(s))).join('')).join('\n');
}

/** 「YAYA」タブが見えていれば、描きなおす */
function renderLive() {
  const panel = document.querySelector('.side-panel[data-panel="yaya"]');
  if (!panel || !panel.classList.contains('is-active')) return;
  const script = liveScript();
  const box = $('#yaya-live');
  const code = script ? scriptYaya(programOf(Model.project), script.id, { handwritten: YayaLink.handwrittenNow() }) : null;
  $('#yaya-live-title').textContent = script ? Model.scriptTitle(script) : 'YAYA';
  liveCode = code || '';
  $('#btn-yaya-live-copy').disabled = !liveCode;   // 写すものが無いときは押せない
  // 出せないときは、「ためす」の結果の欄と同じく、かっこ書きで
  if (!script) box.textContent = t('（まだブロックがありません）');
  else if (code == null) box.textContent = t('（帽子ブロックの無いかたまりは、書き出さないので YAYA になりません）');
  else box.innerHTML = colored(code);
}

function init() {
  provide({ showYaya: open });
  // キャンバスで押したかたまりを見る
  $('#canvas').addEventListener('pointerup', (e) => {
    const el = e.target.closest && e.target.closest('.script');
    if (!el || !el._script || el._script.kind === 'loose') return;
    liveId = el._script.id;
    renderLive();
  });
  // ブロックの欄を打っているあいだも、出しなおす
  $('#canvas').addEventListener('input', () => {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(renderLive, 150);
  });
  document.querySelector('.side-tab[data-tab="yaya"]').addEventListener('click', renderLive);
  $('#btn-yaya-live-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(liveCode);
      toast(t('コピーしました'));
    } catch { toast(t('コピーできませんでした'), true); }
  });
}

export const YayaView = { init, open, renderLive };
