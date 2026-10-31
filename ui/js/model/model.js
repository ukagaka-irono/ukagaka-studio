/* 伺かスタジオ - プロジェクトのデータモデルと Undo */

import { AREAS, EVENTS, MOUSE_EVENTS, WHO_ANY, getDef } from './blocks.js';
import { normalizeDics } from './dics.js';
import { t } from '../i18n/i18n.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

// こまの重ねかた（SERIKO の描画メソッド）。書き出しでもこの名前だけ通します（studio/src/export_seriko.cpp と同じ一覧）。
// start / stop は別のうごきを動かす／止める、alternative〜 / parallel〜 は ids のどれか 1 つ／全部を動かす／止める、
// import は APNG などを差しこむ、insert は着せ替え（ids ではなく surface の番号）を描く順の場所、
// scaling は大きさ（x・y が倍率の %）、add は着せ替えの部品を重ねる指定です。
export const BLEND_METHODS = ['multiply', 'screen', 'overlay', 'add', 'add-glow', 'soft-light', 'hard-light',
  'color-dodge', 'color-burn', 'linear-burn', 'linear-light', 'vivid-light', 'pin-light', 'hard-mix',
  'darken', 'lighten', 'darker-color', 'lighter-color', 'difference', 'exclusion', 'subtract', 'divide',
  'color', 'luminosity', 'hue', 'saturation', 'dither'].map((m) => 'blend-' + m);
export const GROUP_METHODS = ['alternativestart', 'alternativestop', 'parallelstart', 'parallelstop'];
// 着せ替えの種類ごとのえらびかた（mustselect … かならず 1 つ、multiple … いくつでも）
export const BIND_OPTIONS = ['mustselect', 'multiple', 'mustselect+multiple'];
const ANIM_METHODS = ['overlay', 'overlayfast', 'base', 'replace',
  'interpolate', 'asis', 'reduce', 'move', 'scaling', 'add',
  ...BLEND_METHODS,
  'start', 'stop', ...GROUP_METHODS, 'insert', 'import'];
const ANIM_SHAPES = ['rect', 'ellipse', 'circle', 'polygon'];

// ---------------------------------------------------------- プロジェクトの形の版
// "format": "ikaga/1" の 1 が版です。形を変えるときは FORMAT_VERSION を 1 つ上げ、
// MIGRATIONS に「ひとつ前の版から直す関数」を足します（docs/ghost-json.md）。
// 読みこむときは、そのプロジェクトの版から順に、いまの版まで直していきます。
const FORMAT_NAME = 'ikaga';
const FORMAT_VERSION = 1;
const FORMAT = FORMAT_NAME + '/' + FORMAT_VERSION;
// 読める名前。nashi は元の「なしスタジオ」のプロジェクトで、形は ikaga と同じです。
const FORMAT_NAMES = [FORMAT_NAME, 'nashi'];
// MIGRATIONS[n] は「版 n のプロジェクトを、版 n+1 に直す」関数です（まだありません）。
//   例: 1: (p) => { p.settings.newThing = p.settings.oldThing; delete p.settings.oldThing; return p; },
const MIGRATIONS = {};

/**
 * プロジェクトの版を読む。{ ok, version, message } を返します。
 * "format" が無いものは、手で書いた ghost.json や古いもののために版 1 とみなします。
 */
function readFormat(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    return { ok: false, message: t('プロジェクトの形をしていません（中身が JSON のオブジェクトではありません）') };
  }
  if (p.format == null || p.format === '') return { ok: true, version: 1 };
  const m = /^([a-z]+)\/(\d+)$/.exec(String(p.format));
  if (!m || FORMAT_NAMES.indexOf(m[1]) < 0) {
    return { ok: false, message: t('知らない形のファイルです（"format": "{format}"）', { format: p.format }) };
  }
  const version = Number(m[2]);
  if (version < 1) return { ok: false, message: t('知らない形のファイルです（"format": "{format}"）', { format: p.format }) };
  if (version > FORMAT_VERSION) {
    return {
      ok: false,
      message: t('この伺かスタジオより新しい版で作られたプロジェクトです（"format": "{format}"、読めるのは {latest} まで）。伺かスタジオを新しくしてから開いてください',
        { format: p.format, latest: FORMAT }),
    };
  }
  return { ok: true, version };
}

/** いまの版まで直したコピーを返す。読めない形なら Error を投げます（元のものは書きかえません） */
function upgrade(p) {
  const f = readFormat(p);
  if (!f.ok) throw new Error(f.message);
  let out = clone(p);
  for (let v = f.version; v < FORMAT_VERSION; v++) {
    if (!MIGRATIONS[v]) throw new Error(t('版 {from} から {to} への直しかたがありません', { from: v, to: v + 1 }));
    out = MIGRATIONS[v](out);
  }
  out.format = FORMAT;
  return out;
}

let seq = 0;
function uid(prefix) {
  seq++;
  return (prefix || 'id') + '_' + Date.now().toString(36).slice(-4) + seq.toString(36);
}

const Model = {
  project: null,
  undoStack: [],
  redoStack: [],
  listeners: [],
  commitHooks: [],
  dirty: false,

  uid,
  clone,
  FORMAT,
  readFormat,

  // ------------------------------------------------------------ lifecycle
  newProject() {
    return {
      format: FORMAT,
      meta: {
        name: t('あたらしいゴースト'),
        sakuraName: t('さくら'),
        keroName: t('うにゅう'),
        craftman: '',
        craftmanUrl: '',
        homeUrl: '',
        version: '1.0.0',
        description: '',
      },
      settings: {
        randomTalkInterval: 180,
        randomTalkEnabled: true,
        noRepeatCount: 0,
        defaultSurfaceSakura: 0,
        defaultSurfaceKero: 10,
      },
      shell: {
        balloonEnabled: false, balloonColor: '#fffdf5',
        // バルーンの見た目（studio/src/export_balloon.cpp）。色を自分で決めないときは、地の色から線と文字の色を作ります
        balloonShape: 'round', balloonSize: 'normal', balloonTail: true,
        balloonCustomColors: false, balloonLineColor: '#8f8a7a', balloonTextColor: '#2e2b22',
        sakuraColor: '#f08cae', sakuraCloth: '#6e82c8',
        keroColor: '#8fd18a', keroCloth: '#e8b45c',
        images: [],       // { id, path, name, w, h } 用意した立ち絵
        areas: {},        // { 立ち絵の番号: [{ name, x1, y1, x2, y2 }] } 絵の上で描いた当たり判定
      },
      variables: [],
      scripts: [],
      dics: [],          // YAYA の辞書 [{ name, text }]（段階 8-2。model/dics.js）
    };
  },

  /**
   * 読みこんだプロジェクトを、いまの版の・欠けのない形にする。
   * 読めない形（新しすぎる版・知らない形・オブジェクトでないもの）なら Error を投げます。
   */
  normalize(src) {
    const p = upgrade(src);
    // 既定値は別に取っておく（out に p をかさねると、out.meta が p.meta そのものになり、欠けたところが埋まらない）
    const defaults = Model.newProject();
    const out = Object.assign(Model.newProject(), p);
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    out.meta = Object.assign(defaults.meta, obj(p.meta));
    // ゴーストの言語。無いもの（前からあるプロジェクト）は日本語のゴーストです。
    // 画面の言語で埋めないこと（日本語で作ったゴーストが、英語の画面で開いただけで英語にならないように）
    if (out.meta.lang !== 'ja' && out.meta.lang !== 'en') delete out.meta.lang;
    out.settings = Object.assign(defaults.settings, obj(p.settings));
    out.shell = Object.assign(defaults.shell, obj(p.shell));
    out.shell.images = (Array.isArray(out.shell.images) ? out.shell.images : [])
      .filter((x) => x && x.path && Number.isFinite(Number(x.id)))
      .map((x) => ({
        id: Number(x.id), path: String(x.path),
        name: x.name ? String(x.name) : String(x.path).split(/[\/]/).pop(),
        w: Number(x.w) || 0, h: Number(x.h) || 0,
      }))
      .sort((a, b) => a.id - b.id);
    // 絵の上で描いた当たり判定（立ち絵の番号ごと）。あればその番号の自動の当たり判定のかわりになります（export_shell.cpp）
    const areas = {};
    const srcAreas = out.shell.areas && typeof out.shell.areas === 'object' ? out.shell.areas : {};
    for (const id of Object.keys(srcAreas)) {
      if (!/^\d+$/.test(id) || !Array.isArray(srcAreas[id])) continue;
      areas[id] = srcAreas[id]
        .filter((a) => a && String(a.name || '').trim())
        .map((a) => ({
          name: String(a.name).trim(),
          x1: Math.round(Number(a.x1) || 0), y1: Math.round(Number(a.y1) || 0),
          x2: Math.round(Number(a.x2) || 0), y2: Math.round(Number(a.y2) || 0),
        }));
    }
    out.shell.areas = areas;
    out.dics = normalizeDics(out.dics);
    out.variables = Array.isArray(out.variables) ? out.variables : [];
    out.variables = out.variables
      .filter((v) => v && v.name)
      .map((v) => ({ name: String(v.name), value: v.value == null ? 0 : v.value }));
    // うごき（SERIKO のアニメーション）。書き出すと surfaces.txt に入ります。
    out.animations = (Array.isArray(out.animations) ? out.animations : [])
      .map((a, i) => ({
        id: Number.isFinite(Number(a && a.id)) ? Number(a.id) : i,
        base: Number(a && a.base) || 0,
        interval: (a && a.interval) ? String(a.interval) : 'never',
        every: Number(a && a.every) || 4,
        patterns: (Array.isArray(a && a.patterns) ? a.patterns : [])
          .map((p) => ({
            surface: Number(p && p.surface) || 0,
            wait: Number.isFinite(Number(p && p.wait)) ? Number(p.wait) : 200,
            method: ANIM_METHODS.indexOf(p && p.method) >= 0 ? p.method : 'base',
            x: Number(p && p.x) || 0,
            y: Number(p && p.y) || 0,
            file: p && p.file ? String(p.file) : '',
            // alternativestart などで動かす・止めるうごきの番号（0〜127）
            ids: (Array.isArray(p && p.ids) ? p.ids : String((p && p.ids) || '').split(/[\s,.]+/))
              .filter((n) => n !== '' && n != null)
              .map((n) => Math.floor(Number(n)))
              .filter((n, i, all) => Number.isFinite(n) && n >= 0 && n <= 127 && all.indexOf(n) === i),
          })),
        // 着せ替え（interval が bind のとき）。シェルの descript.txt の bindgroup になります
        bind: {
          category: String((a && a.bind && a.bind.category) || '').trim(),
          part: String((a && a.bind && a.bind.part) || '').trim(),
          default: !!(a && a.bind && a.bind.default),
          // その種類のえらびかた（descript.txt の bindoptionN.group）。'' はふつう（1 つだけ・外せる）
          option: BIND_OPTIONS.includes(a && a.bind && a.bind.option) ? a.bind.option : '',
          // これを着たときに、いっしょに着る着せ替えのうごき番号（addid）
          addid: (Array.isArray(a && a.bind && a.bind.addid) ? a.bind.addid : [])
            .map((n) => Math.floor(Number(n)))
            .filter((n, i, all) => Number.isFinite(n) && n >= 0 && n <= 127 && all.indexOf(n) === i),
        },
        // このうごきの間だけ有効な当たり判定
        collisions: (Array.isArray(a && a.collisions) ? a.collisions : [])
          .filter((c) => c && String(c.name || '').trim())
          .map((c) => ({
            name: String(c.name).trim(),
            shape: ANIM_SHAPES.indexOf(c.shape) >= 0 ? c.shape : 'rect',
            x1: Number(c.x1) || 0, y1: Number(c.y1) || 0,
            x2: Number(c.x2) || 0, y2: Number(c.y2) || 0,
            points: c.points ? String(c.points) : '',
          })),
      }));

    out.scripts = Array.isArray(out.scripts) ? out.scripts : [];
    let y = 40;
    out.scripts = out.scripts.filter((s) => s && typeof s === 'object').map((s) => {
      const script = Object.assign({ kind: 'event', blocks: [] }, s);
      script.id = script.id || uid('s');
      // 名前やイベント名が文字でないと、題を作るところで止まって、画面が描けなくなる（人からもらったファイル）
      for (const k of ['id', 'kind', 'event', 'name']) {
        if (script[k] != null && typeof script[k] !== 'string') script[k] = String(script[k]);
      }
      script.blocks = Array.isArray(script.blocks) ? script.blocks : [];
      if (typeof script.x !== 'number') script.x = 60;
      if (typeof script.y !== 'number') { script.y = y; y += 180; }
      if (script.folded !== true) delete script.folded;   // キャンバスでたたんでいる（editor/scripts.js）
      if (script.kind === 'talk' && script.weight == null) script.weight = 1;
      if (script.kind === 'talk' && typeof script.group !== 'string') script.group = '';
      if (script.kind === 'talk' && typeof script.when !== 'string') script.when = '';   // しぼり込み（段階 6-1）
      if ((script.kind === 'talk' || script.kind === 'function') && !script.name) {
        script.name = script.kind === 'talk' ? t('トーク') : t('なまえのないトーク');
      }
      if (script.kind === 'event') {
        if (!script.event) script.event = 'OnBoot';
        // マウス系イベントのしぼり込み（当たった場所・相手）
        if (typeof script.area !== 'string') script.area = '';
        if (typeof script.who !== 'number') script.who = -1;
        // ゴースト間通信のしぼり込み（だれが・なんと言ったら）
        if (typeof script.from !== 'string') script.from = '';
        if (typeof script.contains !== 'string') script.contains = '';
        // SSP のメニューに出す名前（「SSP のメニューからえらばれたとき」）
        if (typeof script.menu !== 'string') script.menu = '';
        // 書き出した ghost.json の when（アラームの 'HH:MM'・記念日の 'MM-DD'）を、編集できる形にほどく
        if (typeof s.when === 'string') {
          const hm = /^(\d\d):(\d\d)$/.exec(s.when);
          const md = /^(\d\d)-(\d\d)$/.exec(s.when);
          if (hm && script.event === 'OnStudioAlarm') { script.hour = Number(hm[1]); script.minute = Number(hm[2]); }
          if (md && script.event === 'OnStudioAnniversary') { script.month = Number(md[1]); script.day = Number(md[2]); }
          if (/^\d+$/.test(s.when) && script.event === 'OnStudioNthBoot') script.nth = Number(s.when);
          if (script.event === 'OnKeyPress') script.key = s.when;
          delete script.when;
        }
        if (script.event === 'OnStudioAlarm') {
          if (typeof script.hour !== 'number') script.hour = 12;
          if (typeof script.minute !== 'number') script.minute = 0;
        }
        if (script.event === 'OnStudioNthBoot' && typeof script.nth !== 'number') script.nth = 10;
        if (script.event === 'OnKeyPress' && typeof script.key !== 'string') script.key = '';
        if (script.event === 'OnStudioAnniversary') {
          if (typeof script.month !== 'number') script.month = 1;
          if (typeof script.day !== 'number') script.day = 1;
        }
        // くりかえしの間隔（1 なら毎秒）
        script.everySec = Math.max(1, Math.floor(Number(script.everySec) || 1));
        // 読み込んだゴーストの filter を、編集できる形にほどく
        if (s.filter && typeof s.filter === 'object') {
          if (typeof s.filter.area === 'string') script.area = s.filter.area;
          if (typeof s.filter.who === 'number') script.who = s.filter.who;
          if (typeof s.filter.from === 'string') script.from = s.filter.from;
          if (typeof s.filter.contains === 'string') script.contains = s.filter.contains;
          delete script.filter;
        }
      }
      return script;
    });
    return out;
  },

  /** プロジェクトを開く。読めない形なら Error を投げ、いま開いているものはそのまま残します */
  init(project) {
    Model.project = Model.normalize(project);   // 投げるならここ（まだ何も書きかえていない）
    Model.generation = (Model.generation || 0) + 1;   // 開きなおすたびに変わる（保存の最中に開きなおしたか。panels/dialog.js）
    Model.undoStack = [];
    Model.redoStack = [];
    Model.dirty = false;
    Model.emit();
  },

  // --------------------------------------------------------------- events
  onChange(fn) { Model.listeners.push(fn); },
  emit() { Model.listeners.forEach((fn) => fn(Model.project)); },
  /**
   * 「元にもどす」に積む前に、画面の側で持っているものをプロジェクトに書きもどす
   * （辞書の画面のブロックは、プロジェクトの外に持っていて、変わったら辞書のテキストに書きます。panels/dictionary.js）
   */
  onCommit(fn) { Model.commitHooks.push(fn); },
  flush() { Model.commitHooks.forEach((fn) => fn()); },

  /** すべての変更はこれを通す（Undo 用のスナップショットを取る） */
  act(fn) {
    const snap = clone(Model.project);
    let result;
    try {
      result = fn();
      Model.flush();
    } catch (e) {
      console.error(e);
      Model.project = snap;
      Model.emit();
      throw e;
    }
    if (result === false) return false;   // 変更なし
    Model.undoStack.push(snap);
    if (Model.undoStack.length > 80) Model.undoStack.shift();
    Model.redoStack = [];
    Model.dirty = true;
    Model.emit();
    return result;
  },

  /** 入力欄の編集など、すでに書き換えたあとで Undo 履歴だけ積みたいとき */
  pushUndo(snapshot) {
    if (!snapshot) return;
    Model.flush();
    if (JSON.stringify(snapshot) === JSON.stringify(Model.project)) return;
    Model.undoStack.push(snapshot);
    if (Model.undoStack.length > 80) Model.undoStack.shift();
    Model.redoStack = [];
    Model.dirty = true;
    Model.emit();
  },

  undo() {
    if (!Model.undoStack.length) return false;
    Model.redoStack.push(clone(Model.project));
    Model.project = Model.undoStack.pop();
    Model.dirty = true;
    Model.emit();
    return true;
  },

  redo() {
    if (!Model.redoStack.length) return false;
    Model.undoStack.push(clone(Model.project));
    Model.project = Model.redoStack.pop();
    Model.dirty = true;
    Model.emit();
    return true;
  },

  // -------------------------------------------------------------- scripts
  addScript(kind, opts) {
    const s = Object.assign({
      id: uid('s'),
      kind,
      x: 60, y: 60,
      blocks: [],
    }, opts || {});
    if (kind === 'event') {
      if (!s.event) s.event = 'OnBoot';
      if (typeof s.area !== 'string') s.area = '';
      if (typeof s.who !== 'number') s.who = -1;
      if (typeof s.from !== 'string') s.from = '';
      if (typeof s.contains !== 'string') s.contains = '';
      if (typeof s.menu !== 'string') s.menu = '';
      if (typeof s.everySec !== 'number') s.everySec = 1;
    }
    if (kind === 'talk') { s.name = s.name || t('トーク'); if (s.weight == null) s.weight = 1; }
    if (kind === 'function') s.name = s.name || t('あたらしいトーク');
    Model.project.scripts.push(s);
    return s;
  },

  removeScript(script) {
    const i = Model.project.scripts.indexOf(script);
    if (i >= 0) Model.project.scripts.splice(i, 1);
  },

  scriptTitle(s) {
    if (!s) return '';
    if (s.kind === 'event') {
      const found = EVENTS.find((e) => e[1] === s.event);
      let label = found ? found[0] : (s.event || t('イベント'));
      if (s.event === 'OnSecondChange') {
        const n = Math.max(1, Number(s.everySec) || 1);
        return n > 1 ? t('{n}秒ごとにくりかえす', { n }) : label;
      }
      if (MOUSE_EVENTS[s.event]) {
        // 仮シェルの名前に無いもの（うごきで足した当たり判定）は、そのまま出す
        const area = (AREAS.find((a) => a[1] === (s.area || '')) || [])[0] || s.area;
        const who = (WHO_ANY.find((w) => w[1] === (s.who == null ? -1 : s.who)) || [])[0];
        if (s.area || (s.who != null && s.who >= 0)) label = t('{who}の{area}が{label}', { who, area, label });
      }
      if (s.event === 'OnCommunicate' && (s.from || s.contains)) {
        const who = s.from ? s.from : t('だれか');
        label = s.contains ? t('{who}に「{contains}」と{label}', { who, contains: s.contains, label }) : t('{who}に{label}', { who, label });
      }
      const pad = (n) => String(Math.floor(Number(n) || 0)).padStart(2, '0');
      if (s.event === 'OnStudioAlarm') {
        label = t('毎日 {time} になったとき', { time: pad(s.hour == null ? 12 : s.hour) + ':' + pad(s.minute) });
      }
      if (s.event === 'OnStudioNthBoot') label = t('{n} 回目に起動したとき', { n: Number(s.nth) || 10 });
      if (s.event === 'OnKeyPress' && String(s.key || '').trim()) label = t('{key} キーが押されたとき', { key: String(s.key).trim() });
      if (s.event === 'OnStudioAnniversary') {
        label = t('毎年 {month} 月 {day} 日（記念日）', { month: Number(s.month) || 1, day: Number(s.day) || 1 });
      }
      if (s.event === 'OnStudioMenu' && String(s.menu || '').trim()) {
        label = t('メニューの「{menu}」がえらばれたとき', { menu: String(s.menu).trim() });
      }
      return label;
    }
    if (s.kind === 'talk') {
      const g = String(s.group || '').trim();
      return g ? t('ランダムトーク「{name}」（{group}）', { name: s.name || '', group: g })
        : t('ランダムトーク「{name}」', { name: s.name || '' });
    }
    if (s.kind === 'function') return t('「{name}」', { name: s.name || '' });
    return t('ブロックのかたまり');
  },

  functionNames() {
    return Model.project.scripts
      .filter((s) => s.kind === 'function' || s.kind === 'talk')
      .map((s) => s.name)
      .filter((n, i, a) => n && a.indexOf(n) === i);
  },

  // ------------------------------------------------------------ variables
  addVariable(name, value) {
    name = String(name || '').trim();
    if (!name) return null;
    if (Model.project.variables.some((v) => v.name === name)) return null;
    const v = { name, value: value == null ? 0 : value };
    Model.project.variables.push(v);
    return v;
  },

  renameVariable(oldName, newName) {
    newName = String(newName || '').trim();
    if (!newName || oldName === newName) return false;
    if (Model.project.variables.some((v) => v.name === newName)) return false;
    const v = Model.project.variables.find((x) => x.name === oldName);
    if (!v) return false;
    v.name = newName;
    // 変数の名前をえらぶ欄（var・set・change の name、ask・saori_call の into など）をぜんぶ
    Model.walkBlocks((b) => {
      const def = getDef(b);
      for (const [arg, a] of Object.entries((def && def.args) || {})) {
        if (a.kind === 'varname' && b[arg] === oldName) b[arg] = newName;
      }
    });
    return true;
  },

  removeVariable(name) {
    const i = Model.project.variables.findIndex((v) => v.name === name);
    if (i >= 0) Model.project.variables.splice(i, 1);
  },

  variableNames() { return Model.project.variables.map((v) => v.name); },

  // --------------------------------------------------------------- blocks
  /** すべてのブロックを訪問する。visit(block, stack, index) */
  walkBlocks(visit) {
    const walkStack = (stack) => {
      if (!Array.isArray(stack)) return;
      stack.forEach((b, i) => {
        if (!b || typeof b !== 'object') return;
        visit(b, stack, i);
        walkInner(b);
      });
    };
    const walkInner = (b) => {
      const d = getDef(b);
      if (d) {
        for (const s of d.subs || []) walkStack(b[s.key]);
        if (d.dynamic && Array.isArray(b[d.dynamic])) b[d.dynamic].forEach(walkStack);
        for (const name in (d.args || {})) {
          const v = b[name];
          if (v && typeof v === 'object' && v.type) { visit(v, null, -1); walkInner(v); }
        }
      }
    };
    Model.project.scripts.forEach((s) => walkStack(s.blocks));
  },

  countBlocks() {
    let n = 0;
    Model.walkBlocks(() => { n++; });
    return n;
  },
};

export { Model };
