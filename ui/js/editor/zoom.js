/* 伺かスタジオ - キャンバスの拡大・縮小 */

import { $ } from '../core/dom.js';
import { Session } from '../core/session.js';
import { Drag } from './drag.js';

function setZoom(z) {
  Session.zoom = Math.max(0.4, Math.min(1.6, z));
  $('#canvas').style.transform = 'scale(' + Session.zoom + ')';
  Drag.setZoom(Session.zoom);
  $('#btn-zoom-reset').textContent = Math.round(Session.zoom * 100) + '%';
}

function init() {
  $('#btn-zoom-in').addEventListener('click', () => setZoom(Session.zoom + 0.1));
  $('#btn-zoom-out').addEventListener('click', () => setZoom(Session.zoom - 0.1));
  $('#btn-zoom-reset').addEventListener('click', () => setZoom(1));
  $('#workspace').addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(Session.zoom + (e.deltaY < 0 ? 0.08 : -0.08));
  }, { passive: false });
}

export const Zoom = { init, setZoom };
