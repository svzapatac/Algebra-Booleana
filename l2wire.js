/* Lab 2 · ruteador de cables para Logisim 2.7 (sin túneles).
   Entrada: netlist {gates:[{t,i:[redes],o:red}], inputs:[nombres], outputs:[{label,net}], clocks?:[nombres]}
   Tipos: AND OR XOR NAND NOR XNOR NOT DFF (i=[reloj,dato]).
   Método: columnas por nivel, canales con pistas verticales únicas y carriles horizontales bajo el circuito.
   Dos redes distintas nunca comparten segmento ni extremo, así que Logisim no las une por error. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L2W = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TYPE = {
    AND: { name: 'AND Gate', lib: 1, ins: [[-30, -10], [-30, 10]], sz: 30 },
    OR: { name: 'OR Gate', lib: 1, ins: [[-30, -10], [-30, 10]], sz: 30 },
    XOR: { name: 'XOR Gate', lib: 1, ins: [[-40, -10], [-40, 10]], sz: 30 },
    NAND: { name: 'NAND Gate', lib: 1, ins: [[-40, -10], [-40, 10]], sz: 30 },
    NOR: { name: 'NOR Gate', lib: 1, ins: [[-40, -10], [-40, 10]], sz: 30 },
    XNOR: { name: 'XNOR Gate', lib: 1, ins: [[-50, -10], [-50, 10]], sz: 30 },
    NOT: { name: 'NOT Gate', lib: 1, ins: [[-20, 0]], sz: 20 },
    DFF: { name: 'D Flip-Flop', lib: 4, ins: [[-10, 50], [-10, 10]], sz: 0, out: [50, 10] }
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<project source="5.0.0" version="1.0">\n' +
    '  This file is intended to be loaded by Logisim-evolution v5.0.0(https://github.com/logisim-evolution/).\n' +
    '  <lib desc="#Wiring" name="0"/>\n  <lib desc="#Gates" name="1"/>\n  <lib desc="#Plexers" name="2"/>\n' +
    '  <lib desc="#Arithmetic" name="3"/>\n  <lib desc="#Memory" name="4"/>\n  <lib desc="#I/O" name="5"/>\n  <lib desc="#TTL" name="6"/>\n  <lib desc="#TCL" name="7"/>\n  <lib desc="#Base" name="8"/>\n  <lib desc="#BFH-Praktika" name="9"/>\n  <lib desc="#Input/Output-Extra" name="10"/>\n  <lib desc="#Soc" name="11"/>\n' +
    '  <main name="main"/>\n  <options>\n    <a name="gateUndefined" val="ignore"/>\n    <a name="simlimit" val="1000"/>\n    <a name="simrand" val="0"/>\n  </options>\n' +
    '  <circuit name="main">\n    <a name="appearance" val="logisim_evolution"/>\n    <a name="circuit" val="main"/>\n';
  const TAIL = '  </circuit>\n</project>\n';

  /* intervalos con colores: asigna a cada intervalo el menor índice libre (algoritmo del borde izquierdo) */
  function colorIntervals(items) {            // items: [{lo,hi}] -> devuelve cantidad de colores, asigna .k
    items.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
    const ends = [];
    for (const it of items) {
      let k = ends.findIndex(e => e + 10 <= it.lo);
      if (k < 0) { k = ends.length; ends.push(it.hi); } else ends[k] = it.hi;
      it.k = k;
    }
    return ends.length;
  }

  function layout(nl) {
    const comps = [];
    const srcOf = {};                          // red -> comp que la maneja
    const mk = c => { c.id = comps.length; comps.push(c); return c; };
    const clocks = new Set(nl.clocks || []);
    nl.inputs.forEach(n => { const c = mk({ kind: clocks.has(n) ? 'clk' : 'in', label: n, ins: [], out: n, P: [] }); srcOf[n] = c; });
    const used = new Set(); nl.gates.forEach(g => g.i.forEach(n => used.add(n))); nl.outputs.forEach(o => used.add(o.net));
    ['VCC', 'GND'].forEach(n => { if (used.has(n) && !srcOf[n]) srcOf[n] = mk({ kind: 'const', label: n, val: n === 'VCC' ? 1 : 0, ins: [], out: n, P: [] }); });
    nl.gates.forEach(g => { const c = mk({ kind: 'gate', t: g.t, ins: g.i.slice(), out: g.o, P: TYPE[g.t].ins.map(p => p[1]) }); srcOf[g.o] = c; });
    nl.outputs.forEach(o => mk({ kind: 'out', label: o.label, ins: [o.net], out: null, P: [0] }));
    // niveles (los DFF cortan los ciclos: su salida cuenta como nivel 0)
    const lvl = new Array(comps.length).fill(0);
    for (let it = 0; it < comps.length + 2; it++) {
      let ch = false;
      for (const c of comps) {
        if (c.kind === 'in' || c.kind === 'clk' || c.kind === 'const') continue;
        let l = 1;
        for (const n of c.ins) { const s = srcOf[n]; if (!s) continue; const sl = (s.kind === 'gate' && s.t === 'DFF') ? 0 : lvl[s.id]; l = Math.max(l, sl + 1); }
        if (l > lvl[c.id] && l <= comps.length + 1) { lvl[c.id] = l; ch = true; }
      }
      if (!ch) break;
    }
    const maxL = Math.max(0, ...comps.filter(c => c.kind === 'gate').map(c => lvl[c.id]));
    comps.filter(c => c.kind === 'out').forEach(c => { lvl[c.id] = maxL + 1; });
    // columnas: (nivel, clase) con DFF en columna propia
    const colKey = c => lvl[c.id] * 2 + ((c.kind === 'gate' && c.t === 'DFF') ? 1 : 0);
    const keys = [...new Set(comps.map(colKey))].sort((a, b) => a - b);
    const cols = keys.map(k => comps.filter(c => colKey(c) === k));
    cols.forEach((col, ci) => col.forEach(c => { c.col = ci; }));
    // orden de filas: baricentro hacia adelante
    cols.forEach((col, ci) => {
      if (ci === 0) { col.forEach((c, i) => { c.rowIdx = i; }); return; }
      col.forEach((c, i) => {
        const ys = c.ins.map(n => srcOf[n]).filter(s => s && s.col < ci && s.rowIdx !== undefined).map(s => s.rowIdx);
        c.bary = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : i;
        c.o0 = i;
      });
      col.sort((a, b) => a.bary - b.bary || a.o0 - b.o0);
      col.forEach((c, i) => { c.rowIdx = i; });
    });
    // desfase vertical por columna: los pines de entrada de la columna no coinciden con las salidas de la anterior
    let o = 0, prevOutMod = 0; const pitchOf = col => col.some(c => c.kind === 'gate' && c.t === 'DFF') ? 80 : 40;
    cols.forEach((col, ci) => {
      const P = new Set(); col.forEach(c => (c.P.length ? c.P : [0]).forEach(p => P.add(p)));
      if (ci > 0) {
        const prevOut = prevOutMod; let found = null;
        for (const d of [10, 20, 30, 0]) {
          const cand = (o + d) % 40;
          let ok = true;
          for (const p of P) if (((cand + p) % 40 + 40) % 40 === prevOut) ok = false;
          if (ok) { found = cand; break; }
        }
        o = found === null ? (o + 20) % 40 : found;
      }
      col.off = o; col.pitch = pitchOf(col);
      col.isFF = col.some(c => c.kind === 'gate' && c.t === 'DFF'); prevOutMod = (o + (col.isFF ? 10 : 0)) % 40;
      col.forEach(c => { c.y = 60 + o + c.rowIdx * col.pitch; c.outDy = col.isFF ? 10 : 0; c.outDx = col.isFF ? 50 : 0; });
    });
    return { comps, cols, srcOf };
  }

  function toCirc(nl) {
    const { comps, cols, srcOf } = layout(nl);
    const nC = cols.length;
    const maxY = Math.max(...comps.map(c => c.y)) + 40;
    // sumideros por red agrupados por columna destino
    const nets = {};
    for (const c of comps) c.ins.forEach((n, k) => {
      const s = srcOf[n]; if (!s) return;
      const r = nets[n] || (nets[n] = { net: n, src: s, sinks: [] });
      r.sinks.push({ c, k });
    });
    const list = Object.values(nets);
    // clasificar: grupos adyacentes (col = origen+1) y lejanos
    list.forEach(r => {
      r.groups = {};
      r.sinks.forEach(sk => { (r.groups[sk.c.col] = r.groups[sk.c.col] || []).push(sk); });
      r.near = r.groups[r.src.col + 1] || null;
      r.far = Object.keys(r.groups).map(Number).filter(cc => cc !== r.src.col + 1);
      const sy = sk => sk.c.y + TYPE_PIN(sk)[1];
      r.srcY = r.src.y + (r.src.outDy || 0);
    });
    function TYPE_PIN(sk) {
      const c = sk.c;
      if (c.kind === 'out') return [0, 0];
      return TYPE[c.t].ins[sk.k];
    }
    const sinkY = sk => sk.c.y + TYPE_PIN(sk)[1];
    // pistas verticales por canal (canal k = antes de la columna k). Origen: canal src.col+1. Lejanos: canal destino.
    const tracks = {};     // canal -> items
    const addTrack = (ch, it) => { (tracks[ch] = tracks[ch] || []).push(it); return it; };
    const lanesNeeded = [];
    list.forEach(r => {
      const needLane = r.far.length > 0;
      const ys = [r.srcY];
      if (r.near) r.near.forEach(sk => ys.push(sinkY(sk)));
      r.laneItem = null;
      if (needLane) { r.laneItem = { net: r, lo: 0, hi: 0 }; lanesNeeded.push(r.laneItem); }
      r.srcTrack = { lo: Math.min(...ys), hi: Math.max(...ys), r, role: 'src' };
      r.farTracks = r.far.map(cc => {
        const ysf = r.groups[cc].map(sinkY);
        return { cc, lo: Math.min(...ysf), hi: Math.max(...ysf), r, role: 'far', laneNeed: true };
      });
    });
    // las pistas que dependen del carril se extienden hasta el carril: se fija después de asignar carriles.
    // Primero: carriles, con rango x provisional (por columnas) -> usamos columnas como intervalos de x
    const laneBase = maxY + 40;
    lanesNeeded.forEach(l => {
      const r = l.net;
      const cs = [r.src.col + 1, ...r.far];
      l.lo = Math.min(...cs) * 1000 + 0; l.hi = Math.max(...cs) * 1000 + 999;   // x aproximada (se mantiene disjunta entre redes por columna)
    });
    // intervalos de x por columnas pueden coincidir en la misma columna: usar +10 de margen -> se tratan como cerrados
    const nLanes = colorIntervals(lanesNeeded.map(l => l));
    lanesNeeded.forEach(l => { l.net.laneY = laneBase + l.k * 10; });
    // ahora los intervalos verticales incluyen el carril
    list.forEach(r => {
      if (r.laneItem) { r.srcTrack.hi = Math.max(r.srcTrack.hi, r.laneY); r.farTracks.forEach(t => { t.hi = Math.max(t.hi, r.laneY); }); }
      addTrack(r.src.col + 1, r.srcTrack);
      r.farTracks.forEach(t => addTrack(t.cc, t));
    });
    const T = {};
    for (let ch = 0; ch <= nC; ch++) T[ch] = (tracks[ch] && tracks[ch].length) ? colorIntervals(tracks[ch]) : 0;
    // coordenadas x
    const X = []; let x = 120;
    for (let ci = 0; ci < nC; ci++) {
      if (ci > 0) x += (cols[ci - 1].isFF ? 50 : 0) + 20 + 10 * (T[ci] + 1) + 70;
      X.push(x);
    }
    const chanX = (ch, k) => (ch === 0 ? 0 : X[ch - 1] + (cols[ch - 1].isFF ? 50 : 0) + 20 + 10 * (k + 1));
    // segmentos
    let wires = '';
    const seen = new Set();
    const W = (x1, y1, x2, y2) => {
      if (x1 === x2 && y1 === y2) return;
      const k = x1 < x2 || y1 < y2 ? `${x1},${y1},${x2},${y2}` : `${x2},${y2},${x1},${y1}`;
      if (seen.has(k)) return; seen.add(k);
      wires += `    <wire from="(${x1},${y1})" to="(${x2},${y2})"/>\n`;
    };
    list.forEach(r => {
      const sx = X[r.src.col] + (r.src.outDx || 0), sy = r.srcY;
      const tx = chanX(r.src.col + 1, r.srcTrack.k);
      W(sx, sy, tx, sy);
      W(tx, r.srcTrack.lo, tx, r.srcTrack.hi);
      if (r.near) r.near.forEach(sk => { const px = X[sk.c.col] + (sk.c.kind === 'out' ? 0 : TYPE_PIN(sk)[0]); const py = sinkY(sk); W(tx, py, px, py); });
      if (r.laneItem) {
        const xs = [tx];
        r.farTracks.forEach(t => {
          const dx = chanX(t.cc, t.k); xs.push(dx);
          W(dx, t.lo, dx, t.hi);
          r.groups[t.cc].forEach(sk => { const px = X[sk.c.col] + (sk.c.kind === 'out' ? 0 : TYPE_PIN(sk)[0]); const py = sinkY(sk); W(dx, py, px, py); });
        });
        W(Math.min(...xs), r.laneY, Math.max(...xs), r.laneY);
      }
    });
    // componentes
    let out = HEAD;
    for (const c of comps) {
      const cx = X[c.col], cy = c.y;
      if (c.kind === 'in') out += `    <comp lib="0" loc="(${cx},${cy})" name="Pin">\n      <a name="label" val="${esc(c.label)}"/>\n    </comp>\n`;
      else if (c.kind === 'clk') out += `    <comp lib="0" loc="(${cx},${cy})" name="Clock">\n      <a name="label" val="${esc(c.label)}"/>\n    </comp>\n`;
      else if (c.kind === 'const') out += `    <comp lib="0" loc="(${cx},${cy})" name="Constant">\n      <a name="value" val="0x${c.val}"/>\n    </comp>\n`;
      else if (c.kind === 'out') out += `    <comp lib="0" loc="(${cx},${cy})" name="Pin">\n      <a name="facing" val="west"/>\n      <a name="output" val="true"/>\n      <a name="label" val="${esc(c.label)}"/>\n    </comp>\n`;
      else {
        const ty = TYPE[c.t];
        out += `    <comp lib="${ty.lib}" loc="(${cx},${cy})" name="${ty.name}">\n` +
          (c.t === 'DFF' ? '' : (c.t === 'NOT' ? '      <a name="size" val="20"/>\n' : '      <a name="size" val="30"/>\n      <a name="inputs" val="2"/>\n')) + '    </comp>\n';
      }
    }
    return HEAD + out.slice(HEAD.length) + wires + TAIL;
  }

  /* comprobación geométrica propia: ningún par de redes distintas comparte segmento ni extremo */
  function selfCheck(circ) {
    const re = /<wire from="\((-?\d+),(-?\d+)\)" to="\((-?\d+),(-?\d+)\)"\/>/g; let m; const segs = [];
    while ((m = re.exec(circ))) segs.push([+m[1], +m[2], +m[3], +m[4]]);
    // union-find por conexión (extremos sobre segmentos)
    const par = segs.map((_, i) => i); const f = i => par[i] === i ? i : (par[i] = f(par[i]));
    const on = (s, x, y) => (s[0] === s[2] ? x === s[0] && y >= Math.min(s[1], s[3]) && y <= Math.max(s[1], s[3]) : y === s[1] && x >= Math.min(s[0], s[2]) && x <= Math.max(s[0], s[2]));
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i], b = segs[j];
      if (on(a, b[0], b[1]) || on(a, b[2], b[3]) || on(b, a[0], a[1]) || on(b, a[2], a[3])) par[f(i)] = f(j);
    }
    return { wires: segs.length, nets: new Set(segs.map((_, i) => f(i))).size };
  }
  return { toCirc, selfCheck, TYPE, layout };
});
