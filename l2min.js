/* Lab 2 · versión "original" (suma de minitérminos) y "reducida" (Quine-McCluskey con indiferentes) de cada operación. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./l2core.js'));
  else root.L2M = factory(root.L2);
})(typeof self !== 'undefined' ? self : this, function (L2) {
  'use strict';

  /* tabla de verdad: variables en orden A(N-1)..A0,B(N-1)..B0 ; índice = A·2^N + B */
  function table(op, N) {
    const M = 1 << N, outs = [];
    const names = op === 'add' ? [...Array(N).keys()].map(i => 'S' + i).concat('Cout')
      : op === 'sub' ? [...Array(N).keys()].map(i => 'D' + i).concat('Prestamo')
        : op === 'mul' ? [...Array(2 * N).keys()].map(i => 'P' + i)
          : [...Array(N).keys()].map(i => 'Q' + i).concat([...Array(N).keys()].map(i => 'R' + i));
    names.forEach(n => outs.push({ label: n, ones: [], dc: [] }));
    for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) {
      const idx = a * M + b; let v;
      if (op === 'add') { const s = a + b; v = (s & (M - 1)) | ((s >> N) << N); }
      else if (op === 'sub') { v = ((a - b) & (M - 1)) | ((a < b ? 1 : 0) << N); }
      else if (op === 'mul') v = a * b;
      else { if (b === 0) { outs.forEach(o => o.dc.push(idx)); continue; } v = Math.floor(a / b) | ((a % b) << N); }
      outs.forEach((o, k) => { if ((v >> k) & 1) o.ones.push(idx); });
    }
    return outs;
  }

  /* Quine-McCluskey con términos indiferentes. Patrón MSB primero ('0','1','-'). */
  function qmDC(ones, dcs, n) {
    if (!ones.length) return [];
    const SZ = 1 << n;
    let level = new Map();
    [...ones, ...dcs].forEach(m => level.set(m, { v: m, k: 0 }));
    const prim = [];
    while (level.size) {
      const nxt = new Map(), used = new Set();
      for (const [key, c] of level) for (let b = 0; b < n; b++) {
        const bit = 1 << b;
        if ((c.k & bit) || (c.v & bit)) continue;
        const pk = c.k * SZ + (c.v | bit);
        if (!level.has(pk)) continue;
        used.add(key); used.add(pk);
        const nk = c.k | bit, nkey = nk * SZ + c.v;
        if (!nxt.has(nkey)) nxt.set(nkey, { v: c.v, k: nk });
      }
      for (const [key, c] of level) if (!used.has(key)) prim.push(c);
      level = nxt;
    }
    const onesSet = new Set(ones);
    let primes = prim.map(c => {
      const m = []; let s = c.k;
      for (;;) { m.push(c.v | s); if (s === 0) break; s = (s - 1) & c.k; }
      let pat = ''; for (let i = 0; i < n; i++) { const bit = 1 << (n - 1 - i); pat += (c.k & bit) ? '-' : (c.v & bit) ? '1' : '0'; }
      return { pat, m: m.filter(x => onesSet.has(x)) };
    }).filter(p => p.m.length);
    const lits = p => p.pat.replace(/-/g, '').length;
    const cov = new Map(); ones.forEach(m => cov.set(m, []));
    primes.forEach(p => p.m.forEach(m => cov.get(m).push(p)));
    const chosen = new Set(); ones.forEach(m => { const c = cov.get(m); if (c.length === 1) chosen.add(c[0]); });
    let left = new Set(ones); chosen.forEach(p => p.m.forEach(m => left.delete(m)));
    const cand = primes.filter(p => !chosen.has(p));
    if (left.size) {
      const rest = [...left];
      const useful = cand.filter(p => p.m.some(m => left.has(m)));
      if (useful.length <= 16) {
        let best = null;
        for (let s = 1; s <= useful.length && !best; s++) {
          const rec = (st, ch) => {
            if (ch.length === s) {
              const cv = new Set(); ch.forEach(p => p.m.forEach(m => cv.add(m)));
              if (rest.every(m => cv.has(m))) { const l = ch.reduce((a, p) => a + lits(p), 0); if (!best || l < best.l) best = { l, ch: ch.slice() }; }
              return;
            }
            for (let i = st; i < useful.length; i++) { ch.push(useful[i]); rec(i + 1, ch); ch.pop(); }
          };
          rec(0, []);
        }
        best.ch.forEach(p => chosen.add(p));
      } else {
        while (left.size) {
          let bp = null, bg = 0, bl = 99;
          for (const p of useful) { let g = 0; for (const m of p.m) if (left.has(m)) g++; if (g > bg || (g === bg && g > 0 && lits(p) < bl)) { bg = g; bp = p; bl = lits(p); } }
          chosen.add(bp); bp.m.forEach(m => left.delete(m));
        }
        // quitar redundantes
        for (const p of [...chosen]) {
          const others = new Set(); [...chosen].filter(q => q !== p).forEach(q => q.m.forEach(m => others.add(m)));
          if (p.m.every(m => others.has(m))) chosen.delete(p);
        }
      }
    }
    return [...chosen].map(p => p.pat);
  }

  /* construye la netlist a partir de tablas: mode 'orig' (minitérminos) o 'min' (QM).
     vars = nombres de variables, la primera es el bit más significativo del índice */
  function buildTT(tt, vars, inputs, mode, name) {
    const nl = { name: name || mode, gates: [], inputs: inputs.slice(), outputs: [], uid: 0 };
    const nv = vars.length;
    const g = (t, i, o) => { const out = o || ('n' + (++nl.uid)); nl.gates.push({ t, i, o: out }); return out; };
    const inv = {}; const neg = v => inv[v] || (inv[v] = g('NOT', [v], 'n_' + v));
    const prodCache = {};
    const tree = (t, xs) => {
      xs = xs.slice(); if (xs.length === 0) return t === 'AND' ? 'VCC' : 'GND';
      while (xs.length > 1) { const nx = []; for (let i = 0; i < xs.length; i += 2) nx.push(i + 1 < xs.length ? g(t, [xs[i], xs[i + 1]]) : xs[i]); xs = nx; }
      return xs[0];
    };
    const prod = pat => prodCache[pat] || (prodCache[pat] = (() => {
      const l = []; for (let i = 0; i < pat.length; i++) if (pat[i] === '1') l.push(vars[i]); else if (pat[i] === '0') l.push(neg(vars[i]));
      return tree('AND', l);
    })());
    const bin = m => m.toString(2).padStart(nv, '0');
    let nProd = 0, nLit = 0;
    for (const o of tt) {
      const pats = mode === 'orig' ? o.ones.map(bin) : qmDC(o.ones, o.dc, nv);
      let net;
      if (!o.ones.length) net = 'GND';
      else if (mode !== 'orig' && pats.length === 1 && /^-+$/.test(pats[0])) net = 'VCC';
      else net = tree('OR', pats.map(prod));
      nl.outputs.push({ label: o.label, net });
      nProd += pats.length; pats.forEach(p => { nLit += p.replace(/-/g, '').length; });
    }
    nl.info = { products: nProd, literals: nLit };
    return nl;
  }
  function build(op, N, mode) {
    const nv = 2 * N, vars = [];
    for (let j = 0; j < nv; j++) vars.push(j < N ? 'A' + (N - 1 - j) : 'B' + (N - 1 - (j - N)));
    const inputs = [...Array(N).keys()].map(i => 'A' + i).concat([...Array(N).keys()].map(i => 'B' + i));
    return buildTT(table(op, N), vars, inputs, mode, op + '_' + mode);
  }
  return { table, qmDC, build, buildTT };
});
