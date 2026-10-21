/* 伺かスタジオ - 右の列のタブの切りかえ */

function switchTab(name) {
  for (const t of document.querySelectorAll('.side-tab')) {
    t.classList.toggle('is-active', t.dataset.tab === name);
  }
  for (const p of document.querySelectorAll('.side-panel')) {
    p.classList.toggle('is-active', p.dataset.panel === name);
  }
}

function init() {
  for (const t of document.querySelectorAll('.side-tab')) {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  }
}

export const Tabs = { init, switchTab };
