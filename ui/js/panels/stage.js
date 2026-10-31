/* 伺かスタジオ - 「ためす」のステージ（さくらスクリプトを受けとって、吹き出しと立ち絵を動かす） */

import { Model } from '../model/model.js';
import { Player } from '../model/player.js';
import { $, sleep } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { Session } from '../core/session.js';
import { Commands } from '../core/commands.js';
import { Render } from '../editor/render.js';
import { t } from '../i18n/i18n.js';
import { shellImageOf, shellUrl } from './surfaces.js';

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
  img.dataset.surface = String(id);   // さわったときに、どの立ち絵の当たり判定を使うか（panels/touch.js）
  if (img.getAttribute('src') !== url) img.setAttribute('src', url);
}

/** 立ち絵をいつもの顔にもどし、吹き出しの名前をいまのプロジェクトに合わせる */
function refresh() {
  setSurface(0, 0);
  setSurface(1, 10);
  $('#balloon-0 .balloon-name').textContent = Model.project.meta.sakuraName || t('さくら');
  $('#balloon-1 .balloon-name').textContent = Model.project.meta.keroName || t('うにゅう');
}

/** 吹き出しを空にして、はじめの形にもどす */
function reset() {
  for (const id of ['balloon-0', 'balloon-1']) {
    const b = document.getElementById(id);
    b.querySelector('.balloon-text').textContent = '';
    b.classList.add('is-empty');
  }
  refresh();
}

function balloonOf(who) {
  return document.getElementById('balloon-' + (who === 1 ? 1 : 0));
}

async function playSakura(script) {
  const token = ++Session.playToken;
  reset();
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
        await waitForStageClick(2500);
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

/** ステージがクリックされるか、ms たつまで待つ（どちらでも、待つのに付けたものは外す） */
function waitForStageClick(ms) {
  return new Promise((resolve) => {
    const stage = $('#stage');
    let timer = 0;
    const done = () => { stage.removeEventListener('click', done); clearTimeout(timer); resolve(); };
    stage.addEventListener('click', done);
    timer = setTimeout(done, ms);
  });
}

export const Stage = { refresh, reset, playSakura };
