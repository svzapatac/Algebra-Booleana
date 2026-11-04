/* Lab 2 · secciones: editor, original vs reducida, HDL, TTL y descargas. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const NM = { add: 'sumador', sub: 'restador', mul: 'multiplicador', div: 'divisor' };
  const NAME = { add: 'sumador', sub: 'restador', mul: 'multiplicador', div: 'divisor' };
  const dl = (n, t) => window.Lab2.download(n, t);
  let cur = { op: 'add', n: 4, nl: null }, cache = {}, hLang = 'v', hKind = 's', tIdx = 0, ttlPlan = null;
  const tbl = (head, rows) => '<div class="tw"><table><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table></div>';
  const cnt = nl => { const c = { AND: 0, OR: 0, XOR: 0, NOT: 0 }; nl.gates.forEach(g => c[g.t] = (c[g.t] || 0) + 1); return c; };
  const base = () => NM[cur.op] + cur.n;

  /* ---------- hook desde lab2.js ---------- */
  window.Lab2Hook = function (op, n) {
    const same = cur.op === op && cur.n === n && cur.nl;
    cur.op = op; cur.n = n;
    if (!same) { cur.nl = L2.BUILD[op](n); cur.min = cur.orig = null; cache = {}; tIdx = 0; ttlPlan = L2T.plan(cur.nl); renderCmp(); renderTtl(); renderHdl(); }
    $('#dlO').disabled = n > 3; $('#dlM').disabled = n > 5;
    $('#dlO').title = n > 3 ? 'Solo hasta 3 bits (6 variables): con más, el circuito de minitérminos es enorme' : '';
    $('#dlM').title = n > 5 ? 'Hasta 5 bits (10 variables)' : '';
    $('#edLoadM').disabled = n > 3;
  };
  $('#dlW').onclick = () => dl(`${base()}_cables.circ`, L2W.toCirc(cur.nl));
  $('#dlB').onclick = () => dl(`${base()}_bloques.circ`, L2.toCircBlocks(cur.op, cur.n));
  $('#dlO').onclick = () => dl(`${base()}_original.circ`, L2W.toCirc(L2M.build(cur.op, cur.n, 'orig')));
  $('#dlM').onclick = () => dl(`${base()}_reducida.circ`, L2W.toCirc(L2M.build(cur.op, cur.n, 'min')));

  /* ---------- original vs reducida ---------- */
  function renderCmp() {
    const n = cur.n, op = cur.op, rows = [];
    const stat = (nl) => { const c = cnt(nl); return [nl.gates.length, c.AND, c.OR, c.XOR || 0, c.NOT]; };
    rows.push(['Estructural (por etapas)', ...stat(cur.nl), '—', '—']);
    const box = $('#cmp'); box.innerHTML = '<p class="muted">Calculando…</p>';
    setTimeout(() => {
      if (n <= 4) { const o = L2M.build(op, n, 'orig'); rows.push(['Original (minitérminos)', ...stat(o), o.info.products, o.info.literals]); }
      else rows.push(['Original (minitérminos)', '—', '—', '—', '—', '—', 'muy grande', '—']);
      if (n <= 5) { const t0 = performance.now(); const m = L2M.build(op, n, 'min'); rows.push(['Reducida (Quine-McCluskey)', ...stat(m), m.info.products, m.info.literals]); cur.minMs = Math.round(performance.now() - t0); }
      else rows.push(['Reducida (Quine-McCluskey)', '—', '—', '—', '—', '—', '—', '—']);
      let note = `<p class="muted">Variables de entrada: <b>${2 * n}</b> (${n <= 2 ? 'caben en un mapa de Karnaugh grande' : n === 2.5 ? '' : 'se reduce con Quine-McCluskey'}). Conteo en compuertas de 2 entradas + NOT. `;
      if (n >= 3) note += 'Nota: la forma por etapas suele ser <b>más pequeña</b> que cualquier suma de productos de dos niveles, porque reutiliza el acarreo; la reducción por QM acorta cada salida por separado.';
      box.innerHTML = tbl(['Versión', 'Compuertas', 'AND', 'OR', 'XOR', 'NOT', 'Productos', 'Literales'], rows) + note + '</p>' +
        (n <= 5 ? `<p class="muted">QM calculado en ${cur.minMs} ms en tu navegador. Todas las versiones se comprobaron con la tabla completa en Logisim.</p>` : '');
    }, 20);
  }

  /* ---------- HDL ---------- */
  const tabs = (sel, cb) => document.querySelectorAll(sel + ' button').forEach(b => b.onclick = () => { document.querySelectorAll(sel + ' button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cb(b.dataset.v); renderHdl(); });
  tabs('#hLang', v => { hLang = v; }); tabs('#hKind', v => { hKind = v; });
  function hdlText() {
    const { op, n } = cur, b = base();
    if (hLang === 'v') {
      if (hKind === 's') return { code: L2H.verilogStruct(cur.nl, b + '_est'), tb: L2H.verilogTBstruct(cur.nl, op, n, b + '_est'), ext: 'v', name: b + '_est' };
      if (hKind === 'b') return { code: L2H.verilogBehav(op, n), tb: L2H.verilogTB(op, n, b, false), ext: 'v', name: b };
      return { code: L2H.verilogSeq(op, n), tb: L2H.verilogTB(op, n, b, true), ext: 'v', name: b + '_seq' };
    }
    if (hKind === 's') return { code: L2H.vhdlStruct(cur.nl, b + '_est'), tb: L2H.vhdlTB(op, n, b + '_est', false), ext: 'vhd', name: b + '_est' };
    if (hKind === 'b') return { code: L2H.vhdlBehav(op, n), tb: L2H.vhdlTB(op, n, b, false), ext: 'vhd', name: b };
    return { code: L2H.vhdlSeq(op, n), tb: L2H.vhdlTB(op, n, b + '_seq', true), ext: 'vhd', name: b + '_seq' };
  }
  function renderHdl() {
    const t = hdlText(); cache.h = t;
    $('#hCode').textContent = t.code;
    const lat = { add: '1 ciclo', sub: '1 ciclo', mul: cur.n + 1 + ' ciclos', div: cur.n + 1 + ' ciclos' }[cur.op];
    $('#hNote').textContent = hKind === 'q'
      ? `Con reloj: señales clk, rst, start y done. Aplica A y B, sube start un ciclo y espera done (${lat}).`
      : hKind === 's' ? 'Estructural: una asignación por compuerta, igual que el circuito de Logisim.' : 'Comportamental: describe la operación y deja que la herramienta de síntesis arme el circuito.';
    $('#hNote').textContent += ' Probado con ' + (hLang === 'v' ? 'Icarus Verilog' : 'GHDL') + ' contra la aritmética real (todas las combinaciones hasta 5 bits).';
  }
  $('#hCopy').onclick = () => { const t = cache.h.code; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { $('#hCopy').textContent = 'Copiado ✔'; setTimeout(() => $('#hCopy').textContent = 'Copiar', 1200); }).catch(() => { const r = document.createRange(); r.selectNodeContents($('#hCode')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); };
  $('#hDl').onclick = () => dl(cache.h.name + '.' + cache.h.ext, cache.h.code);
  $('#hTb').onclick = () => dl(cache.h.name + '_tb.' + cache.h.ext, cache.h.tb);

  /* ---------- TTL ---------- */
  function renderTtl() {
    const p = ttlPlan, n = cur.n;
    const parts = Object.entries(p.counts).map(([k, v]) => `${v} × ${k}`).join(' · ');
    $('#ttlSum').innerHTML = `<p><b>${p.total}</b> chips en total: ${parts}. Alimenta todos con +5 V en el pin 14 y GND en el pin 7. Entradas: interruptores DIP; salidas: LED con resistencia de 330 Ω a GND.</p>` +
      (n > 5 ? '<p class="warn">Con ' + n + ' bits son muchos chips; en clase se arman 4 o 5 bits.</p>' : '') +
      (p.spare ? `<p class="muted">Quedan ${p.spare} compuertas libres: conecta sus entradas a GND.</p>` : '');
    const sel = $('#tSel'); sel.innerHTML = p.chips.map((c, i) => `<option value="${i}">${i + 1}. ${c.id} · ${c.spec.chip}</option>`).join('');
    drawCards();
    $('#ttlQuick').innerHTML = `TTL: <b>${p.total}</b> chips (${parts}) → <a href="#ttl">ver cada chip</a>`;
    $('#ttlNets').innerHTML = tbl(['red', 'sale de', 'llega a'], p.nets.map(x => [x.net, x.from, x.to.join(', ')]));
  }
  function card(ch, i) {
    const lines = ch.slots.map(s => `<li><b>Compuerta ${s.n}</b>: <code>${s.expr}</code> — entradas: pin ${s.ins.map(x => x.pin).join(' y pin ')}, salida: pin ${s.outPin}${s.dest.length ? ' → ' + s.dest.join(', ') : ''}</li>`).join('');
    return `<figure class="ttlcard"><figcaption><span class="num">${i + 1} / ${ttlPlan.total}</span><b>${ch.title}</b><small>${ch.sub} · ${ch.used}/${ch.cap} compuertas en uso</small></figcaption>${L2T.svg(ch)}<ul class="ttlist">${lines}${ch.cap > ch.used ? `<li class="muted">${ch.cap - ch.used} compuerta(s) libre(s): entradas a GND.</li>` : ''}<li class="muted">Pin 14 = +5 V · Pin 7 = GND</li></ul></figure>`;
  }
  function drawCards() {
    const p = ttlPlan, all = $('#tAll').checked;
    $('#ttlCards').innerHTML = all ? p.chips.map(card).join('') : card(p.chips[tIdx], tIdx);
    $('#tSel').value = tIdx; $('#tPrev').disabled = all || tIdx === 0; $('#tNext').disabled = all || tIdx >= p.chips.length - 1; $('#tSel').disabled = all;
  }
  $('#tPrev').onclick = () => { tIdx = Math.max(0, tIdx - 1); drawCards(); };
  $('#tNext').onclick = () => { tIdx = Math.min(ttlPlan.chips.length - 1, tIdx + 1); drawCards(); };
  $('#tSel').onchange = e => { tIdx = +e.target.value; drawCards(); };
  $('#tAll').onchange = drawCards;
  $('#dlT').onclick = () => {
    const p = ttlPlan; let t = `PLANO TTL · ${NAME[cur.op]} de ${cur.n} bits\nChips: ${Object.entries(p.counts).map(([k, v]) => v + ' x ' + k).join(', ')}\n\n`;
    p.chips.forEach(c => t += L2T.chipText(c) + '\n');
    t += 'CABLEADO (red: origen -> destinos)\n'; p.nets.forEach(x => t += `  ${x.net}: ${x.from} -> ${x.to.join(', ')}\n`);
    dl(`${base()}_TTL.txt`, t);
  };

  /* ---------- editor ---------- */
  const ed = L2E.init($('#edHost'));
  let running = false, savedNL = null;
  const msg = (t, bad) => { $('#edMsg').textContent = t || ''; $('#edMsg').className = bad ? 'warn' : 'muted'; };
  function loadNL(nl, what) {
    if (nl.gates.length > 300) { msg(`El circuito de ${what} tiene ${nl.gates.length} compuertas: demasiado grande para dibujarlo aquí. Usa 1–3 bits o descarga el .circ.`, true); return; }
    ed.loadNetlist(nl, L2W); msg(`Cargado: ${what} (${nl.gates.length} compuertas). Cambia los interruptores y mira los LED.`); $('#edBack').hidden = true;
  }
  $('#edLoad').onclick = () => loadNL(cur.nl, `${NAME[cur.op]} de ${cur.n} bits`);
  $('#edLoadM').onclick = () => loadNL(L2M.build(cur.op, cur.n, 'min'), `${NAME[cur.op]} de ${cur.n} bits, reducido por QM`);
  $('#edRun').onclick = () => { running = ed.run(!running, +$('#edSpd').value); $('#edRun').textContent = running ? '⏸ Pausar reloj' : '▶ Reloj'; };
  $('#edSpd').onchange = () => { if (running) ed.run(true, +$('#edSpd').value); };
  $('#edTick').onclick = () => ed.tick();
  $('#edClr').onclick = () => { ed.clear(); msg('Lienzo vacío.'); $('#edTab').innerHTML = ''; };
  $('#edTT').onclick = () => {
    const t = ed.truth(); if (t.error) { msg(t.error, true); return; }
    if (!t.ins.length || !t.nl.outputs.length) { msg('Necesitas al menos un interruptor y un LED conectados.', true); return; }
    $('#edTab').innerHTML = tbl([...t.ins, ...t.nl.outputs.map(o => o.label)], t.rows.map(r => [...t.ins.map(i => r.v[i]), ...t.nl.outputs.map(o => '<b>' + r.out[o.label] + '</b>')])); msg(`Tabla de ${t.rows.length} filas del circuito dibujado.`);
  };
  $('#edRed').onclick = () => {
    const t = ed.truth(); if (t.error) { msg(t.error, true); return; }
    if (!t.ins.length || !t.nl.outputs.length) { msg('Dibuja el circuito primero (interruptores, compuertas y LED).', true); return; }
    const tt = t.nl.outputs.map(o => ({ label: o.label, ones: [], dc: [] }));
    t.rows.forEach((r, k) => t.nl.outputs.forEach((o, j) => { if (r.out[o.label]) tt[j].ones.push(k); }));
    const red = L2M.buildTT(tt, t.ins, t.ins, 'min', 'reducido');
    const before = t.nl.gates.length; savedNL = t.nl;
    ed.loadNetlist(red, L2W); $('#edBack').hidden = false;
    msg(`Reducido con Quine-McCluskey: ${before} → ${red.gates.length} compuertas (suma de productos mínima por salida; ${red.info.products} productos, ${red.info.literals} literales).` + (red.gates.length > before ? ' La suma de productos de dos niveles puede ser mayor que usar compuertas XOR/XNOR.' : ''));
  };
  $('#edBack').onclick = () => { if (savedNL) { ed.loadNetlist(savedNL, L2W); $('#edBack').hidden = true; msg('Circuito original restaurado.'); } };
  const nlOk = () => { const nl = ed.toNetlist(); if (!nl.inputs.length || !nl.outputs.length) { msg('Agrega al menos un interruptor (o reloj) y un LED antes de exportar.', true); return null; } if (nl.warns.length) msg('Aviso: ' + nl.warns.join('; ')); return nl; };
  $('#edCirc').onclick = () => { const nl = nlOk(); if (nl) dl('circuito_editor.circ', L2W.toCirc(nl)); };
  $('#edV').onclick = () => { const nl = nlOk(); if (nl) dl('circuito_editor.v', L2H.verilogStruct(nl, 'circuito')); };
  $('#edVH').onclick = () => { const nl = nlOk(); if (nl) dl('circuito_editor.vhd', L2H.vhdlStruct(nl, 'circuito')); };
  window.Lab2Ed = ed;
  window.Lab2Hook(cur.op, +$('#n').value);
  // el primer render de lab2.js ocurre antes de cargar este archivo: forzar una pasada
  $('#n').dispatchEvent(new Event('input'));
})();
