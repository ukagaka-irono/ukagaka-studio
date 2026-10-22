/* 伺かスタジオ - 「キャラと絵」の画面
 *
 * 立ち絵の絵の割りあて、仮シェルとバルーンの色、SERIKO のうごきの編集。
 * プロジェクトを変えたら Model.act / Model.pushUndo を通すだけで、描きなおしは
 * main.js の renderAll がこの画面の render() を呼んでくれます（見えているときだけ）。
 */

import { Model, BLEND_METHODS, GROUP_METHODS } from '../model/model.js';
import { $ } from '../core/dom.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { shellImages, shellImageOf, shellUrl, hasSurface } from './surfaces.js';
import { bindField, setVal } from './fields.js';
import { Stage } from './stage.js';

// ------------------------------------------------------------ 立ち絵の絵
// 標準の 6 枚。ここに無い番号も「追加」でふやせる。
const SHELL_SLOTS = [
  [0, t('さくら／通常')], [1, t('さくら／笑顔')], [2, t('さくら／驚き')],
  [10, t('うにゅう／通常')], [11, t('うにゅう／笑顔')], [12, t('うにゅう／驚き')],
];

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
    const card = Render.div('shell-slot');

    const thumb = Render.div('thumb');
    const pic = Render.el('img');
    pic.src = shellUrl(id);
    pic.alt = label;
    thumb.appendChild(pic);
    card.appendChild(thumb);

    card.appendChild(Render.div('slot-name', t('{label}（{id} 番）', { label, id })));
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
    card.appendChild(file);

    const btns = Render.div('slot-btns');
    const pickBtn = Render.el('button', 'btn tiny', img ? t('変える') : t('えらぶ'));
    pickBtn.addEventListener('click', () => pickShellImage(id));
    btns.appendChild(pickBtn);
    if (img) {
      const clear = Render.el('button', 'btn tiny', t('もどす'));
      clear.title = t('自動生成にもどす');
      clear.addEventListener('click', () => {
        Model.act(() => {
          const list = shellImages();
          const i = list.findIndex((x) => Number(x.id) === Number(id));
          if (i >= 0) list.splice(i, 1);
        });
      });
      btns.appendChild(clear);
    }
    card.appendChild(btns);
    box.appendChild(card);
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
  Stage.refresh();
  toast(files.length > 1 ? t('{count} 枚を割り当てました', { count: files.length }) : t('画像を割り当てました'));
}

/**
 * いまあるシェルのフォルダから、番号ごとの絵を読みこむ（段階 3-5d。exe の studio/src/shell_import.cpp）。
 * 同じ番号に割り当ててあった絵は置きかえ、ほかの番号はそのまま残します。
 */
async function importShellFolder() {
  const path = $('#shell-import-path').value.trim();
  if (!path) { toast(t('シェルのフォルダを入れてください'), true); return; }
  let r;
  try {
    r = await api('/api/shell/import', { method: 'POST', body: { path } });
  } catch (e) {
    toast(e.message, true);
    return;
  }
  const files = r.images || [];
  if (files.length) {
    Model.act(() => {
      const list = shellImages();
      for (const f of files) {
        const one = { id: Number(f.id), path: f.path, name: f.name, w: f.width, h: f.height, stamp: String(Date.now()) };
        const i = list.findIndex((x) => Number(x.id) === one.id);
        if (i >= 0) list[i] = one; else list.push(one);
      }
      list.sort((a, b) => Number(a.id) - Number(b.id));
    });
    Stage.refresh();
  }
  let msg = t('シェルの絵を {count} 枚読みこみました', { count: files.length });
  const comp = r.compositeOnly || [];
  if (comp.length) {
    msg += t('（{n} 個の番号は、surfaces.txt で絵を組み合わせているので読みこめませんでした: {ids}）',
      { n: comp.length, ids: comp.slice(0, 8).join(', ') + (comp.length > 8 ? ' …' : '') });
  }
  toast(msg, !files.length);
}

/** 仮シェルの見本（色を動かしている最中も呼ぶので、軽くしておく） */
function renderPreviews() {
  for (const id of [0, 1, 2, 10]) {
    const img = document.getElementById('shell-prev-' + id);
    if (img) img.setAttribute('src', shellUrl(id));
  }
}

// ------------------------------------------------------- うごき（SERIKO）
const ANIM_INTERVALS = [
  [t('呼んだときだけ'), 'never'],
  [t('いつも'), 'always'],
  [t('ときどき'), 'sometimes'],
  [t('まれに'), 'rarely'],
  [t('◯秒に一度くらい'), 'random'],
  [t('◯回しゃべるごと'), 'talk'],
  [t('起動時に一度だけ'), 'runonce'],
  [t('着せ替え（えらばれたら重ねる）'), 'bind'],
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
  [t('大きさを変える'), 'scaling'],
  [t('着せ替えの部品を重ねる'), 'add'],
  [t('かけあわせ'), 'blend-multiply'],
  [t('スクリーン'), 'blend-screen'],
  [t('オーバーレイ'), 'blend-overlay'],
  [t('足しあわせ'), 'blend-add'],
  // こまかい混ぜかた（Photoshop と同じ名前）は、surfaces.txt の名前のまま出します
  ...BLEND_METHODS.filter((m) => !['blend-multiply', 'blend-screen', 'blend-overlay', 'blend-add'].includes(m))
    .map((m) => [t('混ぜかた: {name}', { name: m.slice(6) }), m]),
  [t('ほかのうごきを動かす'), 'start'],
  [t('ほかのうごきを止める'), 'stop'],
  [t('いくつかのうちどれか 1 つを動かす'), 'alternativestart'],
  [t('いくつかのうちどれか 1 つを止める'), 'alternativestop'],
  [t('いくつかをまとめて動かす'), 'parallelstart'],
  [t('いくつかをまとめて止める'), 'parallelstop'],
  [t('着せ替えを描く順の場所'), 'insert'],
  [t('動く絵を差しこむ'), 'import'],
];

// 当たり判定のかたち
const ANIM_SHAPES = [
  [t('四角'), 'rect'],
  [t('だ円'), 'ellipse'],
  [t('丸'), 'circle'],
  [t('多角形'), 'polygon'],
];

/** 数や文字の入力欄。変えたら onInput でプロジェクトに書きこみ、元にもどす記録を 1 つ積む */
function numField(label, value, onInput, opts) {
  const f = Render.el('label', 'field' + (opts && opts.stacked ? '' : ' row'));
  f.appendChild(Render.el('span', null, label));
  const inp = Render.el('input');
  inp.type = (opts && opts.type) || 'number';
  inp.value = value;
  if (opts && opts.min != null) inp.min = String(opts.min);
  inp.addEventListener('change', () => {
    const snap = Model.clone(Model.project);
    onInput(inp.value);
    Model.pushUndo(snap);
  });
  f.appendChild(inp);
  return f;
}

/** ドロップダウン。えらんだら onPick で書きこむ */
function pickField(label, list, value, onPick, opts) {
  const f = Render.el('label', 'field' + (opts && opts.stacked ? '' : ' row'));
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
  });
  f.appendChild(s);
  return f;
}

/** こまの見本（立ち絵の絵。ほかのうごきを動かす・止める／動く絵は、文字で） */
function frameThumb(p) {
  const box = Render.div('frame-thumb');
  if (p.method === 'start' || p.method === 'stop') {
    box.classList.add('is-text');
    box.appendChild(Render.el('span', 'frame-icon', p.method === 'start' ? '▶' : '■'));
    box.appendChild(Render.el('span', null, t('うごき {id}', { id: p.surface })));
  } else if (GROUP_METHODS.includes(p.method)) {
    box.classList.add('is-text');
    box.appendChild(Render.el('span', 'frame-icon', /start$/.test(p.method) ? '▶' : '■'));
    box.appendChild(Render.el('span', null, (p.ids || []).length
      ? t('うごき {ids}', { ids: p.ids.join(', ') }) : t('（番号なし）')));
  } else if (p.method === 'insert') {
    box.classList.add('is-text');
    box.appendChild(Render.el('span', 'frame-icon', '👗'));
    box.appendChild(Render.el('span', null, t('着せ替え {id}', { id: p.surface })));
  } else if (p.method === 'scaling') {
    box.classList.add('is-text');
    box.appendChild(Render.el('span', 'frame-icon', '⤢'));
    box.appendChild(Render.el('span', null, `${p.x || 100}% × ${p.y || 100}%`));
  } else if (p.method === 'import') {
    box.classList.add('is-text');
    box.appendChild(Render.el('span', 'frame-icon', '🎞'));
    box.appendChild(Render.el('span', null, p.file || t('（ファイル名なし）')));
  } else if (hasSurface(p.surface)) {
    const img = Render.el('img');
    img.src = shellUrl(Number(p.surface) || 0);
    img.alt = t('立ち絵 {id}', { id: p.surface });
    box.appendChild(img);
  } else {
    box.classList.add('is-text');
    box.appendChild(Render.el('span', 'frame-icon', '？'));
    box.appendChild(Render.el('span', null, t('{id} 番の絵がありません', { id: p.surface })));
  }
  return box;
}

function renderFrames(a) {
  const strip = Render.div('frame-strip');
  a.patterns.forEach((p, k) => {
    const card = Render.div('frame-card');
    const top = Render.div('frame-top');
    top.appendChild(Render.el('span', 'frame-no', String(k + 1)));
    const rm = Render.el('button', 'btn tiny', '−');
    rm.title = t('このこまを消す');
    rm.addEventListener('click', () => Model.act(() => { a.patterns.splice(k, 1); }));
    top.appendChild(rm);
    card.appendChild(top);
    card.appendChild(frameThumb(p));

    card.appendChild(pickField(t('重ねかた'), ANIM_METHODS, p.method || 'base',
      (v) => { p.method = v; }, { stacked: true }));
    // 重ねかたによって、必要な欄が変わる
    if (p.method === 'start' || p.method === 'stop') {
      card.appendChild(numField(t('うごき番号'), p.surface,
        (v) => { p.surface = Math.max(0, Math.min(127, Number(v) || 0)); }, { min: 0 }));
    } else if (p.method === 'insert') {
      card.appendChild(numField(t('着せ替えのうごき番号'), p.surface,
        (v) => { p.surface = Math.max(0, Math.min(127, Number(v) || 0)); }, { min: 0 }));
    } else if (GROUP_METHODS.includes(p.method)) {
      card.appendChild(numField(t('うごき番号（, で区切る）'), (p.ids || []).join(', '), (v) => {
        p.ids = String(v).split(/[\s,.]+/).filter((s) => s !== '').map((s) => Math.floor(Number(s)))
          .filter((n, i, all) => Number.isFinite(n) && n >= 0 && n <= 127 && all.indexOf(n) === i);
      }, { type: 'text', stacked: true }));
    } else if (p.method === 'scaling') {
      card.appendChild(numField(t('ミリ秒'), p.wait, (v) => { p.wait = Math.max(0, Number(v) || 0); }, { min: 0 }));
      // 大きさの倍率（%）。小数も書けます。100 で元の大きさ
      card.appendChild(numField(t('よこの倍率 %'), p.x || 100, (v) => { p.x = Math.max(1, Math.min(1000, Number(v) || 100)); }));
      card.appendChild(numField(t('たての倍率 %'), p.y || 100, (v) => { p.y = Math.max(1, Math.min(1000, Number(v) || 100)); }));
    } else {
      if (p.method === 'import') {
        card.appendChild(numField(t('動く絵'), p.file || '', (v) => { p.file = String(v).trim(); },
          { type: 'text', stacked: true }));
      } else {
        card.appendChild(numField(t('立ち絵の番号'), p.surface, (v) => { p.surface = Number(v) || 0; }, { min: 0 }));
      }
      card.appendChild(numField(t('ミリ秒'), p.wait, (v) => { p.wait = Math.max(0, Number(v) || 0); },
        { min: 0 }));
      // 位置ずらし。0 のままなら基準の絵とぴったり重なります。
      card.appendChild(numField(t('よこ'), p.x || 0, (v) => { p.x = Number(v) || 0; }));
      card.appendChild(numField(t('たて'), p.y || 0, (v) => { p.y = Number(v) || 0; }));
    }
    strip.appendChild(card);
  });
  const add = Render.el('button', 'frame-add', t('＋ こまを足す'));
  add.addEventListener('click', () => Model.act(() => {
    a.patterns.push({ surface: a.base, wait: 200, method: 'base', x: 0, y: 0 });
  }));
  strip.appendChild(add);
  return strip;
}

function renderCollisions(a) {
  const cols = Render.div('anim-cols');
  (a.collisions || []).forEach((c, k) => {
    const cr = Render.div('anim-col');
    cr.appendChild(Render.el('span', 'anim-step', t('あたり')));
    cr.appendChild(numField(t('名前'), c.name, (v) => { c.name = String(v).trim(); }, { type: 'text' }));
    cr.appendChild(pickField(t('かたち'), ANIM_SHAPES, c.shape || 'rect', (v) => { c.shape = v; }));
    if (c.shape === 'circle') {
      cr.appendChild(numField(t('中心よこ'), c.x1, (v) => { c.x1 = Number(v) || 0; }));
      cr.appendChild(numField(t('中心たて'), c.y1, (v) => { c.y1 = Number(v) || 0; }));
      cr.appendChild(numField(t('半径'), c.x2, (v) => { c.x2 = Math.max(0, Number(v) || 0); }, { min: 0 }));
    } else if (c.shape === 'polygon') {
      cr.appendChild(numField(t('かどの位置'), c.points || '', (v) => { c.points = String(v); },
        { type: 'text' }));
      cr.appendChild(Render.el('span', 'hint', t('x,y を空白でならべます（3 つ以上）')));
    } else {
      cr.appendChild(numField(t('左'), c.x1, (v) => { c.x1 = Number(v) || 0; }));
      cr.appendChild(numField(t('上'), c.y1, (v) => { c.y1 = Number(v) || 0; }));
      cr.appendChild(numField(t('右'), c.x2, (v) => { c.x2 = Number(v) || 0; }));
      cr.appendChild(numField(t('下'), c.y2, (v) => { c.y2 = Number(v) || 0; }));
    }
    const rm = Render.el('button', 'btn tiny', '−');
    rm.title = t('この当たり判定を消す');
    rm.addEventListener('click', () => Model.act(() => { a.collisions.splice(k, 1); }));
    cr.appendChild(rm);
    cols.appendChild(cr);
  });
  const addCol = Render.el('button', 'btn tiny', t('＋ 当たり判定を足す'));
  addCol.title = t('このうごきが動いている間だけ、ここを触れるようにします');
  addCol.addEventListener('click', () => Model.act(() => {
    if (!Array.isArray(a.collisions)) a.collisions = [];
    a.collisions.push({
      name: 'Anim' + a.id, shape: 'rect',
      x1: 0, y1: 0, x2: 60, y2: 60, points: '',
    });
  }));
  cols.appendChild(addCol);
  return cols;
}

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
    head.appendChild(numField(t('番号'), a.id, (v) => { a.id = Math.max(0, Math.min(127, Number(v) || 0)); },
      { min: 0 }));
    head.appendChild(numField(t('どの立ち絵に付ける'), a.base, (v) => { a.base = Number(v) || 0; }, { min: 0 }));
    head.appendChild(pickField(t('いつ動く'), ANIM_INTERVALS, a.interval, (v) => { a.interval = v; }));
    if (a.interval === 'random' || a.interval === 'talk') {
      head.appendChild(numField(a.interval === 'random' ? t('秒') : t('回'), a.every,
        (v) => { a.every = Math.max(1, Number(v) || 1); }, { min: 1 }));
    }
    if (a.interval === 'bind') {
      // 着せ替え。種類と名前がシェルの descript.txt のメニューになります（付ける立ち絵が 10 番以上なら相方のもの）
      if (!a.bind) a.bind = { category: '', part: '', default: false };
      head.appendChild(numField(t('種類'), a.bind.category, (v) => { a.bind.category = String(v).trim(); }, { type: 'text' }));
      head.appendChild(numField(t('名前'), a.bind.part, (v) => { a.bind.part = String(v).trim(); }, { type: 'text' }));
      head.appendChild(pickField(t('はじめから'), [[t('着ない'), '0'], [t('着る'), '1']], a.bind.default ? '1' : '0',
        (v) => { a.bind.default = v === '1'; }));
    }
    const del = Render.el('button', 'btn tiny', t('消す'));
    del.addEventListener('click', () => Model.act(() => { Model.project.animations.splice(idx, 1); }));
    head.appendChild(del);
    row.appendChild(head);

    // パラパラの中身（どの絵を何ミリ秒）。左から順に出ます
    row.appendChild(renderFrames(a));
    // このうごきの間だけ有効な当たり判定（animationN.collisionM）
    row.appendChild(renderCollisions(a));

    if (!a.patterns.length) {
      row.appendChild(Render.div('hint', t('こまが無いので、書き出しても動きません。')));
    }
    if (a.interval === 'bind' && (!a.bind || !a.bind.category || !a.bind.part)) {
      row.appendChild(Render.div('hint', t('着せ替えは、種類と名前を入れると SSP のメニューに出ます（「着せ替える」ブロックでも切りかえられます）。')));
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
}

// ------------------------------------------------------------- まとめ
/** この画面をいまのプロジェクトで描きなおす（main.js が、この画面が見えているときに呼ぶ） */
function render() {
  const sh = Model.project.shell;
  setVal('#shell-sakura-color', sh.sakuraColor);
  setVal('#shell-sakura-cloth', sh.sakuraCloth);
  setVal('#shell-kero-color', sh.keroColor);
  setVal('#shell-kero-cloth', sh.keroCloth);
  setVal('#shell-balloon-on', !!sh.balloonEnabled);
  setVal('#shell-balloon-color', sh.balloonColor);
  renderPreviews();
  renderShellSlots();
  renderAnimList();
}

function init() {
  // 色を動かしている最中は、見本と「ためす」の立ち絵だけを描きなおす（軽いので）
  const live = () => { renderPreviews(); Stage.refresh(); };
  bindField('#shell-sakura-color', (v) => { Model.project.shell.sakuraColor = v; }, live);
  bindField('#shell-sakura-cloth', (v) => { Model.project.shell.sakuraCloth = v; }, live);
  bindField('#shell-kero-color', (v) => { Model.project.shell.keroColor = v; }, live);
  bindField('#shell-kero-cloth', (v) => { Model.project.shell.keroCloth = v; }, live);
  bindField('#shell-balloon-on', (v) => { Model.project.shell.balloonEnabled = !!v; });
  bindField('#shell-balloon-color', (v) => { Model.project.shell.balloonColor = v; });

  $('#btn-anim-add').addEventListener('click', addAnimation);
  $('#btn-shell-import').addEventListener('click', importShellFolder);
  $('#btn-shell-add').addEventListener('click', () => {
    const v = prompt(t('どの番号の立ち絵にしますか？（さくらは 0〜9、うにゅうは 10 以上）'), '3');
    if (v == null) return;
    const id = Math.max(0, Math.floor(Number(v)));
    if (!Number.isFinite(id)) { toast(t('番号は数字で入れてください'), true); return; }
    pickShellImage(id);
  });
}

export const Chara = { init, render, pickShellImage, addAnimation };
