/* 배당 계산기. 입력: 페이지 안 #dividend-data(JSON, 빌더가 collector 배당 테이블로 생성). 외부 호출 없음. */
(() => {
  'use strict';
  const source = document.getElementById('dividend-data');
  const root = document.querySelector('[data-dividend-calculator]');
  if (!source || !root) return;
  let data;
  try { data = JSON.parse(source.textContent); } catch (e) { return; }
  const bySymbol = new Map(data.items.map(item => [item.symbol, item]));
  const TAX = 0.15;  // 미국 배당 원천징수(한국 거주자 조세조약 세율)
  const STORE = 'stock-radar:dividend-holdings';
  const usd = v => '$' + v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const rows = root.querySelector('.holdings');
  const template = root.querySelector('#holding-row');
  const empty = root.querySelector('.result-empty');
  const result = root.querySelector('.result');

  function save() {
    const holdings = [...rows.children].map(row => ({
      symbol: row.querySelector('[name=symbol]').value.trim().toUpperCase(),
      mode: row.querySelector('[name=mode]').value,
      value: row.querySelector('[name=value]').value,
    }));
    try { localStorage.setItem(STORE, JSON.stringify(holdings)); } catch (e) { /* 저장 불가 환경은 무시 */ }
  }

  function addRow(holding = {}) {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('[name=symbol]').value = holding.symbol || '';
    row.querySelector('[name=mode]').value = holding.mode === 'amount' ? 'amount' : 'shares';
    row.querySelector('[name=value]').value = holding.value || '';
    row.querySelector('.remove').addEventListener('click', () => { row.remove(); if (!rows.children.length) addRow(); update(); });
    row.addEventListener('input', update);
    rows.appendChild(row);
    return row;
  }

  function cell(text, cls) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    return td;
  }

  function update() {
    let invested = 0, annual = 0;
    const lines = [];
    for (const row of rows.children) {
      const symbol = row.querySelector('[name=symbol]').value.trim().toUpperCase();
      const mode = row.querySelector('[name=mode]').value;
      const value = parseFloat(row.querySelector('[name=value]').value);
      const hint = row.querySelector('.hint');
      const item = bySymbol.get(symbol);
      if (!symbol) { hint.textContent = ''; continue; }
      if (!item) { hint.textContent = '배당 데이터가 없는 티커예요.'; continue; }
      hint.textContent = `${item.name} · $${item.price.toFixed(2)} · 연 ${usd(item.ttm)}/주 · ${item.frequency} · 수익률 ${item.yield.toFixed(2)}%`;
      if (!(value > 0)) continue;
      const shares = mode === 'amount' ? value / item.price : value;
      const cost = shares * item.price, yearly = shares * item.ttm;
      invested += cost; annual += yearly;
      lines.push({item, shares, cost, yearly});
    }
    save();
    if (!lines.length) { result.hidden = true; empty.hidden = false; return; }
    result.hidden = false; empty.hidden = true;
    root.querySelector('[data-out=annual]').textContent = usd(annual);
    root.querySelector('[data-out=monthly]').textContent = usd(annual / 12);
    root.querySelector('[data-out=after-tax]').textContent = usd(annual * (1 - TAX) / 12);
    root.querySelector('[data-out=yield]').textContent = (annual / invested * 100).toFixed(2) + '%';
    root.querySelector('[data-out=invested]').textContent = usd(invested);
    const body = root.querySelector('.breakdown tbody');
    body.replaceChildren(...lines.map(({item, shares, cost, yearly}) => {
      const tr = document.createElement('tr');
      const first = cell(item.symbol, 'l ticker');
      tr.append(first, cell(shares.toLocaleString('en-US', {maximumFractionDigits: 2})), cell(usd(cost)),
                cell(item.frequency, 'c'), cell(usd(yearly)), cell(usd(yearly / 12)));
      return tr;
    }));
  }

  root.querySelector('.add').addEventListener('click', () => { addRow().querySelector('[name=symbol]').focus(); });
  root.querySelectorAll('[data-pick]').forEach(button => button.addEventListener('click', () => {
    const blank = [...rows.children].find(row => !row.querySelector('[name=symbol]').value.trim());
    const row = blank || addRow();
    row.querySelector('[name=symbol]').value = button.dataset.pick;
    row.querySelector('[name=value]').focus();
    update();
  }));
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { saved = []; }
  (Array.isArray(saved) && saved.length ? saved : [{symbol: 'SCHD', mode: 'amount', value: '10000'}]).forEach(addRow);
  root.querySelector('.calc-content').hidden = false;
  root.querySelector('.calc-loading').hidden = true;
  update();
})();
