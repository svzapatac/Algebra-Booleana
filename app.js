(function () {
'use strict';
const L = window.Logic;
const LETTERS = 'ABCDEF';
const EXAMPLES = [
  ["AB' + CD", 4], ["AB'C + AB'C' + CD", 4], ["(A + B)'", 3], ["A + A'B", 2],
  ["AB + A'C + BC", 3], ["A ⊕ B ⊕ C", 3], ["(A + B)(A + C) = A + BC", 3], ["A nand B", 2]
];
const TOKENS = ["'", '+', '·', '⊕', '(', ')', '0', '1'];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const st = { n: 4, vals: {}, expr: '', res: null, open: new Set(), tab: { km: 'sop', gates: 'orig' } };

/* ───── formulario ───── */
function vars() { return LETTERS.slice(0, st.n).split(''); }
function renderVars() {
  $('#nOut').textContent = st.n;
  $('#vars').innerHTML = vars().map(v => {
    const cur = String(st.vals[v] === undefined ? 0 : st.vals[v]);
    const b = (val, lab) => `<button type="button" data-act="val" data-v="${v}" data-x="${val}" class="${cur === val ? 'on' : ''}">${lab}</button>`;
    return `<div class="var"><b>${v}</b><div class="seg">${b('0', '0')}${b('1', '1')}</div></div>`;
  }).join('');
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
  p.set('v', vars().map(v => st.vals[v] === undefined ? 0 : st.vals[v]).join(''));
  try { history.replaceState(null, '', '?' + p.toString()); } catch (e) {}
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  const n = parseInt(p.get('n'), 10);
  if (n >= 1 && n <= 6) st.n = n;
  const v = p.get('v') || '';
  vars().forEach((x, i) => { if (v[i] === '0' || v[i] === '1') st.vals[x] = +v[i]; });
  if (p.get('e')) { st.expr = p.get('e'); $('#expr').value = st.expr; return true; }
  return false;
}

/* ───── cálculo ───── */
function run(keepOpen) {
  st.expr = $('#expr').value.trim();
  showErr('');
  const values = {}; vars().forEach(v => { values[v] = st.vals[v] === undefined ? 0 : st.vals[v]; });
  try {
    st.res = L.analyze({ vars: vars(), expr: st.expr, values });
  } catch (e) { showErr(e.message); return; }
  if (!keepOpen) st.open = new Set();
  writeUrl();
  render();
}

/* ───── render ───── */
const CARDS = [
  { id: 'tt', n: '01', title: 'Tabla de verdad', prev: r => `${r.table.rows.length} filas`, body: bodyTable },
  { id: 'mm', n: '02', title: 'Minitérminos y maxitérminos', prev: r => `${r.ones.length} · ${r.zeros.length}`, body: bodyTerms },
  { id: 'km', n: '03', title: 'Mapa de Karnaugh', prev: r => r.kmap ? `${r.kmap.sop.groups.length} grupos` : 'Quine-McCluskey', body: bodyKmap },
  { id: 'gt', n: '04', title: 'Compuertas lógicas', prev: r => `${r.cost.orig.gates} → ${r.cost.min.gates}`, body: bodyGates },
  { id: 'al', n: '05', title: 'Álgebra y postulados', prev: r => `${r.canon.sop.steps.length + r.derive.steps.length - 2} pasos`, body: bodyAlgebra },
  { id: 'ck', n: '06', title: 'Comprobación', prev: r => `${r.checks.filter(c => c.ok).length}/${r.checks.length}`, body: bodyCheck }
];

function render() {
  const r = st.res, box = $('#result');
  const allOk = r.checks.every(c => c.ok);
  const valPill = r.values ? `<span class="pill hi">${r.vars.map(v => v + '=' + r.values[v]).join(' ')} → ${r.label} = ${r.evalValue}</span>` : '';
  const eq = r.equation ? `<span class="pill ${r.equation.equal ? 'ok' : 'bad'}">${r.equation.equal ? 'Identidad verdadera' : 'Identidad falsa'}</span>` : '';
  box.innerHTML = `
    <div class="sum">
      <div class="big"><small>${esc(r.label)} =</small>${esc(r.min.sop)}</div>
      <div class="big" style="font-size:20px;color:var(--lav)"><small>POS</small>${esc(r.min.pos)}</div>
      <div class="pills">
        <span class="pill hi">${esc(r.sigma)}</span><span class="pill hi">${esc(r.pi)}</span>${valPill}${eq}
        <span class="pill ${allOk ? 'ok' : 'bad'}">${allOk ? '✓ ' : ''}${r.checks.filter(c => c.ok).length}/${r.checks.length} comprobaciones</span>
      </div>
    </div>
    <div class="cards" style="margin-top:24px">${CARDS.map(c => cardHtml(c, r)).join('')}</div>`;
}
function cardHtml(c, r) {
  if (c.id === 'km' && r.n > 4) return `<article class="card locked" id="card-km"><div class="card-h" style="cursor:not-allowed;opacity:.5"><span class="num">${c.n}</span><h2>${c.title}</h2><span class="prev">Solo hasta 4 variables</span><svg class="chev" viewBox="0 0 18 18" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="transform:none"><rect x="3.5" y="8" width="11" height="7.5" rx="2"/><path d="M6 8V6a3 3 0 016 0v2"/></svg></div></article>`;
  const open = st.open.has(c.id);
  return `<article class="card ${open ? 'open' : ''}" id="card-${c.id}">
    <button type="button" class="card-h" data-act="toggle" data-id="${c.id}" aria-expanded="${open}">
      <span class="num">${c.n}</span><h2>${c.title}</h2><span class="prev">${esc(c.prev(r))}</span>
      <svg class="chev" viewBox="0 0 18 18" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l5 5 5-5"/></svg>
    </button>
    ${open ? `<div class="card-b">${c.body(r)}</div>` : ''}
  </article>`;
}
function refreshCard(id) {
  const c = CARDS.find(x => x.id === id), el = $('#card-' + id);
  el.outerHTML = cardHtml(c, st.res);
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
  } else ev = `<p class="note">Asigna 0/1 a todas las variables (o toca una fila) para ver la evaluación.</p>`;
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
function bodyKmap(r) {
  let out = '';
  const km = r.kmap;
  if (km) {
    const mode = st.tab.km, g = km[mode];
    const CS = 68, HW = 64, HH = 50;
    const rows = km.rowCodes.length, cols = km.colCodes.length;
    const want = mode === 'sop' ? 1 : 0;
    let cells = `<div class="corner"><i style="left:8px;bottom:6px">${km.rowVars.join('')}</i><i style="right:8px;top:6px">${km.colVars.join('')}</i></div>`;
    cells += km.colCodes.map(c => `<div class="h">${c}</div>`).join('');
    km.rowCodes.forEach((rc, ri) => {
      cells += `<div class="h">${rc}</div>`;
      km.cells[ri].forEach(c => { cells += `<div class="cell ${c.v === want ? 'one' : ''}"><small>${c.m}</small>${c.v}</div>`; });
    });
    const frames = g.groups.map((gr, gi) => {
      const [col, ls] = GS[gi % GS.length], ins = 4 + (gi % 3) * 3;
      return gr.frames.map(f => {
        const left = HW + f.c0 * CS + ins, top = HH + f.r0 * CS + ins;
        const w = (f.c1 - f.c0 + 1) * CS - 2 * ins, h = (f.r1 - f.r0 + 1) * CS - 2 * ins;
        const bw = `${f.oT ? 0 : 2}px ${f.oR ? 0 : 2}px ${f.oB ? 0 : 2}px ${f.oL ? 0 : 2}px`;
        const rad = `${f.oT || f.oL ? 0 : 12}px ${f.oT || f.oR ? 0 : 12}px ${f.oB || f.oR ? 0 : 12}px ${f.oB || f.oL ? 0 : 12}px`;
        return `<div class="frame" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;border-style:${ls};border-color:${col};border-width:${bw};border-radius:${rad};background:${col}1A"></div>`;
      }).join('');
    }).join('');
    const legend = g.groups.map((gr, gi) => { const [col, ls] = GS[gi % GS.length]; return `<div class="lg"><i style="border:2px ${ls} ${col};background:${col}1A"></i>${esc(gr.term)}<span>${gr.size} celdas · fijas ${esc(gr.why)}</span></div>`; }).join('');
    out += `<div class="tabs"><button type="button" class="${mode === 'sop' ? 'on' : ''}" data-act="kmtab" data-m="sop">Unos · SOP</button><button type="button" class="${mode === 'pos' ? 'on' : ''}" data-act="kmtab" data-m="pos">Ceros · POS</button></div>
    <div class="km-wrap">
      <div class="km" style="grid-template-columns:${HW}px repeat(${cols},${CS}px);grid-template-rows:${HH}px repeat(${rows},${CS}px)">${cells}${frames}</div>
      <div class="legend"><p class="sub">Grupos</p>${legend || '<div class="lg">sin grupos</div>'}
        <div class="canon" style="margin-top:6px"><small>RESULTADO</small>${esc(r.label)} = ${esc(g.expr)}</div></div>
    </div>`;
  } else {
    out += `<p class="note">El mapa de Karnaugh está disponible de 2 a 4 variables. Con ${r.n} variables se simplifica con Quine-McCluskey (abajo).</p>`;
  }
  out += `<details class="fold" ${km ? '' : 'open'}><summary>Quine-McCluskey · unos</summary><div>${qmHtml(r, r.qm.ones, 'sop')}</div></details>`;
  if (r.zeros.length) out += `<details class="fold"><summary>Quine-McCluskey · ceros</summary><div>${qmHtml(r, r.qm.zeros, 'pos')}</div></details>`;
  return out;
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
  const items = { orig: ['Original', r.ast, r.cost.orig], sop: ['Mínima SOP', r.min.sopAst, r.cost.min], pos: ['Mínima POS', r.min.posAst, r.cost.pos] };
  const [name, ast, cost] = items[t];
  const svg = L.gateSvg(ast, { values: r.values, vars: r.vars });
  const tabs = `<div class="tabs">${Object.entries(items).map(([k, v]) => `<button type="button" class="${k === t ? 'on' : ''}" data-act="gtab" data-m="${k}">${v[0]}</button>`).join('')}</div>`;
  const ic = cost.ic.map(i => `<span class="pill">${i.code} ${i.name} × ${i.chips}</span>`).join('');
  const cmp = `<span class="pill hi">Original ${r.cost.orig.gates} compuertas</span><span class="pill hi">SOP ${r.cost.min.gates}</span><span class="pill hi">POS ${r.cost.pos.gates}</span>`;
  return `${tabs}<div class="svgbox">${svg}</div>
    <div class="stats"><span class="pill ok">${name}: ${cost.gates} compuertas · ${cost.inputs} entradas</span>${ic}</div>
    <div class="stats">${cmp}</div>
    <div><p class="sub">Cómo se arma · ${name}</p><div class="box">${(r.glist[t] || []).map((g, i) => `<div class="ev" style="grid-template-columns:34px 70px 1fr 1fr"><span style="color:var(--acc)">G${i + 1}</span><span class="op">${g.op}</span><span>${esc(g.ins.join(', '))}</span><span class="v" style="text-align:left">→ ${esc(g.out)}</span></div>`).join('') || '<div class="ev"><span>Sin compuertas</span></div>'}</div></div>`;
}

/* 05 álgebra */
function tagInfo(tag) {
  const m = /^([PT])(\d)(\(([ab])\))?$/.exec(tag || '');
  if (m) return { cls: m[1] === 'P' ? 'post' : 'teo', label: (m[1] === 'P' ? 'Postulado ' : 'Teorema ') + m[2] + (m[3] || '') };
  return { dado: { cls: 'given', label: 'dado' }, DEF: { cls: 'def', label: 'Definición' }, QM: { cls: 'qm', label: 'Mín. Quine-McCluskey' }, DUAL: { cls: 'dual', label: 'Dualidad' } }[tag] || { cls: 'given', label: tag };
}
function stepRows(steps, prefix, label) {
  const used = [];
  const html = steps.map((s, i) => {
    const last = i === steps.length - 1 && steps.length > 1;
    const ti = tagInfo(s.tag);
    const id = i === 0 ? '' : prefix + i;
    if (s.tag) used.push({ tag: s.tag, id });
    return `<div class="st ${last ? 'last' : ''}"><span class="id">${id}</span>
      <span class="ex2">${i === 0 ? esc(label) + ' ' : ''}${i === 0 ? '' : ''}${esc(s.expr)}</span>
      <span class="tg"><span class="tag ${ti.cls}">${esc(ti.label)}</span>${s.note ? `<small>${esc(s.note)}</small>` : ''}</span>
      <span class="ck">${i === 0 ? '' : (s.ok === false ? '✗' : '✓')}</span></div>`;
  }).join('');
  return { html, used };
}
function bodyAlgebra(r) {
  const head = `<div class="sth"><span>PASO</span><span>ENUNCIADO</span><span>JUSTIFICACIÓN</span><span></span></div>`;
  const blocks = [];
  const lb = r.label;
  const add = (title, o, extra) => blocks.push({ n: blocks.length + 1, title, ...o, extra });
  const cs = r.canon.sop;
  add('Expandir a minitérminos', stepRows(cs.steps, 'E', lb + ' ='), cs.truncated ? '<p class="note" style="margin-top:8px">Se alcanzó el límite de pasos.</p>' : '');
  add('Simplificar', stepRows(r.derive.steps, 'S', lb + ' ='),
    r.derive.steps.length === 1 ? '<p class="note" style="margin-top:8px">Ya está en su forma mínima: ningún postulado la reduce más.</p>' : (r.derive.truncated ? '<p class="note" style="margin-top:8px">Se alcanzó el límite de pasos.</p>' : ''));
  add('Complemento', stepRows(r.complement.steps, 'C', lb + "' ="));
  add('Dual', stepRows([{ tag: 'dado', expr: r.dual.from }, { tag: 'DUAL', expr: '= ' + r.dual.expr, note: '+ ↔ ·   0 ↔ 1', ok: r.dual.ok }], 'D', lb + ' ='));
  add('Producto de sumas mínimo', stepRows(r.min.posSteps, 'P', lb + ' ='), `<p class="note" style="margin-top:8px">${esc(lb)}′ mínima (ceros del mapa) = ${esc(r.min.posG)}</p>`);
  add('Producto de maxitérminos', stepRows(r.canon.pos.steps, 'M', lb + ' ='), `<p class="note" style="margin-top:8px">${esc(lb)}′ = suma de los ceros = ${esc(r.canon.posG.length > 160 ? r.canon.posG.slice(0, 160) + '…' : r.canon.posG)}</p>`);
  const usedMap = {};
  blocks.forEach(b => b.used.forEach(u => { const k = (u.tag || '').slice(0, 2); if (L.RULES[k] && u.id) (usedMap[k] = usedMap[k] || []).push(u.id); }));
  const rail = kind => `<h4>${kind === 'post' ? 'POSTULADOS DE HUNTINGTON' : 'TEOREMAS'}</h4>` + Object.entries(L.RULES).filter(([, v]) => v.kind === kind).map(([k, v]) =>
    `<div class="ri ${usedMap[k] ? 'used' : ''}"><b>${k}</b><div><span>${v.name}</span><code>${esc(v.f)}</code></div><em>${usedMap[k] ? [...new Set(usedMap[k])].slice(0, 6).join(' ') : ''}</em></div>`).join('');
  return `<div class="alg"><div class="alg-main">${blocks.map(b => `<div class="blk"><h3><b>${b.n}</b>${b.title}</h3>${head}${b.html}${b.extra || ''}</div>`).join('')}</div>
    <aside class="rail">${rail('post')}${rail('teo')}</aside></div>`;
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
    st.n = Math.max(1, Math.min(6, st.n + (a === 'nplus' ? 1 : -1)));
    Object.keys(st.vals).forEach(k => { if (!vars().includes(k)) delete st.vals[k]; });
    renderVars();
  } else if (a === 'val') {
    st.vals[t.dataset.v] = +t.dataset.x;
    renderVars(); if ($('#expr').value.trim()) run(true);
  } else if (a === 'tok') insertToken(t.dataset.t);
  else if (a === 'ex') {
    const ex = EXAMPLES[+t.dataset.i]; st.n = ex[1]; st.vals = {}; $('#expr').value = ex[0]; renderVars(); run(false);
  } else if (a === 'go') run(true);
  else if (a === 'toggle') {
    const id = t.dataset.id; st.open.has(id) ? st.open.delete(id) : st.open.add(id); refreshCard(id);
  } else if (a === 'kmtab') { st.tab.km = t.dataset.m; refreshCard('km'); }
  else if (a === 'gtab') { st.tab.gates = t.dataset.m; refreshCard('gt'); }
  else if (a === 'copy') {
    writeUrl();
    const done = () => { t.textContent = 'Enlace copiado'; setTimeout(() => t.textContent = 'Copiar enlace', 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
  }
});
$('#expr').addEventListener('keydown', e => { if (e.key === 'Enter') run(true); });

/* ───── inicio ───── */
renderExamples();
const hasUrl = readUrl();
renderVars();
if (hasUrl) { st.open = new Set(['al']); run(true); }
else { $('#expr').value = "AB' + CD"; run(false); }
})();
