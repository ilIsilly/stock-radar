(function () {
  'use strict';
  function parseAmount(raw) {
    const value = String(raw).trim();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,6})?$/.test(value)) return null;
    const amount = Number(value.replace(/,/g, ''));
    return Number.isFinite(amount) && amount >= 0 && amount <= 1e12 ? amount : null;
  }
  function convert(amount, from, to, rates) {
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rates[from]) ||
        !Number.isFinite(rates[to]) || rates[from] <= 0 || rates[to] <= 0) return null;
    const result = amount * rates[from] / rates[to];
    return Number.isFinite(result) ? result : null;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {parseAmount, convert};
  if (typeof document === 'undefined') return;
  const data = JSON.parse(document.getElementById('fx-data').textContent);
  const input = document.getElementById('fx-amount');
  const from = document.getElementById('fx-from');
  const to = document.getElementById('fx-to');
  const output = document.getElementById('fx-result');
  const error = document.getElementById('fx-error');
  const number = (value, digits = 2) => new Intl.NumberFormat('ko-KR', {maximumFractionDigits: digits}).format(value);
  function update() {
    const amount = parseAmount(input.value);
    const result = amount === null ? null : convert(amount, from.value, to.value, data.rates);
    const invalid = result === null;
    error.textContent = invalid ? '0부터 1조까지 숫자를 입력해 주세요. 소수점은 6자리까지 가능합니다.' : '';
    input.setAttribute('aria-invalid', String(invalid));
    output.textContent = invalid ? '—' : `${number(result)} ${to.value}`;
    const unit = convert(1, from.value, to.value, data.rates);
    document.getElementById('fx-unit').textContent = unit === null ? '' : `1 ${from.value} = ${number(unit, 6)} ${to.value}`;
    document.querySelectorAll('[data-currency]').forEach(card => {
      card.setAttribute('aria-pressed', String(card.dataset.currency === from.value && to.value === 'KRW'));
    });
  }
  input.addEventListener('input', update);
  from.addEventListener('change', update);
  to.addEventListener('change', update);
  document.getElementById('fx-swap').addEventListener('click', () => {
    [from.value, to.value] = [to.value, from.value];
    update();
  });
  document.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => {
    input.value = number(Number(button.dataset.amount)); update();
  }));
  document.querySelectorAll('[data-currency]').forEach(button => button.addEventListener('click', () => {
    from.value = button.dataset.currency; to.value = 'KRW'; update();
  }));
  function showAge() {
    document.getElementById('fx-stale').hidden = Date.now() - Date.parse(data.fetched_at) <= 48 * 60 * 60 * 1000;
  }
  showAge();
  setInterval(showAge, 60000);
  update();
})();
