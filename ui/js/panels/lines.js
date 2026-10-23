/* 伺かスタジオ - 「セリフ」の画面（セリフの一覧・まとめて直す・CSV の出し入れ）
 *
 * プロジェクトの「話す」ブロックを表にして、その場で直せるようにします（集めかたと CSV は model/lines.js）。
 * セリフが増えてきたとき、キャンバスを動きまわらずに読みなおし・直しができます。
 * CSV は表計算で直して読みこむと、変わったセリフだけを書きもどします。
 */

import { Model } from '../model/model.js';
import { collectLines, linesToCsv, parseCsv, applyCsv } from '../model/lines.js';
import { $ } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { Pages } from './pages.js';
import { Search } from './search.js';

const WHO = () => [t('さくら'), t('うにゅう')];

function render() {
  const box = $('#lines-list');
  if (!box) return;
  const q = ($('#lines-filter').value || '').trim().toLowerCase();
  const all = collectLines(Model.project);
  const lines = q ? all.filter((l) => (l.text + ' ' + Model.scriptTitle(l.script)).toLowerCase().includes(q)) : all;
  $('#lines-count').textContent = q
    ? t('{n} / {all} 件', { n: lines.length, all: all.length }) : t('{n} 件', { n: all.length });
  box.textContent = '';
  if (!all.length) {
    box.appendChild(Render.div('hint', t('まだ「話す」ブロックがありません。トークの画面で置いてください。')));
    return;
  }
  let last = null;
  for (const l of lines) {
    if (l.script !== last) {
      last = l.script;
      const head = Render.el('button', 'lines-script', Model.scriptTitle(l.script));
      head.title = t('クリックでその場所へ移動します');
      head.addEventListener('click', () => jump(l));
      box.appendChild(head);
    }
    const row = Render.div('lines-row');
    row.appendChild(Render.el('span', 'lines-who', WHO()[l.who === 1 ? 1 : 0] || String(l.who)));
    if (l.readonly) {
      const ro = Render.el('span', 'lines-ro', t('（ブロックがはめこんであるので、ここでは直せません）'));
      ro.addEventListener('click', () => jump(l));
      row.appendChild(ro);
    } else {
      const input = Render.el('textarea', 'lines-text');
      input.rows = 1;
      input.value = l.text;
      const fit = () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; };
      requestAnimationFrame(fit);
      input.addEventListener('input', fit);
      input.addEventListener('change', () => {
        Model.act(() => { l.block.text = input.value; });
      });
      row.appendChild(input);
    }
    box.appendChild(row);
  }
}

function jump(line) {
  Pages.show('talk');
  setTimeout(() => Search.jumpTo({ script: line.script, block: line.block }), 120);   // キャンバスを描いてから
}

/** CSV に書き出す（WebView2 のダウンロードで保存します） */
function exportCsv() {
  const lines = collectLines(Model.project);
  if (!lines.length) { toast(t('書き出すセリフがありません'), true); return; }
  const csv = linesToCsv(lines, (s) => Model.scriptTitle(s));
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Render.el('a');
  a.href = url;
  const name = String(Model.project.meta.name || 'ghost').replace(/[\\/:*?"<>|]/g, '_');
  a.download = t('{name}-セリフ.csv', { name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t('セリフを CSV に書き出しました（{n} 件）', { n: lines.filter((l) => !l.readonly).length }));
}

/** CSV を読みこんで、変わったセリフを書きもどす */
async function importCsv(file) {
  if (!file) return;
  let text;
  try { text = await file.text(); } catch (e) { toast(e.message, true); return; }
  let r = null;
  Model.act(() => {
    r = applyCsv(Model.project, parseCsv(text));
    return r.changed > 0 ? undefined : false;    // 何も変わらなければ、元にもどす記録を積まない
  });
  if (r.error) { toast(t('key と text の列がある CSV を読みこんでください'), true); return; }
  let msg = t('{n} 件のセリフを書きもどしました', { n: r.changed });
  if (r.unknown.length) msg += t('（{n} 件は、もう無いブロックなので使いませんでした）', { n: r.unknown.length });
  toast(msg, r.changed === 0 && r.unknown.length > 0);
}

function init() {
  $('#lines-filter').addEventListener('input', render);
  $('#btn-lines-csv').addEventListener('click', exportCsv);
  const file = $('#lines-csv-file');
  $('#btn-lines-import').addEventListener('click', () => file.click());
  file.addEventListener('change', () => { importCsv(file.files[0]); file.value = ''; });
}

export const Lines = { init, render };
