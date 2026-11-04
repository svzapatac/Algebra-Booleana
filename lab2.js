(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const NAMES = { add: 'sumador', sub: 'restador', mul: 'multiplicador', div: 'divisor' };
  let op = 'add';
  const bin = L2.bin;

  function download(name, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const N = () => +$('#n').value;
  const maxV = () => (1n << BigInt(N())) - 1n;
  function vals() {
    const m = maxV(); let a = BigInt(Math.max(0, Math.floor(+$('#a').value || 0))), b = BigInt(Math.max(0, Math.floor(+$('#b').value || 0)));
    return { a: a > m ? m : a, b: b > m ? m : b, clipped: a > m || b > m };
  }
  const tbl = (head, rows) => '<div class="tw"><table><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table></div>';
  const st = (t, body) => '<div class="st"><b>' + t + '</b><div>' + body + '</div></div>';

  function renderSteps(n, a, b) {
    const A = bin(a, n), Bs = bin(b, n);
    if (op === 'add') {
      const s = L2.stepsAdd(n, a, b);
      return st('1. Escribe A y B en binario', `<div class="eq">A = ${a} = ${A}\nB = ${b} = ${Bs}</div>`) +
        st('2. Suma bit a bit desde el bit 0 (derecha)', 'En cada columna: <code>S = A ⊕ B ⊕ Cin</code> y <code>Cout = A·B + Cin·(A ⊕ B)</code>. El acarreo de salida pasa a la columna siguiente.' +
          tbl(['bit', 'A', 'B', 'Cin', 'S', 'Cout'], s.rows.map(r => [r.i, r.a, r.b, r.cin, r.s, r.cout]))) +
        st('3. Lee el resultado', `<div class="eq">Cout final = ${s.carry}\nS = ${bin(s.result, n)} (${s.result})\nCon acarreo: ${s.carry}${bin(s.result, n)} = ${s.total}</div>` +
          (s.overflow ? '<span class="no">Hay desbordamiento: el resultado no cabe en ' + n + ' bits (Cout = 1).</span>' : '<span class="ok">Sin desbordamiento.</span>')) +
        st('4. Comprobación', `${a} + ${b} = ${a + b} ${s.total === a + b ? '<span class="ok">✔</span>' : '<span class="no">✘</span>'}`) +
        st('5. En Logisim / TTL', 'Cadena de ' + n + ' sumadores completos (2 XOR + 2 AND + 1 OR cada uno; el bit 0 con Cin = 0 se reduce a semisumador si lo prefieres).');
    }
    if (op === 'sub') {
      const s = L2.stepsSub(n, a, b);
      return st('1. Idea', 'A − B = A + (complemento a 2 de B) = A + NOT(B) + 1. Se reutiliza el sumador.') +
        st('2. Invierte B (NOT bit a bit)', `<div class="eq">B  = ${Bs}\n~B = ${bin(s.nb, n)}   (complemento a 1)\n+1 = ${bin(s.twos, n)}   (complemento a 2)</div>`) +
        st('3. Suma A + ~B con acarreo inicial Cin = 1', tbl(['bit', 'A', '~B', 'Cin', 'D', 'Cout'], s.rows.map(r => [r.i, r.a, r.bn, r.cin, r.s, r.cout]))) +
        st('4. Interpreta el acarreo', `Cout = ${s.carry}. ` + (s.borrow
          ? `<span class="no">Cout = 0 → hubo préstamo (A &lt; B).</span> Resultado en complemento a 2: ${bin(s.result, n)} = −${s.magnitude}.`
          : `<span class="ok">Cout = 1 → no hay préstamo (A ≥ B).</span> Resultado: ${bin(s.result, n)} = ${s.result}.`)) +
        st('5. Comprobación', `${a} − ${b} = ${s.diff} ${('' + (s.borrow ? (s.result - (1n << BigInt(n))) : s.result)) === ('' + s.diff) ? '<span class="ok">✔</span>' : '<span class="no">✘</span>'}`);
    }
    if (op === 'mul') {
      const s = L2.stepsMul(n, a, b);
      return st('1. Productos parciales', 'Por cada bit Bi de B: si Bi = 1 se copia A desplazada i lugares; si Bi = 0 la fila es 0. Cada celda es una compuerta AND (<code>Aj·Bi</code>).') +
        st('2. Filas', tbl(['i', 'Bi', 'fila (A · Bi · 2^i)', 'acumulado'], s.rows.map(r => [r.i, r.bi, r.ppStr, r.accStr]))) +
        st('3. Suma de las filas', 'Las filas se suman con sumadores (la primera fila pasa directo; las demás se acumulan con una fila de semisumadores/sumadores completos). Resultado de 2N = ' + (2 * n) + ' bits.') +
        st('4. Resultado', `<div class="eq">${a} × ${b} = ${s.result}\nP = ${bin(s.result, 2 * n)}</div>`) +
        st('5. Comprobación', s.check ? '<span class="ok">✔ la suma de filas coincide</span>' : '<span class="no">✘</span>');
    }
    const s = L2.stepsDiv(n, a, b);
    if (s.error) return '<span class="no">' + s.error + '</span>';
    return st('1. Idea (división con restauración)', 'Se baja un bit del dividendo por etapa. Se resta el divisor B: si el resultado no es negativo, el bit del cociente es 1 y se conserva; si es negativo, el bit es 0 y se restaura el valor anterior.') +
      st('2. Etapas', tbl(['etapa', 'resto desplazado', 'R − B', 'q', 'resto'], s.rows.map(r => [r.k, r.shiftA, r.tStr, r.q, r.restored ? r.A + ' (restaurado)' : r.A]))) +
      st('3. Resultado', `<div class="eq">${a} ÷ ${b}\nCociente Q = ${bin(s.quotient, n)} = ${s.quotient}\nResiduo R = ${bin(s.remainder, n)} = ${s.remainder}</div>`) +
      st('4. Comprobación', `${s.quotient} × ${b} + ${s.remainder} = ${s.quotient * b + s.remainder} ${s.ok ? '<span class="ok">✔</span>' : '<span class="no">✘</span>'}`) +
      st('5. En Logisim / TTL', 'Son ' + n + ' etapas en cascada, cada una con un restador de N+1 bits y un multiplexor (AND/OR) que elige entre la diferencia y el resto anterior.');
  }

  function result(n, a, b) {
    let h = `<h2>Resultado · ${NAMES[op]} de ${n} bits</h2><div class="chips"><span class="chip">A = ${bin(a, n)}</span><span class="chip">B = ${bin(b, n)}</span></div>`;
    if (op === 'add') { const s = L2.stepsAdd(n, a, b); h += `<div class="big">${s.total} = ${s.carry}·${bin(s.result, n)}</div><p class="muted">${a} + ${b}</p>`; }
    if (op === 'sub') { const s = L2.stepsSub(n, a, b); h += `<div class="big">${s.diff}</div><p class="muted">${a} − ${b} · salida ${bin(s.result, n)} · préstamo ${s.borrow ? 1 : 0}</p>`; }
    if (op === 'mul') { const s = L2.stepsMul(n, a, b); h += `<div class="big">${s.result}</div><p class="muted">${a} × ${b} · P = ${bin(s.result, 2 * n)}</p>`; }
    if (op === 'div') { const s = L2.stepsDiv(n, a, b); h += s.error ? `<div class="warn">${s.error}</div>` : `<div class="big">Q=${s.quotient} · R=${s.remainder}</div><p class="muted">${a} ÷ ${b}</p>`; }
    return h;
  }

  function ttlText(nl, plan, n) {
    let t = `PLANO TTL · ${NAMES[op]} de ${n} bits\nAlimentación: pin 14 = +5 V, pin 7 = GND en todos los chips.\n\nCHIPS (${plan.total}):\n`;
    plan.chips.forEach(c => t += `  ${c.id}  ${c.desc}  (usadas ${c.used}/${c.cap})\n`);
    t += '\nCONEXIONES (cada línea es un cable):\n';
    plan.nets.forEach(x => t += `  ${x.net}: ${x.from}  →  ${x.to.join(', ')}\n`);
    t += '\nNota: las entradas de compuertas sin usar de un chip se conectan a GND.\n';
    return t;
  }


  /* ---- simulador en la página ---- */
  let simNL = null, simV = {};
  function simSync(n, v) {
    simNL = L2.BUILD[op](n); simV = {};
    for (let i = 0; i < n; i++) { simV['A' + i] = Number((v.a >> BigInt(i)) & 1n); simV['B' + i] = Number((v.b >> BigInt(i)) & 1n); }
    if (op === 'add') simV.Cin = 0;
    simDraw();
  }
  function simDraw() {
    const nl = simNL, n = N();
    const out = L2.evalNL(nl, simV);
    const val = Object.assign({ GND: 0, VCC: 1 }, simV);
    for (const g of nl.gates) { const a = val[g.i[0]], b = g.i.length > 1 ? val[g.i[1]] : 0; val[g.o] = g.t === 'AND' ? a & b : g.t === 'OR' ? a | b : g.t === 'XOR' ? a ^ b : 1 - a; }
    const swb = nl.inputs.slice().reverse().map(k => `<button class="tg ${simV[k] ? 'on' : ''}" data-k="${k}">${k}=${simV[k]}</button>`).join('');
    let ia = 0, ib = 0; for (let i = 0; i < n; i++) { ia += simV['A' + i] << i; ib += simV['B' + i] << i; }
    $('#simIn').innerHTML = '<b>Entradas</b>' + swb + `<span class="vv">A=${ia} · B=${ib}</span>`;
    const dec = p => { let r = 0, k = 0; while (out[p + k] !== undefined) { r += out[p + k] * Math.pow(2, k); k++; } return r; };
    let sum = '';
    if (op === 'add') sum = `S + Cout = ${dec('S') + out.Cout * Math.pow(2, n)}`;
    if (op === 'sub') sum = `D = ${dec('D')} · préstamo ${out.Prestamo}`;
    if (op === 'mul') sum = `P = ${dec('P')}`;
    if (op === 'div') sum = `Q = ${dec('Q')} · R = ${dec('R')}` + (ib === 0 ? ' (B=0: indefinido)' : '');
    $('#simOut').innerHTML = '<b>Salidas</b>' + nl.outputs.slice().reverse().map(o => `<span class="led ${val[o.net] ? 'on' : ''}">${o.label}=${val[o.net]}</span>`).join('') + `<span class="vv">${sum}</span>`;
    const cells = {}; let maxc = 0;
    for (const g of nl.gates) { (cells[g.cell] = cells[g.cell] || []).push(g); }
    const keys = Object.keys(cells), cols = {};
    keys.forEach(k => { const ci = nl.cellInfo[k]; maxc = Math.max(maxc, ci.col); });
    const rowsSet = [...new Set(keys.map(k => nl.cellInfo[k].row))].sort((a, b) => a - b);
    const wrap = $('#simCells'); wrap.style.gridTemplateColumns = `repeat(${maxc + 1},minmax(120px,1fr))`;
    let html = '';
    rowsSet.forEach(r => { for (let c = 0; c <= maxc; c++) {
      const k = c + ',' + r, gs = cells[k];
      html += gs ? `<div class="cell"><small>${nl.cellInfo[k].label}</small>` + gs.map(g => `<div class="gt ${val[g.o] ? 'on' : ''}"><span>${g.t}</span><span>${g.o}=${val[g.o]}</span></div>`).join('') + '</div>' : '<div></div>';
    } });
    wrap.innerHTML = html;
    $('#simIn').querySelectorAll('.tg').forEach(bn => bn.onclick = () => { simV[bn.dataset.k] ^= 1; simDraw(); });
  }

  function render() {
    const n = N(); $('#nv').textContent = n; $('#hN').textContent = n;
    $('#opName').textContent = NAMES[op];
    $('#lb').firstChild.textContent = op === 'div' ? 'B (divisor)' : 'B';
    const v = vals();
    const w = $('#warn');
    if (op === 'div' && v.b === 0n) { v.b = 1n; $('#b').value = 1; }
    if (v.clipped) { w.hidden = false; w.textContent = 'Los valores se limitaron a ' + n + ' bits (máx. ' + maxV() + ').'; $('#a').value = v.a; $('#b').value = v.b; } else w.hidden = true;
    $('#resBox').innerHTML = result(n, v.a, v.b);
    $('#steps').innerHTML = renderSteps(n, v.a, v.b);
    const nl = L2.BUILD[op](n), s = L2.stats(nl);
    $('#stats').innerHTML = ['AND', 'OR', 'XOR', 'NOT'].map(k => `<span class="chip">${k}: ${s[k]}</span>`).join('') + `<span class="chip">total: ${s.total}</span>`;
    const plan = L2.ttlPlan(nl);
    const rows = plan.chips.map(c => [c.chip, c.id, c.desc, c.used + '/' + c.cap]);
    let t = `<p class="muted">Con compuertas SSI: <b>${plan.total}</b> chips (${plan.spare} compuertas libres). Todos usan pin 14 = +5 V y pin 7 = GND.</p>` + tbl(['TTL', 'id', 'contenido', 'usadas'], rows);
    if (n > 5) t += '<p class="warn">Para ' + n + ' bits el montaje en protoboard es grande; en clase normalmente se arman 4 o 5 bits.</p>';
    const show = plan.nets.slice(0, 60).map(x => [x.net, x.from, x.to.join(', ')]);
    t += '<h3>Cableado</h3>' + tbl(['red', 'sale de', 'llega a'], show) + (plan.nets.length > 60 ? `<p class="muted">… ${plan.nets.length - 60} redes más en el .txt descargable.</p>` : '');
    $('#ttl').innerHTML = t;
    simSync(n, v);
    $('#dlG').onclick = () => download(`${NAMES[op]}_${n}bits_compuertas.circ`, L2.toCirc(nl));
    $('#dlB').onclick = () => download(`${NAMES[op]}_${n}bits_bloques.circ`, L2.toCircBlocks(op, n));
    $('#dlT').onclick = () => download(`${NAMES[op]}_${n}bits_TTL.txt`, ttlText(nl, plan, n));
  }

  document.querySelectorAll('#ops button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#ops button').forEach(x => x.classList.remove('on')); b.classList.add('on'); op = b.dataset.op; render();
  });
  ['#n', '#a', '#b'].forEach(s => $(s).addEventListener('input', render));
  $('#rnd').onclick = () => { const m = Number(maxV()); $('#a').value = Math.floor(Math.random() * (m + 1)); $('#b').value = Math.floor(Math.random() * (m + 1)) || 1; render(); };
  render();
})();
