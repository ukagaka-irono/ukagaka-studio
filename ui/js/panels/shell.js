/* 伺かスタジオ - 立ち絵とうごき（「ゴースト」タブ）と、ステージの再生
 *
 * シェルの絵の割りあて、SERIKO のうごきの編集、
 * さくらスクリプトを受けとって吹き出しと立ち絵を動かすところ。
 */

import { Model } from '../model/model.js';
import { Player } from '../model/player.js';
import { $, sleep } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { Commands } from '../core/commands.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';

// ------------------------------------------------------------ 立ち絵の絵
// 標準の 6 枚。ここに無い番号も「追加」でふやせる。
const SHELL_SLOTS = [
  [0, t('さくら／通常')], [1, t('さくら／笑顔')], [2, t('さくら／驚き')],
  [10, t('うにゅう／通常')], [11, t('うにゅう／笑顔')], [12, t('うにゅう／驚き')],
];

function shellImages() {
  const sh = Model.project.shell || {};
  if (!Array.isArray(sh.images)) sh.images = [];
  return sh.images;
}

function shellImageOf(surfaceId) {
  return shellImages().find((x) => Number(x.id) === Number(surfaceId)) || null;
}

// 仮シェルは exe 側で描いてもらう。色を URL に入れてあるので、
// 色を変えれば URL も変わり、そのまま描き直しになる。
function shellUrl(surfaceId) {
  const img = shellImageOf(surfaceId);
  if (img && img.path) {
    return '/api/shell/file?path=' + encodeURIComponent(img.path) +
           '&v=' + encodeURIComponent(img.stamp || '');
  }
  const s = Model.project.shell || {};
  const kero = surfaceId >= 10;
  const hair = (kero ? s.keroColor : s.sakuraColor) || (kero ? '#8fd18a' : '#f08cae');
  const cloth = (kero ? s.keroCloth : s.sakuraCloth) || (kero ? '#e8b45c' : '#6e82c8');
  return '/api/shell?id=' + surfaceId +
         '&hair=' + encodeURIComponent(hair) +
         '&cloth=' + encodeURIComponent(cloth);
}

function setSurface(who, surfaceId) {
  const img = document.getElementById('chara-' + (who === 1 ? 1 : 0));
  if (!img) return;
  // 用意した画像があればその番号をそのまま使う。
  // 仮シェルしか無い番号は 0/1/2（さくら）と 10/11/12（うにゅう）に丸める。
  let id = Number(surfaceId) || 0;
  if (!shellImageOf(id)) {
    if (who === 1 && id < 10) id += 10;
    if ([0, 1, 2, 10, 11, 12].indexOf(id) < 0) id = who === 1 ? 10 : 0;
  }
  const url = shellUrl(id);
  if (img.getAttribute('src') !== url) img.setAttribute('src', url);
}

// ゴーストタブの見本と、ためすタブの立ち絵をまとめて描き直す
function refreshShell() {
  setSurface(0, 0);
  setSurface(1, 10);
  for (const id of [0, 1, 2, 10]) {
    const img = document.getElementById('shell-prev-' + id);
    if (img) img.setAttribute('src', shellUrl(id));
  }
  renderShellSlots();
  renderAnimList();
}

// うごき（SERIKO のアニメーション）
const ANIM_INTERVALS = [
  [t('呼んだときだけ'), 'never'],
  [t('いつも'), 'always'],
  [t('ときどき'), 'sometimes'],
  [t('まれに'), 'rarely'],
  [t('◯秒に一度くらい'), 'random'],
  [t('◯回しゃべるごと'), 'talk'],
  [t('起動時に一度だけ'), 'runonce'],
];

// こまの重ねかた（SERIKO の描画メソッド）。名前は surfaces.txt にそのまま出ます。
const ANIM_METHODS = [
  [t('かさねる'), 'overlay'],
  [t('かさねる（速い）'), 'overlayfast'],
  [t('土台をとりかえる'), 'base'],
  [t('すきとおりごと上書き'), 'replace'],
  [t('すきまだけ重ねる'), 'interpolate'],
  [t('すきとおりを無視する'), 'asis'],
  [t('すきとおりをけずる'), 'reduce'],
  [t('位置だけ動かす'), 'move'],
  [t('かけあわせ'), 'blend-multiply'],
  [t('スクリーン'), 'blend-screen'],
  [t('オーバーレイ'), 'blend-overlay'],
  [t('足しあわせ'), 'blend-add'],
  [t('ほかのうごきを動かす'), 'start'],
  [t('ほかのうごきを止める'), 'stop'],
  [t('動く絵を差しこむ'), 'import'],
];

// 当たり判定のかたち
const ANIM_SHAPES = [
  [t('四角'), 'rect'],
  [t('だ円'), 'ellipse'],
  [t('丸'), 'circle'],
  [t('多角形'), 'polygon'],
];

function renderAnimList() {
  const box = $('#anim-list');
  if (!box) return;
  const anims = Model.project.animations || [];
  box.textContent = '';
  if (!anims.length) {
    box.appendChild(Render.div('hint', t('まだうごきがありません。下のボタンで作れます。')));
    return;
  }

  anims.forEach((a, idx) => {
    const row = Render.div('anim-row');

    const head = Render.div('anim-head');
    head.appendChild(Render.el('span', 'anim-id', t('うごき {id}', { id: a.id })));

    const mk = (label, value, onInput, opts) => {
      const f = Render.el('label', 'field row');
      f.appendChild(Render.el('span', null, label));
      const inp = Render.el('input');
      inp.type = (opts && opts.type) || 'number';
      inp.value = value;
      if (opts && opts.min != null) inp.min = String(opts.min);
      inp.addEventListener('change', () => {
        const snap = Model.clone(Model.project);
        onInput(inp.value);
        Model.pushUndo(snap);
        renderAnimList();
      });
      f.appendChild(inp);
      return f;
    };

    head.appendChild(mk(t('番号'), a.id, (v) => { a.id = Math.max(0, Math.min(127, Number(v) || 0)); },
      { min: 0 }));
    head.appendChild(mk(t('どの立ち絵に付ける'), a.base, (v) => { a.base = Number(v) || 0; }, { min: 0 }));

    const sel = Render.el('select');
    for (const [label, value] of ANIM_INTERVALS) {
      const o = Render.el('option', null, label);
      o.value = value;
      sel.appendChild(o);
    }
    sel.value = a.interval;
    sel.addEventListener('change', () => {
      const snap = Model.clone(Model.project);
      a.interval = sel.value;
      Model.pushUndo(snap);
      renderAnimList();
    });
    const selField = Render.el('label', 'field row');
    selField.appendChild(Render.el('span', null, t('いつ動く')));
    selField.appendChild(sel);
    head.appendChild(selField);

    if (a.interval === 'random' || a.interval === 'talk') {
      head.appendChild(mk(a.interval === 'random' ? t('秒') : t('回'), a.every,
        (v) => { a.every = Math.max(1, Number(v) || 1); }, { min: 1 }));
    }

    const del = Render.el('button', 'btn tiny', t('消す'));
    del.addEventListener('click', () => {
      Model.act(() => { Model.project.animations.splice(idx, 1); });
      renderAnimList();
    });
    head.appendChild(del);
    row.appendChild(head);

    // パラパラの中身（どの絵を何ミリ秒）
    const pats = Render.div('anim-pats');
    // えらんだものを owner[key] に入れる小さなドロップダウン
    const pick = (label, list, value, onPick) => {
      const f = Render.el('label', 'field row');
      f.appendChild(Render.el('span', null, label));
      const s = Render.el('select');
      for (const [text, v] of list) {
        const o = Render.el('option', null, text);
        o.value = v;
        s.appendChild(o);
      }
      s.value = value;
      s.addEventListener('change', () => {
        const snap = Model.clone(Model.project);
        onPick(s.value);
        Model.pushUndo(snap);
        renderAnimList();
      });
      f.appendChild(s);
      return f;
    };

    a.patterns.forEach((p, k) => {
      const pr = Render.div('anim-pat');
      pr.appendChild(Render.el('span', 'anim-step', `${k + 1}`));
      pr.appendChild(pick(t('重ねかた'), ANIM_METHODS, p.method || 'base',
        (v) => { p.method = v; }));
      // 重ねかたによって、必要な欄が変わる
      if (p.method === 'start' || p.method === 'stop') {
        pr.appendChild(mk(t('うごき番号'), p.surface,
          (v) => { p.surface = Math.max(0, Math.min(127, Number(v) || 0)); }, { min: 0 }));
      } else {
        if (p.method === 'import') {
          pr.appendChild(mk(t('動く絵'), p.file || '', (v) => { p.file = String(v).trim(); },
            { type: 'text' }));
        } else {
          pr.appendChild(mk(t('立ち絵'), p.surface, (v) => { p.surface = Number(v) || 0; }, { min: 0 }));
        }
        pr.appendChild(mk(t('ミリ秒'), p.wait, (v) => { p.wait = Math.max(0, Number(v) || 0); },
          { min: 0 }));
        // 位置ずらし。0 のままなら基準の絵とぴったり重なります。
        pr.appendChild(mk(t('よこ'), p.x || 0, (v) => { p.x = Number(v) || 0; }));
        pr.appendChild(mk(t('たて'), p.y || 0, (v) => { p.y = Number(v) || 0; }));
      }
      const rm = Render.el('button', 'btn tiny', '−');
      rm.title = t('このこまを消す');
      rm.addEventListener('click', () => {
        Model.act(() => { a.patterns.splice(k, 1); });
        renderAnimList();
      });
      pr.appendChild(rm);
      pats.appendChild(pr);
    });
    const addPat = Render.el('button', 'btn tiny', t('＋ こまを足す'));
    addPat.addEventListener('click', () => {
      Model.act(() => { a.patterns.push({ surface: a.base, wait: 200, method: 'base', x: 0, y: 0 }); });
      renderAnimList();
    });
    pats.appendChild(addPat);
    row.appendChild(pats);

    // このうごきの間だけ有効な当たり判定（animationN.collisionM）
    const cols = Render.div('anim-cols');
    (a.collisions || []).forEach((c, k) => {
      const cr = Render.div('anim-pat');
      cr.appendChild(Render.el('span', 'anim-step', t('あたり')));
      cr.appendChild(mk(t('名前'), c.name, (v) => { c.name = String(v).trim(); }, { type: 'text' }));
      cr.appendChild(pick(t('かたち'), ANIM_SHAPES, c.shape || 'rect', (v) => { c.shape = v; }));
      if (c.shape === 'circle') {
        cr.appendChild(mk(t('中心よこ'), c.x1, (v) => { c.x1 = Number(v) || 0; }));
        cr.appendChild(mk(t('中心たて'), c.y1, (v) => { c.y1 = Number(v) || 0; }));
        cr.appendChild(mk(t('半径'), c.x2, (v) => { c.x2 = Math.max(0, Number(v) || 0); }, { min: 0 }));
      } else if (c.shape === 'polygon') {
        cr.appendChild(mk(t('かどの位置'), c.points || '', (v) => { c.points = String(v); },
          { type: 'text' }));
        cr.appendChild(Render.el('span', 'hint', t('x,y を空白でならべます（3 つ以上）')));
      } else {
        cr.appendChild(mk(t('左'), c.x1, (v) => { c.x1 = Number(v) || 0; }));
        cr.appendChild(mk(t('上'), c.y1, (v) => { c.y1 = Number(v) || 0; }));
        cr.appendChild(mk(t('右'), c.x2, (v) => { c.x2 = Number(v) || 0; }));
        cr.appendChild(mk(t('下'), c.y2, (v) => { c.y2 = Number(v) || 0; }));
      }
      const rm = Render.el('button', 'btn tiny', '−');
      rm.title = t('この当たり判定を消す');
      rm.addEventListener('click', () => {
        Model.act(() => { a.collisions.splice(k, 1); });
        renderAnimList();
      });
      cr.appendChild(rm);
      cols.appendChild(cr);
    });
    const addCol = Render.el('button', 'btn tiny', t('＋ 当たり判定を足す'));
    addCol.title = t('このうごきが動いている間だけ、ここを触れるようにします');
    addCol.addEventListener('click', () => {
      Model.act(() => {
        if (!Array.isArray(a.collisions)) a.collisions = [];
        a.collisions.push({
          name: 'Anim' + a.id, shape: 'rect',
          x1: 0, y1: 0, x2: 60, y2: 60, points: '',
        });
      });
      renderAnimList();
    });
    cols.appendChild(addCol);
    row.appendChild(cols);

    if (!a.patterns.length) {
      row.appendChild(Render.div('hint', t('こまが無いので、書き出しても動きません。')));
    }
    box.appendChild(row);
  });
}

function addAnimation() {
  Model.act(() => {
    const anims = Model.project.animations;
    let id = 0;
    while (anims.some((a) => a.id === id)) id++;
    anims.push({
      id, base: 0, interval: 'sometimes', every: 4,
      patterns: [
        { surface: 1, wait: 200, method: 'base', x: 0, y: 0 },
        { surface: 0, wait: 200, method: 'base', x: 0, y: 0 },
      ],
    });
  });
  renderAnimList();
}

function renderShellSlots() {
  const box = $('#shell-slots');
  if (!box) return;
  const images = shellImages();
  const extra = images
    .map((x) => Number(x.id))
    .filter((id) => !SHELL_SLOTS.some(([sid]) => sid === id))
    .sort((a, b) => a - b);
  const rows = SHELL_SLOTS.concat(extra.map((id) => [id, id >= 10 ? t('うにゅう') : t('さくら')]));

  box.textContent = '';
  for (const [id, label] of rows) {
    const img = shellImageOf(id);
    const row = Render.div('shell-slot');

    const thumb = Render.div('thumb');
    const pic = Render.el('img');
    pic.src = shellUrl(id);
    pic.alt = label;
    thumb.appendChild(pic);
    row.appendChild(thumb);

    const info = Render.div('info');
    info.appendChild(Render.div('slot-name', t('{label}（{id} 番）', { label, id })));
    const file = Render.el('span', 'slot-file' + (img ? '' : ' is-auto'),
      img ? (img.name || img.path) : t('自動生成'));
    if (img) {
      file.title = img.path;
      // ファイルが動いた・消えたときは、ここで気づけるようにする
      pic.addEventListener('error', () => {
        file.textContent = t('ファイルが見つかりません');
        file.style.color = 'var(--danger)';
        thumb.textContent = '？';
      });
    }
    info.appendChild(file);
    row.appendChild(info);

    const pickBtn = Render.el('button', 'btn tiny', img ? t('変える') : t('えらぶ'));
    pickBtn.addEventListener('click', () => pickShellImage(id));
    row.appendChild(pickBtn);

    if (img) {
      const clear = Render.el('button', 'btn tiny', t('もどす'));
      clear.title = t('自動生成にもどす');
      clear.addEventListener('click', () => {
        Model.act(() => {
          const list = shellImages();
          const i = list.findIndex((x) => Number(x.id) === Number(id));
          if (i >= 0) list.splice(i, 1);
        });
        refreshShell();
      });
      row.appendChild(clear);
    }
    box.appendChild(row);
  }
}

async function pickShellImage(surfaceId) {
  let r;
  try {
    r = await api('/api/shell/pick', { method: 'POST', body: {} });
  } catch (e) {
    toast(e.message, true);
    return;
  }
  const files = r.files || [];
  if (!files.length) return;

  // 複数えらんだときは、この番号から順にあてはめる（0,1,2 / 10,11,12 の並び）
  const order = SHELL_SLOTS.map(([id]) => id);
  let at = order.indexOf(Number(surfaceId));
  Model.act(() => {
    const list = shellImages();
    files.forEach((f, n) => {
      let id = Number(surfaceId);
      if (n > 0) {
        if (at < 0 || at + n >= order.length) id = Number(surfaceId) + n;
        else id = order[at + n];
      }
      const one = { id, path: f.path, name: f.name, w: f.width, h: f.height, stamp: String(Date.now()) };
      const i = list.findIndex((x) => Number(x.id) === id);
      if (i >= 0) list[i] = one; else list.push(one);
    });
    list.sort((a, b) => Number(a.id) - Number(b.id));
  });
  refreshShell();
  toast(files.length > 1 ? t('{count} 枚を割り当てました', { count: files.length }) : t('画像を割り当てました'));
}

function resetStage() {
  for (const id of ['balloon-0', 'balloon-1']) {
    const b = document.getElementById(id);
    b.querySelector('.balloon-text').textContent = '';
    b.classList.add('is-empty');
  }
  $('#balloon-0 .balloon-name').textContent = Model.project.meta.sakuraName || t('さくら');
  $('#balloon-1 .balloon-name').textContent = Model.project.meta.keroName || t('うにゅう');
  refreshShell();
}

function balloonOf(who) {
  return document.getElementById('balloon-' + (who === 1 ? 1 : 0));
}

async function playSakura(script) {
  const token = ++Session.playToken;
  resetStage();
  if (!script) return;
  const ops = Player.parseSakura(script);
  let who = 0;
  let target = balloonOf(0);

  for (const op of ops) {
    if (token !== Session.playToken) return;
    switch (op.op) {
      case 'scope':
        who = op.who;
        target = balloonOf(who);
        target.classList.remove('is-empty');
        break;
      case 'surface':
        setSurface(who, op.id);
        break;
      case 'text': {
        target.classList.remove('is-empty');
        const box = target.querySelector('.balloon-text');
        for (const ch of Array.from(op.text)) {
          if (token !== Session.playToken) return;
          box.appendChild(document.createTextNode(ch));
          target.scrollTop = target.scrollHeight;
          await sleep(22);
        }
        break;
      }
      case 'newline':
        target.querySelector('.balloon-text').appendChild(document.createTextNode('\n'));
        break;
      case 'clear':
        target.querySelector('.balloon-text').textContent = '';
        break;
      case 'wait':
        await sleep(Math.min(1200, op.ms));
        break;
      case 'clickwait': {
        const mark = Render.el('span', 'balloon-wait', ' ▼');
        target.querySelector('.balloon-text').appendChild(mark);
        await Promise.race([sleep(2500), waitForStageClick()]);
        mark.remove();
        break;
      }
      case 'choice': {
        const chip = Render.el('span', 'balloon-choice', op.label);
        chip.addEventListener('click', () => {
          const fn = Model.project.scripts.find(
            (s) => (s.kind === 'function' || s.kind === 'talk') && s.name === op.id
          );
          if (fn) Commands.runScript(fn);
          else toast(t('「{id}」というトークが見つかりません', { id: op.id }), true);
        });
        target.querySelector('.balloon-text').appendChild(chip);
        break;
      }
      case 'end':
      case 'close':
        return;
      default:
        break;
    }
  }
}

function waitForStageClick() {
  return new Promise((resolve) => {
    const stage = $('#stage');
    const fn = () => { stage.removeEventListener('click', fn); resolve(); };
    stage.addEventListener('click', fn);
  });
}

function init() {
  $('#btn-anim-add').addEventListener('click', addAnimation);
  $('#btn-shell-add').addEventListener('click', () => {
    const v = prompt(t('どの番号の立ち絵にしますか？（さくらは 0〜9、うにゅうは 10 以上）'), '3');
    if (v == null) return;
    const id = Math.max(0, Math.floor(Number(v)));
    if (!Number.isFinite(id)) { toast(t('番号は数字で入れてください'), true); return; }
    pickShellImage(id);
  });
}

export const Shell = { init, refreshShell, addAnimation, pickShellImage, resetStage, playSakura };
