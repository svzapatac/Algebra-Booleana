/* Lab 2 · secciones: editor, original vs reducida, HDL, TTL y descargas. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const NM = { add: 'sumador', sub: 'restador', mul: 'multiplicador', div: 'divisor', cmp: 'comparador' };
  const NAME = NM;
  const dl = (n, t) => window.Lab2.download(n, t);
  let cur = { op: 'add', n: 4, nl: null }, cache = {}, hLang = 'v', hKind = 's', tIdx = 0, ttlPlan = null, tMode = 'g';
  const setPlan = () => { ttlPlan = (cur.op === 'cmp' && tMode === '85') ? L2T.cmp85(cur.n) : L2T.plan(cur.nl); $('#tMode').hidden = cur.op !== 'cmp'; };
  document.querySelectorAll('#tMode button').forEach(x => x.onclick = () => { document.querySelectorAll('#tMode button').forEach(y => y.classList.remove('on')); x.classList.add('on'); tMode = x.dataset.m; tIdx = 0; setPlan(); renderTtl(); });
  const tbl = (head, rows) => '<div class="tw"><table><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table></div>';
  const cnt = nl => { const c = { AND: 0, OR: 0, XOR: 0, NOT: 0 }; nl.gates.forEach(g => c[g.t] = (c[g.t] || 0) + 1); return c; };
  const base = () => NM[cur.op] + cur.n;

  /* ---------- hook desde lab2.js ---------- */
  window.Lab2Hook = function (op, n) {
    const same = cur.op === op && cur.n === n && cur.nl;
    cur.op = op; cur.n = n;
    if (!same) { cur.nl = L2.BUILD[op](n); cur.min = cur.orig = null; cache = {}; tIdx = 0; setPlan(); renderCmp(); renderTtl(); renderHdl(); }
    $('#dlO').disabled = n > 3;
  };
  $('#dlW').onclick = () => dl(`${base()}_cables.circ`, L2W.toCirc(cur.nl));
  $('#dlB').onclick = () => dl(`${base()}_bloques.circ`, L2.toCircBlocks(cur.op, cur.n));
  $('#dlO').onclick = () => dl(`${base()}_original.circ`, L2W.toCirc(L2M.build(cur.op, cur.n, 'orig')));

  /* ---------- original vs reducida ---------- */
  function renderCmp() {
    const n = cur.n, op = cur.op, rows = [];
    const stat = (nl) => { const c = cnt(nl); return [nl.gates.length, c.AND, c.OR, c.XOR || 0, c.NOT]; };
    rows.push(['Estructural (por etapas)', ...stat(cur.nl), '—', '—']);
    const box = $('#cmp'); box.innerHTML = '<p class="muted">Calculando…</p>';
    setTimeout(() => {
      if (n <= 4) { const o = L2M.build(op, n, 'orig'); rows.push(['Original (minitérminos)', ...stat(o), o.info.products, o.info.literals]); }
      else rows.push(['Original (minitérminos)', '—', '—', '—', '—', '—', 'muy grande', '—']);
      box.innerHTML = tbl(['Versión', 'Compuertas', 'AND', 'OR', 'XOR', 'NOT', 'Productos', 'Literales'], rows);
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
  }
  $('#hCopy').onclick = () => { const t = cache.h.code; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { $('#hCopy').textContent = 'Copiado'; setTimeout(() => $('#hCopy').textContent = 'Copiar', 1200); }).catch(() => { const r = document.createRange(); r.selectNodeContents($('#hCode')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); };
  $('#hDl').onclick = () => dl(cache.h.name + '.' + cache.h.ext, cache.h.code);
  $('#hTb').onclick = () => dl(cache.h.name + '_tb.' + cache.h.ext, cache.h.tb);

  /* ---------- TTL ---------- */
  function renderTtl() {
    const p = ttlPlan, n = cur.n;
    const parts = Object.entries(p.counts).map(([k, v]) => `${v} × ${k}`).join(' · ');
    $('#ttlSum').innerHTML = `<p class="tx"><b>${p.total}</b> chips: ${parts}. Alimentación: +5 V en el pin VCC y GND en el pin GND de cada chip. Entradas con interruptores DIP; salidas con LED y resistencia de 330 Ω a GND.` +
      (p.spare ? ` Compuertas libres: ${p.spare}; sus entradas van a GND.` : '') + (n > 5 && cur.op !== 'cmp' ? ` Con ${n} bits el montaje es grande; en clase se arman 4 o 5 bits.` : '') + '</p>';
    const sel = $('#tSel'); sel.innerHTML = p.chips.map((c, i) => `<option value="${i}">${i + 1}. ${c.id} · ${c.spec.chip}</option>`).join('');
    drawCards();
    $('#ttlNets').innerHTML = tbl(['red', 'sale de', 'llega a'], p.nets.map(x => [x.net, x.from, x.to.join(', ')]));
  }
  function card(ch, i) {
    const lines = ch.lines ? ch.lines.map(t => `<li>${t}</li>`).join('') : ch.slots.map(s => `<li><b>Compuerta ${s.n}</b>: <code>${s.expr}</code> — entradas: pin ${s.ins.map(x => x.pin).join(' y pin ')}, salida: pin ${s.outPin}${s.dest.length ? ' → ' + s.dest.join(', ') : ''}</li>`).join('');
    return `<figure class="ttlcard"><figcaption><span class="num">${i + 1} / ${ttlPlan.total}</span><b>${ch.title}</b><small>${ch.sub} · ${ch.used}/${ch.cap} compuertas en uso</small></figcaption>${L2T.svg(ch)}<ul class="ttlist">${lines}${ch.cap > ch.used ? `<li>${ch.cap - ch.used} compuerta(s) libre(s): entradas a GND.</li>` : ''}${ch.lines ? '' : '<li>Pin 14 = +5 V · Pin 7 = GND</li>'}</ul></figure>`;
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
  const msg = (t) => { $('#edMsg').textContent = t || ''; $('#edMsg').hidden = !t; };
  function loadNL(nl, what) {
    if (nl.gates.length > 300) { msg(`${what}: ${nl.gates.length} compuertas, demasiado grande para el editor (máx. 300)`, true); return; }
    ed.loadNetlist(nl, L2W); msg(`${what}: ${nl.gates.length} compuertas`);
  }
  $('#edLoad').onclick = () => loadNL(cur.nl, `${NAME[cur.op]} de ${cur.n} bits`);
  $('#edRun').onclick = () => { running = ed.run(!running, +$('#edSpd').value); $('#edRun').textContent = running ? 'Pausar' : 'Reloj'; };
  $('#edSpd').onchange = () => { if (running) ed.run(true, +$('#edSpd').value); };
  $('#edTick').onclick = () => ed.tick();
  $('#edClr').onclick = () => { ed.clear(); msg(''); $('#edTab').innerHTML = ''; };
  $('#edTT').onclick = () => {
    const t = ed.truth(); if (t.error) { msg(t.error, true); return; }
    if (!t.ins.length || !t.nl.outputs.length) { msg('Falta al menos un interruptor y un LED conectados', true); return; }
    $('#edTab').innerHTML = tbl([...t.ins, ...t.nl.outputs.map(o => o.label)], t.rows.map(r => [...t.ins.map(i => r.v[i]), ...t.nl.outputs.map(o => '<b>' + r.out[o.label] + '</b>')])); msg(`${t.rows.length} filas`);
  };
  const nlOk = () => { const nl = ed.toNetlist(); if (!nl.inputs.length || !nl.outputs.length) { msg('Falta al menos un interruptor (o reloj) y un LED', true); return null; } if (nl.warns.length) msg(nl.warns.join('; ')); return nl; };
  $('#edCirc').onclick = () => { const nl = nlOk(); if (nl) dl('circuito_editor.circ', L2W.toCirc(nl)); };
  $('#edV').onclick = () => { const nl = nlOk(); if (nl) dl('circuito_editor.v', L2H.verilogStruct(nl, 'circuito')); };
  $('#edVH').onclick = () => { const nl = nlOk(); if (nl) dl('circuito_editor.vhd', L2H.vhdlStruct(nl, 'circuito')); };
  window.Lab2Ed = ed;
  window.Lab2Hook(cur.op, +$('#n').value);
  // el primer render de lab2.js ocurre antes de cargar este archivo: forzar una pasada
  $('#n').dispatchEvent(new Event('input'));
})();
