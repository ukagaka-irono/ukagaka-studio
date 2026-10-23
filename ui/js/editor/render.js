/* 伺かスタジオ - ブロックの描画 */

import { AREAS, BLOCKS, EVENTS, MOUSE_EVENTS, PALETTE, createBlock, getDef } from '../model/blocks.js';
import { Model } from '../model/model.js';
import { yayaCallChoices } from '../model/yaya.js';
import { Commands } from '../core/commands.js';
import { Session } from '../core/session.js';
import { updateTitle } from '../core/title.js';
import { Scripts } from './scripts.js';
import { Notes } from './notes.js';
import { Parts } from './parts.js';
import { t } from '../i18n/i18n.js';

const INPUT_FONT = '600 12.5px "Segoe UI", "Yu Gothic UI", Meiryo, sans-serif';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const div = (cls, text) => el('div', cls, text);

let measurer = null;
function measureText(text) {
  if (!measurer) {
    measurer = el('span');
    measurer.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;font:' + INPUT_FONT;
    document.body.appendChild(measurer);
  }
  measurer.textContent = text == null ? '' : String(text);
  return measurer.offsetWidth;
}

function fitInput(input) {
  const w = measureText(input.value);
  const min = input.classList.contains('long') ? 46 : 26;
  input.style.width = Math.max(min, Math.min(320, w + 16)) + 'px';
}

// 変更を Undo に積むためのスナップショット保持
let editSnapshot = null;
function beginEdit() { editSnapshot = Model.clone(Model.project); }
function endEdit(changed) {
  if (changed && editSnapshot) Model.pushUndo(editSnapshot);
  editSnapshot = null;
}

// ------------------------------------------------------------ 入力スロット
function buildSlot(owner, argName, argDef, project) {
  const value = owner[argName];
  const slot = el('span', 'slot' + (argDef.mode === 'bool' ? ' bool' : ''));
  slot._slotOwner = owner;
  slot._slotArg = argName;
  slot._slotMode = argDef.mode || 'text';
  slot._slotLiteral = !!argDef.literal;   // 書いた文字だけを使う欄（ブロックははめられない）

  if (value && typeof value === 'object' && value.type) {
    slot.classList.add('filled');
    const inner = buildBlockEl(value, project);
    inner._slot = slot;
    slot.appendChild(inner);
    return slot;
  }
  if (argDef.mode === 'bool') return slot;   // 空の六角スロット

  const input = el('input');
  input.type = 'text';
  if (argDef.long) input.classList.add('long');
  input.value = value == null ? '' : String(value);
  fitInput(input);
  input.addEventListener('focus', () => { beginEdit(); input.select(); });
  input.addEventListener('input', () => {
    fitInput(input);
    owner[argName] = argDef.mode === 'number' && input.value !== '' && !isNaN(Number(input.value))
      ? Number(input.value)
      : input.value;
    updateTitle();   // 打っている間も、タイトルの ● だけは付けておく
  });
  input.addEventListener('change', () => endEdit(true));
  input.addEventListener('blur', () => endEdit(false));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    e.stopPropagation();
  });
  slot.appendChild(input);
  return slot;
}

function buildSelect(options, current, onPick) {
  const sel = el('select', 'field-drop');
  let matched = false;
  options.forEach(([label, value]) => {
    const o = el('option', null, label);
    o.value = String(value);
    if (String(value) === String(current)) { o.selected = true; matched = true; }
    sel.appendChild(o);
  });
  if (!matched && current != null && current !== '') {
    const o = el('option', null, String(current));
    o.value = String(current);
    o.selected = true;
    sel.insertBefore(o, sel.firstChild);
  }
  sel.addEventListener('change', () => {
    const picked = options.find(([, v]) => String(v) === sel.value);
    onPick(picked ? picked[1] : sel.value, sel);
  });
  sel.addEventListener('pointerdown', (e) => e.stopPropagation());
  return sel;
}

// -------------------------------------------------------------- フィールド
function buildField(owner, name, argDef, project, blockEl) {
  switch (argDef.kind) {
    case 'dropdown':
      return buildSelect(argDef.options, owner[name], (v) => {
        Model.act(() => { owner[name] = v; });
      });

    case 'eventname': {
      const wrap = el('span', 'field-wrap');
      const isKnown = EVENTS.some(([, v]) => v === owner[name]);
      const sel = buildSelect(EVENTS, isKnown ? owner[name] : '__custom__', (v) => {
        Model.act(() => {
          owner[name] = v === '__custom__' ? (isKnown ? '' : owner[name]) : v;
          // 形が変わる帽子（時刻・日づけなど）の欄が無ければ、最初の値を入れておく
          const def = owner.kind === 'event' ? BLOCKS[hatKeyFor(owner)] : null;
          for (const [k, a] of Object.entries((def && def.args) || {})) {
            if (owner[k] === undefined && a.def !== undefined) owner[k] = a.def;
          }
        });
      });
      wrap.appendChild(sel);
      if (!isKnown) {
        const input = el('input');
        input.className = 'long';
        input.style.cssText = 'margin-left:6px;border:0;border-radius:999px;padding:3px 8px;font:' + INPUT_FONT;
        input.value = owner[name] || '';
        fitInput(input);
        input.addEventListener('focus', beginEdit);
        input.addEventListener('input', () => { fitInput(input); owner[name] = input.value; });
        input.addEventListener('change', () => endEdit(true));
        input.addEventListener('blur', () => endEdit(false));
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        wrap.appendChild(input);
      }
      return wrap;
    }

    // 当たり判定の名前。仮シェルのものに、うごきで足したものを継ぎ足す。
    case 'areaname': {
      const opts = AREAS.slice();
      const seen = {};
      for (const [, v] of opts) seen[v] = 1;
      // 絵の上で描いた当たり判定の名前（あたま・かお…にないもの）
      for (const list of Object.values((Model.project.shell || {}).areas || {})) {
        for (const c of list) {
          if (!c.name || seen[c.name]) continue;
          seen[c.name] = 1;
          opts.push([t('{name}（描いた当たり判定）', { name: c.name }), c.name]);
        }
      }
      for (const a of (Model.project.animations || [])) {
        for (const c of (a.collisions || [])) {
          if (!c.name || seen[c.name]) continue;
          seen[c.name] = 1;
          opts.push([t('{name}（うごき {id}）', { name: c.name, id: a.id }), c.name]);
        }
      }
      if (owner[name] && !seen[owner[name]]) opts.push([owner[name], owner[name]]);
      return buildSelect(opts, owner[name], (v) => {
        Model.act(() => { owner[name] = v; });
      });
    }

    case 'varname': {
      const opts = Model.variableNames().map((n) => [n, n]);
      if (!opts.length) opts.push([t('（変数がありません）'), '']);
      opts.push([t('＋ あたらしい変数…'), '__new__']);
      return buildSelect(opts, owner[name], (v, sel) => {
        if (v === '__new__') {
          const created = Commands.promptNewVariable();
          sel.value = created || owner[name] || '';
          if (created) Model.act(() => { owner[name] = created; });
          return;
        }
        Model.act(() => { owner[name] = v; });
      });
    }

    case 'funcname': {
      const opts = Model.functionNames().map((n) => [n, n]);
      if (!opts.length) opts.push([t('（トークがありません）'), '']);
      opts.push([t('＋ あたらしいトーク…'), '__new__']);
      return buildSelect(opts, owner[name], (v, sel) => {
        if (v === '__new__') {
          const created = Scripts.promptNewFunction();
          sel.value = created || owner[name] || '';
          if (created) Model.act(() => { owner[name] = created; });
          return;
        }
        Model.act(() => { owner[name] = v; });
      });
    }

    default: {
      const slot = buildSlot(owner, name, argDef, project, blockEl);
      // つないだ手書きのゴーストの関数から、えらべるようにする（書くこともできます）
      const choices = argDef.pick === 'yayaFunctions' && !(owner[name] && typeof owner[name] === 'object')
        ? yayaCallChoices((Session.yayaGhost || {}).functions) : [];
      if (!choices.length) return slot;
      const wrap = el('span', 'field-wrap');
      wrap.appendChild(slot);
      const pick = buildSelect([['▾', ''], ...choices.map((n) => [n, n])], '', (v) => {
        if (v) Model.act(() => { owner[name] = v; });
      });
      pick.classList.add('field-pick');
      pick.title = t('つないだゴーストの関数からえらぶ');
      wrap.appendChild(pick);
      return wrap;
    }
  }
}

function fillRow(row, owner, def, project, blockEl) {
  for (const part of def.parts) {
    if (part.lbl != null) {
      const lbl = part.lbl.replace(/^\s+|\s+$/g, ' ');
      if (lbl.trim() === '' ) continue;
      row.appendChild(el('span', 'lbl', part.lbl.trim()));
    } else {
      const argDef = (def.args || {})[part.arg];
      if (!argDef) continue;
      row.appendChild(buildField(owner, part.arg, argDef, project, blockEl));
    }
  }
}

// ------------------------------------------------------------------ block
function buildBlockEl(block, project) {
  const def = getDef(block);
  if (!def) {
    const unknown = div('blk cat-control');
    const row = div('row sh-stack', t('？ 不明なブロック: {type}', { type: block && block.type }));
    unknown.appendChild(row);
    unknown._blk = block;
    return unknown;
  }

  const wrap = div('blk cat-' + def.cat);
  wrap._blk = block;
  wrap._def = def;
  if (def.shape === 'reporter') wrap.classList.add('reporter');
  if (def.shape === 'boolean') wrap.classList.add('boolean');
  if (block.disabled) wrap.classList.add('disabled');

  const shapeClass = {
    stack: 'sh-stack', cap: 'sh-cap', hat: 'sh-hat', c: 'sh-ctop',
    reporter: '', boolean: '',
  }[def.shape] || '';

  const row = div('row ' + shapeClass);
  fillRow(row, block, def, project, wrap);
  wrap.appendChild(row);

  if (def.shape === 'c') {
    const subs = [];
    if (def.dynamic) {
      if (!Array.isArray(block[def.dynamic])) block[def.dynamic] = [[], []];
      block[def.dynamic].forEach((arr, i) => {
        subs.push({ arr, label: i === 0 ? null : t('または') });
      });
    } else {
      for (const s of def.subs || []) {
        if (!Array.isArray(block[s.key])) block[s.key] = [];
        subs.push({ arr: block[s.key], label: s.label });
      }
    }

    subs.forEach((s, i) => {
      if (i > 0) {
        const mid = div('row sh-cmid');
        mid.appendChild(el('span', 'branch-label', s.label || ''));
        wrap.appendChild(mid);
      }
      const mouth = div('c-mouth');
      mouth.appendChild(buildStackEl(s.arr, project, { block, key: def.dynamic || (def.subs[i] || {}).key }));
      wrap.appendChild(mouth);
    });

    const bottom = div('row sh-cbottom');
    if (def.dynamic) {
      const minus = el('button', 'blk-btn', '−');
      minus.title = t('えらび先をへらす');
      minus.addEventListener('pointerdown', (e) => e.stopPropagation());
      minus.addEventListener('click', () => {
        Model.act(() => {
          if (block[def.dynamic].length > 1) block[def.dynamic].pop();
        });
      });
      const plus = el('button', 'blk-btn', '＋');
      plus.title = t('えらび先をふやす');
      plus.addEventListener('pointerdown', (e) => e.stopPropagation());
      plus.addEventListener('click', () => {
        Model.act(() => { block[def.dynamic].push([]); });
      });
      bottom.appendChild(minus);
      bottom.appendChild(plus);
    }
    wrap.appendChild(bottom);
  }
  const note = Notes.build(block);   // メモ（かたまりの右に、付せんのように出す）
  if (note) wrap.appendChild(note);
  return wrap;
}

function buildStackEl(arr, project, owner) {
  const st = div('stack');
  st._stack = arr;
  st._owner = owner;
  arr.forEach((b, i) => {
    const be = buildBlockEl(b, project);
    be._stack = arr;
    be._index = i;
    st.appendChild(be);
  });
  return st;
}

const HAT_DEF = { event: '@event', talk: '@talk', function: '@function' };

// マウス系イベントのときだけ、しぼり込みつきの帽子ブロックに変わる
function hatKeyFor(script) {
  if (script.kind === 'event') {
    if (MOUSE_EVENTS[script.event]) return '@event.touch';
    if (script.event === 'OnSecondChange') return '@event.every';
    if (script.event === 'OnCommunicate') return '@event.comm';
    if (script.event === 'OnStudioMenu') return '@event.menu';
    if (script.event === 'OnStudioAlarm') return '@event.alarm';
    if (script.event === 'OnStudioAnniversary') return '@event.anniv';
  }
  return HAT_DEF[script.kind];
}

function buildScriptEl(script, project, options) {
  const opts = options || {};
  const wrap = div('script');
  wrap._script = script;
  if (!opts.noPosition) {
    wrap.style.left = (script.x || 0) + 'px';
    wrap.style.top = (script.y || 0) + 'px';
  }

  if (!opts.noTools) {
    const tools = div('script-tools');
    const mk = (label, title, fn) => {
      const b = el('button', 'script-tool', label);
      b.title = title;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    if (script.blocks.length || script.folded) {
      tools.appendChild(mk(script.folded ? '▸' : '▾', script.folded ? t('ひろげる') : t('たたむ'), () => Scripts.toggleFold(script)));
    }
    tools.appendChild(mk('▶', t('このかたまりを実行してみる'), () => Commands.runScript(script)));
    tools.appendChild(mk('⧉', t('複製する'), () => Scripts.duplicateScript(script)));
    tools.appendChild(mk('✕', t('削除する'), () => Scripts.deleteScript(script)));
    wrap.appendChild(tools);
  }

  const hatKey = hatKeyFor(script);
  if (hatKey) {
    const def = BLOCKS[hatKey];
    const hat = div('blk cat-' + def.cat + ' hat');
    hat._script = script;
    hat._isHat = true;
    const row = div('row sh-hat');
    fillRow(row, script, def, project, hat);
    hat.appendChild(row);
    const note = opts.noTools ? null : Notes.build(script);   // かたまりのメモ
    if (note) hat.appendChild(note);
    wrap.appendChild(hat);
  }

  // たたんでいるときは、中のブロックのかわりに数だけを出す（押すとひろげる）
  if (script.folded && !opts.noTools) {
    wrap.classList.add('is-folded');
    const bar = el('button', 'fold-summary', t('… {n} 個のブロック（たたんでいます）', { n: Scripts.countBlocks(script) }));
    bar.title = t('押すと、ひろげます');
    bar.addEventListener('click', (e) => { e.stopPropagation(); Scripts.toggleFold(script); });
    wrap.appendChild(bar);
    return wrap;
  }

  wrap.appendChild(buildStackEl(script.blocks, project, { script }));
  return wrap;
}

// -------------------------------------------------------------- workspace
function renderWorkspace(canvas, project) {
  canvas.textContent = '';
  for (const script of project.scripts) {
    canvas.appendChild(buildScriptEl(script, project));
  }
}

// ---------------------------------------------------------------- palette
function renderPalette(container, catId, project) {
  container.textContent = '';
  const entries = PALETTE[catId] || [];

  for (const entry of entries) {
    if (typeof entry === 'object' && entry.note) {
      container.appendChild(div('palette-note', entry.note));
      continue;
    }
    if (typeof entry === 'object' && entry.button) {
      const b = el('button', 'btn small', entry.label);
      b.style.marginBottom = '10px';
      b.addEventListener('click', () => Commands.promptNewVariable());
      container.appendChild(b);
      continue;
    }
    if (entry === '@parts') {
      if (!Parts.list.length) container.appendChild(div('palette-note', t('まだ部品がありません。')));
      for (const part of Parts.list) {
        const box = div('palette-part');
        box._palettePart = part;
        box.title = t('ドラッグして置きます。右クリックで名前を変える・消す');
        const head = div('palette-part-name', part.name);
        head.appendChild(el('small', null, t('ブロック {n} こ', { n: part.blocks.length })));
        box.appendChild(head);
        box.appendChild(buildStackEl(Model.clone(part.blocks), project));
        container.appendChild(box);
      }
      continue;
    }
    if (entry === '@vars') {
      const names = Model.variableNames();
      if (!names.length) {
        container.appendChild(div('palette-note', t('まだ変数がありません。上のボタンで作ってみましょう。')));
      }
      for (const name of names) {
        const block = { type: 'var', name };
        const holder = div('script');
        const be = buildBlockEl(block, project);
        be._paletteKey = 'var';
        be._paletteBlock = block;
        holder.appendChild(be);
        container.appendChild(holder);
      }
      continue;
    }

    const def = BLOCKS[entry];
    if (!def) continue;

    if (def.hat) {
      const fake = {
        id: 'palette', kind: def.kind, blocks: [],
        event: 'OnBoot', name: def.kind === 'talk' ? t('トーク') : t('あたらしいトーク'), weight: 1,
        area: '', who: -1,
      };
      // 帽子ブロックの既定値（なでなでブロックなど）を反映する
      for (const argName in (def.args || {})) {
        const a = def.args[argName];
        if (a && a.def !== undefined) fake[argName] = a.def;
      }
      const se = buildScriptEl(fake, project, { noPosition: true, noTools: true });
      se.firstChild._paletteHat = def.kind;
      se.firstChild._paletteScript = fake;
      container.appendChild(se);
      continue;
    }

    const block = createBlock(entry);
    if (!block) continue;
    const holder = div('script');
    const be = buildBlockEl(block, project);
    be._paletteKey = entry;
    be._paletteBlock = block;
    holder.appendChild(be);
    container.appendChild(holder);
  }
}

export const Render = {
  buildBlockEl, buildStackEl, buildScriptEl, renderWorkspace, renderPalette,
  measureText, div, el, hatKeyFor,
};
