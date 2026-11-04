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
  /* SVG de un chip: muesca a la izquierda; pines 1-7 abajo (izq→der) y 8-14 arriba (der→izq) */
  function svg(ch) {
    const W = 560, H = 230, bx = 40, bw = 480, by = 80, bh = 70, px = i => bx + 26 + i * 70, pw = 24, ph = 22;
    const col = k => ({ in: '#1d6fe8', out: '#0a8f5b', pwr: '#c62f3d', free: '#9aa9bf' }[k] || '#555');
    let s = `<svg viewBox="0 0 ${W} ${H}" class="ic" role="img" aria-label="${esc(ch.title)}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="#16233b" stroke="#0a3d91" stroke-width="2"/>`;
    s += `<path d="M${bx} ${by + bh / 2 - 12} a12 12 0 0 1 0 24" fill="#eaf2fb" stroke="#0a3d91"/>`;
    s += `<circle cx="${bx + 26}" cy="${by + bh - 16}" r="5" fill="#2b3f63"/>`;
    s += `<text x="${bx + bw / 2}" y="${by + 32}" fill="#eaf2fb" font-family="monospace" font-size="20" text-anchor="middle" font-weight="700">SN${esc(ch.spec.chip)}N</text>`;
    s += `<text x="${bx + bw / 2}" y="${by + 54}" fill="#9db7e0" font-family="monospace" font-size="12" text-anchor="middle">${esc(ch.id)}</text>`;
    for (let i = 0; i < 7; i++) {
      const pb = i + 1, pt = 14 - i;
      [[pb, true], [pt, false]].forEach(([n, bottom]) => {
        const p = ch.pins[n] || { role: '', net: '', kind: 'free' }, x = px(i), c = col(p.kind);
        const y0 = bottom ? by + bh : by - ph;
        s += `<rect x="${x - pw / 2}" y="${y0}" width="${pw}" height="${ph}" fill="#d9dee7" stroke="#7f8da3"/>`;
        s += `<text x="${x}" y="${bottom ? y0 + 15 : y0 + 15}" font-family="monospace" font-size="12" text-anchor="middle" fill="#0b2545" font-weight="700">${n}</text>`;
        const ty = bottom ? y0 + ph + 16 : y0 - 22;
        s += `<text x="${x}" y="${ty}" font-family="monospace" font-size="11" text-anchor="middle" fill="${c}" font-weight="700">${esc(p.role)}</text>`;
        s += `<text x="${x}" y="${bottom ? ty + 14 : ty - 13}" font-family="monospace" font-size="10" text-anchor="middle" fill="#0b2545">${esc(String(p.net).length > 9 ? String(p.net).slice(0, 9) + '…' : p.net)}</text>`;
      });
    }
    return s + '</svg>';
  }

  function chipText(ch) {
    let t = `${ch.title}  [${ch.id}]\n  Pin 14 = +5 V, Pin 7 = GND\n`;
    ch.slots.forEach(s => { t += `  Compuerta ${s.n}: ${s.expr}   (entradas pines ${s.ins.map(i => i.pin).join(' y ')}, salida pin ${s.outPin} → ${s.dest.join(', ') || '—'})\n`; });
    if (ch.cap > ch.used) t += `  Compuertas libres: ${ch.cap - ch.used} (conecta sus entradas a GND)\n`;
    return t;
  }
  return { plan, svg, chipText, CHIP, TTLTYPES, prepare };
});
