(function () {
'use strict';
const L = window.Logic;
const LETTERS = 'ABCDEFGH';
const EXAMPLES = [
  ["((((A+B)'·(A+C)) ⊕ (A+B+C)') ⊙ (A+B+D)') ⊕ (E(A+B))'", 5],
  ["AB' + CD", 4], ["AB'C + AB'C' + CD", 4], ["(A + B)'", 3], ["A + A'B", 2],
  ["AB + A'C + BC", 3], ["A ⊕ B ⊕ C", 3], ["(A + B)(A + C) = A + BC", 3], ["A nand B", 2]
];
const TOKENS = ["'", '+', '·', '⊕', '⊙', '(', ')', '0', '1'];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const st = { n: 5, vals: null, expr: '', res: null, open: new Set(), tab: { km: 'sop', gates: 'lab', al: 0 }, bat: { on: false, k: 0, playing: false, timer: null } };

/* ───── formulario ───── */
function vars() { return LETTERS.slice(0, st.n).split(''); }
function renderVars() {
  $('#nOut').textContent = st.n;
  $('#tokens').innerHTML = vars().map(v => `<button type="button" class="tok" data-act="tok" data-t="${v}">${v}</button>`).join('') +
    TOKENS.map(t => `<button type="button" class="tok" data-act="tok" data-t="${t}">${t}</button>`).join('');
}
function renderExamples() {
  $('#examples').innerHTML = EXAMPLES.map((e, i) => `<button type="button" class="ex" data-act="ex" data-i="${i}">${esc(e[0])}</button>`).join('');
}
function insertToken(t) {
  const inp = $('#expr'), a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
  inp.value = inp.value.slice(0, a) + t + inp.value.slice(b);
  inp.focus(); inp.setSelectionRange(a + t.length, a + t.length);
}
function showErr(m) { const e = $('#err'); e.hidden = !m; e.textContent = m || ''; }

/* ───── URL ───── */
function writeUrl() {
  const p = new URLSearchParams();
  p.set('e', st.expr); p.set('n', st.n);
  try { history.replaceState(null, '', '?' + p.toString()); } catch (e) {}
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  const n = parseInt(p.get('n'), 10);
  if (n >= 1 && n <= 8) st.n = n;
  if (p.get('e')) { st.expr = p.get('e'); $('#expr').value = st.expr; return true; }
  return false;
}

/* ───── cálculo ───── */
function autoN(src) {
  let s = String(src || '');
  const eq = s.split('=');
  if (eq.length === 2 && /^\s*F\s*(\([^)]*\))?\s*$/i.test(eq[0])) s = eq[1];
  s = s.replace(/\b(XNOR|NAND|NOR|XOR|AND|OR|NOT)\b/gi, ' ');
  let mx = -1;
  for (const ch of s.toUpperCase()) { const i = LETTERS.indexOf(ch); if (i > mx) mx = i; }
  return mx + 1;
}
function run(keepOpen) {
  st.expr = $('#expr').value.trim();
  showErr('');
  const need = autoN(st.expr);
  if (need >= 1 && need <= 8 && need !== st.n) { st.n = need; renderVars(); }
  const values = st.vals && vars().every(v => st.vals[v] === 0 || st.vals[v] === 1) ? st.vals : undefined;
  try {
    st.res = L.analyze({ vars: vars(), expr: st.expr, values });
  } catch (e) { showErr(e.message); return; }
  st.open = new Set(['pt', 'gt', 'al']);
  stopBat(); st.bat.on = false; st.bat.k = 0; st.bat.playing = false;
  writeUrl();
  render();
}

/* ───── render ───── */
const CARDS = [
  { id: 'pt', n: '00', title: 'Resolver por partes', show: r => r.partes && r.partes.length > 0, prev: r => `${r.partes.length} cajas`, body: bodyPartes },
  { id: 'tt', n: '01', title: 'Tabla de verdad', prev: r => `${r.table.rows.length} filas`, body: bodyTable },
  { id: 'mm', n: '02', title: 'Minitérminos y maxitérminos', prev: r => `${r.ones.length} · ${r.zeros.length}`, body: bodyTerms },
  { id: 'km', n: '03', title: 'Mapa de Karnaugh', prev: r => r.kmap ? `${r.kmap.sop.groups.length} grupos` : 'Quine-McCluskey', body: bodyKmap },
  { id: 'gt', n: '04', title: 'Compuertas y laboratorio', prev: r => `${r.cost.orig.gates} → ${r.cost.min.gates}`, body: bodyGates },
  { id: 'al', n: '05', title: 'Álgebra y postulados', prev: r => `${r.canon.sop.steps.length + r.derive.steps.length - 2} pasos`, body: bodyAlgebra },
  { id: 'ck', n: '06', title: 'Comprobación', prev: r => `${r.checks.filter(c => c.ok).length}/${r.checks.length}`, body: bodyCheck }
];


const ROUTE = [['pt', 'Por partes'], ['tt', 'Tabla de verdad'], ['mm', 'Σ y Π'], ['km', 'Karnaugh'], ['al', 'Álgebra'], ['gt', 'Compuertas'], ['ck', 'Comprobación']];

function render() {
  const r = st.res, box = $('#result');
  const allOk = r.checks.every(c => c.ok);
  const valPill = r.values ? `<span class="pill hi">${r.vars.map(v => v + '=' + r.values[v]).join(' ')} → ${r.label} = ${r.evalValue}</span>` : '';
  const eq = r.equation ? `<span class="pill ${r.equation.equal ? 'ok' : 'bad'}">${r.equation.equal ? 'Identidad verdadera' : 'Identidad falsa'}</span>` : '';
  box.innerHTML = `
    <div class="sum">
      <div class="orig"><span>Expresión</span><code>${esc(r.expr)}</code></div>
      <div class="res-grid">
        <div class="resbox sop"><div class="rh"><b>SOP</b><span>Suma de productos · agrupa los unos</span></div><div class="rv">${esc(r.label)} = ${esc(r.min.sop)}</div><div class="rf"><span>Filas donde F = 1</span>${esc(r.sigma.replace(/^Σ\(|\)$/g,"").replace(/^Σm\(|\)$/g,""))}</div></div>
        <div class="resbox pos"><div class="rh"><b>POS</b><span>Producto de sumas · agrupa los ceros</span></div><div class="rv">${esc(r.label)} = ${esc(r.min.pos)}</div><div class="rf"><span>Filas donde F = 0</span>${esc(r.pi.replace(/^Π\(|\)$/g,"").replace(/^ΠM\(|\)$/g,""))}</div></div>
      </div>
      <div class="pills">${valPill}${eq}
        <span class="pill ${allOk ? 'ok' : 'bad'}">${allOk ? '✓ ' : ''}${r.checks.filter(c => c.ok).length}/${r.checks.length} comprobaciones</span>
      </div>
    </div>
    <div class="route"><span class="sub" style="margin:0">Ruta del programa</span>${ROUTE.filter(x => x[0] !== 'pt' || (r.partes && r.partes.length)).map((x, i) => `<button type="button" class="rt" data-act="goto" data-id="${x[0]}"><b>${i + 1}</b>${x[1]}</button>`).join('<i>›</i>')}</div>
    <div class="cards" style="margin-top:24px">${CARDS.filter(c => !c.show || c.show(r)).map((c, i) => cardHtml({ ...c, n: String(i + 1).padStart(2, '0') }, r)).join('')}</div>`;
  mountLab();
}
function cardHtml(c, r) {
  const open = st.open.has(c.id);
  return `<article class="card ${open ? 'open' : ''}" id="card-${c.id}">
    <button type="button" class="card-h" data-act="toggle" data-id="${c.id}" aria-expanded="${open}">
      <span class="num">${c.n}</span><h2>${c.title}</h2><span class="prev">${esc(c.prev(r))}</span>
      <svg class="chev" viewBox="0 0 18 18" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l5 5 5-5"/></svg>
    </button>
    ${open ? `<div class="card-b">${c.body(r)}</div>` : ''}
  </article>`;
}
function mountLab() { const h = $('#lab-root'); if (h && window.Lab && st.res) Lab.mount(h, st.res, st.vals); }
function refreshCard(id) {
  const vis = CARDS.filter(x => !x.show || x.show(st.res));
  const c = { ...CARDS.find(x => x.id === id), n: String(vis.findIndex(x => x.id === id) + 1).padStart(2, '0') }, el = $('#card-' + id);
  el.outerHTML = cardHtml(c, st.res);
  mountLab();
}

/* 01 tabla */
function bodyTable(r) {
  const t = r.table;
  const head = `<tr>${t.vars.map(v => `<th>${v}</th>`).join('')}${t.cols.map((c, i) => `<th class="${i === 0 ? 'sep' : ''}">${esc(c)}</th>`).join('')}<th class="f sep">${esc(r.label)}</th></tr>`;
  const rows = t.rows.map(x => `<tr data-row="${x.i}" class="${x.i === r.rowAt ? 'sel' : ''}">
    ${x.bits.map(b => `<td class="${b ? 'one' : ''}">${b}</td>`).join('')}
    ${x.cols.map((b, i) => `<td class="${(b ? 'one ' : '') + (i === 0 ? 'sep' : '')}">${b}</td>`).join('')}
    <td class="f sep">${x.f}</td></tr>`).join('');
  let ev = '';
  if (r.evalSteps) {
    ev = `<div><p class="sub">Evaluación · ${r.vars.map(v => v + '=' + r.values[v]).join('  ')}</p><div class="box">
      ${r.evalSteps.map(s => `<div class="ev"><span>${esc(s.expr)}</span><span class="op">${s.op}</span><span>${esc(s.calc)}</span><span class="v">${s.value}</span></div>`).join('') ||
        `<div class="ev"><span>${esc(r.expr)}</span><span class="op">—</span><span></span><span class="v">${r.evalValue}</span></div>`}
    </div></div>`;
  }
  return `<div class="tw"><table class="tt"><thead>${head}</thead><tbody>${rows}</tbody></table></div>${ev}`;
}

/* 02 min/max */
function bodyTerms(r) {
  const list = (a, k) => a.length ? a.map(x => `<div class="mrow"><span>${k}<sub>${x.i}</sub></span><span>${x.bin}</span><span>${esc(x.term)}</span></div>`).join('') : `<div class="mrow"><span>—</span><span></span><span></span></div>`;
  return `<div class="two">
    <div><p class="sub">Minitérminos · ${esc(r.sigma)}</p><div class="box">${list(r.minterms, 'm')}</div></div>
    <div><p class="sub">Maxitérminos · ${esc(r.pi)}</p><div class="box">${list(r.maxterms, 'M')}</div></div>
  </div>
  <div class="canon"><small>FORMA CANÓNICA · SUMA DE MINITÉRMINOS</small>${esc(r.label)} = ${esc(r.canonSop)}</div>
  <div class="canon"><small>FORMA CANÓNICA · PRODUCTO DE MAXITÉRMINOS</small>${esc(r.label)} = ${esc(r.canonPos)}</div>`;
}

/* 03 karnaugh */
const GS = [['#A78BFA', 'solid'], ['#C4B5FD', 'dashed'], ['#7C3AED', 'solid'], ['#DDD6FE', 'dotted'], ['#8B5CF6', 'dashed'], ['#EDE9FE', 'dotted']];
function kgeom(km) {
  const c = km.colCodes.length, hl = Math.max(km.rowCodes[0].length, km.colCodes[0].length);
  const CS = c > 8 ? 38 : c > 4 ? 54 : 68, HW = Math.max(40, hl * 11 + 22), HH = c > 8 ? 36 : 50;
  return { CS, HW, HH, cls: c > 8 ? 'xs' : c > 4 ? 'sm' : '' };
}
function bodyKmap(r) {
  if (r.kmap && st.bat.on) return bodyBattle(r);
  let out = '';
  const km = r.kmap;
  if (km) {
    const mode = st.tab.km, g = km[mode];
    const { CS, HW, HH, cls: kcls } = kgeom(km);
    const rows = km.rowCodes.length, cols = km.colCodes.length;
    const want = mode === 'sop' ? 1 : 0;
    const bat = st.bat;
    let groups = g.groups.map((gr, gi) => ({ gr, gi }));
    if (bat.on) { groups.sort((x, y) => y.gr.size - x.gr.size || x.gi - y.gi); groups = groups.slice(0, bat.k); }
    const capSet = new Set(groups.flatMap(x => x.gr.cells.map(c => c[0] + ',' + c[1])));
    let total = 0; km.cells.forEach(row => row.forEach(c => { if (c.v === want) total++; }));
    let cells = `<div class="corner"><i style="left:8px;bottom:6px">${km.rowVars.join('')}</i><i style="right:8px;top:6px">${km.colVars.join('')}</i></div>`;
    cells += km.colCodes.map(c => `<div class="h">${c}</div>`).join('');
    km.rowCodes.forEach((rc, ri) => {
      cells += `<div class="h">${rc}</div>`;
      km.cells[ri].forEach((c, ci) => {
        const isT = c.v === want;
        const cls = !isT ? '' : !bat.on ? 'one' : capSet.has(ri + ',' + ci) ? 'one cap' : 'one ship';
        cells += `<div class="cell ${cls}"><small>${c.m}</small>${c.v}</div>`;
      });
    });
    const frames = groups.map(({ gr, gi }, idx) => {
      const [col, ls] = GS[gi % GS.length], ins = 4 + (gi % 3) * 3;
      const isNew = bat.on && idx === groups.length - 1;
      return gr.frames.map(f => {
        const left = HW + f.c0 * CS + ins, top = HH + f.r0 * CS + ins;
        const w = (f.c1 - f.c0 + 1) * CS - 2 * ins, h = (f.r1 - f.r0 + 1) * CS - 2 * ins;
        const bw = `${f.oT ? 0 : 2}px ${f.oR ? 0 : 2}px ${f.oB ? 0 : 2}px ${f.oL ? 0 : 2}px`;
        const rad = `${f.oT || f.oL ? 0 : 12}px ${f.oT || f.oR ? 0 : 12}px ${f.oB || f.oR ? 0 : 12}px ${f.oB || f.oL ? 0 : 12}px`;
        return `<div class="frame ${isNew ? 'new' : ''}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;border-style:${ls};border-color:${col};border-width:${bw};border-radius:${rad};background:${col}1A"></div>`;
      }).join('');
    }).join('');
    const legend = groups.map(({ gr, gi }, idx) => { const [col, ls] = GS[gi % GS.length]; return `<div class="lg ${bat.on && idx === groups.length - 1 ? 'hot' : ''}"><i style="border:2px ${ls} ${col};background:${col}1A"></i>${esc(gr.term)}<span>${gr.size} celdas · fijas ${esc(gr.why)}</span></div>`; }).join('');
    const nG = g.groups.length, done = bat.on && bat.k >= nG;
    const expr = bat.on ? (groups.length ? groups.map(x => x.gr.term).join(mode === 'sop' ? ' + ' : '') : '…') : g.expr;
    const ctrl = !bat.on
      ? `<button type="button" class="bt pri" data-act="bat" data-m="start">▶ Modo batalla</button>`
      : `<button type="button" class="bt pri" data-act="bat" data-m="${bat.playing ? 'pause' : 'play'}">${bat.playing ? '⏸ Pausa' : '▶ Seguir'}</button>
         <button type="button" class="bt" data-act="bat" data-m="next">Siguiente ›</button>
         <button type="button" class="bt" data-act="bat" data-m="reset">↺ Reiniciar</button>
         <button type="button" class="bt" data-act="bat" data-m="exit">Salir</button>
         <span class="pill hi">Capturadas ${capSet.size}/${total}</span><span class="pill">Grupos ${groups.length}/${nG}</span>`;
    out += `<div class="stats" style="align-items:center"><div class="tabs"><button type="button" class="${mode === 'sop' ? 'on' : ''}" data-act="kmtab" data-m="sop">Unos · SOP</button><button type="button" class="${mode === 'pos' ? 'on' : ''}" data-act="kmtab" data-m="pos">Ceros · POS</button></div>${ctrl}</div>
    <div class="km-wrap">
      <div class="km ${kcls}" style="grid-template-columns:${HW}px repeat(${cols},${CS}px);grid-template-rows:${HH}px repeat(${rows},${CS}px)">${cells}${frames}</div>
      <div class="legend"><p class="sub">${bat.on ? (done ? 'Todas capturadas' : 'Capturas') : 'Grupos'}</p>${legend || `<div class="lg">${bat.on ? total + ' objetivos a la vista' : 'sin grupos'}</div>`}
        <div class="canon" style="margin-top:6px"><small>RESULTADO</small>${esc(r.label)}${mode === 'pos' ? '' : ''} = ${esc(expr)}</div></div>
    </div>`;
  } else {
    out += `<p class="note">El mapa de Karnaugh necesita al menos 2 variables.</p>`;
  }
  return out;
}

function batSeq(r) {
  const km = r.kmap, f = a => a.map((gr, gi) => ({ gr, gi })).sort((x, y) => y.gr.size - x.gr.size || x.gi - y.gi);
  return [...f(km.sop.groups).map(x => ({ ...x, kind: 'sop' })), ...f(km.pos.groups).map(x => ({ ...x, kind: 'pos' }))];
}
function bodyBattle(r) {
  const km = r.kmap, bat = st.bat, seq = batSeq(r), vis = seq.slice(0, bat.k);
  const { CS, HW, HH, cls: kcls } = kgeom(km), rows = km.rowCodes.length, cols = km.colCodes.length;
  const nOnes = km.sop.groups.length;
  const capO = new Set(), capZ = new Set();
  vis.forEach(x => x.gr.cells.forEach(c => (x.kind === 'sop' ? capO : capZ).add(c[0] + ',' + c[1])));
  let tO = 0, tZ = 0; km.cells.forEach(row => row.forEach(c => { c.v ? tO++ : tZ++; }));
  let cells = `<div class="corner"><i style="left:8px;bottom:6px">${km.rowVars.join('')}</i><i style="right:8px;top:6px">${km.colVars.join('')}</i></div>`;
  cells += km.colCodes.map(c => `<div class="h">${c}</div>`).join('');
  km.rowCodes.forEach((rc, ri) => {
    cells += `<div class="h">${rc}</div>`;
    km.cells[ri].forEach((c, ci) => {
      const k = ri + ',' + ci;
      const cls = c.v ? (capO.has(k) ? 'one cap' : 'one ship') : (capZ.has(k) ? 'zero cap' : (bat.k >= nOnes ? 'zero ship' : 'zero'));
      cells += `<div class="cell ${cls}"><small>${c.m}</small>${c.v}</div>`;
    });
  });
  const frames = vis.map((x, idx) => {
    const [col, ls] = GS[idx % GS.length], ins = 4 + (idx % 3) * 3, isNew = idx === vis.length - 1;
    return x.gr.frames.map(f => {
      const left = HW + f.c0 * CS + ins, top = HH + f.r0 * CS + ins;
      const w = (f.c1 - f.c0 + 1) * CS - 2 * ins, h = (f.r1 - f.r0 + 1) * CS - 2 * ins;
      const bw = `${f.oT ? 0 : 2}px ${f.oR ? 0 : 2}px ${f.oB ? 0 : 2}px ${f.oL ? 0 : 2}px`;
      const rad = `${f.oT || f.oL ? 0 : 12}px ${f.oT || f.oR ? 0 : 12}px ${f.oB || f.oR ? 0 : 12}px ${f.oB || f.oL ? 0 : 12}px`;
      return `<div class="frame ${isNew ? 'new' : ''}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;border-style:${ls};border-color:${col};border-width:${bw};border-radius:${rad};background:${col}1A"></div>`;
    }).join('');
  }).join('');
  const legend = vis.map((x, idx) => { const [col, ls] = GS[idx % GS.length]; return `<div class="lg ${idx === vis.length - 1 ? 'hot' : ''}"><i style="border:2px ${ls} ${col};background:${col}1A"></i>${esc(x.gr.term)}<span>${x.kind === 'sop' ? 'unos' : 'ceros'} · ${x.gr.size} celdas · fijas ${esc(x.gr.why)}</span></div>`; }).join('');
  const eO = vis.filter(x => x.kind === 'sop').map(x => x.gr.term).join(' + ') || '…';
  const eZ = vis.filter(x => x.kind === 'pos').map(x => x.gr.term).join('') || '…';
  const done = bat.k >= seq.length;
  const ctrl = `<button type="button" class="bt pri" data-act="bat" data-m="${bat.playing ? 'pause' : 'play'}">${bat.playing ? '⏸ Pausa' : '▶ Seguir'}</button>
    <button type="button" class="bt" data-act="bat" data-m="next">Siguiente ›</button>
    <button type="button" class="bt" data-act="bat" data-m="reset">↺ Reiniciar</button>
    <button type="button" class="bt" data-act="bat" data-m="exit">Salir</button>
    <span class="pill hi">Unos ${capO.size}/${tO}</span><span class="pill hi">Ceros ${capZ.size}/${tZ}</span>`;
  return `<div class="stats" style="align-items:center">${ctrl}</div>
    <div class="km-wrap">
      <div class="km ${kcls}" style="grid-template-columns:${HW}px repeat(${cols},${CS}px);grid-template-rows:${HH}px repeat(${rows},${CS}px)">${cells}${frames}</div>
      <div class="legend"><p class="sub">${done ? 'Tablero completo' : bat.k < nOnes ? 'Capturando unos' : bat.k === nOnes && !vis.length ? 'Listo' : 'Capturando ceros'}</p>${legend || `<div class="lg">${tO} unos · ${tZ} ceros a la vista</div>`}
        <div class="canon" style="margin-top:6px"><small>RESULTADO · SOP</small>${esc(r.label)} = ${esc(eO)}</div>
        <div class="canon"><small>RESULTADO · POS</small>${esc(r.label)} = ${esc(eZ)}</div></div>
    </div>`;
}
function qmHtml(r, q, kind) {
  if (!q.ones.length) return '<p class="note">No hay términos.</p>';
  const cols = q.cols.map((col, ci) => `<div class="qcol"><p class="sub" style="margin-bottom:6px">Columna ${ci + 1}</p>${col.map(g => `<div class="qgrp"><b>${g.ones} unos</b>${g.items.map(it => `<div class="qi ${it.used ? 'u' : ''}"><span>${it.pat}</span><em>${it.used ? '✓' : 'primo'}</em><span>${it.m.join(',')}</span></div>`).join('')}</div>`).join('')}</div>`).join('');
  const ess = new Set(q.essential.map(p => p.pat)), cov = new Set(q.cover.map(p => p.pat));
  const head = `<tr><th>Primo</th><th>Término</th>${q.ones.map(m => `<th>${m}</th>`).join('')}</tr>`;
  const body = q.primes.map(p => `<tr><td class="mono">${p.pat}</td><td class="mono" style="color:var(--lav2)">${esc(kind === 'sop' ? L.patProd(p.pat, r.vars) : L.patSum(p.pat, r.vars))}${ess.has(p.pat) ? ' ★' : cov.has(p.pat) ? ' ●' : ''}</td>${q.ones.map(m => `<td class="${p.m.includes(m) ? 'x' : ''} ${ess.has(p.pat) && p.m.includes(m) ? 'e' : ''}">${p.m.includes(m) ? '×' : ''}</td>`).join('')}</tr>`).join('');
  const res = q.cover.map(p => kind === 'sop' ? L.patProd(p.pat, r.vars) : L.patSum(p.pat, r.vars)).join(kind === 'sop' ? ' + ' : '');
  return `<ol class="note" style="padding-left:34px;line-height:1.7"><li>Se agrupan los minitérminos según cuántos unos tienen.</li><li>Se unen pares que difieren en un solo bit; ese bit pasa a <b>–</b>. <b>✓</b> = ya se unió con otro.</li><li>Los que quedan sin ✓ (<b>primo</b>) no se pueden unir más.</li><li>En la tabla de primos, ★ = único que cubre algún minitérmino (obligatorio); se añaden los necesarios hasta cubrir todos.</li></ol><div class="qcols">${cols}</div><div><p class="sub">Tabla de primos · ★ esencial · ● elegido</p><div class="tw"><table class="tt pc"><thead>${head}</thead><tbody>${body}</tbody></table></div></div><div class="canon"><small>RESULTADO</small>${esc(r.label)}${kind === 'sop' ? '' : "′"} = ${esc(res)}</div>`;
}

/* 04 compuertas */
function bodyGates(r) {
  const t = st.tab.gates;
  if (t === 'lab') {
    const tb = `<div class="tabs"><button type="button" class="on" data-act="gtab" data-m="lab">Laboratorio interactivo</button>${['orig', 'sop', 'pos'].map(k => `<button type="button" data-act="gtab" data-m="${k}">${{ orig: 'Original', sop: 'Mínima SOP', pos: 'Mínima POS' }[k]} (diagrama)</button>`).join('')}</div>`;
    return `${tb}<div id="lab-root" style="margin-top:12px"></div>`;
  }
  const items = { orig: ['Original', r.ast, r.cost.orig], sop: ['Mínima SOP', r.min.sopAst, r.cost.min], pos: ['Mínima POS', r.min.posAst, r.cost.pos] };
  const [name, ast, cost] = items[t];
  const svg = L.gateSvg(ast, { values: r.values, vars: r.vars });
  const tabs = `<div class="tabs"><button type="button" data-act="gtab" data-m="lab">Laboratorio interactivo</button>${Object.entries(items).map(([k, v]) => `<button type="button" class="${k === t ? 'on' : ''}" data-act="gtab" data-m="${k}">${v[0]}</button>`).join('')}</div>`;
  const ic = cost.ic.map(i => `<span class="pill">${i.code} ${i.name} × ${i.chips}</span>`).join('');
  const cmp = `<span class="pill hi">Original ${r.cost.orig.gates} compuertas</span><span class="pill hi">SOP ${r.cost.min.gates}</span><span class="pill hi">POS ${r.cost.pos.gates}</span>`;
  return `${tabs}<div class="svgbox">${svg}</div>
    <div class="stats"><span class="pill ok">${name}: ${cost.gates} compuertas · ${cost.inputs} entradas</span>${ic}</div>
    <div class="stats">${cmp}</div>
    <div><p class="sub">Cómo se arma · ${name}</p><div class="box">${(r.glist[t] || []).map((g, i) => `<div class="ev" style="grid-template-columns:34px 70px 1fr 1fr"><span style="color:var(--acc)">G${i + 1}</span><span class="op">${g.op}</span><span>${esc(g.ins.join(', '))}</span><span class="v" style="text-align:left">→ ${esc(g.out)}</span></div>`).join('') || '<div class="ev"><span>Sin compuertas</span></div>'}</div></div>`;
}


/* 00 resolver por partes */
function bodyPartes(r) {
  const head = `<div class="sth"><span>PASO</span><span>ENUNCIADO</span><span>JUSTIFICACIÓN</span><span></span></div>`;
  return `<div class="pboxes">${r.partes.map(b => {
    const sr = stepRows(b.steps, b.id + '.', '');
    const ops = b.kind === 'gate' ? `<div class="pops">${b.operands.map(o => `<div><b>${o.name}</b><code>${esc(o.min)}</code>${o.from ? `<em>caja ${o.from}</em>` : ''}</div>`).join('')}</div>
      <div class="pdef"><span>Definición</span><code>${esc(b.def)}</code></div>` : '';
    return `<details class="pbox ${b.kind}" open><summary><b>${b.id}</b><span class="bt2">${b.title}</span><code class="pex">${esc(b.expr)}</code><span class="cnt">${b.steps.length - 1} pasos</span></summary>
      ${ops}${head}${sr.html}
      <div class="pres"><span>Resultado de la caja ${b.id}</span><code>${esc(b.result)}</code><i>${b.ok ? '✓' : '✗'}</i></div></details>`;
  }).join('')}</div>`;
}

/* 05 álgebra */
function tagInfo(tag) {
  const m = /^([PT])(\d)(\(([ab])\))?$/.exec(tag || '');
  if (m) return { cls: m[1] === 'P' ? 'post' : 'teo', label: (m[1] === 'P' ? 'Postulado ' : 'Teorema ') + m[2] + (m[3] || '') };
  return { dado: { cls: 'given', label: 'dado' }, DEF: { cls: 'def', label: 'Definición' }, QM: { cls: 'qm', label: 'Mín. Quine-McCluskey' }, DUAL: { cls: 'dual', label: 'Dualidad' } }[tag] || { cls: 'given', label: tag };
}
function hlExpr(cur, prev) {
  const A = cur.split(' '), B = prev ? prev.split(' ') : [];
  const mk = (t, ch) => ch ? `<mark>${esc(t)}</mark>` : (/^(\+|⊕|XNOR|NAND|NOR|XOR)$/.test(t) ? `<i class="op">${esc(t)}</i>` : esc(t));
  if (!B.length || A.length * B.length > 250000) return A.map(t => mk(t, false)).join(' ');
  const n = A.length, m = B.length, W = m + 1, D = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    D[i * W + j] = A[i] === B[j] ? D[(i + 1) * W + j + 1] + 1 : Math.max(D[(i + 1) * W + j], D[i * W + j + 1]);
  const keep = new Array(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (A[i] === B[j]) { keep[i] = true; i++; j++; }
    else if (D[(i + 1) * W + j] >= D[i * W + j + 1]) i++; else j++;
  }
  return A.map((t, i) => mk(t, !keep[i] && !/^(\+|⊕|XNOR)$/.test(t))).join(' ');
}
function stepRows(steps, prefix, label) {
  const used = [];
  const html = steps.map((s, i) => {
    const last = i === steps.length - 1 && steps.length > 1;
    const ti = tagInfo(s.tag);
    const id = i === 0 ? '' : prefix + i;
    if (s.tag) used.push({ tag: s.tag, id });
    return `<div class="st ${last ? 'last' : ''}"><span class="id">${id}</span>
      <span class="ex2 ${s.expr.length > 160 ? 'xlong' : s.expr.length > 70 ? 'long' : ''}">${i === 0 ? esc(label) + ' ' : ''}${i === 0 ? hlExpr(s.expr, '') : '<i class="op">=</i> ' + hlExpr(s.expr.replace(/^=\s*/, ''), steps[i - 1].expr.replace(/^=\s*/, ''))}</span>
      <span class="tg"><span class="tag ${ti.cls}">${esc(ti.label)}</span>${s.note ? `<small>${esc(s.note)}</small>` : ''}</span>
      <span class="ck">${i === 0 ? '' : (s.ok === false ? '✗' : '✓')}</span></div>`;
  }).join('');
  const l = steps[steps.length - 1].expr.replace(/^=\s*/, '');
  return { html, used, last: l.length > 90 ? l.slice(0, 90) + '…' : l, full: l };
}
function bodyAlgebra(r) {
  const head = `<div class="sth"><span>PASO</span><span>ENUNCIADO</span><span>JUSTIFICACIÓN</span><span></span></div>`;
  const blocks = [];
  const lb = r.label;
  const fin = o => { const l = o.steps ? o.steps[o.steps.length - 1] : null; return o.fin; };
  const add = (title, o, extra, opn) => blocks.push({ n: blocks.length + 1, title, ...o, extra, opn });
  const cs = r.canon.sop;
  add('Simplificar', stepRows(r.derive.steps, 'S', lb + ' ='),
    (r.partes && r.partes.length && r.derive.steps.length > 12 ? '<p class="note" style="margin-top:8px">Esta es la versión mecánica y larga. La versión corta, por etapas, está en la tarjeta «Resolver por partes».</p>' : '') + (r.derive.steps.length === 1 ? '<p class="note" style="margin-top:8px">Ya está en su forma mínima.</p>' : (r.derive.truncated ? '<p class="note" style="margin-top:8px">Se alcanzó el límite de pasos.</p>' : '')), true);
  add('Complemento', stepRows(r.complement.steps, 'C', lb + "' ="));
  add('Dual', stepRows([{ tag: 'dado', expr: r.dual.from }, { tag: 'DUAL', expr: '= ' + r.dual.expr, note: '+ ↔ ·   0 ↔ 1', ok: r.dual.ok }], 'D', lb + ' ='));
  add('Producto de sumas mínimo', stepRows(r.min.posSteps, 'P', lb + ' ='), `<p class="note" style="margin-top:8px">${esc(lb)}′ mínima (ceros del mapa) = ${esc(r.min.posG)}</p>`);
  add('Expandir a minitérminos', stepRows(cs.steps, 'E', lb + ' ='), cs.truncated ? '<p class="note" style="margin-top:8px">Se alcanzó el límite de pasos.</p>' : '');
  add('Producto de maxitérminos', stepRows(r.canon.pos.steps, 'M', lb + ' ='), `<p class="note" style="margin-top:8px">${esc(lb)}′ = suma de los ceros</p>`);
  const usedMap = {};
  blocks.forEach(b => b.used.forEach(u => { const k = (u.tag || '').slice(0, 2); if (L.RULES[k] && u.id) (usedMap[k] = usedMap[k] || []).push(u.id); }));
  const rail = kind => `<h4>${kind === 'post' ? 'POSTULADOS DE HUNTINGTON' : 'TEOREMAS'}</h4>` + Object.entries(L.RULES).filter(([, v]) => v.kind === kind).map(([k, v]) =>
    `<div class="ri ${usedMap[k] ? 'used' : ''}"><b>${k}</b><div><span>${v.name}</span><code>${esc(v.f)}</code></div><em>${usedMap[k] ? [...new Set(usedMap[k])].slice(0, 6).join(' ') : ''}</em></div>`).join('');
  const cur = Math.min(st.tab.al || 0, blocks.length - 1), b = blocks[cur];
  const cnt = x => x.html.split('class="st').length - 2;
  const tabs = `<div class="altabs">${blocks.map((x, k) => `<button type="button" class="${k === cur ? 'on' : ''}" data-act="altab" data-i="${k}"><b>${x.n}</b><span>${x.title}</span><small>${cnt(x)} pasos</small></button>`).join('')}</div>`;
  const uses = Object.fromEntries(Object.entries(usedMap).map(([k, v]) => [k, v.length]));
  const rail2 = kind => `<h4>${kind === 'post' ? 'POSTULADOS DE HUNTINGTON' : 'TEOREMAS'}</h4>` + Object.entries(L.RULES).filter(([, v]) => v.kind === kind).map(([k, v]) =>
    `<div class="ri ${uses[k] ? 'used' : ''}"><b>${k}</b><div><span>${v.name}</span><code>${esc(v.f)}</code></div><em>${uses[k] ? '×' + uses[k] : ''}</em></div>`).join('');
  return `${tabs}<div class="alg"><div class="alg-main">
      <div class="albox"><div class="alh"><b>${b.n}</b><span>${b.title}</span><small>${cnt(b)} pasos · cada fila cambia solo lo resaltado</small></div>
        ${head}${b.html}${b.extra || ''}
        <div class="pres"><span>Resultado</span><code>${esc(b.full)}</code><i>✓</i></div></div></div>
    <aside class="rail"><p class="sub" style="margin:0 0 4px">Reglas usadas en la hoja completa</p>${rail2('post')}${rail2('teo')}</aside></div>`;
}

/* 06 comprobación */
function bodyCheck(r) {
  const v = r.verify, N = r.table.rows.length;
  const ref = v.cols[0].tv;
  const eq = r.equation;
  const cols = eq ? [{ label: r.expr }, { label: eq.rhs }] : v.cols.map(c => ({ label: c.label }));
  const head = `<tr>${r.vars.map(x => `<th>${x}</th>`).join('')}${(eq ? [r.expr, eq.rhs] : v.cols.map(c => c.label)).map((c, i) => `<th class="${i === 0 ? 'sep' : ''}${i === 0 ? ' f' : ''}">${esc(c)}</th>`).join('')}<th class="sep">=</th></tr>`;
  const rows = r.table.rows.map(x => {
    const vals = eq ? [r.fv[x.i], eq.rhsVals[x.i]] : v.cols.map(c => +c.tv[x.i]);
    const same = vals.every(a => a === vals[0]);
    return `<tr class="${same ? '' : 'diff'}">${x.bits.map(b => `<td class="${b ? 'one' : ''}">${b}</td>`).join('')}${vals.map((b, i) => `<td class="${(b ? 'one ' : '') + (i === 0 ? 'sep f' : '')}">${b}</td>`).join('')}<td class="sep ${same ? 'one' : ''}">${same ? '✓' : '≠'}</td></tr>`;
  }).join('');
  const checks = r.checks.map(c => `<div class="chk ${c.ok ? '' : 'no'}"><i>${c.ok ? '✓' : '✗'}</i>${esc(c.name)}</div>`).join('');
  return `<div class="checks">${checks}</div>
    <div class="tw"><table class="tt"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

function stopBat() { clearInterval(st.bat.timer); st.bat.timer = null; }
function startBat() {
  stopBat();
  st.bat.timer = setInterval(() => {
    const b = st.bat; if (!b.playing || !st.res || !st.res.kmap) return;
    const nG = batSeq(st.res).length;
    if (b.k >= nG) { b.playing = false; stopBat(); }
    else { b.k++; if (b.k >= nG) { b.playing = false; stopBat(); } }
    refreshCard('km');
  }, 1600);
}

/* ───── eventos ───── */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-row]'); if (!t) return;
  if (t.dataset.row !== undefined) {
    const row = st.res.table.rows[+t.dataset.row];
    st.vals = {}; vars().forEach((v, i) => st.vals[v] = row.bits[i]);
    renderVars(); run(true); return;
  }
  const a = t.dataset.act;
  if (a === 'nminus' || a === 'nplus') {
    st.n = Math.max(1, Math.min(8, st.n + (a === 'nplus' ? 1 : -1)));
    st.vals = null;
    renderVars();
  } else if (a === 'tok') insertToken(t.dataset.t);
  else if (a === 'ex') {
    const ex = EXAMPLES[+t.dataset.i]; st.n = ex[1]; st.vals = null; $('#expr').value = ex[0]; renderVars(); run(false);
  } else if (a === 'go') { st.vals = null; run(true); }
  else if (a === 'toggle') {
    const id = t.dataset.id; st.open.has(id) ? st.open.delete(id) : st.open.add(id); refreshCard(id);
  } else if (a === 'goto') {
    const id = t.dataset.id; 
    st.open.add(id); refreshCard(id); $('#card-' + id).scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (a === 'kmtab') { st.tab.km = t.dataset.m; st.bat.k = 0; refreshCard('km'); }
  else if (a === 'bat') {
    const m = t.dataset.m, b = st.bat, nG = batSeq(st.res).length;
    if (m === 'start') { b.on = true; b.k = 0; b.playing = true; startBat(); }
    else if (m === 'pause') b.playing = false;
    else if (m === 'play') { if (b.k >= nG) b.k = 0; b.playing = true; startBat(); }
    else if (m === 'next') { b.playing = false; b.k = Math.min(nG, b.k + 1); }
    else if (m === 'reset') { b.k = 0; b.playing = false; }
    else if (m === 'exit') { b.on = false; b.playing = false; stopBat(); }
    refreshCard('km');
  }
  else if (a === 'altab') { st.tab.al = +t.dataset.i; refreshCard('al'); }
  else if (a === 'gtab') { st.tab.gates = t.dataset.m; refreshCard('gt'); }
  else if (a === 'copy') {
    writeUrl();
    const done = () => { t.textContent = 'Enlace copiado'; setTimeout(() => t.textContent = 'Copiar enlace', 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
  }
});
$('#expr').addEventListener('keydown', e => { if (e.key === 'Enter') { st.vals = null; run(true); } });

/* ───── inicio ───── */
renderExamples();
const hasUrl = readUrl();
renderVars();
if (hasUrl) { st.open = new Set(['pt', 'gt', 'al']); run(true); }
else { $('#expr').value = EXAMPLES[0][0]; st.open = new Set(['pt', 'gt', 'al']); run(true); }
})();
