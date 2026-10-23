/* 伺かスタジオ - このかたまりの YAYA を見る
 *
 * かたまりの帽子の右クリック「YAYA を見る」で、書き出したときにそのかたまりがなる YAYA の関数を出します。
 * 書き出すものと 1 字もちがわないように、同じ訳しかた（model/yaya.js の toYaya）から切り出します（scriptYaya）。
 * 手で YAYA を書くほうへ移っていく人が、ブロックと YAYA を見くらべるためのものです。
 */

import { Model } from '../model/model.js';
import { programOf, scriptYaya } from '../model/yaya.js';
import { provide } from '../core/commands.js';
import { Session } from '../core/session.js';
import { toast } from '../core/toast.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Dialog } from './dialog.js';

function open(script) {
  if (!script) return;
  const handwritten = (Session.yayaGhost || {}).functions || [];
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

function init() {
  provide({ showYaya: open });
}

export const YayaView = { init, open };
