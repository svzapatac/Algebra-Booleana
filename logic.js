/* Lab Booleano — motor lógico (Mano, Cap. 2). Funciona en navegador y Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ───────── AST ───────── */
const V = n => ({ t: 'var', n });
const K = v => ({ t: 'const', v: v ? 1 : 0 });
const NOT = a => ({ t: 'not', a });
const mkAnd = a => a.length === 0 ? K(1) : a.length === 1 ? a[0] : { t: 'and', args: a };
const mkOr = a => a.length === 0 ? K(0) : a.length === 1 ? a[0] : { t: 'or', args: a };
const XORF = new Set(['xor', 'nand', 'nor', 'xnor']);
const kids = n => n.t === 'not' ? [n.a] : (n.args || []);
const isLit = n => n.t === 'var' || (n.t === 'not' && n.a.t === 'var');
const litKey = n => n.t === 'var' ? n.n : n.a.n + "'";
const flip = k => k.endsWith("'") ? k.slice(0, -1) : k + "'";

function key(n) {
  switch (n.t) {
    case 'var': return n.n;
    case 'const': return n.v ? '1' : '0';
    case 'not': return '!' + key(n.a);
    case 'and': case 'or': return n.t + '(' + n.args.map(key).sort().join(',') + ')';
    default: return n.t + '(' + n.args.map(key).join(',') + ')';
  }
}

function str(n) {
  switch (n.t) {
    case 'var': return n.n;
    case 'const': return n.v ? '1' : '0';
    case 'not': { const a = n.a; return (a.t === 'var' || a.t === 'const' || a.t === 'not') ? str(a) + "'" : '(' + str(a) + ")'"; }
    case 'and': {
      let out = '';
      n.args.forEach((c, i) => {
        let s = str(c);
        if (c.t === 'or' || c.t === 'and' || XORF.has(c.t)) s = '(' + s + ')';
        if (i > 0 && (c.t === 'const' || n.args[i - 1].t === 'const')) out += '·';
        out += s;
      });
      return out;
    }
    case 'or': return n.args.map(c => c.t === 'or' ? '(' + str(c) + ')' : str(c)).join(' + ');
    default: {
      const sym = { xor: ' ⊕ ', nand: ' NAND ', nor: ' NOR ', xnor: ' XNOR ' }[n.t];
      const [a, b] = n.args;
      const sa = (a.t === 'or' || (XORF.has(a.t) && !(a.t === 'xor' && n.t === 'xor'))) ? '(' + str(a) + ')' : str(a);
      const sb = (b.t === 'or' || XORF.has(b.t)) ? '(' + str(b) + ')' : str(b);
      return sa + sym + sb;
    }
  }
}

function ev(n, e) {
  switch (n.t) {
    case 'var': return e[n.n];
    case 'const': return n.v;
    case 'not': return ev(n.a, e) ? 0 : 1;
    case 'and': return n.args.every(x => ev(x, e)) ? 1 : 0;
    case 'or': return n.args.some(x => ev(x, e)) ? 1 : 0;
    case 'xor': return ev(n.args[0], e) ^ ev(n.args[1], e);
    case 'xnor': return 1 ^ ev(n.args[0], e) ^ ev(n.args[1], e);
    case 'nand': return (ev(n.args[0], e) && ev(n.args[1], e)) ? 0 : 1;
    case 'nor': return (ev(n.args[0], e) || ev(n.args[1], e)) ? 0 : 1;
  }
}

function allEnvs(vars) {
  const n = vars.length, out = [];
  for (let i = 0; i < (1 << n); i++) {
    const e = {};
    vars.forEach((v, k) => { e[v] = (i >> (n - 1 - k)) & 1; });
    out.push(e);
  }
  return out;
}

/* ───────── Parser ───────── */
const WORDS = { AND: 'AND', OR: 'OR', NOT: 'NOTW', XOR: 'XOR', NAND: 'NAND', NOR: 'NOR', XNOR: 'XNOR' };

function tokenize(src) {
  const toks = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '+' || c === '|' || c === '∨') { toks.push({ k: 'OR' }); i++; continue; }
    if ('·*.&∧•×'.includes(c)) { toks.push({ k: 'AND' }); i++; continue; }
    if (c === '⊕' || c === '^') { toks.push({ k: 'XOR' }); i++; continue; }
    if (c === '⊙' || c === '≡' || c === '↔') { toks.push({ k: 'XNOR' }); i++; continue; }
    if ("'’′`".includes(c)) { toks.push({ k: 'PRIME' }); i++; continue; }
    if (c === '!' || c === '~' || c === '¬') { toks.push({ k: 'NOTP' }); i++; continue; }
    if (c === '(' || c === '[') { toks.push({ k: 'LP' }); i++; continue; }
    if (c === ')' || c === ']') { toks.push({ k: 'RP' }); i++; continue; }
    if (c === '0' || c === '1') { toks.push({ k: 'CONST', v: +c }); i++; continue; }
    if (/[A-Za-z]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      const run = src.slice(i, j).toUpperCase();
      if (WORDS[run] && run.length > 1) toks.push({ k: WORDS[run] });
      else if ((run === 'Y') && false) toks.push({ k: 'AND' });
      else for (const ch of run) toks.push({ k: 'VAR', n: ch });
      i = j; continue;
    }
    throw new Error('Símbolo no reconocido: "' + c + '"');
  }
  return toks;
}

function parse(src, vars) {
  const toks = tokenize(src); let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  function pOr() {
    const a = [pXor()];
    while (peek() && peek().k === 'OR') { next(); a.push(pXor()); }
    return a.length === 1 ? a[0] : { t: 'or', args: a };
  }
  function pXor() {
    let l = pAnd();
    while (peek() && ['XOR', 'NAND', 'NOR', 'XNOR'].includes(peek().k)) {
      const op = next().k.toLowerCase();
      l = { t: op, args: [l, pAnd()] };
    }
    return l;
  }
  function pAnd() {
    const a = [pUn()];
    for (;;) {
      const t = peek(); if (!t) break;
      if (t.k === 'AND') { next(); a.push(pUn()); }
      else if (['VAR', 'CONST', 'LP', 'NOTP', 'NOTW'].includes(t.k)) a.push(pUn());
      else break;
    }
    return a.length === 1 ? a[0] : { t: 'and', args: a };
  }
  function pUn() {
    const t = peek();
    if (t && (t.k === 'NOTP' || t.k === 'NOTW')) { next(); return NOT(pUn()); }
    let b = pPrim();
    while (peek() && peek().k === 'PRIME') { next(); b = NOT(b); }
    return b;
  }
  function pPrim() {
    const t = next();
    if (!t) throw new Error('La expresión está incompleta');
    if (t.k === 'VAR') {
      if (!vars.includes(t.n)) throw new Error('La variable ' + t.n + ' no está definida (usa ' + vars.join(', ') + ')');
      return V(t.n);
    }
    if (t.k === 'CONST') return K(t.v);
    if (t.k === 'LP') {
      const e = pOr();
      if (!peek() || peek().k !== 'RP') throw new Error('Falta cerrar un paréntesis');
      next(); return e;
    }
    throw new Error('Expresión inválida cerca de un operador');
  }
  if (!toks.length) throw new Error('Escribe una expresión');
  const r = pOr();
  if (p < toks.length) throw new Error(toks[p].k === 'RP' ? 'Paréntesis de cierre sobrante' : 'Expresión inválida');
  return r;
}

/* ───────── Reglas del libro ───────── */
const RULES = {
  P1: { kind: 'post', name: 'Cerradura', f: 'x + y ∈ B · x·y ∈ B' },
  P2: { kind: 'post', name: 'Identidad', f: 'x + 0 = x · x·1 = x' },
  P3: { kind: 'post', name: 'Conmutativa', f: 'x + y = y + x · xy = yx' },
  P4: { kind: 'post', name: 'Distributiva', f: 'x(y + z) = xy + xz' },
  P5: { kind: 'post', name: 'Complemento', f: "x + x' = 1 · xx' = 0" },
  P6: { kind: 'post', name: 'Dos elementos', f: 'existen x ≠ y en B' },
  T1: { kind: 'teo', name: 'Idempotencia', f: 'x + x = x · xx = x' },
  T2: { kind: 'teo', name: 'Elemento nulo', f: 'x + 1 = 1 · x·0 = 0' },
  T3: { kind: 'teo', name: 'Involución', f: "(x')' = x" },
  T4: { kind: 'teo', name: 'Asociatividad', f: 'x + (y + z) = (x + y) + z' },
  T5: { kind: 'teo', name: 'De Morgan', f: "(x + y)' = x'y'" },
  T6: { kind: 'teo', name: 'Absorción', f: 'x + xy = x · x(x + y) = x' }
};

/* ───────── Reescritura ───────── */
function applyTop(n, rule) {
  const r = rule(n); if (r) return { n: r, c: 1 };
  if (n.t === 'var' || n.t === 'const') return { n, c: 0 };
  if (n.t === 'not') { const s = applyTop(n.a, rule); return { n: s.c ? NOT(s.n) : n, c: s.c }; }
  let c = 0; const args = n.args.map(x => { const s = applyTop(x, rule); c += s.c; return s.n; });
  return { n: c ? { t: n.t, args } : n, c };
}
function applyBottom(n, rule) {
  let c = 0, m = n;
  if (n.t === 'not') { const s = applyBottom(n.a, rule); c += s.c; if (s.c) m = NOT(s.n); }
  else if (n.args) {
    let cc = 0; const args = n.args.map(x => { const s = applyBottom(x, rule); cc += s.c; return s.n; });
    c += cc; if (cc) m = { t: n.t, args };
  }
  const r = rule(m); if (r) return { n: r, c: c + 1 };
  return { n: m, c };
}
const via = (apply, rule) => cur => { const s = apply(cur, rule); return s.c ? { node: s.n } : null; };

const is0 = n => n.t === 'const' && n.v === 0, is1 = n => n.t === 'const' && n.v === 1;
const hasComp = args => { const ks = new Set(args.filter(isLit).map(litKey)); for (const k of ks) if (ks.has(flip(k)) && !k.endsWith("'")) return true; return false; };
const dups = args => new Set(args.map(key)).size < args.length;
const dedupe = args => { const s = new Set(); return args.filter(a => { const k = key(a); if (s.has(k)) return false; s.add(k); return true; }); };

const R = {
  nand: n => n.t === 'nand' ? NOT(mkAnd(n.args)) : null,
  nor: n => n.t === 'nor' ? NOT(mkOr(n.args)) : null,
  xor: n => n.t === 'xor' ? mkOr([mkAnd([n.args[0], NOT(n.args[1])]), mkAnd([NOT(n.args[0]), n.args[1]])]) : null,
  xnor: n => n.t === 'xnor' ? mkOr([mkAnd(n.args), mkAnd([NOT(n.args[0]), NOT(n.args[1])])]) : null,
  flatOr: n => n.t === 'or' && n.args.some(c => c.t === 'or') ? mkOr(n.args.flatMap(c => c.t === 'or' ? c.args : [c])) : null,
  flatAnd: n => n.t === 'and' && n.args.some(c => c.t === 'and') ? mkAnd(n.args.flatMap(c => c.t === 'and' ? c.args : [c])) : null,
  t3: n => n.t === 'not' && n.a.t === 'not' ? n.a.a : null,
  t5a: n => n.t === 'not' && n.a.t === 'or' ? mkAnd(n.a.args.map(NOT)) : null,
  t5b: n => n.t === 'not' && n.a.t === 'and' ? mkOr(n.a.args.map(NOT)) : null,
  notK: n => n.t === 'not' && n.a.t === 'const' ? K(1 - n.a.v) : null,
  t2b: n => n.t === 'and' && n.args.some(is0) ? K(0) : null,
  t2a: n => n.t === 'or' && n.args.some(is1) ? K(1) : null,
  p2b: n => n.t === 'and' && n.args.some(is1) ? mkAnd(n.args.filter(a => !is1(a))) : null,
  p2a: n => n.t === 'or' && n.args.some(is0) ? mkOr(n.args.filter(a => !is0(a))) : null,
  p5b: n => n.t === 'and' && hasComp(n.args) ? K(0) : null,
  p5a: n => n.t === 'or' && hasComp(n.args) ? K(1) : null,
  t1b: n => n.t === 'and' && dups(n.args) ? mkAnd(dedupe(n.args)) : null,
  t1a: n => n.t === 'or' && dups(n.args) ? mkOr(dedupe(n.args)) : null,
  dist: n => {
    if (n.t !== 'and') return null;
    const j = n.args.findIndex(a => a.t === 'or'); if (j < 0) return null;
    return mkOr(n.args[j].args.map(o => mkAnd(n.args.map((a, k) => k === j ? o : a))));
  }
};

const M = (tag, note, kind) => ({ tag, note, kind: kind || (tag[0] === 'P' ? 'post' : tag[0] === 'T' ? 'teo' : 'def') });

const isProd = t => isLit(t) || (t.t === 'and' && t.args.every(isLit));
const prodLits = t => t.t === 'and' ? t.args : [t];
const prodSet = t => new Set(prodLits(t).map(litKey));

function absorbRun(cur) {
  if (cur.t !== 'or' || !cur.args.every(isProd)) return null;
  const sets = cur.args.map(prodSet);
  const keep = cur.args.filter((t, j) => !sets.some((si, i) => i !== j && si.size < sets[j].size && [...si].every(k => sets[j].has(k))));
  return keep.length < cur.args.length ? { node: mkOr(keep) } : null;
}

function mergeRun(cur) {
  if (cur.t !== 'or' || !cur.args.every(isProd)) return null;
  const sets = cur.args.map(prodSet);
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    const a = sets[i], b = sets[j];
    if (a.size !== b.size || a.size < 2) continue;
    const da = [...a].filter(k => !b.has(k)), db = [...b].filter(k => !a.has(k));
    if (da.length !== 1 || db.length !== 1 || flip(da[0]) !== db[0]) continue;
    const steps = []; let terms = cur.args.slice();
    if (j !== i + 1) {
      const tj = terms.splice(j, 1)[0]; terms.splice(i + 1, 0, tj);
      steps.push({ node: mkOr(terms), meta: M('P3(a)', 'conmutativa: acercar términos') });
    }
    const Ti = terms[i], Tj = terms[i + 1];
    if (terms.length > 2)
      steps.push({ node: mkOr([...terms.slice(0, i), mkOr([Ti, Tj]), ...terms.slice(i + 2)]), meta: M('T4(a)', 'asociativa: agrupar') });
    const li = prodLits(Ti), v = li.find(l => litKey(l) === da[0]), vp = prodLits(Tj).find(l => litKey(l) === db[0]);
    const fac = mkAnd([...li.filter(l => litKey(l) !== da[0]), mkOr([v, vp])]);
    steps.push({ node: mkOr([...terms.slice(0, i), fac, ...terms.slice(i + 2)]), meta: M('P4(a)', 'distributiva: factor común') });
    return { steps };
  }
  return null;
}

const costOf = n => {
  const lc = t => t.t === 'and' ? t.args.length : t.t === 'const' ? 0 : 1;
  return n.t === 'or' ? [n.args.length, n.args.reduce((s, t) => s + lc(t), 0)] : [1, lc(n)];
};

function runSteps(start, attempts, ref, envs, cap) {
  const tvOf = n => envs.map(e => ev(n, e)).join('');
  const steps = []; let cur = start, ok = true, truncated = false;
  const push = (node, meta) => {
    const good = tvOf(node) === ref; if (!good) ok = false;
    steps.push({ ...meta, node, expr: '= ' + str(node), ok: good }); cur = node;
  };
  const t0 = Date.now(), size = n => n.t === 'var' || n.t === 'const' ? 1 : 1 + kids(n).reduce((s, c) => s + size(c), 0);
  for (let g = 0; ; g++) {
    if (g >= cap || Date.now() - t0 > 1800 || size(cur) > 2500) { truncated = true; break; }
    let did = false;
    for (const at of attempts) {
      const r = at.run(cur); if (!r) continue;
      if (r.steps) r.steps.forEach(s => push(s.node, s.meta)); else push(r.node, at.meta);
      did = true; break;
    }
    if (!did) break;
  }
  return { steps, cur, ok, truncated, tvOf };
}

const A_DEF = [
  { run: via(applyBottom, R.nand), meta: M('DEF', 'NAND: (xy)\'', 'def') },
  { run: via(applyBottom, R.nor), meta: M('DEF', "NOR: (x + y)'", 'def') },
  { run: via(applyBottom, R.xor), meta: M('DEF', "XOR: xy' + x'y", 'def') },
  { run: via(applyBottom, R.xnor), meta: M('DEF', "XNOR: xy + x'y'", 'def') }
];
const A_NOT = [
  { run: via(applyTop, R.t3), meta: M('T3', "involución: (x')' = x") },
  { run: via(applyTop, R.t5a), meta: M('T5(a)', 'De Morgan') },
  { run: via(applyTop, R.t5b), meta: M('T5(b)', 'De Morgan') },
  { run: via(applyTop, R.notK), meta: M('P5', "0' = 1 · 1' = 0") }
];
const A_CLEAN = [
  { run: via(applyBottom, R.t2b), meta: M('T2(b)', 'x·0 = 0') },
  { run: via(applyBottom, R.t2a), meta: M('T2(a)', 'x + 1 = 1') },
  { run: via(applyBottom, R.p5b), meta: M('P5(b)', "complemento: xx' = 0") },
  { run: via(applyBottom, R.p5a), meta: M('P5(a)', "complemento: x + x' = 1") },
  { run: via(applyBottom, R.p2b), meta: M('P2(b)', 'identidad: x·1 = x') },
  { run: via(applyBottom, R.p2a), meta: M('P2(a)', 'identidad: x + 0 = x') },
  { run: via(applyBottom, R.t1b), meta: M('T1(b)', 'idempotencia: xx = x') },
  { run: via(applyBottom, R.t1a), meta: M('T1(a)', 'idempotencia: x + x = x') }
];

/* ───────── Quine-McCluskey ───────── */
const popc = s => [...s].filter(c => c === '1').length;
const patProd = (p, vars) => { let s = ''; for (let i = 0; i < p.length; i++) if (p[i] === '1') s += vars[i]; else if (p[i] === '0') s += vars[i] + "'"; return s || '1'; };
const patSum = (p, vars) => { const l = []; for (let i = 0; i < p.length; i++) if (p[i] === '0') l.push(vars[i]); else if (p[i] === '1') l.push(vars[i] + "'"); return l.length ? '(' + l.join(' + ') + ')' : '0'; };

function qm(ones, n) {
  const SZ = 1 << n;
  // cubos como (valor, máscara de "-"): se fusionan los que difieren en un solo bit
  let level = new Map();
  ones.forEach(m => level.set(m, { v: m, k: 0 }));
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
  let primes = prim.map(c => {
    let pat = '';
    for (let i = 0; i < n; i++) { const bit = 1 << (n - 1 - i); pat += (c.k & bit) ? '-' : (c.v & bit) ? '1' : '0'; }
    const m = []; let s = c.k;
    for (;;) { m.push(c.v | s); if (s === 0) break; s = (s - 1) & c.k; }
    m.sort((x, y) => x - y);
    return { pat, m, used: false };
  });
  const seen = new Set(); primes = primes.filter(p => !seen.has(p.pat) && seen.add(p.pat));
  const lits = p => { let c = 0; for (const ch of p.pat) if (ch !== '-') c++; return c; };
  const cov = new Map(); ones.forEach(m => cov.set(m, []));
  primes.forEach(p => p.m.forEach(m => { const l = cov.get(m); if (l) l.push(p); }));
  const essential = [];
  ones.forEach(m => { const c = cov.get(m); if (c.length === 1 && !essential.includes(c[0])) essential.push(c[0]); });
  const covered = new Set(essential.flatMap(p => p.m));
  const rest = ones.filter(m => !covered.has(m));
  const cand = primes.filter(p => !essential.includes(p));
  let extra = [];
  if (rest.length) {
    if (cand.length <= 18) {
      outer: for (let s = 1; s <= cand.length; s++) {
        let best = null;
        const rec = (start, chosen) => {
          if (chosen.length === s) {
            const cv = new Set(chosen.flatMap(p => p.m));
            if (rest.every(m => cv.has(m))) { const l = chosen.reduce((a, p) => a + lits(p), 0); if (!best || l < best.l) best = { l, c: chosen.slice() }; }
            return;
          }
          for (let i = start; i < cand.length; i++) { chosen.push(cand[i]); rec(i + 1, chosen); chosen.pop(); }
        };
        rec(0, []);
        if (best) { extra = best.c; break outer; }
      }
    } else {
      let left = new Set(rest);
      while (left.size) {
        let bp = null, bg = 0;
        for (const p of cand) { let g = 0; for (const m of p.m) if (left.has(m)) g++; if (g > bg) { bg = g; bp = p; } }
        extra.push(bp); bp.m.forEach(m => left.delete(m));
      }
    }
  }
  const sk = p => String(p.pat.replace(/-/g, '').length) + p.pat.replace(/-/g, '9');
  const cover = [...essential, ...extra].sort((a, b) => (sk(a) < sk(b) ? -1 : sk(a) > sk(b) ? 1 : 0));
  return { cols: [], primes: primes.sort((a, b) => a.m[0] - b.m[0]), essential, cover, ones };
}

function sopAst(pats, vars) {
  if (!pats.length) return K(0);
  const terms = pats.map(p => {
    const l = []; for (let i = 0; i < p.length; i++) if (p[i] === '1') l.push(V(vars[i])); else if (p[i] === '0') l.push(NOT(V(vars[i])));
    return l.length ? mkAnd(l) : K(1);
  });
  return terms.some(t => t.t === 'const') ? K(1) : mkOr(terms);
}

/* ───────── Derivaciones ───────── */
function simplify(ast, vars, minAst) {
  const envs = allEnvs(vars);
  const ref = envs.map(e => ev(ast, e)).join('');
  const attempts = [
    ...A_DEF,
    { run: via(applyBottom, R.flatOr), meta: M('T4(a)', 'asociativa: quitar paréntesis') },
    { run: via(applyBottom, R.flatAnd), meta: M('T4(b)', 'asociativa: quitar paréntesis') },
    ...A_NOT, ...A_CLEAN,
    { run: via(applyBottom, R.dist), meta: M('P4(a)', 'distributiva: x(y + z) = xy + xz') },
    { run: absorbRun, meta: M('T6(a)', 'absorción: x + xy = x') },
    { run: mergeRun, meta: {} }
  ];
  const r = runSteps(ast, attempts, ref, envs, 90);
  let { steps, cur, ok } = r;
  let completed = false;
  if (key(cur) !== key(minAst)) {
    const good = r.tvOf(minAst) === ref; if (!good) ok = false;
    steps.push({ ...M('QM', 'forma mínima (Quine-McCluskey / Karnaugh)', 'qm'), node: minAst, expr: '= ' + str(minAst), ok: good });
    completed = true;
  }
  return { steps: [{ kind: 'given', tag: 'dado', expr: str(ast), node: ast, ok: true }, ...steps], ok, completed, truncated: r.truncated };
}

function canonExpand(ast, vars, ones) {
  const envs = allEnvs(vars), n = vars.length;
  const ref = envs.map(e => ev(ast, e)).join('');
  const expand = cur => {
    const terms = cur.t === 'or' ? cur.args : [cur];
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i]; if (!isProd(t)) continue;
      const have = new Set(prodLits(t).map(l => l.t === 'var' ? l.n : l.a.n));
      const miss = vars.find(v => !have.has(v)); if (!miss) continue;
      const nt = mkAnd([...prodLits(t), mkOr([V(miss), NOT(V(miss))])]);
      const nterms = terms.slice(); nterms[i] = nt;
      return { node: mkOr(nterms) };
    }
    return null;
  };
  const attempts = [
    ...A_DEF,
    { run: via(applyBottom, R.flatOr), meta: M('T4(a)', 'asociativa: quitar paréntesis') },
    { run: via(applyBottom, R.flatAnd), meta: M('T4(b)', 'asociativa: quitar paréntesis') },
    ...A_NOT,
    { run: via(applyBottom, R.t2b), meta: M('T2(b)', 'x·0 = 0') },
    { run: via(applyBottom, R.t2a), meta: M('T2(a)', 'x + 1 = 1') },
    { run: via(applyBottom, R.p5b), meta: M('P5(b)', "complemento: xx' = 0") },
    { run: via(applyBottom, R.p2b), meta: M('P2(b)', 'identidad: x·1 = x') },
    { run: via(applyBottom, R.p2a), meta: M('P2(a)', 'identidad: x + 0 = x') },
    { run: via(applyBottom, R.t1b), meta: M('T1(b)', 'idempotencia: xx = x') },
    { run: via(applyBottom, R.t1a), meta: M('T1(a)', 'idempotencia: x + x = x') },
    { run: via(applyBottom, R.dist), meta: M('P4(a)', 'distributiva: x(y + z) = xy + xz') },
    { run: expand, meta: M('P5(a)', "x = x·1 = x(y + y')") }
  ];
  const r = runSteps(ast, attempts, ref, envs, 400);
  let { steps, cur, ok } = r;
  const pat = i => i.toString(2).padStart(n, '0');
  const target = sopAst(ones.map(pat), vars);
  if (ones.length && key(cur) === key(target) && str(cur) !== str(target)) {
    steps.push({ ...M('P3', 'conmutativa: ordenar por índice'), tag: 'P3(a)', node: target, expr: '= ' + str(target), ok: r.tvOf(target) === ref }); 
  } else if (ones.length && key(cur) !== key(target)) {
    steps.push({ ...M('TV', 'según la tabla de verdad', 'qm'), tag: 'TV', node: target, expr: '= ' + str(target), ok: r.tvOf(target) === ref });
  }
  return { steps: [{ kind: 'given', tag: 'dado', expr: str(ast), node: ast, ok: true }, ...steps], ok: ok && steps.every(x => x.ok !== false), truncated: r.truncated };
}

function gateList(ast) {
  const out = [], seen = new Set(), nm = { not: 'NOT', and: 'AND', or: 'OR', xor: 'XOR', nand: 'NAND', nor: 'NOR', xnor: 'XNOR' };
  (function w(n) {
    if (n.t === 'var' || n.t === 'const') return;
    kids(n).forEach(w);
    const o = str(n); if (seen.has(o)) return; seen.add(o);
    out.push({ out: o, op: nm[n.t], ins: kids(n).map(str) });
  })(ast);
  return out;
}

function complement(g, vars) {
  const envs = allEnvs(vars), start = NOT(g);
  const ref = envs.map(e => ev(start, e)).join('');
  const r = runSteps(start, [...A_NOT], ref, envs, 40);
  return { steps: [{ kind: 'given', tag: 'dado', expr: str(start), node: start, ok: true }, ...r.steps], ast: r.cur, ok: r.ok };
}

function dualOf(n) {
  switch (n.t) {
    case 'const': return K(1 - n.v);
    case 'var': return n;
    case 'not': return NOT(dualOf(n.a));
    case 'and': return { t: 'or', args: n.args.map(dualOf) };
    case 'or': return { t: 'and', args: n.args.map(dualOf) };
    default: return n;
  }
}

function evalSteps(ast, env) {
  const out = [], seen = new Set();
  const ops = { not: 'NOT', and: 'AND', or: 'OR', xor: 'XOR', nand: 'NAND', nor: 'NOR', xnor: 'XNOR' };
  (function walk(n) {
    if (n.t === 'var' || n.t === 'const') return;
    kids(n).forEach(walk);
    const s = str(n); if (seen.has(s)) return; seen.add(s);
    const kv = kids(n).map(c => ev(c, env));
    const calc = { not: kv[0] + "'", and: kv.join('·'), or: kv.join(' + '), xor: kv.join(' ⊕ '),
      nand: '(' + kv.join('·') + ")'", nor: '(' + kv.join(' + ') + ")'", xnor: '(' + kv.join(' ⊕ ') + ")'" }[n.t];
    out.push({ expr: s, op: ops[n.t], calc, value: ev(n, env) });
  })(ast);
  return out;
}

/* ───────── Mapa de Karnaugh ───────── */
function runs(idx, L) {
  const arr = Array(L).fill(false); idx.forEach(i => arr[i] = true);
  if (arr.every(Boolean)) return [{ a: 0, b: L - 1, oL: false, oR: false }];
  const out = [];
  for (let s = 0; s < L; s++) if (arr[s] && !arr[(s - 1 + L) % L]) {
    let len = 0; while (arr[(s + len) % L]) len++;
    if (s + len <= L) out.push({ a: s, b: s + len - 1, oL: false, oR: false });
    else { out.push({ a: s, b: L - 1, oL: false, oR: true }); out.push({ a: 0, b: (s + len - 1) % L, oL: true, oR: false }); }
  }
  return out;
}

function kmapFor(n, vars, fv, onesQ, zerosQ) {
  if (n < 2 || n > 8) return null;
  const gray = k => Array.from({ length: 1 << k }, (_, i) => (i ^ (i >> 1)).toString(2).padStart(k, '0'));
  const rv = vars.slice(0, Math.max(1, n >> 1));
  const cv = vars.slice(rv.length);
  const rc = gray(rv.length), cc = gray(cv.length);
  const cells = rc.map(r => cc.map(c => { const m = parseInt(r + c, 2); return { m, v: fv[m] }; }));
  const groupsFor = (q, kind) => q.cover.map((p, gi) => {
    const pos = p.m.map(m => { const s = m.toString(2).padStart(n, '0'); return [rc.indexOf(s.slice(0, rv.length)), cc.indexOf(s.slice(rv.length))]; });
    const Rr = [...new Set(pos.map(x => x[0]))], Cc = [...new Set(pos.map(x => x[1]))];
    const frames = [];
    runs(Rr, rc.length).forEach(rs => runs(Cc, cc.length).forEach(cs =>
      frames.push({ r0: rs.a, r1: rs.b, c0: cs.a, c1: cs.b, oT: rs.oL, oB: rs.oR, oL: cs.oL, oR: cs.oR })));
    const fixed = []; for (let i = 0; i < p.pat.length; i++) if (p.pat[i] !== '-') fixed.push(vars[i] + '=' + p.pat[i]);
    return { gi, pat: p.pat, m: p.m, cells: pos, frames, why: fixed.join(' ') || 'todas las celdas', term: kind === 'sop' ? patProd(p.pat, vars) : patSum(p.pat, vars), size: p.m.length };
  });
  const sg = groupsFor(onesQ, 'sop'), pg = groupsFor(zerosQ, 'pos');
  return {
    rowVars: rv, colVars: cv, rowCodes: rc, colCodes: cc, cells,
    sop: { groups: sg, expr: onesQ.ones.length === 0 ? '0' : onesQ.cover.some(p => !/[01]/.test(p.pat)) ? '1' : sg.map(g => g.term).join(' + ') },
    pos: { groups: pg, expr: zerosQ.ones.length === 0 ? '1' : zerosQ.cover.some(p => !/[01]/.test(p.pat)) ? '0' : pg.map(g => g.term).join('') }
  };
}

/* ───────── Diagrama de compuertas (SVG) ───────── */
function gateSvg(ast, opts) {
  opts = opts || {};
  const vals = opts.values || null;
  const known = vals && opts.vars && opts.vars.every(v => vals[v] === 0 || vals[v] === 1);
  const W = 44, ROW = 46, COLW = 100, LM = 44, ON = '#C4B5FD', OFF = '#524C6B', NEU = '#8B86A3';
  let slot = 0;
  function lay(n) {
    if (n.t === 'var' || n.t === 'const') return { n, leaf: true, level: 0, y: (slot++) * ROW + ROW / 2, kids: [] };
    const ks = kids(n).map(lay);
    return { n, kids: ks, level: Math.max(...ks.map(k => k.level)) + 1, y: ks.reduce((s, k) => s + k.y, 0) / ks.length };
  }
  const L = lay(ast);
  const maxLevel = L.level;
  const parts = [];
  const colOf = lv => LM + 16 + (lv - 1) * COLW;
  const wireCol = nd => !known ? NEU : (ev(nd.n, vals) ? ON : OFF);
  const shape = { and: 'and', nand: 'and', or: 'or', nor: 'or', xor: 'or', xnor: 'or' };
  function draw(nd) {
    nd.kids.forEach(draw);
    if (nd.leaf) { nd.ox = LM; return; }
    const n = nd.n, t = n.t, k = nd.kids.length;
    const x = colOf(nd.level), y = nd.y;
    const h = t === 'not' ? 24 : Math.max(34, 12 * (k + 1));
    const bub = t === 'not' || t === 'nand' || t === 'nor' || t === 'xnor';
    const bw = t === 'not' ? 24 : bub ? W - 4 : W;
    const sh = shape[t];
    const top = y - h / 2, bot = y + h / 2;
    const stroke = 'stroke="#A78BFA" stroke-width="1.6" fill="#12101C" stroke-linejoin="round"';
    let body = '';
    if (t === 'not') body = `<path d="M${x},${y - 11} L${x + 24},${y} L${x},${y + 11} Z" ${stroke}/>`;
    else if (sh === 'and') body = `<path d="M${x},${top} H${x + bw / 2} A${bw / 2} ${h / 2} 0 0 1 ${x + bw / 2} ${bot} H${x} Z" ${stroke}/>`;
    else {
      body = `<path d="M${x},${top} Q${x + bw * 0.55},${top} ${x + bw},${y} Q${x + bw * 0.55},${bot} ${x},${bot} Q${x + bw * 0.3},${y} ${x},${top} Z" ${stroke}/>`;
      if (t === 'xor' || t === 'xnor') body += `<path d="M${x - 6},${top} Q${x + bw * 0.3 - 6},${y} ${x - 6},${bot}" fill="none" stroke="#A78BFA" stroke-width="1.6"/>`;
    }
    nd.ox = x + bw;
    if (bub) { body += `<circle cx="${x + bw + 4}" cy="${y}" r="4" ${stroke}/>`; nd.ox = x + bw + 8; }
    // entradas
    const xorShift = (t === 'xor' || t === 'xnor') ? 6 : 0;
    nd.kids.forEach((c, i) => {
      const py = t === 'not' ? y : top + h * (i + 1) / (k + 1);
      let px = x - xorShift;
      if (sh === 'or') { const d = (py - y) / (h / 2); px += bw * 0.15 * (1 - d * d); }
      const ch = x - xorShift - 12 - 5 * i;
      parts.push(`<path d="M${c.ox},${c.y} H${ch} V${py} H${px}" fill="none" stroke="${wireCol(c)}" stroke-width="1.8" stroke-linejoin="round"/>`);
    });
    parts.push(body);
  }
  draw(L);
  // etiquetas de hojas
  (function leaves(nd) {
    if (nd.leaf) {
      const lab = nd.n.t === 'var' ? nd.n.n : String(nd.n.v);
      parts.push(`<text x="${LM - 8}" y="${nd.y + 4.5}" text-anchor="end" fill="#EDEAF7" font-family="Geist Mono, monospace" font-size="13">${lab}</text>`);
      if (nd.n.t === 'var' && known) parts.push(`<text x="${LM - 8}" y="${nd.y + 4.5}" dx="-14" text-anchor="end" fill="${vals[nd.n.n] ? ON : OFF}" font-family="Geist Mono, monospace" font-size="10">${vals[nd.n.n]}</text>`);
      return;
    }
    nd.kids.forEach(leaves);
  })(L);
  const outX = L.ox, outY = L.y;
  const totalW = outX + 64, totalH = Math.max(slot * ROW, 60) + 8;
  const fv = known ? ev(ast, vals) : null;
  parts.push(`<path d="M${outX},${outY} H${outX + 26}" stroke="${known ? (fv ? ON : OFF) : NEU}" stroke-width="1.8" fill="none"/>`);
  parts.push(`<text x="${outX + 32}" y="${outY + 4.5}" fill="#DDD6FE" font-family="Geist Mono, monospace" font-size="13" font-weight="600">F${known ? ' = ' + fv : ''}</text>`);
  const w = Math.max(totalW + (known ? 30 : 0), 160);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${totalH}" width="${w}" height="${totalH}" role="img" aria-label="Diagrama de compuertas">${parts.join('')}</svg>`;
}

function gateStats(ast) {
  const s = { NOT: 0, AND: 0, OR: 0, XOR: 0, NAND: 0, NOR: 0, XNOR: 0, inputs: 0 };
  (function w(n) {
    if (n.t === 'var' || n.t === 'const') return;
    kids(n).forEach(w);
    const k = kids(n).length;
    if (n.t === 'not') { s.NOT++; s.inputs++; }
    else if (n.t === 'and') { s.AND += k - 1; s.inputs += k; }
    else if (n.t === 'or') { s.OR += k - 1; s.inputs += k; }
    else { s[n.t.toUpperCase()]++; s.inputs += 2; }
  })(ast);
  s.gates = s.NOT + s.AND + s.OR + s.XOR + s.NAND + s.NOR + s.XNOR;
  const ic = [];
  const pk = (n, per, code, name) => { if (n) ic.push({ code, name, gates: n, chips: Math.ceil(n / per) }); };
  pk(s.NOT, 6, '7404', 'NOT'); pk(s.AND, 4, '7408', 'AND'); pk(s.OR, 4, '7432', 'OR');
  pk(s.NAND, 4, '7400', 'NAND'); pk(s.NOR, 4, '7402', 'NOR'); pk(s.XOR, 4, '7486', 'XOR');
  s.ic = ic;
  return s;
}

/* ───────── Análisis completo ───────── */
function subCols(ast) {
  const seen = new Map();
  (function w(n) { if (n.t === 'var' || n.t === 'const') return; kids(n).forEach(w); const s = str(n); if (!seen.has(s)) seen.set(s, n); })(ast);
  const root = str(ast); seen.delete(root);
  return [...seen.entries()].slice(-12);
}


/* Resolución por partes: una caja por XOR / XNOR / NAND / NOR (de adentro hacia afuera) */
function partesOf(ast, vars) {
  const n = vars.length, envs = allEnvs(vars);
  const minOf = nd => {
    const on = []; envs.forEach((e, i) => { if (ev(nd, e)) on.push(i); });
    if (!on.length) return K(0);
    if (on.length === envs.length) return K(1);
    return sopAst(qm(on, n).cover.map(p => p.pat), vars);
  };
  const NAME = { xor: 'XOR', xnor: 'XNOR', nand: 'NAND', nor: 'NOR' };
  const DEF = { xor: "x ⊕ y = x·y' + x'·y", xnor: "x ⊙ y = x·y + x'·y'", nand: "(x·y)' = x' + y'", nor: "(x + y)' = x'·y'" };
  const boxes = [], byKey = {};
  let hasGate = false;
  const simpBox = c => {
    if (c.t === 'var' || c.t === 'const' || isLit(c) || XORF.has(c.t)) return;
    const k = key(c); if (byKey[k] !== undefined) return;
    const res = minOf(c); if (str(res) === str(c)) return;
    const sm = simplify(c, vars, res);
    byKey[k] = boxes.length;
    boxes.push({ id: boxes.length + 1, kind: 'simp', title: 'Simplificar', expr: str(c), steps: sm.steps, result: str(res), ok: sm.ok });
  };
  const walk = nd => {
    if (nd.t === 'var' || nd.t === 'const') return;
    kids(nd).forEach(walk);
    const k = key(nd);
    if (!XORF.has(nd.t) || byKey[k] !== undefined) return;
    hasGate = true;
    nd.args.forEach(simpBox);
    const ops = nd.args.map(c => {
      const m = minOf(c);
      return { expr: str(c), min: str(m), node: m, from: byKey[key(c)] };
    });
    const sub = { t: nd.t, args: ops.map(o => o.node) };
    const res = minOf(nd);
    const sm = simplify(sub, vars, res);
    byKey[k] = boxes.length;
    boxes.push({ id: boxes.length + 1, kind: 'gate', op: NAME[nd.t], title: 'Resolver ' + NAME[nd.t], expr: str(nd), def: DEF[nd.t],
      operands: ops.map((o, i) => ({ name: i ? 'y' : 'x', expr: o.expr, min: o.min, from: o.from === undefined ? null : o.from + 1 })),
      sub: str(sub), steps: sm.steps, result: str(res), ok: sm.ok });
  };
  walk(ast);
  if (hasGate) return boxes.slice(0, 14);
  const res = minOf(ast), sm = simplify(ast, vars, res);
  return [{ id: 1, kind: 'simp', title: 'Simplificar', expr: str(ast), steps: sm.steps, result: str(res), ok: sm.ok }];
}

function analyze(opts) {
  const vars = opts.vars.map(v => v.toUpperCase()), n = vars.length;
  if (n < 1 || n > 10) throw new Error('Usa entre 1 y 10 variables');
  let src = String(opts.expr || '').replace(/==|≡/g, '=').trim();
  let label = 'F', eqSrc = null;
  const parts = src.split('=');
  if (parts.length > 2) throw new Error('Solo se permite un signo =');
  if (parts.length === 2) {
    const l = parts[0].trim();
    const isLabel = /^[A-Za-z][A-Za-z0-9_]*\s*(\([^)]*\))?$/.test(l) && !(l.length === 1 && vars.includes(l.toUpperCase()));
    if (isLabel) { label = l.replace(/\s*\(.*\)/, ''); src = parts[1]; }
    else { eqSrc = parts[1]; src = parts[0]; }
  }
  const ast = parse(src, vars);
  const envs = allEnvs(vars);
  const fv = envs.map(e => ev(ast, e));
  const ones = [], zeros = [];
  fv.forEach((v, i) => (v ? ones : zeros).push(i));
  const bin = i => i.toString(2).padStart(n, '0');
  const prod = i => vars.map((v, k) => bin(i)[k] === '1' ? v : v + "'").join('');
  const sum = i => '(' + vars.map((v, k) => bin(i)[k] === '0' ? v : v + "'").join(' + ') + ')';

  const sc = subCols(ast);
  const table = {
    vars, cols: sc.map(([s]) => s), root: str(ast),
    rows: envs.map((e, i) => ({ i, bits: vars.map(v => e[v]), cols: sc.map(([, nd]) => ev(nd, e)), f: fv[i] }))
  };

  const qO = qm(ones, n), qZ = qm(zeros, n);
  const minAst = sopAst(qO.cover.map(p => p.pat), vars);
  const dv = simplify(ast, vars, minAst);
  const comp = complement(minAst, vars);
  const dualAst = dualOf(minAst);
  const dualOk = envs.every(e => { const ne = {}; vars.forEach(v => ne[v] = 1 - e[v]); return ev(dualAst, e) === 1 - ev(minAst, ne); });
  const gZ = sopAst(qZ.cover.map(p => p.pat), vars);
  const posC = complement(gZ, vars);
  const posAst = posC.ast;

  const tv = nd => envs.map(e => ev(nd, e)).join('');
  const refTv = fv.join('');
  const canonSop = ones.length ? ones.map(prod).join(' + ') : '0';
  const canonPos = zeros.length ? zeros.map(sum).join('') : '1';

  const km = kmapFor(n, vars, fv, qO, qZ);
  const values = opts.values && vars.every(v => opts.values[v] === 0 || opts.values[v] === 1) ? opts.values : null;
  const rowAt = values ? envs.findIndex(e => vars.every(v => e[v] === values[v])) : -1;

  // Comprobación
  const verifyCols = [
    { label: label, tv: refTv },
    { label: 'Σ', tv: envs.map((e, i) => ones.includes(i) ? 1 : 0).join('') },
    { label: 'Π', tv: envs.map((e, i) => zeros.includes(i) ? 0 : 1).join('') },
    { label: 'mín SOP', tv: tv(minAst) },
    { label: 'mín POS', tv: tv(posAst) }
  ];
  const compTv = tv(comp.ast);
  const checks = [
    { name: 'Σ minitérminos ≡ F', ok: verifyCols[1].tv === refTv },
    { name: 'Π maxitérminos ≡ F', ok: verifyCols[2].tv === refTv },
    { name: 'Simplificación paso a paso ≡ F', ok: dv.ok },
    { name: 'Forma mínima SOP ≡ F', ok: verifyCols[3].tv === refTv },
    { name: 'Forma mínima POS ≡ F', ok: verifyCols[4].tv === refTv },
    { name: "Complemento F' ≡ ¬F", ok: comp.ok && compTv === envs.map(e => 1 - ev(ast, e)).join('') },
    { name: 'Dual: Fᵈ(x) = (F(x′))′', ok: dualOk },
    { name: 'Σ + Π cubren 2ⁿ filas', ok: ones.length + zeros.length === envs.length }
  ];
  // identidad
  let equation = null;
  if (eqSrc !== null) {
    const rhs = parse(eqSrc, vars);
    const rv = envs.map(e => ev(rhs, e));
    equation = { lhs: str(ast), rhs: str(rhs), equal: rv.join('') === refTv, rhsVals: rv, diffs: rv.map((v, i) => v !== fv[i] ? i : -1).filter(i => i >= 0) };
    checks.unshift({ name: 'Identidad ' + equation.lhs + ' = ' + equation.rhs, ok: equation.equal });
  }

  const canonSteps = ones.length ? canonExpand(ast, vars, ones) : { steps: [{ kind: 'given', tag: 'dado', expr: str(ast), ok: true }], ok: true };
  const gZfull = sopAst(zeros.map(bin), vars);
  const canonPosC = complement(gZfull, vars);
  checks.push({ name: canonSteps.truncated ? 'Forma canónica Σ ≡ F (tabla de verdad)' : 'Forma canónica por álgebra ≡ F', ok: canonSteps.ok && canonPosC.ok });
  const cost = { orig: gateStats(ast), min: gateStats(minAst), pos: gateStats(posAst) };

  return {
    vars, n, label, ast, expr: str(ast), fv, ones, zeros, values, rowAt,
    table, sigma: 'Σ(' + ones.join(', ') + ')', pi: 'Π(' + zeros.join(', ') + ')',
    minterms: ones.map(i => ({ i, bin: bin(i), term: prod(i) })),
    maxterms: zeros.map(i => ({ i, bin: bin(i), term: sum(i) })),
    canonSop, canonPos,
    qm: { ones: qO, zeros: qZ },
    kmap: km,
    min: { sop: str(minAst), pos: str(posAst), sopAst: minAst, posAst, posG: str(gZ), posSteps: posC.steps },
    partes: partesOf(ast, vars),
    derive: dv, complement: comp, dual: { ast: dualAst, expr: str(dualAst), ok: dualOk, from: str(minAst) },
    evalSteps: values ? evalSteps(ast, values) : null,
    evalValue: values ? ev(ast, values) : null,
    verify: { cols: verifyCols, rows: envs.length },
    checks, equation, cost,
    canon: { sop: canonSteps, posG: str(gZfull), pos: canonPosC },
    glist: { orig: gateList(ast), sop: gateList(minAst), pos: gateList(posAst) },
    usedRules: [...new Set([...dv.steps, ...comp.steps, ...posC.steps].map(s => (s.tag || '').slice(0, 2)).filter(t => RULES[t]))]
  };
}

return { analyze, parse, tokenize, str, ev, key, gateSvg, gateStats, RULES, qm, simplify, complement, dualOf, allEnvs, patProd, patSum };
});
