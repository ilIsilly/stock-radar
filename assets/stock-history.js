/* stock-api assets/stock-history.js에서 옮김. 입력: USD 일봉 OHLCV + collector MA5/MA20. 외부 호출 없음. */
(() => {
  'use strict';
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  // 기간 선택과 MA5/MA20 계산은 빌더(collector 지표)가 끝내서 넘긴다. 여기선 검증만.
  function prepare(rows) {
    const unique = new Map();
    if (!Array.isArray(rows)) throw new Error('Expected daily bars');
    for (const row of rows) {
      if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error('Invalid bar date');
      if (!['open', 'high', 'low', 'close', 'volume'].every(k => numeric(row[k]))) throw new Error('Invalid bar value');
      if (row.low <= 0 || row.volume < 0 || row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close)) throw new Error('Invalid OHLC');
      if (unique.has(row.date)) throw new Error('Duplicate bar date');
      unique.set(row.date, {...row, ma5: numeric(row.ma5) ? row.ma5 : null, ma20: numeric(row.ma20) ? row.ma20 : null});
    }
    const bars = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
    return {bars, start: bars.length ? bars[0].date : '', end: bars.length ? bars[bars.length - 1].date : ''};
  }
  function mount(root, payload) {
    const error = root.querySelector('.history-message');
    const content = root.querySelector('.history-content');
    try {
      if (payload.symbol !== root.dataset.symbol || payload.currency !== 'USD') throw new Error('Mismatched data');
      const data = prepare(payload.bars);
      const bars = data.bars;
      if (!bars.length) { error.textContent = '이 기간의 주가 데이터가 아직 없어요.'; return; }
      content.hidden = false; error.hidden = true;
      root.querySelector('.history-period').textContent = data.start.replaceAll('-', '.') + ' – ' + data.end.replaceAll('-', '.');
      const svg = root.querySelector('svg'), ns = 'http://www.w3.org/2000/svg';
      const enabled = {5: true, 20: true}; let selected = bars.length - 1, width = 300;
      const usd = v => '$' + v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      const extent = bars.flatMap(d => [d.low, d.high, d.ma5, d.ma20]).filter(numeric);
      const lo = Math.min(...extent), hi = Math.max(...extent), padding = Math.max((hi - lo) * .12, hi * .01);
      const min = lo - padding, max = hi + padding, maxVolume = Math.max(1, ...bars.map(d => d.volume));
      const add = (tag, attrs, text) => {
        const e = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        if (text !== undefined) e.textContent = text; svg.appendChild(e); return e;
      };
      function draw() {
        width = svg.getBoundingClientRect().width;
        if (width < 100) return;
        svg.setAttribute('viewBox', `0 0 ${width} 294`); svg.replaceChildren();
        const right = width - 60, step = (right - 4) / bars.length;
        const x = i => 4 + (i + .5) * step, y = v => 194 - (v - min) / (max - min) * 174;
        for (let i = 0; i < 5; i++) {
          const value = min + (max - min) * i / 4;
          add('line', {x1: 4, x2: right, y1: y(value), y2: y(value), stroke: '#eef1f4'});
          add('text', {x: right + 6, y: y(value) + 4}, value.toLocaleString('en-US', {maximumFractionDigits: 2}));
        }
        add('text', {x: right + 6, y: 11}, 'USD'); add('text', {x: 4, y: 216}, '거래량');
        bars.forEach((d, i) => {
          const color = d.close >= d.open ? '#05b169' : '#df1b41';
          add('line', {x1: x(i), x2: x(i), y1: y(d.high), y2: y(d.low), stroke: color});
          add('rect', {x: x(i) - step * .32, y: Math.min(y(d.open), y(d.close)), width: step * .64, height: Math.max(1, Math.abs(y(d.open) - y(d.close))), fill: color});
          add('rect', {x: x(i) - step * .32, y: 265 - d.volume / maxVolume * 38, width: step * .64, height: d.volume / maxVolume * 38, fill: color, opacity: .5});
        });
        [5, 20].forEach(n => {
          if (!enabled[n]) return;
          const coords = [];
          bars.forEach((d, i) => {if (numeric(d['ma' + n])) coords.push(`${coords.length ? 'L' : 'M'}${x(i)},${y(d['ma' + n])}`);});
          add('path', {d: coords.join(' '), fill: 'none', stroke: n === 5 ? '#e8a215' : '#8b5cf6', 'stroke-width': 1.4});
        });
        for (let i = 0; i < Math.min(3, bars.length); i++) {
          const k = Math.round(i * (bars.length - 1) / (Math.min(3, bars.length) - 1 || 1));
          add('text', {x: x(k), y: 286, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}, bars[k].date.slice(5).replace('-', '.'));
        }
        add('line', {x1: x(selected), x2: x(selected), y1: 20, y2: 266, stroke: '#8a919e', 'stroke-dasharray': '3 3'});
        add('circle', {cx: x(selected), cy: y(bars[selected].close), r: 3, fill: '#0052ff', stroke: '#fff'});
      }
      function select(i) {
        selected = Math.max(0, Math.min(bars.length - 1, i)); const d = bars[selected];
        root.querySelector('.history-date').textContent = d.date.replaceAll('-', '.');
        root.querySelector('.history-close').textContent = usd(d.close);
        ['open', 'high', 'low'].forEach(k => {root.querySelector(`[data-field="${k}"]`).textContent = usd(d[k]);});
        root.querySelector('[data-field="volume"]').textContent = Math.round(d.volume).toLocaleString('ko-KR') + '주';
        svg.setAttribute('aria-valuenow', selected);
        svg.setAttribute('aria-valuetext', `${d.date} 종가 ${usd(d.close)}`); draw();
      }
      svg.setAttribute('aria-valuemax', bars.length - 1);
      const atPointer = e => {const rect = svg.getBoundingClientRect(); select(Math.floor((e.clientX - rect.left - 4) / (rect.width - 64) * bars.length));};
      svg.addEventListener('pointerdown', atPointer);
      svg.addEventListener('pointermove', e => {if (e.buttons || e.pointerType === 'mouse') atPointer(e);});
      svg.addEventListener('keydown', e => {
        const keys = {ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: bars.length - 1};
        if (e.key in keys) {e.preventDefault(); select(keys[e.key]);}
      });
      root.querySelectorAll('[data-ma]').forEach(button => button.addEventListener('click', () => {
        const n = button.dataset.ma; enabled[n] = !enabled[n]; button.setAttribute('aria-pressed', enabled[n]); draw();
      }));
      new ResizeObserver(draw).observe(svg); select(selected);
    } catch (e) { content.hidden = true; error.hidden = false; error.textContent = '주가 데이터를 표시할 수 없어요.'; }
  }
  document.querySelectorAll('[data-stock-history]').forEach(root => {
    const source = document.getElementById(root.dataset.sourceId);
    try { mount(root, JSON.parse(source.textContent)); }
    catch (e) { root.querySelector('.history-message').textContent = '주가 데이터가 아직 연결되지 않았어요.'; }
  });
})();
