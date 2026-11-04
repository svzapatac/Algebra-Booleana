/* Lab 2 · núcleo: pasos de cada operación, netlist de compuertas, escritor .circ (Logisim 2.7), asignación de chips TTL.
   Sin dependencias. Corre en el navegador y en Node (para pruebas). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- utilidades ---------- */
  const B = v => BigInt(v);
  const mask = n => (1n << B(n)) - 1n;
  const bin = (v, n) => BigInt.asUintN(n, B(v)).toString(2).padStart(n, '0');
  const bit = (v, i) => Number((B(v) >> B(i)) & 1n);

  /* ================= PASOS A MANO ================= */
  function stepsAdd(N, a, b) {
    a = B(a); b = B(b);
    const rows = []; let c = 0;
    for (let i = 0; i < N; i++) {
      const x = bit(a, i), y = bit(b, i), s = x ^ y ^ c, co = (x & y) | (c & (x ^ y));
      rows.push({ i, a: x, b: y, cin: c, p: x ^ y, g: x & y, s, cout: co });
      c = co;
    }
    const total = a + b;
    return { op: 'add', N, a, b, rows, carry: c, result: total & mask(N), total, overflow: c === 1 };
  }

  function stepsSub(N, a, b) {
    a = B(a); b = B(b);
    const nb = (~b) & mask(N), twos = (nb + 1n) & mask(N);
    const rows = []; let c = 1;
    for (let i = 0; i < N; i++) {
      const x = bit(a, i), y = bit(nb, i), s = x ^ y ^ c, co = (x & y) | (c & (x ^ y));
      rows.push({ i, a: x, bn: y, cin: c, s, cout: co });
      c = co;
    }
    const d = a - b, low = d & mask(N);
    return { op: 'sub', N, a, b, nb, twos, rows, carry: c, borrow: c === 0, result: low, diff: d,
      magnitude: d < 0n ? -d : d };
  }

  function stepsMul(N, a, b) {
    a = B(a); b = B(b);
    const rows = []; let acc = 0n;
    for (let i = 0; i < N; i++) {
      const bi = bit(b, i), pp = bi ? a << B(i) : 0n;
      acc += pp;
      rows.push({ i, bi, pp, acc, ppStr: bin(pp, 2 * N), accStr: bin(acc, 2 * N) });
    }
    return { op: 'mul', N, a, b, rows, result: a * b, check: acc === a * b };
  }

  function stepsDiv(N, a, b) {
    a = B(a); b = B(b);
    if (b === 0n) return { op: 'div', N, a, b, error: 'El divisor no puede ser 0.' };
    const W = N + 1, M = mask(W);
    let A = 0n, Q = a;
    const rows = [];
    for (let k = 1; k <= N; k++) {
      const msbQ = (Q >> B(N - 1)) & 1n;
      A = ((A << 1n) | msbQ) & M;
      Q = (Q << 1n) & mask(N);
      const shiftA = A, shiftQ = Q;
      let t = A - b;
      let restored = false;
      if (t < 0n) { restored = true; Q = Q | 0n; } else { A = t; Q = Q | 1n; }
      rows.push({ k, shiftA: bin(shiftA, W), shiftQ: bin(shiftQ, N), t, tStr: t < 0n ? '−' + bin(-t, W) : bin(t, W),
        restored, q: restored ? 0 : 1, A: bin(A, W), Q: bin(Q, N) });
    }
    return { op: 'div', N, a, b, rows, quotient: Q, remainder: A, ok: Q === a / b && A === a % b };
  }

  function stepsCmp(N, a, b) {
    a = B(a); b = B(b);
    const rows = []; let eq = 1, res = null, first = -1;
    for (let i = N - 1; i >= 0; i--) {
      const x = bit(a, i), y = bit(b, i), xi = x === y ? 1 : 0, gt = x & (1 - y), lt = (1 - x) & y;
      const before = eq;
      if (before && !xi && res === null) { res = gt ? '>' : '<'; first = i; }
      eq = before & xi;
      rows.push({ i, a: x, b: y, x: xi, gt, lt, prefix: before, eq });
    }
    if (res === null) res = '=';
    return { op: 'cmp', N, a, b, rows, rel: res, first, mayor: a > b ? 1 : 0, igual: a === b ? 1 : 0, menor: a < b ? 1 : 0 };
  }

  /* ================= NETLIST DE COMPUERTAS ================= */
  function NL(name) {
    const nl = { name, gates: [], inputs: [], outputs: [], cellInfo: {}, cur: null, uid: 0 };
    nl.cell = (col, row, label) => { nl.cur = col + ',' + row; nl.cellInfo[nl.cur] = nl.cellInfo[nl.cur] || { col, row, label }; };
    nl.input = n => { nl.inputs.push(n); return n; };
    nl.output = (label, net) => { nl.outputs.push({ label, net }); };
    nl.g = (t, ins, out) => {
      const o = out || ('n' + (++nl.uid));
      nl.gates.push({ t, i: ins, o, cell: nl.cur });
      return o;
    };
    nl.NOT = (a, o) => nl.g('NOT', [a], o);
    nl.AND = (a, b, o) => nl.g('AND', [a, b], o);
    nl.OR = (a, b, o) => nl.g('OR', [a, b], o);
    nl.XOR = (a, b, o) => nl.g('XOR', [a, b], o);
    return nl;
  }

  /* celda sumadora: devuelve {s, c}; usa semisumador o sumador completo según haya acarreo y operandos */
  function adderCell(nl, x, y, c, tag) {
    if (x == null && y == null) return { s: c, c: null };
    if (x == null || y == null) {
      const z = x == null ? y : x;
      if (c == null) return { s: z, c: null };
      return { s: nl.XOR(z, c, 's' + tag), c: nl.AND(z, c, 'c' + tag) };
    }
    if (c == null) return { s: nl.XOR(x, y, 's' + tag), c: nl.AND(x, y, 'c' + tag) };
    const p = nl.XOR(x, y, 'p' + tag), s = nl.XOR(p, c, 's' + tag);
    const g = nl.AND(x, y, 'g' + tag), t = nl.AND(p, c, 't' + tag);
    return { s, c: nl.OR(g, t, 'c' + tag) };
  }

  function buildAdd(N) {
    const nl = NL('sumador');
    for (let i = 0; i < N; i++) nl.input('A' + i);
    for (let i = 0; i < N; i++) nl.input('B' + i);
    nl.input('Cin');
    let c = 'Cin';
    for (let i = 0; i < N; i++) {
      nl.cell(i, 0, 'Sumador completo · bit ' + i);
      const r = adderCell(nl, 'A' + i, 'B' + i, c, '_' + i);
      nl.output('S' + i, r.s); c = r.c;
    }
    nl.output('Cout', c);
    return nl;
  }

  function buildSub(N) {
    const nl = NL('restador');
    for (let i = 0; i < N; i++) nl.input('A' + i);
    for (let i = 0; i < N; i++) nl.input('B' + i);
    nl.cell(0, 1, 'Complemento a 1 de B');
    const nb = [];
    for (let i = 0; i < N; i++) { nl.cell(i, 0, 'NOT de B' + i); nb.push(nl.NOT('B' + i, 'nB' + i)); }
    let c = 'VCC'; // A + (~B) + 1
    for (let i = 0; i < N; i++) {
      nl.cell(i, 1, 'Sumador completo · bit ' + i);
      const r = adderCell(nl, 'A' + i, nb[i], c, '_' + i);
      nl.output('D' + i, r.s); c = r.c;
    }
    nl.output('Cout', c);
    nl.cell(N, 1, 'Préstamo');
    nl.output('Prestamo', nl.NOT(c, 'borrow'));
    return nl;
  }

  function buildMul(N) {
    const nl = NL('multiplicador');
    for (let i = 0; i < N; i++) nl.input('A' + i);
    for (let i = 0; i < N; i++) nl.input('B' + i);
    const acc = new Array(2 * N).fill(null);
    for (let i = 0; i < N; i++) {
      const pp = [];
      for (let j = 0; j < N; j++) { nl.cell(j, i, 'B' + i + '·A' + j); pp.push(nl.AND('A' + j, 'B' + i, 'pp' + i + '_' + j)); }
      if (i === 0) { for (let j = 0; j < N; j++) acc[j] = pp[j]; }
      else {
        let c = null;
        for (let j = 0; j < N; j++) {
          nl.cell(j, i, 'Fila ' + i + ' · col ' + j);
          const r = adderCell(nl, acc[i + j], pp[j], c, '_' + i + '_' + j);
          acc[i + j] = r.s; c = r.c;
        }
        acc[i + N] = c;
      }
    }
    for (let k = 0; k < 2 * N; k++) nl.output('P' + k, acc[k] == null ? 'GND' : acc[k]);
    return nl;
  }

  function buildDiv(N) {
    const nl = NL('divisor');
    for (let i = 0; i < N; i++) nl.input('A' + i);   // dividendo
    for (let i = 0; i < N; i++) nl.input('B' + i);   // divisor
    nl.cell(0, 0, 'NOT de B (una sola vez)');
    const nb = [];
    for (let k = 0; k < N; k++) { nl.cell(k, 0, 'NOT B' + k); nb.push(nl.NOT('B' + k, 'nB' + k)); }
    let r = new Array(N).fill('GND');                 // resto parcial (N bits)
    const q = new Array(N);
    for (let s = 0; s < N; s++) {
      const row = s + 1, abit = 'A' + (N - 1 - s);
      const x = [abit]; for (let k = 0; k < N; k++) x.push(r[k]);        // x = (resto<<1)|bit , N+1 bits
      let c = 'VCC'; const t = [];
      for (let k = 0; k <= N; k++) {
        nl.cell(k, row, 'Etapa ' + (s + 1) + ' · bit ' + k);
        const nbk = k < N ? nb[k] : 'VCC';
        const res = adderCell(nl, x[k], nbk, c, '_' + s + '_' + k);
        t.push(res.s); c = res.c;
      }
      const qs = c; q[N - 1 - s] = qs;               // q = 1 si x ≥ B
      nl.cell(N + 1, row, 'Elige resto');
      const nq = nl.NOT(qs, 'nq' + s);
      const nr = [];
      for (let k = 0; k < N; k++) {
        nl.cell(N + 2 + k, row, 'Mux bit ' + k);
        const a1 = nl.AND(qs, t[k], 'ma' + s + '_' + k), a2 = nl.AND(nq, x[k], 'mb' + s + '_' + k);
        nr.push(nl.OR(a1, a2, 'r' + s + '_' + k));
      }
      r = nr;
    }
    for (let k = 0; k < N; k++) nl.output('Q' + k, q[k]);
    for (let k = 0; k < N; k++) nl.output('R' + k, r[k]);
    return nl;
  }

  function buildCmp(N) {
    const nl = NL('comparador');
    for (let i = 0; i < N; i++) nl.input('A' + i);
    for (let i = 0; i < N; i++) nl.input('B' + i);
    const x = [], gt = [], lt = [];
    for (let i = 0; i < N; i++) {
      nl.cell(i, 0, 'Bit ' + i);
      const nA = nl.NOT('A' + i, 'nA' + i), nB = nl.NOT('B' + i, 'nB' + i);
      x.push(nl.NOT(nl.XOR('A' + i, 'B' + i, 'd' + i), 'x' + i));
      gt.push(nl.AND('A' + i, nB, 'gt' + i));
      lt.push(nl.AND(nA, 'B' + i, 'lt' + i));
    }
    // prefijos de igualdad desde el bit más significativo
    const pre = new Array(N); pre[N - 1] = null;           // sin condición previa
    for (let i = N - 2; i >= 0; i--) pre[i] = pre[i + 1] == null ? x[i + 1] : nl.AND(pre[i + 1], x[i + 1], 'e' + i);
    const orAll = (arr, tag) => { let c = arr[0]; for (let k = 1; k < arr.length; k++) c = nl.OR(c, arr[k], tag + k); return c; };
    const termG = [], termL = [];
    for (let i = N - 1; i >= 0; i--) {
      termG.push(pre[i] == null ? gt[i] : nl.AND(pre[i], gt[i], 'tg' + i));
      termL.push(pre[i] == null ? lt[i] : nl.AND(pre[i], lt[i], 'tl' + i));
    }
    let eq = x[0]; for (let i = 1; i < N; i++) eq = nl.AND(eq, x[i], 'q' + i);
    nl.output('Mayor', orAll(termG, 'og')); nl.output('Igual', eq); nl.output('Menor', orAll(termL, 'ol'));
    return nl;
  }
  const BUILD = { add: buildAdd, sub: buildSub, mul: buildMul, div: buildDiv, cmp: buildCmp };

  /* evaluación de la netlist (para verificar contra la aritmética) */
  function evalNL(nl, vals) {
    const v = Object.assign({ GND: 0, VCC: 1 }, vals);
    for (const g of nl.gates) {
      const a = v[g.i[0]], b = g.i.length > 1 ? v[g.i[1]] : 0;
      v[g.o] = g.t === 'AND' ? a & b : g.t === 'OR' ? a | b : g.t === 'XOR' ? a ^ b : 1 - a;
    }
    const out = {};
    for (const o of nl.outputs) out[o.label] = v[o.net];
    return out;
  }
  function stats(nl) {
    const c = { AND: 0, OR: 0, XOR: 0, NOT: 0 };
    nl.gates.forEach(g => c[g.t]++);
    c.total = nl.gates.length; return c;
  }

  /* ================= ESCRITOR .circ (Logisim 2.7.1) ================= */
  const LIB = { wiring: 0, gates: 1, plex: 2, arith: 3, mem: 4, io: 5, base: 6 };
  const NAMEOF = { AND: 'AND Gate', OR: 'OR Gate', XOR: 'XOR Gate', NOT: 'NOT Gate' };
  const DX = { AND: -30, OR: -30, XOR: -40, NOT: -20 };       // x de las entradas respecto de la salida
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<project source="5.0.0" version="1.0">\n' +
    '  This file is intended to be loaded by Logisim-evolution v5.0.0(https://github.com/logisim-evolution/).\n' +
    '  <lib desc="#Wiring" name="0"/>\n  <lib desc="#Gates" name="1"/>\n  <lib desc="#Plexers" name="2"/>\n' +
    '  <lib desc="#Arithmetic" name="3"/>\n  <lib desc="#Memory" name="4"/>\n  <lib desc="#I/O" name="5"/>\n  <lib desc="#Base" name="8"/>\n' +
    '  <main name="main"/>\n  <options>\n    <a name="gateUndefined" val="ignore"/>\n    <a name="simlimit" val="1000"/>\n    <a name="simrand" val="0"/>\n  </options>\n' +
    '  <circuit name="main">\n    <a name="appearance" val="logisim_evolution"/>\n    <a name="circuit" val="main"/>\n';
  const TAIL = '  </circuit>\n</project>\n';

  function W(x1, y1, x2, y2) { return `    <wire from="(${x1},${y1})" to="(${x2},${y2})"/>\n`; }
  function pinIn(x, y, label, width) {
    return `    <comp lib="0" loc="(${x},${y})" name="Pin">\n      <a name="label" val="${esc(label)}"/>\n` + (width > 1 ? `      <a name="width" val="${width}"/>\n` : '') + `    </comp>\n`;
  }
  function pinOut(x, y, label, width) {
    return `    <comp lib="0" loc="(${x},${y})" name="Pin">\n      <a name="facing" val="west"/>\n      <a name="output" val="true"/>\n      <a name="label" val="${esc(label)}"/>\n` + (width > 1 ? `      <a name="width" val="${width}"/>\n` : '') + `    </comp>\n`;
  }
  function tunnel(x, y, label, facing) {
    return `    <comp lib="0" loc="(${x},${y})" name="Tunnel">\n      <a name="facing" val="${facing}"/>\n      <a name="label" val="${esc(label)}"/>\n    </comp>\n`;
  }
  function constant(x, y, val, width) {
    return `    <comp lib="0" loc="(${x},${y})" name="Constant">\n` + (width > 1 ? `      <a name="width" val="${width}"/>\n` : '') + `      <a name="value" val="0x${val.toString(16)}"/>\n    </comp>\n`;
  }
  function text(x, y, t) {
    return `    <comp lib="8" loc="(${x},${y})" name="Text">\n      <a name="text" val="${esc(t)}"/>\n    </comp>\n`;
  }

  /* compuertas: circuito plano con túneles (cada red = un túnel con su nombre) */
  function toCirc(nl) {
    const GX = 240, GY = 70, PADX = 60, PADY = 60, X0 = 520;
    // niveles locales dentro de cada celda
    const levelOf = {}, byCell = {};
    for (const g of nl.gates) {
      let l = 0;
      for (const n of g.i) { const d = levelOf[n]; if (d && d.cell === g.cell) l = Math.max(l, d.l + 1); }
      levelOf[g.o] = { l, cell: g.cell };
      g.l = l; (byCell[g.cell] = byCell[g.cell] || []).push(g);
    }
    // tamaño de celdas
    const cells = Object.keys(byCell).map(k => {
      const gs = byCell[k], info = nl.cellInfo[k], rowsPerLevel = {};
      gs.forEach(g => { g.r = rowsPerLevel[g.l] = (rowsPerLevel[g.l] === undefined ? 0 : rowsPerLevel[g.l] + 1); });
      const lv = Math.max(...gs.map(g => g.l)) + 1, rows = Math.max(...Object.values(rowsPerLevel)) + 1;
      return { key: k, info, gs, w: 130 + lv * GX + 20, h: rows * GY + 50 };
    });
    const colW = {}, rowH = {};
    cells.forEach(c => { colW[c.info.col] = Math.max(colW[c.info.col] || 0, c.w + PADX); rowH[c.info.row] = Math.max(rowH[c.info.row] || 0, c.h + PADY); });
    const colX = {}, rowY = {};
    let acc = X0; Object.keys(colW).map(Number).sort((a, b) => a - b).forEach(c => { colX[c] = acc; acc += colW[c]; });
    acc = 60; Object.keys(rowH).map(Number).sort((a, b) => a - b).forEach(r => { rowY[r] = acc; acc += rowH[r]; });

    let out = HEAD;
    // pines de entrada (izquierda) y salida
    let y = 60;
    out += text(60, y - 30, 'ENTRADAS');
    nl.inputs.forEach(n => { out += pinIn(60, y, n, 1) + W(60, y, 100, y) + tunnel(100, y, n, 'west'); y += 40; });
    let y2 = 60;
    out += text(380, 30, 'SALIDAS');
    nl.outputs.forEach(o => { out += pinOut(400, y2, o.label, 1) + W(360, y2, 400, y2) + tunnel(360, y2, o.net, 'east'); y2 += 40; });
    // constantes si se usan
    const used = new Set(); nl.gates.forEach(g => g.i.forEach(n => used.add(n))); nl.outputs.forEach(o => used.add(o.net));
    let yc = Math.max(y, y2) + 20;
    if (used.has('VCC')) { out += constant(60, yc, 1, 1) + W(60, yc, 100, yc) + tunnel(100, yc, 'VCC', 'west'); yc += 40; }
    if (used.has('GND')) { out += constant(60, yc, 0, 1) + W(60, yc, 100, yc) + tunnel(100, yc, 'GND', 'west'); yc += 40; }

    for (const c of cells) {
      const cx = colX[c.info.col], cy = rowY[c.info.row];
      out += text(cx + 80, cy, c.info.label || '');
      for (const g of c.gs) {
        const gx = cx + 130 + g.l * GX, gy = cy + 50 + g.r * GY;
        const nm = NAMEOF[g.t];
        out += `    <comp lib="1" loc="(${gx},${gy})" name="${nm}">\n` + (g.t === 'NOT' ? '      <a name="size" val="20"/>\n' : '      <a name="size" val="30"/>\n      <a name="inputs" val="2"/>\n') + `    </comp>\n`;
        const px = gx + DX[g.t];
        if (g.t === 'NOT') {
          out += W(px - 50, gy, px, gy) + tunnel(px - 50, gy, g.i[0], 'east');
        } else {
          out += W(px - 70, gy - 25, px - 20, gy - 25) + W(px - 20, gy - 25, px - 20, gy - 10) + W(px - 20, gy - 10, px, gy - 10) + tunnel(px - 70, gy - 25, g.i[0], 'east');
          out += W(px - 70, gy + 25, px - 20, gy + 25) + W(px - 20, gy + 25, px - 20, gy + 10) + W(px - 20, gy + 10, px, gy + 10) + tunnel(px - 70, gy + 25, g.i[1], 'east');
        }
        out += W(gx, gy, gx + 30, gy) + tunnel(gx + 30, gy, g.o, 'west');
      }
    }
    return out + TAIL;
  }

  /* bloques de la librería Aritmética de Logisim, con buses de N bits */
  function toCircBlocks(op, N) {
    if (op === 'cmp') return toCircCmp(N);
    const name = { add: 'Adder', sub: 'Subtractor', mul: 'Multiplier', div: 'Divider' }[op];
    const cx = 520, cy = 200;
    let out = HEAD;
    out += text(60, 30, { add: 'SUMADOR de ' + N + ' bits (bloque Adder)', sub: 'RESTADOR de ' + N + ' bits (bloque Subtractor)', mul: 'MULTIPLICADOR de ' + N + ' bits (bloque Multiplier)', div: 'DIVISOR de ' + N + ' bits (bloque Divider)' }[op]);
    out += pinIn(100, cy - 10, 'A', N) + W(100, cy - 10, cx - 40, cy - 10);
    out += pinIn(100, cy + 10 + 40, 'B', N) + W(100, cy + 50, 140, cy + 50) + W(140, cy + 50, 140, cy + 10) + W(140, cy + 10, cx - 40, cy + 10);
    out += `    <comp lib="3" loc="(${cx},${cy})" name="${name}">\n      <a name="width" val="${N}"/>\n    </comp>\n`;
    // puerto superior (-20,-20)
    const topW = (op === 'mul' || op === 'div') ? N : 1;
    out += constant(cx - 80, cy - 60, 0, topW) + W(cx - 80, cy - 60, cx - 20, cy - 60) + W(cx - 20, cy - 60, cx - 20, cy - 20);
    // salida principal
    const mainLabel = { add: 'S', sub: 'D', mul: 'P_bajo', div: 'Q' }[op];
    out += W(cx, cy, cx + 100, cy) + pinOut(cx + 100, cy, mainLabel, N);
    // puerto inferior (-20,20)
    const botLabel = { add: 'Cout', sub: 'Prestamo', mul: 'P_alto', div: 'R' }[op];
    const botW = (op === 'mul' || op === 'div') ? N : 1;
    out += W(cx - 20, cy + 20, cx - 20, cy + 70) + W(cx - 20, cy + 70, cx + 100, cy + 70) + pinOut(cx + 100, cy + 70, botLabel, botW);
    return out + TAIL;
  }

  function toCircCmp(N) {
    const cx = 520, cy = 200;
    let out = HEAD;
    out += pinIn(100, cy - 10, 'A', N) + W(100, cy - 10, cx - 40, cy - 10);
    out += pinIn(100, cy + 50, 'B', N) + W(100, cy + 50, 140, cy + 50) + W(140, cy + 50, 140, cy + 10) + W(140, cy + 10, cx - 40, cy + 10);
    out += `    <comp lib="3" loc="(${cx},${cy})" name="Comparator">\n      <a name="width" val="${N}"/>\n      <a name="mode" val="unsigned"/>\n    </comp>\n`;
    out += W(cx, cy - 10, cx + 40, cy - 10) + W(cx + 40, cy - 10, cx + 40, cy - 50) + W(cx + 40, cy - 50, cx + 100, cy - 50) + pinOut(cx + 100, cy - 50, 'Mayor', 1);
    out += W(cx, cy, cx + 100, cy) + pinOut(cx + 100, cy, 'Igual', 1);
    out += W(cx, cy + 10, cx + 20, cy + 10) + W(cx + 20, cy + 10, cx + 20, cy + 50) + W(cx + 20, cy + 50, cx + 100, cy + 50) + pinOut(cx + 100, cy + 50, 'Menor', 1);
    return out + TAIL;
  }

  /* ================= TTL: chips y conexiones ================= */
  const CHIP = {
    XOR: { chip: '7486', desc: '4 XOR de 2 entradas', per: 4, slots: [[1, 2, 3], [4, 5, 6], [10, 9, 8], [13, 12, 11]] },
    AND: { chip: '7408', desc: '4 AND de 2 entradas', per: 4, slots: [[1, 2, 3], [4, 5, 6], [10, 9, 8], [13, 12, 11]] },
    OR: { chip: '7432', desc: '4 OR de 2 entradas', per: 4, slots: [[1, 2, 3], [4, 5, 6], [10, 9, 8], [13, 12, 11]] },
    NOT: { chip: '7404', desc: '6 inversores', per: 6, slots: [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]] }
  };
  function ttlPlan(nl) {
    const count = {}, place = {};
    const chips = [];
    for (const g of nl.gates) {
      const spec = CHIP[g.t], n = count[g.t] = (count[g.t] === undefined ? 0 : count[g.t] + 1);
      const chipIdx = Math.floor(n / spec.per), slot = n % spec.per;
      const id = spec.chip + '-' + (chipIdx + 1);
      if (!chips.find(c => c.id === id)) chips.push({ id, chip: spec.chip, type: g.t, desc: spec.desc, used: 0, cap: spec.per });
      chips.find(c => c.id === id).used++;
      const pins = spec.slots[slot];
      place[g.o] = { id, y: pins[pins.length - 1], ins: g.i.map((net, k) => ({ net, chip: id, pin: pins[k] })) };
    }
    // redes: origen y destinos
    const nets = {};
    const get = n => nets[n] || (nets[n] = { net: n, from: null, to: [] });
    nl.inputs.forEach(n => { get(n).from = 'Entrada ' + n; });
    get('VCC').from = '+5 V (VCC)'; get('GND').from = 'GND';
    for (const g of nl.gates) {
      const pl = place[g.o]; get(g.o).from = pl.id + ' pin ' + pl.y;
      pl.ins.forEach(i => get(i.net).to.push(i.chip + ' pin ' + i.pin));
    }
    nl.outputs.forEach(o => get(o.net).to.push('Salida ' + o.label));
    const list = Object.values(nets).filter(n => n.from && n.to.length).map(n => ({ net: n.net, from: n.from, to: n.to }));
    const total = chips.length;
    return { chips, total, nets: list, spare: chips.reduce((s, c) => s + (c.cap - c.used), 0) };
  }

  return { stepsAdd, stepsSub, stepsMul, stepsDiv, stepsCmp, BUILD, evalNL, stats, toCirc, toCircBlocks, ttlPlan, bin, bit, mask };
});
