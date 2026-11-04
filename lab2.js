(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const NAMES = { add: 'sumador', sub: 'restador', mul: 'multiplicador', div: 'divisor', cmp: 'comparador' };
  let op = 'add';
  const bin = L2.bin;
  window.Lab2 = {};

  function download(name, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  window.Lab2.download = download;
  const N = () => +$('#n').value;
  const maxV = () => (1n << BigInt(N())) - 1n;
  function vals() {
    const m = maxV(); const a = BigInt(Math.max(0, Math.floor(+$('#a').value || 0))), b = BigInt(Math.max(0, Math.floor(+$('#b').value || 0)));
    return { a: a > m ? m : a, b: b > m ? m : b, clipped: a > m || b > m };
  }
  const tbl = (head, rows) => '<div class="tw"><table><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table></div>';
  const st = (t, body) => '<div class="st"><h3>' + t + '</h3>' + body + '</div>';
  const RL = r => (r === '<' ? '&lt;' : r === '>' ? '&gt;' : '=');
  const eq = t => '<div class="eq">' + t + '</div>';

  function renderSteps(n, a, b) {
    const A = bin(a, n), Bs = bin(b, n);
    const bins = st('Binario', eq(`A = ${a} = ${A}\nB = ${b} = ${Bs}`));
    if (op === 'add') {
      const s = L2.stepsAdd(n, a, b);
      return bins + st('Suma por columnas', tbl(['bit', 'A', 'B', 'Cin', 'S', 'Cout'], s.rows.map(r => [r.i, r.a, r.b, r.cin, r.s, r.cout]))) +
        st('Resultado', eq(`Cout = ${s.carry}\nS    = ${bin(s.result, n)} (${s.result})\nTotal = ${s.carry}${bin(s.result, n)} = ${s.total}\nDesbordamiento: ${s.overflow ? 'sí' : 'no'}`)) +
        st('Comprobación', eq(`${a} + ${b} = ${a + b}   ${s.total === a + b ? 'OK' : 'ERROR'}`));
    }
    if (op === 'sub') {
      const s = L2.stepsSub(n, a, b);
      return bins + st('Complemento a 2 de B', eq(`B  = ${Bs}\n~B = ${bin(s.nb, n)}\n-B = ${bin(s.twos, n)}`)) +
        st('A + ~B + 1', tbl(['bit', 'A', '~B', 'Cin', 'D', 'Cout'], s.rows.map(r => [r.i, r.a, r.bn, r.cin, r.s, r.cout]))) +
        st('Resultado', eq(`Cout = ${s.carry}\nPréstamo = ${s.borrow ? 1 : 0}\nD = ${bin(s.result, n)}${s.borrow ? '  (complemento a 2, valor −' + s.magnitude + ')' : '  (' + s.result + ')'}`)) +
        st('Comprobación', eq(`${a} − ${b} = ${s.diff}   ${(s.borrow ? s.result - (1n << BigInt(n)) : s.result) === s.diff ? 'OK' : 'ERROR'}`));
    }
    if (op === 'mul') {
      const s = L2.stepsMul(n, a, b);
      return bins + st('Productos parciales', tbl(['i', 'Bi', 'A·Bi·2^i', 'acumulado'], s.rows.map(r => [r.i, r.bi, r.ppStr, r.accStr]))) +
        st('Resultado', eq(`P = ${bin(s.result, 2 * n)} = ${s.result}`)) +
        st('Comprobación', eq(`${a} × ${b} = ${a * b}   ${s.check ? 'OK' : 'ERROR'}`));
    }
    if (op === 'cmp') {
      const s = L2.stepsCmp(n, a, b);
      return bins + st('Bits de mayor a menor', tbl(['bit', 'Ai', 'Bi', 'Xi = Ai⊙Bi', 'iguales antes', 'Ai·Bi′', 'Ai′·Bi'], s.rows.map(r => [r.i, r.a, r.b, r.x, r.prefix, r.gt, r.lt]))) +
        st('Resultado', eq(`Mayor (A>B) = ${s.mayor}\nIgual (A=B) = ${s.igual}\nMenor (A&lt;B) = ${s.menor}\n${s.rel === '=' ? 'A = B' : 'Primer bit distinto: ' + s.first + ' → A ' + RL(s.rel) + ' B'}`)) +
        st('Comprobación', eq(`${a} ${RL(s.rel)} ${b}   ${(s.rel === '>' ? a > b : s.rel === '<' ? a < b : a === b) ? 'OK' : 'ERROR'}`));
    }
    const s = L2.stepsDiv(n, a, b);
    return bins + st('Etapas', tbl(['etapa', 'resto desplazado', 'R − B', 'q', 'resto'], s.rows.map(r => [r.k, r.shiftA, r.tStr, r.q, r.restored ? r.A + ' (restaurado)' : r.A]))) +
      st('Resultado', eq(`Q = ${bin(s.quotient, n)} = ${s.quotient}\nR = ${bin(s.remainder, n)} = ${s.remainder}`)) +
      st('Comprobación', eq(`${s.quotient} × ${b} + ${s.remainder} = ${s.quotient * b + s.remainder}   ${s.ok ? 'OK' : 'ERROR'}`));
  }

  function result(n, a, b) {
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    let h = `<dl class="kv">${row('A', bin(a, n) + ' (' + a + ')')}${row('B', bin(b, n) + ' (' + b + ')')}</dl>`;
    if (op === 'add') { const s = L2.stepsAdd(n, a, b); h += `<div class="big">${s.total}</div><dl class="kv">${row('S', bin(s.result, n))}${row('Cout', s.carry)}</dl>`; }
    if (op === 'sub') { const s = L2.stepsSub(n, a, b); h += `<div class="big">${s.diff}</div><dl class="kv">${row('D', bin(s.result, n))}${row('Préstamo', s.borrow ? 1 : 0)}</dl>`; }
    if (op === 'mul') { const s = L2.stepsMul(n, a, b); h += `<div class="big">${s.result}</div><dl class="kv">${row('P', bin(s.result, 2 * n))}</dl>`; }
    if (op === 'div') { const s = L2.stepsDiv(n, a, b); h += `<div class="big">Q = ${s.quotient} · R = ${s.remainder}</div><dl class="kv">${row('Q', bin(s.quotient, n))}${row('R', bin(s.remainder, n))}</dl>`; }
    if (op === 'cmp') { const s = L2.stepsCmp(n, a, b); h += `<div class="big">A ${RL(s.rel)} B</div><dl class="kv">${row('Mayor', s.mayor)}${row('Igual', s.igual)}${row('Menor', s.menor)}</dl>`; }
    return h;
  }

  function render() {
    const n = N(); $('#nv').textContent = n;
    $('#opName').textContent = NAMES[op];
    $('#lb').firstChild.textContent = op === 'div' ? 'B (divisor)' : 'B';
    const v = vals(), w = $('#warn'); let msg = '';
    if (op === 'div' && v.b === 0n) { v.b = 1n; $('#b').value = 1; msg = 'B no puede ser 0'; }
    if (v.clipped) { msg = 'Valores limitados a ' + n + ' bits (máx. ' + maxV() + ')'; $('#a').value = v.a; $('#b').value = v.b; }
    w.hidden = !msg; w.textContent = msg;
    $('#resBox').innerHTML = result(n, v.a, v.b);
    $('#steps').innerHTML = renderSteps(n, v.a, v.b);
    const nl = L2.BUILD[op](n), s = L2.stats(nl);
    $('#stats').innerHTML = ['AND', 'OR', 'XOR', 'NOT'].map(k => `<span>${k} ${s[k]}</span>`).join('') + `<span>Total ${s.total}</span>`;
    if (window.Lab2Hook) window.Lab2Hook(op, n, v);
  }

  document.querySelectorAll('#ops button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#ops button').forEach(x => x.classList.remove('on')); b.classList.add('on'); op = b.dataset.op; render();
  });
  ['#n', '#a', '#b'].forEach(s => $(s).addEventListener('input', render));
  $('#rnd').onclick = () => { const m = Number(maxV()); $('#a').value = Math.floor(Math.random() * (m + 1)); $('#b').value = Math.floor(Math.random() * (m + 1)) || 1; render(); };
  render();
})();
