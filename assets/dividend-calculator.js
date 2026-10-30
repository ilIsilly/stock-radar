/* 배당 계산기. 입력: 페이지 안 #dividend-data(JSON, 빌더가 collector 배당 테이블로 생성). 외부 호출 없음. */
(function () {
  'use strict';
  const TAX = 0.15;  // 미국 배당 원천징수(한국 거주자 조세조약 세율)
  const MODES = {s: 'shares', a: 'amount', w: 'won'};
  const SYMBOL = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;

  // page_builder/money.py won()과 같은 규칙
  function won(value) {
    const v = Math.round(value);
    if (v < 10000) return v.toLocaleString('ko-KR') + '원';
    let eok = Math.floor(v / 1e8);
    let man = Math.round((v % 1e8) / 1e4);
    if (man === 10000) { eok += 1; man = 0; }
    if (eok) return eok.toLocaleString('ko-KR') + '억' + (man ? ' ' + man.toLocaleString('ko-KR') + '만 원' : ' 원');
    const m = Math.floor(v / 1e4), rest = v % 1e4;
    return m.toLocaleString('ko-KR') + '만' + (rest ? ' ' + rest.toLocaleString('ko-KR') + '원' : ' 원');
  }
  function usd(value, digits = 2) {
    return '$' + value.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
  }
  // 막대 위 짧은 표기: 12.3만, $1.2k
  function compact(value, rate) {
    if (rate) {
      const v = value * rate;
      return v >= 1e8 ? (v / 1e8).toFixed(1) + '억' : v >= 1e4 ? (v / 1e4).toFixed(v >= 1e5 ? 0 : 1) + '만' : Math.round(v).toLocaleString('ko-KR');
    }
    return value >= 1000 ? '$' + (value / 1000).toFixed(1) + 'k' : '$' + Math.round(value);
  }
  // 공유 링크 ?p=SCHD:a10000,JEPI:s100 (s 주식 수 · a 투자금 $ · w 투자금 원)
  function parseShare(raw) {
    if (typeof raw !== 'string' || !raw) return [];
    return raw.split(',').slice(0, 30).map(part => {
      const match = /^([A-Za-z0-9.\-]{1,15}):([saw])(\d+(?:\.\d{1,6})?)$/.exec(part.trim());
      if (!match) return null;
      const symbol = match[1].toUpperCase(), value = Number(match[3]);
      if (!SYMBOL.test(symbol) || !(value > 0) || value > 1e13) return null;
      return {symbol, mode: MODES[match[2]], value: match[3]};
    }).filter(Boolean);
  }
  function encodeShare(holdings) {
    const code = {shares: 's', amount: 'a', won: 'w'};
    return holdings.filter(h => SYMBOL.test(h.symbol) && Number(h.value) > 0 && code[h.mode])
      .map(h => `${h.symbol}:${code[h.mode]}${Number(h.value)}`).join(',');
  }
  // 세후(또는 세전) 월 target을 받는 데 필요한 투자금(같은 통화)
  function required(monthly, yieldPct, afterTax) {
    const rate = yieldPct / 100 * (afterTax ? 1 - TAX : 1);
    return rate > 0 ? monthly * 12 / rate : null;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {won, compact, parseShare, encodeShare, required};
  if (typeof document === 'undefined') return;

  const source = document.getElementById('dividend-data');
  const root = document.querySelector('[data-dividend-calculator]');
  if (!source || !root) return;
  let data;
  try { data = JSON.parse(source.textContent); } catch (e) { return; }
  const bySymbol = new Map(data.items.map(item => [item.symbol, item]));
  const RATE = data.usdkrw > 0 ? data.usdkrw : null;
  const STORE = 'stock-radar:dividend-holdings';
  const rows = root.querySelector('.holdings');
  const template = root.querySelector('#holding-row');
  const empty = root.querySelector('.result-empty');
  const result = root.querySelector('.result');
  const out = name => root.querySelector(`[data-out=${name}]`);
  const local = v => RATE ? won(v * RATE) : '';
  let portfolio = null;  // {invested, annual} — 목표 역산에서 포트폴리오 수익률로 씀

  if (!RATE) root.querySelectorAll('option[value=won]').forEach(o => o.remove());

  function holdings() {
    return [...rows.children].map(row => ({
      symbol: row.querySelector('[name=symbol]').value.trim().toUpperCase(),
      mode: row.querySelector('[name=mode]').value,
      value: row.querySelector('[name=value]').value,
    }));
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(holdings())); } catch (e) { /* 저장 불가 환경은 무시 */ }
  }

  function addRow(holding = {}) {
    const row = template.content.firstElementChild.cloneNode(true);
    const mode = row.querySelector('[name=mode]');
    row.querySelector('[name=symbol]').value = holding.symbol || '';
    mode.value = [...mode.options].some(o => o.value === holding.mode) ? holding.mode : 'shares';
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

  function calendar(lines) {
    const months = Array.from({length: 12}, () => 0);
    for (const {item, shares} of lines) {
      for (const [m, amount] of Object.entries(item.months || {})) months[Number(m) - 1] += shares * amount * (1 - TAX);
    }
    const max = Math.max(...months);
    const bars = root.querySelector('.cal-bars');
    bars.replaceChildren(...months.map((v, i) => {
      const col = document.createElement('div');
      col.className = 'cal-col';
      col.title = `${i + 1}월 세후 ${usd(v)}${RATE ? ' · ' + won(v * RATE) : ''}`;
      const amount = document.createElement('span');
      amount.className = 'cal-amount';
      amount.textContent = v > 0 ? compact(v, RATE) : '';
      const track = document.createElement('div');
      track.className = 'cal-track';
      const bar = document.createElement('i');
      bar.style.height = max > 0 ? Math.max(v / max * 100, v > 0 ? 4 : 0) + '%' : '0';
      track.appendChild(bar);
      const label = document.createElement('span');
      label.className = 'cal-month';
      label.textContent = `${i + 1}월`;
      col.append(amount, track, label);
      return col;
    }));
    const paid = months.filter(v => v > 0).length;
    const top = months.indexOf(max);
    root.querySelector('.cal-note').textContent = max > 0
      ? `12개월 중 ${paid}개월 배당락 · 가장 많은 달 ${top + 1}월 (세후 ${RATE ? won(max * RATE) : usd(max)})`
      : '';
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
      const special = item.special > 0 ? ` · 특별배당 ${usd(item.special, 4)} 제외` : '';
      hint.textContent = `${item.name} · $${item.price.toFixed(2)} · 연 ${usd(item.ttm)}/주 · ${item.frequency} · 수익률 ${item.yield.toFixed(2)}%${special}`;
      if (!(value > 0)) continue;
      const dollars = mode === 'won' && RATE ? value / RATE : value;
      const shares = mode === 'shares' ? value : dollars / item.price;
      const cost = shares * item.price, yearly = shares * item.ttm;
      invested += cost; annual += yearly;
      lines.push({item, shares, cost, yearly});
    }
    save();
    portfolio = lines.length ? {invested, annual} : null;
    target();
    if (!lines.length) { result.hidden = true; empty.hidden = false; return; }
    result.hidden = false; empty.hidden = true;
    out('annual').textContent = usd(annual);
    out('annual-krw').textContent = local(annual);
    out('monthly').textContent = usd(annual / 12);
    out('monthly-krw').textContent = local(annual / 12);
    out('after-tax').textContent = usd(annual * (1 - TAX) / 12);
    out('after-tax-krw').textContent = local(annual * (1 - TAX) / 12);
    out('yield').textContent = (annual / invested * 100).toFixed(2) + '%';
    out('invested').textContent = usd(invested) + (RATE ? ' · ' + won(invested * RATE) : '');
    const body = root.querySelector('.breakdown tbody');
    body.replaceChildren(...lines.map(({item, shares, cost, yearly}) => {
      const tr = document.createElement('tr');
      const first = document.createElement('td');
      first.className = 'l';
      const link = document.createElement('a');
      link.className = 'ticker';
      link.href = `dividend/${encodeURIComponent(item.symbol)}.html`;
      link.textContent = item.symbol;
      first.appendChild(link);
      tr.append(first, cell(shares.toLocaleString('en-US', {maximumFractionDigits: 2})), cell(usd(cost)),
                cell(item.frequency, 'c'), cell(usd(yearly)), cell(usd(yearly / 12)));
      return tr;
    }));
    calendar(lines);
  }

  // 목표 월배당 역산
  const goal = root.querySelector('[data-goal]');
  function target() {
    if (!goal) return;
    const amount = parseFloat(goal.querySelector('[name=goal-amount]').value);
    const currency = goal.querySelector('[name=goal-currency]').value;
    const afterTax = goal.querySelector('[name=goal-tax]').checked;
    const symbol = goal.querySelector('[name=goal-symbol]').value.trim().toUpperCase();
    const output = goal.querySelector('.goal-result');
    let yieldPct, basis, item = null;
    if (symbol) {
      item = bySymbol.get(symbol);
      if (!item) { output.textContent = '배당 데이터가 없는 티커예요.'; return; }
      yieldPct = item.yield; basis = `${item.symbol} (수익률 ${item.yield.toFixed(2)}%)`;
    } else if (portfolio) {
      yieldPct = portfolio.annual / portfolio.invested * 100; basis = `내 포트폴리오 (수익률 ${yieldPct.toFixed(2)}%)`;
    } else {
      output.textContent = '티커를 넣거나 위에서 보유 종목을 입력해 주세요.'; return;
    }
    if (!(amount > 0)) { output.textContent = '목표 월배당 금액을 입력해 주세요.'; return; }
    const need = required(amount, yieldPct, afterTax);
    if (!need) { output.textContent = '수익률이 0이라 계산할 수 없어요.'; return; }
    const needUsd = currency === 'won' ? need / RATE : need;
    const amountText = currency === 'won' ? won(amount) : usd(amount, 0);
    const needText = currency === 'won' ? `${won(need)} (${usd(needUsd, 0)})` : usd(need, 0) + (RATE ? ` (${won(need * RATE)})` : '');
    const sharesText = item ? ` · ${Math.ceil(needUsd / item.price).toLocaleString('en-US')}주` : '';
    output.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = needText;
    output.append(`${basis} 기준 ${afterTax ? '세후' : '세전'} 월 ${amountText} 목표: 필요 투자금 약 `, strong, sharesText);
  }
  if (goal) {
    if (!RATE) {
      goal.querySelector('[name=goal-currency]').value = 'usd';
      goal.querySelectorAll('option[value=won]').forEach(o => o.remove());
      goal.querySelector('[name=goal-amount]').value = '1000';
    }
    goal.addEventListener('input', target);
    goal.addEventListener('change', target);
  }

  // 공유 링크 복사
  const share = root.querySelector('[data-share]');
  if (share) share.addEventListener('click', () => {
    const code = encodeShare(holdings());
    const status = root.querySelector('.share-status');
    if (!code) { status.textContent = '공유할 보유 종목이 없어요.'; return; }
    const url = `${location.origin}${location.pathname}?p=${encodeURIComponent(code).replace(/%2C/g, ',').replace(/%3A/g, ':')}`;
    const done = () => { status.textContent = '링크를 복사했어요. 붙여 넣으면 같은 포트폴리오가 열려요.'; };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, () => window.prompt('이 링크를 복사하세요', url));
    } else {
      window.prompt('이 링크를 복사하세요', url);
    }
  });

  root.querySelector('.add').addEventListener('click', () => { addRow().querySelector('[name=symbol]').focus(); });
  root.querySelectorAll('[data-pick]').forEach(button => button.addEventListener('click', () => {
    const blank = [...rows.children].find(row => !row.querySelector('[name=symbol]').value.trim());
    const row = blank || addRow();
    row.querySelector('[name=symbol]').value = button.dataset.pick;
    row.querySelector('[name=value]').focus();
    update();
    row.scrollIntoView({block: 'center', behavior: 'smooth'});
  }));
  // 우선순위: 공유 링크 > 이 브라우저에 저장된 입력 > 기본 예시
  let initial = [];
  try { initial = parseShare(new URLSearchParams(location.search).get('p') || ''); } catch (e) { initial = []; }
  if (!initial.length) {
    try { initial = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { initial = []; }
    if (!Array.isArray(initial)) initial = [];
  }
  if (!initial.length) initial = [RATE ? {symbol: 'SCHD', mode: 'won', value: '10000000'} : {symbol: 'SCHD', mode: 'amount', value: '10000'}];
  initial.forEach(addRow);
  root.querySelector('.calc-content').hidden = false;
  root.querySelector('.calc-loading').hidden = true;
  update();
})();
