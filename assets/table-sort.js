// 스캔 표 정렬. 머리글 버튼을 누르면 오름차순 → 내림차순으로 번갈아 정렬한다.
// 셀의 data-sort 값으로 비교하고(th의 data-type="text"면 문자열, 아니면 숫자),
// 값이 없는 셀(data-sort="")은 방향과 상관없이 항상 맨 아래로 보낸다. 동률은 원래(스캔) 순서.
(function (root) {
  function order(keys, dir, type) {
    // keys: 각 행의 원시 값 배열(문자열, ''이면 값 없음). 정렬된 행 인덱스 배열을 돌려준다.
    var sign = dir === 'descending' ? -1 : 1;
    var parsed = keys.map(function (v) {
      if (v === null || v === undefined || v === '') return null;
      if (type === 'text') return String(v).toLowerCase();
      var n = Number(v);
      return isNaN(n) ? null : n;
    });
    return parsed.map(function (_, i) { return i; }).sort(function (a, b) {
      var x = parsed[a], y = parsed[b];
      if (x === null || y === null) return x === y ? a - b : (x === null ? 1 : -1);
      if (x < y) return -sign;
      if (x > y) return sign;
      return a - b;
    });
  }
  root.StockTableSort = {order: order};

  if (typeof document === 'undefined') return;
  var table = document.querySelector('table[data-sortable]');
  if (!table || !table.tHead || !table.tBodies.length) return;
  var tbody = table.tBodies[0];
  var heads = Array.prototype.slice.call(table.tHead.rows[0].cells);
  var original = Array.prototype.slice.call(tbody.rows);

  heads.forEach(function (th, col) {
    var button = th.querySelector('button.sort');
    if (!button) return;
    button.addEventListener('click', function () {
      var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
      var keys = original.map(function (row) {
        var cell = row.cells[col];
        return cell ? cell.getAttribute('data-sort') : '';
      });
      var fragment = document.createDocumentFragment();
      order(keys, dir, th.getAttribute('data-type')).forEach(function (i) { fragment.appendChild(original[i]); });
      tbody.appendChild(fragment);
      heads.forEach(function (other) { other.removeAttribute('aria-sort'); });
      th.setAttribute('aria-sort', dir);
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
