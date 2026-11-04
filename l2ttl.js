/* Lab 2 · plano TTL: asigna compuertas a chips 74LS y dibuja cada chip (DIP-14) con sus pines. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L2T = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* cada ranura: pines [A,B,Y] (o [A,Y] para el inversor) */
  const S4 = [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]];
  const CHIP = {
    AND: { chip: '74LS08', sym: '7408', name: 'AND', big: '4 compuertas AND de 2 entradas', slots: S4, op: '·' },
    OR: { chip: '74LS32', sym: '7432', name: 'OR', big: '4 compuertas OR de 2 entradas', slots: S4, op: '+' },
    XOR: { chip: '74LS86', sym: '7486', name: 'XOR', big: '4 compuertas XOR de 2 entradas', slots: S4, op: '⊕' },
    NAND: { chip: '74LS00', sym: '7400', name: 'NAND', big: '4 compuertas NAND de 2 entradas', slots: S4, op: '↑' },
    NOR: { chip: '74LS02', sym: '7402', name: 'NOR', big: '4 compuertas NOR de 2 entradas', slots: [[2, 3, 1], [5, 6, 4], [8, 9, 10], [11, 12, 13]], op: '↓' },
    NOT: { chip: '74LS04', sym: '7404', name: 'NOT', big: '6 inversores', slots: [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]], op: '¬' }
  };
  const TTLTYPES = Object.keys(CHIP);

  /* XNOR no tiene chip de uso común aquí: se arma con XOR + NOT */
  function prepare(nl) {
    const gates = []; let k = 0;
    nl.gates.forEach(g => {
      if (g.t === 'XNOR') { const m = 'x' + (++k) + '_' + g.o; gates.push({ t: 'XOR', i: g.i, o: m }, { t: 'NOT', i: [m], o: g.o }); }
      else if (g.t === 'DFF') { /* sin chip aquí */ }
      else gates.push(g);
    });
    return { gates, inputs: nl.inputs, outputs: nl.outputs, skippedFF: nl.gates.filter(g => g.t === 'DFF').length };
  }

  function plan(nl0) {
    const nl = prepare(nl0);
    const chips = [], count = {}, nets = {};
    const get = n => nets[n] || (nets[n] = { net: n, from: null, to: [] });
    nl.inputs.forEach(n => { get(n).from = 'Entrada ' + n; });
    get('VCC').from = '+5 V'; get('GND').from = 'GND';
    for (const g of nl.gates) {
      const spec = CHIP[g.t], n = count[g.t] = (count[g.t] === undefined ? 0 : count[g.t] + 1);
      const per = spec.slots.length, ci = Math.floor(n / per), si = n % per;
      const id = spec.sym + '-' + (ci + 1);
      let ch = chips.find(c => c.id === id);
      if (!ch) { ch = { id, spec, type: g.t, pins: {}, slots: [], idx: ci + 1 }; chips.push(ch); }
      const sl = spec.slots[si], names = g.t === 'NOT' ? ['A', 'Y'] : ['A', 'B', 'Y'];
      const gi = si + 1;
      const rec = { n: gi, ins: [], out: g.o, expr: '' };
      g.i.forEach((net, k) => { ch.pins[sl[k]] = { role: gi + names[k], net, kind: 'in' }; rec.ins.push({ pin: sl[k], net }); get(net).to.push(id + ' pin ' + sl[k]); });
      ch.pins[sl[sl.length - 1]] = { role: gi + 'Y', net: g.o, kind: 'out' };
      rec.outPin = sl[sl.length - 1];
      rec.expr = g.t === 'NOT' ? `${g.o} = ${g.i[0]}'` : `${g.o} = ${g.i[0]} ${spec.op} ${g.i[1]}`;
      ch.slots.push(rec);
      get(g.o).from = id + ' pin ' + rec.outPin;
    }
    chips.forEach(ch => {
      ch.pins[14] = { role: 'VCC', net: '+5 V', kind: 'pwr' }; ch.pins[7] = { role: 'GND', net: 'GND', kind: 'pwr' };
      const per = ch.spec.slots.length;
      ch.used = ch.slots.length; ch.cap = per;
      for (let si = ch.slots.length; si < per; si++) ch.spec.slots[si].forEach((p, k, a) => { ch.pins[p] = { role: (si + 1) + (a.length === 2 ? ['A', 'Y'][k] : ['A', 'B', 'Y'][k]), net: k < a.length - 1 ? 'GND (libre)' : '—', kind: 'free' }; });
      ch.title = `${ch.spec.chip} · ${ch.spec.big}`;
      ch.sub = `Chip ${ch.idx} de ${chips.filter(c => c.type === ch.type).length} de tipo ${ch.spec.name}`;
    });
    nl.outputs.forEach(o => get(o.net).to.push('Salida ' + o.label));
    const list = Object.values(nets).filter(n => n.from && n.to.length);
    // destinos de cada salida de chip
    chips.forEach(ch => ch.slots.forEach(s => { const n = nets[s.out]; s.dest = n ? n.to : []; }));
    return { chips, nets: list, total: chips.length, spare: chips.reduce((a, c) => a + c.cap - c.used, 0), skippedFF: nl.skippedFF,
      counts: chips.reduce((m, c) => { m[c.spec.chip] = (m[c.spec.chip] || 0) + 1; return m; }, {}) };
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  /* SVG de un chip DIP (14 o 16 pines): muesca a la izquierda; pines 1..n/2 abajo y el resto arriba */
  function svg(ch) {
    const n = ch.n || 14, half = n / 2, sp = 66, bx = 40, bw = 30 + half * sp, by = 80, bh = 70, W = bw + 80, H = 230, pw = 24, ph = 22;
    const px = i => bx + 30 + i * sp;
    const col = k => ({ in: '#1f5fbf', out: '#0a7a4f', pwr: '#b3261e', free: '#8a96a8' }[k] || '#555');
    let s = `<svg viewBox="0 0 ${W} ${H}" class="ic" role="img" aria-label="${esc(ch.title)}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="#1b2433" stroke="#0f1f3d" stroke-width="2"/>`;
    s += `<path d="M${bx} ${by + bh / 2 - 12} a12 12 0 0 1 0 24" fill="#f4f6f9" stroke="#0f1f3d"/>`;
    s += `<circle cx="${bx + 28}" cy="${by + bh - 14}" r="5" fill="#36445c"/>`;
    s += `<text x="${bx + bw / 2}" y="${by + 32}" fill="#eef2f8" font-family="monospace" font-size="20" text-anchor="middle" font-weight="700">SN${esc(ch.spec.chip)}N</text>`;
    s += `<text x="${bx + bw / 2}" y="${by + 54}" fill="#9db0cf" font-family="monospace" font-size="12" text-anchor="middle">${esc(ch.id)}</text>`;
    for (let i = 0; i < half; i++) {
      const pb = i + 1, pt = n - i;
      [[pb, true], [pt, false]].forEach(([k, bottom]) => {
        const p = ch.pins[k] || { role: '', net: '', kind: 'free' }, x = px(i), c = col(p.kind);
        const y0 = bottom ? by + bh : by - ph;
        s += `<rect x="${x - pw / 2}" y="${y0}" width="${pw}" height="${ph}" fill="#d9dee7" stroke="#7f8da3"/>`;
        s += `<text x="${x}" y="${y0 + 15}" font-family="monospace" font-size="12" text-anchor="middle" fill="#0f1f3d" font-weight="700">${k}</text>`;
        const ty = bottom ? y0 + ph + 16 : y0 - 22;
        s += `<text x="${x}" y="${ty}" font-family="monospace" font-size="11" text-anchor="middle" fill="${c}" font-weight="700">${esc(p.role)}</text>`;
        s += `<text x="${x}" y="${bottom ? ty + 14 : ty - 13}" font-family="monospace" font-size="10" text-anchor="middle" fill="#0f1f3d">${esc(String(p.net).length > 9 ? String(p.net).slice(0, 9) + '…' : p.net)}</text>`;
      });
    }
    return s + '</svg>';
  }

  /* comparador de magnitud 74LS85 (4 bits por chip, en cascada) */
  function cmp85(N) {
    const k = Math.ceil(N / 4), chips = [], nets = [];
    for (let c = 0; c < k; c++) {
      const bit = (j, L) => (4 * c + j < N ? L + (4 * c + j) : 'GND');
      const last = c === k - 1;
      const outNet = t => (last ? { gt: 'Mayor', eq: 'Igual', lt: 'Menor' }[t] : t + c);
      const lo = c === 0;
      const pins = {
        1: { role: 'B3', net: bit(3, 'B'), kind: 'in' }, 2: { role: 'A<B in', net: lo ? 'GND' : 'lt' + (c - 1), kind: 'in' },
        3: { role: 'A=B in', net: lo ? 'VCC' : 'eq' + (c - 1), kind: 'in' }, 4: { role: 'A>B in', net: lo ? 'GND' : 'gt' + (c - 1), kind: 'in' },
        5: { role: 'A>B out', net: outNet('gt'), kind: 'out' }, 6: { role: 'A=B out', net: outNet('eq'), kind: 'out' }, 7: { role: 'A<B out', net: outNet('lt'), kind: 'out' },
        8: { role: 'GND', net: 'GND', kind: 'pwr' }, 9: { role: 'B0', net: bit(0, 'B'), kind: 'in' }, 10: { role: 'A0', net: bit(0, 'A'), kind: 'in' },
        11: { role: 'B1', net: bit(1, 'B'), kind: 'in' }, 12: { role: 'A1', net: bit(1, 'A'), kind: 'in' }, 13: { role: 'A2', net: bit(2, 'A'), kind: 'in' },
        14: { role: 'B2', net: bit(2, 'B'), kind: 'in' }, 15: { role: 'A3', net: bit(3, 'A'), kind: 'in' }, 16: { role: 'VCC', net: '+5 V', kind: 'pwr' }
      };
      const lines = [`Compara A${Math.min(N - 1, 4 * c + 3)}..A${4 * c} con B${Math.min(N - 1, 4 * c + 3)}..B${4 * c}`,
        lo ? 'Entradas en cascada: pin 2 = GND, pin 3 = +5 V, pin 4 = GND' : `Entradas en cascada: pines 2, 3, 4 vienen del chip ${c} (salidas 7, 6, 5)`,
        last ? 'Salidas finales: pin 5 = Mayor, pin 6 = Igual, pin 7 = Menor' : `Salidas: pines 5, 6, 7 van a las entradas en cascada del chip ${c + 2}`,
        'Pin 16 = +5 V · Pin 8 = GND'];
      if (4 * c + 4 > N) lines.splice(1, 0, `Bits sin usar: A y B a GND (pines ${[15, 1, 13, 14, 11, 12, 10, 9].slice(0, 0).join('')}iguales en ambos)`);
      chips.push({ id: '7485-' + (c + 1), n: 16, spec: { chip: '74LS85', sym: '7485', name: 'COMP', big: 'comparador de magnitud de 4 bits' }, type: 'CMP', pins, slots: [], lines,
        title: '74LS85 · comparador de magnitud de 4 bits', sub: `Chip ${c + 1} de ${k} · bits ${4 * c}–${Math.min(N - 1, 4 * c + 3)}`, used: 1, cap: 1, idx: c + 1 });
    }
    chips.forEach(ch => { Object.entries(ch.pins).forEach(([p, v]) => { if (v.kind === 'in' || v.kind === 'out') nets.push({ net: v.net, from: v.kind === 'out' ? ch.id + ' pin ' + p : 'Entrada', to: v.kind === 'in' ? [ch.id + ' pin ' + p] : ['Salida'] }); }); });
    return { chips, nets, total: k, spare: 0, counts: { '74LS85': k }, skippedFF: 0 };
  }

  function chipText(ch) {
    let t = `${ch.title}  [${ch.id}]\n  Pin 14 = +5 V, Pin 7 = GND\n`;
    ch.slots.forEach(s => { t += `  Compuerta ${s.n}: ${s.expr}   (entradas pines ${s.ins.map(i => i.pin).join(' y ')}, salida pin ${s.outPin} → ${s.dest.join(', ') || '—'})\n`; });
    if (ch.cap > ch.used) t += `  Compuertas libres: ${ch.cap - ch.used} (conecta sus entradas a GND)\n`;
    return t;
  }
  return { plan, svg, chipText, cmp85, CHIP, TTLTYPES, prepare };
});
