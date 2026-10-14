/* Laboratorio de compuertas: simulador interactivo (arrastrar, cablear, conmutar, verificar) */
(function (root) {
  'use strict';
  const L = root.Logic;
  const NS = 'http://www.w3.org/2000/svg';
  const W = 56, GAP = 56, X0 = 70, DX = 140;
  const HI = '#C4B5FD', LO = '#4B4660', UNK = '#8B5CF6';
  const NAMES = { and: 'AND', or: 'OR', not: 'NOT', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR' };
  const BUB = { not: 1, nand: 1, nor: 1, xnor: 1 };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ───── modelo ───── */
  function newState() { return { comps: {}, wires: [], seq: 1, sel: null, selW: null, view: { x: 20, y: 20, k: 1 } }; }
  function add(S, c) { const id = 'c' + (S.seq++); S.comps[id] = { id, nIn: 0, val: 0, x: 0, y: 0, ...c }; return id; }
  function wire(S, from, to, pin) {
    S.wires = S.wires.filter(w => !(w.to === to && w.pin === pin));
    S.wires.push({ id: 'w' + (S.seq++), from, to, pin });
  }
  function dims(c) {
    if (c.type === 'in') return { w: 34, h: 24 };
    if (c.type === 'out' || c.type === 'const') return { w: 28, h: 28 };
    if (c.type === 'not') return { w: 26, h: 24 };
    return { w: W, h: Math.max(40, 14 * (c.nIn + 1)) };
  }
  function inPin(c, i) {
    const d = dims(c), k = Math.max(1, c.nIn);
    const y = c.type === 'not' || c.type === 'out' ? c.y : c.y - d.h / 2 + d.h * (i + 1) / (k + 1);
    let x = c.x;
    if (c.type === 'or' || c.type === 'nor' || c.type === 'xor' || c.type === 'xnor') {
      const dd = (y - c.y) / (d.h / 2); x += W * 0.15 * (1 - dd * dd);
      if (c.type === 'xor' || c.type === 'xnor') x -= 6;
    }
    return { x, y };
  }
  function outPin(c) {
    const d = dims(c);
    if (c.type === 'in') return { x: c.x + d.w, y: c.y };
    if (c.type === 'const') return { x: c.x + d.w, y: c.y };
    return { x: c.x + d.w + (BUB[c.type] ? 9 : 0), y: c.y };
  }

  function build(ast, vars, values) {
    const S = newState(), memo = {}, inp = {}, lvl = {};
    vars.forEach((v, i) => { inp[v] = add(S, { type: 'in', label: v, val: values && values[v] ? 1 : 0, x: 20, y: 40 + i * GAP }); lvl[inp[v]] = 0; });
    function go(n) {
      if (n.t === 'var') return inp[n.n];
      const key = L.key(n);
      if (memo[key]) return memo[key];
      let id;
      if (n.t === 'const') { id = add(S, { type: 'const', val: n.v }); lvl[id] = 0; }
      else {
        const ks = (n.t === 'not' ? [n.a] : n.args).map(go);
        id = add(S, { type: n.t, nIn: ks.length });
        lvl[id] = 1 + Math.max(...ks.map(k => lvl[k]));
        ks.forEach((k, i) => wire(S, k, id, i));
      }
      return memo[key] = id;
    }
    const top = go(ast);
    const out = add(S, { type: 'out', nIn: 1, label: 'F' });
    lvl[out] = lvl[top] + 1;
    wire(S, top, out, 0);
    // posiciones: x por nivel, y = promedio de entradas y sin solaparse
    const byLv = {};
    Object.values(S.comps).forEach(c => (byLv[lvl[c.id]] = byLv[lvl[c.id]] || []).push(c));
    Object.keys(byLv).map(Number).sort((a, b) => a - b).forEach(l => {
      const cs = byLv[l];
      cs.forEach(c => {
        c.x = l === 0 ? (c.type === 'const' ? 20 : 20) : X0 + l * DX - 60;
        if (l > 0) { const ws = S.wires.filter(w => w.to === c.id); c.y = ws.reduce((s, w) => s + S.comps[w.from].y, 0) / Math.max(1, ws.length); }
      });
      if (l > 0) {
        cs.sort((a, b) => a.y - b.y);
        for (let i = 1; i < cs.length; i++) { const need = (dims(cs[i - 1]).h + dims(cs[i]).h) / 2 + 14; if (cs[i].y - cs[i - 1].y < need) cs[i].y = cs[i - 1].y + need; }
      } else {
        cs.filter(c => c.type === 'const').forEach((c, i) => { c.y = 40 + (vars.length + i) * GAP; });
      }
    });
    return S;
  }

  /* ───── simulación ───── */
  function gate(t, ins) {
    const anyX = ins.some(v => v === 'X');
    const and = () => ins.some(v => v === 0) ? 0 : anyX ? 'X' : 1;
    const or = () => ins.some(v => v === 1) ? 1 : anyX ? 'X' : 0;
    const inv = v => v === 'X' ? 'X' : 1 - v;
    if (t === 'and') return and();
    if (t === 'or') return or();
    if (t === 'nand') return inv(and());
    if (t === 'nor') return inv(or());
    if (t === 'not') return inv(ins[0]);
    if (t === 'out') return ins[0];
    const x = anyX ? 'X' : ins.reduce((s, v) => s ^ v, 0);
    return t === 'xor' ? x : inv(x);
  }
  function evalAll(S, byLabel) {
    const pins = {}; S.wires.forEach(w => { pins[w.to + ':' + w.pin] = w.from; });
    const memo = {}, stack = {};
    function out(id) {
      if (id in memo) return memo[id];
      if (stack[id]) return 'X';
      stack[id] = 1;
      const c = S.comps[id]; let v;
      if (c.type === 'in') v = byLabel && c.label in byLabel ? byLabel[c.label] : c.val;
      else if (c.type === 'const') v = c.val;
      else { const ins = []; for (let i = 0; i < c.nIn; i++) { const f = pins[id + ':' + i]; ins.push(f ? out(f) : 'X'); } v = gate(c.type, ins); }
      stack[id] = 0; return memo[id] = v;
    }
    Object.keys(S.comps).forEach(out);
    return memo;
  }
  function verify(S, r) {
    const outs = Object.values(S.comps).filter(c => c.type === 'out');
    if (!outs.length) return { state: 'none', msg: 'Falta la salida F (LED)' };
    const o = outs[0], bad = [];
    r.table.rows.forEach(row => {
      const env = {}; r.vars.forEach((v, i) => { env[v] = row.bits[i]; });
      const got = evalAll(S, env)[o.id];
      if (got !== r.fv[row.i]) bad.push({ row, got, exp: r.fv[row.i], env });
    });
    return bad.length ? { state: 'bad', bad, total: r.table.rows.length } : { state: 'ok', total: r.table.rows.length };
  }

  /* ───── dibujo ───── */
  function shape(type, k, h, fill, stroke, sw) {
    const st = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
    const t = type;
    if (t === 'not') return `<path d="M0,-12 L26,0 L0,12 Z" ${st}/><circle cx="30.5" cy="0" r="4.5" ${st}/>`;
    const and = t === 'and' || t === 'nand';
    let s = and
      ? `<path d="M0,${-h / 2} H${W / 2} A${W / 2} ${h / 2} 0 0 1 ${W / 2},${h / 2} H0 Z" ${st}/>`
      : `<path d="M0,${-h / 2} Q${W * .55},${-h / 2} ${W},0 Q${W * .55},${h / 2} 0,${h / 2} Q${W * .3},0 0,${-h / 2} Z" ${st}/>`;
    if (t === 'xor' || t === 'xnor') s += `<path d="M-6,${-h / 2} Q${W * .3 - 6},0 -6,${h / 2}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
    if (BUB[t]) s += `<circle cx="${W + 4.5}" cy="0" r="4.5" ${st}/>`;
    return s;
  }
  function glyph(type) {
    const h = type === 'not' ? 24 : 40;
    const body = shape(type, 2, h, '#12101C', '#A78BFA', 1.6);
    return `<svg viewBox="-10 -24 84 48" width="48" height="28">${body}</svg>`;
  }
  const col = v => v === 1 ? HI : v === 0 ? LO : UNK;

  function render(M) {
    const S = M.S, val = evalAll(S);
    M.val = val;
    let w = '';
    S.wires.forEach(wi => {
      const a = S.comps[wi.from], b = S.comps[wi.to]; if (!a || !b) return;
      const p = outPin(a), q = inPin(b, wi.pin), dx = Math.max(30, Math.abs(q.x - p.x) / 2);
      const v = val[wi.from], sel = S.selW === wi.id;
      w += `<path d="M${p.x},${p.y} C${p.x + dx},${p.y} ${q.x - dx},${q.y} ${q.x},${q.y}" fill="none" stroke="${sel ? '#fff' : col(v)}" stroke-width="${v === 1 ? 2.6 : 2}" ${v === 'X' ? 'stroke-dasharray="5 4"' : ''} />`;
      w += `<path data-wire="${wi.id}" d="M${p.x},${p.y} C${p.x + dx},${p.y} ${q.x - dx},${q.y} ${q.x},${q.y}" fill="none" stroke="transparent" stroke-width="12" style="cursor:pointer"/>`;
    });
    if (M.pend) {
      const a = S.comps[M.pend.from], p = outPin(a), q = M.pend.at, dx = Math.max(30, Math.abs(q.x - p.x) / 2);
      w += `<path d="M${p.x},${p.y} C${p.x + dx},${p.y} ${q.x - dx},${q.y} ${q.x},${q.y}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 4"/>`;
    }
    let cs = '', pl = '';
    Object.values(S.comps).forEach(c => {
      const v = val[c.id], sel = S.sel === c.id, d = dims(c);
      let g = `<g data-comp="${c.id}" transform="translate(${c.x},${c.y})" style="cursor:grab">`;
      if (c.type === 'in') {
        g += `<text x="-10" y="5" text-anchor="end" fill="#EDEAF7" font-size="14" font-family="Geist Mono,monospace" font-weight="600">${esc(c.label)}</text>
          <rect x="0" y="-12" width="34" height="24" rx="7" fill="${c.val ? '#7C3AED' : '#14111F'}" stroke="${sel ? '#fff' : c.val ? '#C4B5FD' : '#3A3158'}" stroke-width="1.6"/>
          <text x="17" y="5" text-anchor="middle" fill="${c.val ? '#fff' : '#8B86A3'}" font-size="13" font-family="Geist Mono,monospace" font-weight="700">${c.val}</text>`;
      } else if (c.type === 'const') {
        g += `<rect x="0" y="-14" width="28" height="28" rx="7" fill="#0E0C16" stroke="${sel ? '#fff' : '#3A3158'}" stroke-width="1.4" stroke-dasharray="3 3"/><text x="14" y="5" text-anchor="middle" fill="${col(c.val)}" font-size="13" font-family="Geist Mono,monospace">${c.val}</text>`;
      } else if (c.type === 'out') {
        const on = v === 1;
        g += `<circle cx="14" cy="0" r="14" fill="${on ? '#C4B5FD' : '#14111F'}" stroke="${sel ? '#fff' : on ? '#EDE9FE' : '#3A3158'}" stroke-width="1.8" ${on ? 'style="filter:drop-shadow(0 0 10px #A78BFA)"' : ''}/>
          <text x="14" y="5" text-anchor="middle" fill="${on ? '#1B1233' : '#8B86A3'}" font-size="13" font-family="Geist Mono,monospace" font-weight="700">${v}</text>
          <text x="36" y="5" fill="#DDD6FE" font-size="14" font-family="Geist Mono,monospace" font-weight="600">${esc(c.label || 'F')}</text>`;
      } else {
        g += shape(c.type, c.nIn, d.h, v === 1 ? '#1B1233' : '#12101C', sel ? '#fff' : v === 1 ? '#C4B5FD' : '#8B5CF6', sel ? 2.2 : 1.6);
        g += `<text x="${c.type === 'not' ? 12 : W / 2}" y="${d.h / 2 + 12}" text-anchor="middle" fill="#6E6988" font-size="9" font-family="Geist Mono,monospace">${NAMES[c.type]}</text>`;
      }
      // pines (capa superior, en coordenadas del mundo)
      if (c.type !== 'in' && c.type !== 'const') {
        for (let i = 0; i < c.nIn; i++) {
          const p = inPin(c, i);
          pl += `<circle data-pin="in:${c.id}:${i}" cx="${p.x}" cy="${p.y}" r="7" fill="${M.pend ? '#7C3AED55' : 'transparent'}" stroke="${M.pend ? '#C4B5FD' : 'none'}" style="cursor:crosshair"/>`;
          pl += `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="${col(pinVal(S, val, c.id, i))}" pointer-events="none"/>`;
        }
      }
      if (c.type !== 'out') {
        const p = outPin(c);
        pl += `<circle data-pin="out:${c.id}" cx="${p.x}" cy="${p.y}" r="7" fill="transparent" style="cursor:crosshair"/><circle cx="${p.x}" cy="${p.y}" r="3" fill="${col(v)}" pointer-events="none"/>`;
      }
      cs += g + '</g>';
    });
    M.g.setAttribute('transform', `translate(${S.view.x},${S.view.y}) scale(${S.view.k})`);
    M.g.innerHTML = w + cs + pl;
    M.side();
    M.zoomLbl.textContent = Math.round(S.view.k * 100) + '%';
  }
  function pinVal(S, val, id, i) { const w = S.wires.find(x => x.to === id && x.pin === i); return w ? val[w.from] : 'X'; }

  /* ───── montaje ───── */
  const cache = { r: null, S: null };
  function mount(host, r, values) {
    const keep = cache.r === r && cache.S;
    const S = keep ? cache.S : (cache.r = r, cache.S = build(r.ast, r.vars, values));
    const M = { S, pend: null, drag: null, val: {} };
    const palette = ['in', 'out', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor'];
    host.innerHTML = `<div class="lab" tabindex="0">
      <div class="lab-pal">
        <p class="sub">Cargar circuito</p>
        <div class="lab-load"><button type="button" data-ld="orig">Original</button><button type="button" data-ld="sop">SOP mínima</button><button type="button" data-ld="pos">POS mínima</button><button type="button" data-ld="clear">Vaciar</button></div>
        <p class="sub">Componentes</p>
        <div class="lab-comps">${palette.map(t => `<button type="button" data-add="${t}">${t === 'in' ? '<span class="g-in">0/1</span>' : t === 'out' ? '<span class="g-out"></span>' : glyph(t)}<small>${t === 'in' ? 'Entrada' : t === 'out' ? 'Salida' : NAMES[t]}</small></button>`).join('')}</div>
      </div>
      <div class="lab-canvas"><svg xmlns="${NS}" class="lab-svg"><defs><pattern id="labgrid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#1E1A2E"/></pattern></defs><rect width="100%" height="100%" fill="url(#labgrid)" data-bg="1"/><g class="lab-g"></g></svg>
        <div class="lab-zoom"><button type="button" data-z="-">−</button><span>100%</span><button type="button" data-z="+">+</button><button type="button" data-z="fit" title="Ajustar">⤢</button></div>
        <div class="lab-hint">Clic en una entrada para cambiar 0/1 · arrastra para mover · clic en un punto de salida y luego en una entrada para cablear · Supr borra</div>
      </div>
      <aside class="lab-side"></aside></div>`;
    const lab = host.querySelector('.lab'), svg = host.querySelector('.lab-svg'), side = host.querySelector('.lab-side');
    M.g = host.querySelector('.lab-g'); M.zoomLbl = host.querySelector('.lab-zoom span');
    const gather = () => ({
      comps: Object.values(S.comps).length, wires: S.wires.length,
      gates: Object.values(S.comps).filter(c => NAMES[c.type]).length
    });
    M.side = () => {
      const c = S.sel && S.comps[S.sel], vr = verify(S, r), st = gather();
      let ins = '';
      if (c) {
        const v = M.val[c.id];
        const rows = [];
        for (let i = 0; i < c.nIn; i++) rows.push(`<div class="ir"><span>Entrada ${i + 1}</span><b class="v${pinVal(S, M.val, c.id, i)}">${pinVal(S, M.val, c.id, i)}</b></div>`);
        ins = `<div class="ins"><h4>${c.type === 'in' ? 'Entrada ' + esc(c.label) : c.type === 'out' ? 'Salida ' + esc(c.label || 'F') : NAMES[c.type] || c.type}</h4>${rows.join('')}<div class="ir"><span>${c.type === 'out' ? 'Valor' : 'Salida'}</span><b class="v${v}">${v}</b></div>
          ${NAMES[c.type] && c.type !== 'not' ? `<div class="ir"><span>Nº de entradas</span><span><button type="button" data-pins="-1">−</button> ${c.nIn} <button type="button" data-pins="1">+</button></span></div>` : ''}
          <button type="button" class="bt" data-del="1">Eliminar</button></div>`;
      } else if (S.selW) ins = `<div class="ins"><h4>Cable</h4><button type="button" class="bt" data-del="1">Eliminar cable</button></div>`;
      else ins = `<div class="ins"><h4>Inspector</h4><p class="note">Selecciona un componente o cable para ver su estado.</p></div>`;
      const vtxt = vr.state === 'ok' ? `<div class="vb ok">✓ Tu circuito da F en las ${vr.total} filas</div>`
        : vr.state === 'none' ? `<div class="vb">${vr.msg}</div>`
        : `<div class="vb bad">✗ ${vr.bad.length} de ${vr.total} filas no coinciden</div><div class="vl">${vr.bad.slice(0, 4).map(b => `<div>${r.vars.map(x => x + '=' + b.env[x]).join(' ')} → obtuvo ${b.got}, debía ${b.exp}</div>`).join('')}</div>`;
      side.innerHTML = `${ins}<div class="ins"><h4>Comprobación contra ${esc(r.label)}</h4>${vtxt}</div>
        <div class="ins"><h4>Circuito</h4><div class="ir"><span>Compuertas</span><b>${st.gates}</b></div><div class="ir"><span>Cables</span><b>${st.wires}</b></div></div>
        <div class="ins"><h4>Señales</h4><div class="key"><i style="background:${HI}"></i> 1 alto<i style="background:${LO}"></i> 0 bajo<i style="background:${UNK}"></i> X sin conectar</div></div>`;
    };
    const redraw = () => render(M);
    const toWorld = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(M.g.getScreenCTM().inverse()); return { x: q.x, y: q.y }; };
    const center = () => { const b = svg.getBoundingClientRect(); return { x: (b.width / 2 - S.view.x) / S.view.k, y: (b.height / 2 - S.view.y) / S.view.k }; };
    const fit = () => {
      const cs = Object.values(S.comps); if (!cs.length) return;
      const b = svg.getBoundingClientRect();
      const x0 = Math.min(...cs.map(c => c.x)) - 30, x1 = Math.max(...cs.map(c => c.x + 120)) + 40;
      const y0 = Math.min(...cs.map(c => c.y - 30)) - 10, y1 = Math.max(...cs.map(c => c.y + 40)) + 10;
      const k = Math.min(1.2, Math.max(.2, Math.min(b.width / (x1 - x0), b.height / (y1 - y0))));
      S.view = { k, x: -x0 * k + (b.width - (x1 - x0) * k) / 2, y: -y0 * k + (b.height - (y1 - y0) * k) / 2 };
    };
    const del = () => {
      if (S.sel) { delete S.comps[S.sel]; S.wires = S.wires.filter(w => w.from !== S.sel && w.to !== S.sel); S.sel = null; }
      else if (S.selW) { S.wires = S.wires.filter(w => w.id !== S.selW); S.selW = null; }
      redraw();
    };

    svg.addEventListener('pointerdown', e => {
      lab.focus({ preventScroll: true });
      const pin = e.target.closest('[data-pin]'), cm = e.target.closest('[data-comp]'), wi = e.target.closest('[data-wire]');
      svg.setPointerCapture(e.pointerId);
      const p = toWorld(e);
      if (pin) {
        const [kind, id, i] = pin.dataset.pin.split(':');
        if (kind === 'out') { M.pend = { from: id, at: p }; redraw(); return; }
        if (kind === 'in' && M.pend) { if (M.pend.from !== id) wire(S, M.pend.from, id, +i); M.pend = null; redraw(); return; }
      }
      if (M.pend) { M.pend = null; redraw(); return; }
      if (cm) { S.sel = cm.dataset.comp; S.selW = null; const c = S.comps[S.sel]; M.drag = { id: S.sel, dx: p.x - c.x, dy: p.y - c.y, sx: e.clientX, sy: e.clientY, moved: false }; redraw(); return; }
      if (wi) { S.selW = wi.dataset.wire; S.sel = null; redraw(); return; }
      S.sel = null; S.selW = null;
      M.pan = { sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; redraw();
    });
    svg.addEventListener('pointermove', e => {
      if (M.drag) {
        const c = S.comps[M.drag.id], p = toWorld(e);
        if (Math.abs(e.clientX - M.drag.sx) + Math.abs(e.clientY - M.drag.sy) > 4) M.drag.moved = true;
        if (M.drag.moved) { c.x = Math.round((p.x - M.drag.dx) / 4) * 4; c.y = Math.round((p.y - M.drag.dy) / 4) * 4; redraw(); }
      } else if (M.pan) {
        S.view.x = M.pan.vx + e.clientX - M.pan.sx; S.view.y = M.pan.vy + e.clientY - M.pan.sy; redraw();
      } else if (M.pend) { M.pend.at = toWorld(e); redraw(); }
    });
    const up = () => {
      if (M.drag) { const c = S.comps[M.drag.id]; if (!M.drag.moved && c && c.type === 'in') { c.val = 1 - c.val; } }
      M.drag = null; M.pan = null; redraw();
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 1 / 1.1, b = svg.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
      const k = Math.max(.2, Math.min(2.5, S.view.k * f));
      S.view.x = mx - (mx - S.view.x) * k / S.view.k; S.view.y = my - (my - S.view.y) * k / S.view.k; S.view.k = k; redraw();
    }, { passive: false });
    lab.addEventListener('keydown', e => {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
      else if (e.key === 'Escape') { M.pend = null; S.sel = null; S.selW = null; redraw(); }
    });
    lab.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.ld) {
        const ast = { orig: r.ast, sop: r.min.sopAst, pos: r.min.posAst }[t.dataset.ld];
        const vals = {}; Object.values(S.comps).forEach(c => { if (c.type === 'in') vals[c.label] = c.val; });
        const N = t.dataset.ld === 'clear' ? newState() : build(ast, r.vars, vals);
        Object.keys(S).forEach(k => { S[k] = N[k]; });
        if (t.dataset.ld !== 'clear') fit(); redraw();
      } else if (t.dataset.add) {
        const ty = t.dataset.add, p = center(), n = Object.keys(S.comps).length;
        const o = { type: ty, x: Math.round(p.x / 4) * 4 - 60 + (n % 4) * 70, y: Math.round(p.y / 4) * 4 - 60 + Math.floor(n / 4) % 4 * 60 };
        if (ty === 'in') { const used = new Set(Object.values(S.comps).filter(c => c.type === 'in').map(c => c.label)); o.label = r.vars.find(v => !used.has(v)) || r.vars[0]; o.val = 0; }
        else if (ty === 'out') { o.nIn = 1; o.label = 'F'; }
        else o.nIn = ty === 'not' ? 1 : 2;
        S.sel = add(S, o); S.selW = null; redraw();
      } else if (t.dataset.z) {
        if (t.dataset.z === 'fit') fit();
        else { const b = svg.getBoundingClientRect(), f = t.dataset.z === '+' ? 1.2 : 1 / 1.2, k = Math.max(.2, Math.min(2.5, S.view.k * f)), mx = b.width / 2, my = b.height / 2;
          S.view.x = mx - (mx - S.view.x) * k / S.view.k; S.view.y = my - (my - S.view.y) * k / S.view.k; S.view.k = k; }
        redraw();
      } else if (t.dataset.del) del();
      else if (t.dataset.pins) {
        const c = S.comps[S.sel]; if (!c) return;
        c.nIn = Math.max(2, Math.min(6, c.nIn + +t.dataset.pins));
        S.wires = S.wires.filter(w => !(w.to === c.id && w.pin >= c.nIn)); redraw();
      }
    });
    requestAnimationFrame(() => { if (!keep) fit(); redraw(); });
  }

  root.Lab = { mount, _eval: evalAll, _build: build, _verify: verify };
})(typeof self !== 'undefined' ? self : this);
