/* 스캔 표 순서의 종목 이동. 왼쪽 = 이전, 오른쪽 = 다음. */
(() => {
  'use strict';
  const root = document.querySelector('[data-stock-navigation]');
  if (!root) return;
  let start = null;
  root.addEventListener('touchstart', event => {
    start = null;
    if (event.touches.length !== 1 ||
        event.target.closest('a, button, input, select, textarea, [contenteditable]')) return;
    const touch = event.touches[0];
    // 화면 가장자리는 브라우저 고유 제스처 영역으로 남긴다.
    if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
    start = {x: touch.clientX, y: touch.clientY, id: touch.identifier, time: Date.now()};
  }, {passive: true});
  root.addEventListener('touchmove', event => {
    if (!start) return;
    if (event.touches.length !== 1) { start = null; return; }
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - start.x), dy = Math.abs(touch.clientY - start.y);
    // 세로 스크롤로 시작한 동작은 종목 이동으로 바꾸지 않는다.
    if (dy > 12 && dy >= dx) { start = null; return; }
    if (dx > 12 && dx > dy * 1.5 && event.cancelable) event.preventDefault();
  }, {passive: false});
  root.addEventListener('touchend', event => {
    const origin = start;
    start = null;
    if (!origin || event.touches.length || Date.now() - origin.time > 800) return;
    const touch = Array.from(event.changedTouches).find(t => t.identifier === origin.id);
    if (!touch) return;
    const dx = touch.clientX - origin.x, dy = touch.clientY - origin.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const link = root.querySelector(dx < 0 ? '[data-stock-prev]' : '[data-stock-next]');
    if (link) window.location.assign(link.href);
  }, {passive: true});
  root.addEventListener('touchcancel', () => { start = null; }, {passive: true});
})();
