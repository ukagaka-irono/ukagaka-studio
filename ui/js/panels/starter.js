/* 伺かスタジオ - ひな形ウィザード（上のバーの「新規」）
 *
 * 名前と、入れる部品（あいさつ・ランダムトーク・アラームなど）をえらんで、新しいゴーストを作ります。
 * 作るのは model/sample.js の starterProject です。
 */

import { Model } from '../model/model.js';
import { STARTER_PARTS, starterProject } from '../model/sample.js';
import { Session } from '../core/session.js';
import { toast } from '../core/toast.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Dialog } from './dialog.js';

function field(label, value) {
  const wrap = Render.el('label', 'field');
  wrap.appendChild(Render.el('span', null, label));
  const input = Render.el('input');
  input.type = 'text';
  input.value = value;
  wrap.appendChild(input);
  return { wrap, input };
}

function open() {
  if (Model.dirty && !confirm(t('保存していない変更があります。新しく作りますか？'))) return;
  const base = Model.newProject().meta;
  const body = Render.div('starter');
  const name = field(t('ゴーストの名前'), base.name);
  const sakura = field(t('本体（さくら）の名前'), base.sakuraName);
  const kero = field(t('相方（うにゅう）の名前'), base.keroName);
  const craftman = field(t('作者名'), '');
  for (const f of [name, sakura, kero, craftman]) body.appendChild(f.wrap);

  body.appendChild(Render.div('starter-head', t('はじめから入れておくもの')));
  const checks = {};
  for (const part of STARTER_PARTS) {
    const row = Render.el('label', 'field row');
    row.appendChild(Render.el('span', null, part.label()));
    const box = Render.el('input');
    box.type = 'checkbox';
    box.checked = part.on;
    row.appendChild(box);
    checks[part.key] = box;
    body.appendChild(row);
  }
  body.appendChild(Render.div('hint', t('あとから、ブロックで自由に直せます。なにも入れないと、からっぽのキャンバスではじまります。')));

  Dialog.modal(t('あたらしいゴースト'), body, [
    { label: t('やめる') },
    {
      label: t('作る'), primary: true,
      run: () => {
        const parts = {};
        for (const [key, box] of Object.entries(checks)) parts[key] = box.checked;
        Model.init(starterProject({
          name: name.input.value, sakuraName: sakura.input.value, keroName: kero.input.value,
          craftman: craftman.input.value, parts,
        }));
        Session.projectName = '';          // 保存すると、新しいファイルを作る（同じ名前のものは上書きしない）
        Session.vars = {};
        toast(t('新しいゴーストを作りました'));
      },
    },
  ]);
  setTimeout(() => { name.input.focus(); name.input.select(); }, 0);
}

export const Starter = { open };
