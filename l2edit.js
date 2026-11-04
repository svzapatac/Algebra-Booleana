/* Lab 2 · editor de circuitos dentro de la página (estilo Logisim): paleta, cables, interruptores, LEDs, reloj y simulación en vivo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L2E = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const G2 = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];
  const TOOLS = [['hand', '🖐 Mano'], ['SW', 'Interruptor'], ['CLK', 'Reloj'], ['LED', 'LED'], ['AND', 'AND'], ['OR', 'OR'], ['NOT', 'NOT'], ['XOR', 'XOR'], ['NAND', 'NAND'], ['NOR', 'NOR'], ['XNOR', 'XNOR'], ['DFF', 'Flip-flop D'], ['VCC', '1'], ['GND', '0'], ['del', '🗑 Borrar']];
  /* pines: [id, dx, dy, dir]  dir 'o' salida, 'i' entrada */
  const PINS = {
    SW: [['out', 44, 12, 'o']], CLK: [['out', 44, 12, 'o']], VCC: [['out', 30, 10, 'o']], GND: [['out', 30, 10, 'o']],
    LED: [['in0', 0, 12, 'i']], NOT: [['in0', 0, 20, 'i'], ['out', 56, 20, 'o']],
    DFF: [['clk', 0, 20, 'i'], ['d', 0, 50, 'i'], ['q', 70, 20, 'o']]
  };
  G2.forEach(t => { PINS[t] = [['in0', 0, 10, 'i'], ['in1', 0, 30, 'i'], ['out', 60, 20, 'o']]; });
  const SIZE = { SW: [44, 24], CLK: [44, 24], VCC: [30, 20], GND: [30, 20], LED: [30, 24], NOT: [56, 40], DFF: [70, 70] };
  G2.forEach(t => { SIZE[t] = [60, 40]; });

  function init(host, onChange) {
    const st = { comps: [], wires: [], tool: 'hand', sel: null, nextId: 1, sim: {}, drag: null, wiring: null, timer: null, status: '', saved: null, mouse: { x: 0, y: 0 } };
    host.innerHTML = '';
    host.classList.add('ed');
    const bar = document.createElement('div'); bar.className = 'ed-bar';
    TOOLS.forEach(([k, n]) => { const b = document.createElement('button'); b.textContent = n; b.dataset.tool = k; b.onclick = () => { st.tool = k; paintBar(); }; bar.appendChild(b); });
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'ed-svg'); svg.setAttribute('viewBox', '0 0 1200 560'); svg.setAttribute('tabindex', '0');
    const info = document.createElement('div'); info.className = 'ed-info';
    const props = document.createElement('div'); props.className = 'ed-props';
    host.append(bar, svg, props, info);
    const paintBar = () => bar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tool === st.tool));
    paintBar();

    const byId = id => st.comps.find(c => c.id === id);
    const pinPos = (c, p) => { const d = PINS[c.type].find(q => q[0] === p); return [c.x + d[1], c.y + d[2]]; };
    const snap = v => Math.round(v / 10) * 10;
    const autoLabel = (type) => {
      const used = new Set(st.comps.map(c => c.label));
      const pool = type === 'SW' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') : type === 'CLK' ? ['CLK', 'CLK2', 'CLK3'] : [...Array(40).keys()].map(i => 'Y' + (i + 1));
      return pool.find(l => !used.has(l)) || type + st.nextId;
    };
    function add(type, x, y, label) {
      const c = { id: st.nextId++, type, x: snap(x), y: snap(y), label: label || ((type === 'SW' || type === 'CLK' || type === 'LED') ? autoLabel(type) : ''), v: 0 };
      st.comps.push(c); return c;
    }

    /* ---------- red y simulación ---------- */
    function nets() {
      const par = {}; const key = (c, p) => c + ':' + p;
      const f = k => { if (par[k] === undefined) par[k] = k; return par[k] === k ? k : (par[k] = f(par[k])); };
      st.comps.forEach(c => PINS[c.type].forEach(p => f(key(c.id, p[0]))));
      st.wires.forEach(w => { par[f(key(w.a.c, w.a.p))] = f(key(w.b.c, w.b.p)); });
      return { f, key };
    }
    function settle(forceVal) {
      const { f, key } = nets();
      const val = {}; const drivers = {};
      st.comps.forEach(c => { if (PINS[c.type].some(p => p[3] === 'o')) { const r = f(key(c.id, PINS[c.type].find(p => p[3] === 'o')[0])); (drivers[r] = drivers[r] || []).push(c); } });
      const rd = (c, p) => val[f(key(c.id, p))] || 0;
      const setSrc = c => {
        const r = f(key(c.id, PINS[c.type].find(p => p[3] === 'o')[0]));
        if (c.type === 'SW' || c.type === 'CLK') val[r] = c.v ? 1 : 0; else if (c.type === 'VCC') val[r] = 1; else if (c.type === 'GND') val[r] = 0; else if (c.type === 'DFF') val[r] = st.sim['q' + c.id] || 0;
      };
      st.comps.forEach(c => { if (['SW', 'CLK', 'VCC', 'GND', 'DFF'].includes(c.type)) setSrc(c); });
      for (let it = 0; it < 80; it++) {
        let ch = false;
        for (const c of st.comps) {
          if (!['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR', 'NOT'].includes(c.type)) continue;
          const a = rd(c, 'in0'), b = c.type === 'NOT' ? 0 : rd(c, 'in1');
          const o = { AND: a & b, OR: a | b, XOR: a ^ b, NAND: 1 - (a & b), NOR: 1 - (a | b), XNOR: 1 - (a ^ b), NOT: 1 - a }[c.type];
          const r = f(key(c.id, 'out'));
          if (val[r] !== o) { val[r] = o; ch = true; }
        }
        if (!ch) break;
      }
      st.val = val; st.f = f; st.key = key; st.rd = rd;
      st.conflict = Object.values(drivers).some(l => l.length > 1);
    }
    function setValue(c, v) {                       // cambiar interruptor/reloj y propagar flancos
      const before = {}; st.comps.forEach(d => { if (d.type === 'DFF') before[d.id] = st.rd(d, 'clk'); });
      settle();
      const pre = {}; st.comps.forEach(d => { if (d.type === 'DFF') pre[d.id] = { clk: st.rd(d, 'clk'), d: st.rd(d, 'd') }; });
      c.v = v; settle();
      let changed = false;
      st.comps.forEach(d => { if (d.type === 'DFF') { const now = st.rd(d, 'clk'); if (pre[d.id].clk === 0 && now === 1) { st.sim['q' + d.id] = pre[d.id].d; changed = true; } } });
      if (changed) settle();
    }

    /* ---------- dibujo ---------- */
    const el = (n, a, kids) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (kids || []).forEach(x => e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x)); return e; };
    function symbol(c) {
      const [w, h] = SIZE[c.type]; const g = el('g', {});
      const on = st.val && st.val[st.f(st.key(c.id, PINS[c.type].find(p => p[3] === 'o') ? PINS[c.type].find(p => p[3] === 'o')[0] : 'in0'))];
      const stroke = { stroke: '#0a3d91', 'stroke-width': 2, fill: '#fff' };
      const T = c.type;
      if (T === 'SW') { g.append(el('rect', Object.assign({ x: 0, y: 0, width: 44, height: 24, rx: 4 }, stroke, { fill: c.v ? '#1d6fe8' : '#fff' })), el('text', { x: 22, y: 17, 'text-anchor': 'middle', fill: c.v ? '#fff' : '#0a3d91', 'font-weight': 700, 'font-size': 14 }, [c.label + '=' + c.v])); }
      else if (T === 'CLK') { g.append(el('rect', Object.assign({ x: 0, y: 0, width: 44, height: 24, rx: 4 }, stroke, { fill: c.v ? '#1d6fe8' : '#fff' })), el('path', { d: 'M6 18 h8 v-12 h8 v12 h8 v-12 h6', fill: 'none', stroke: c.v ? '#fff' : '#0a3d91', 'stroke-width': 2 }), el('text', { x: 22, y: 36, 'text-anchor': 'middle', 'font-size': 11, fill: '#4a6285' }, [c.label])); }
      else if (T === 'VCC' || T === 'GND') g.append(el('rect', Object.assign({ x: 0, y: 0, width: 30, height: 20, rx: 3 }, stroke)), el('text', { x: 15, y: 15, 'text-anchor': 'middle', 'font-weight': 700, fill: '#0a3d91' }, [T === 'VCC' ? '1' : '0']));
      else if (T === 'LED') { const v = st.val && st.val[st.f(st.key(c.id, 'in0'))]; g.append(el('circle', { cx: 18, cy: 12, r: 11, stroke: '#0a3d91', 'stroke-width': 2, fill: v ? '#2f8cff' : '#e6edf7', style: v ? 'filter:drop-shadow(0 0 6px #2f8cff)' : '' }), el('line', { x1: 0, y1: 12, x2: 7, y2: 12, stroke: '#0a3d91', 'stroke-width': 2 }), el('text', { x: 18, y: 38, 'text-anchor': 'middle', 'font-size': 11, fill: '#4a6285' }, [c.label])); }
      else if (T === 'DFF') g.append(el('rect', Object.assign({ x: 12, y: 0, width: 46, height: 70 }, stroke)), el('text', { x: 18, y: 24, 'font-size': 11 }, ['CLK']), el('text', { x: 18, y: 54, 'font-size': 11 }, ['D']), el('text', { x: 40, y: 24, 'font-size': 11 }, ['Q']), el('path', { d: 'M12 14 l8 6 l-8 6', fill: 'none', stroke: '#0a3d91', 'stroke-width': 2 }), el('text', { x: 35, y: 66, 'font-size': 9, fill: '#4a6285' }, ['q=' + (st.sim['q' + c.id] || 0)]));
      else {
        const base = T.replace(/^N(?=AND|OR)/, '').replace(/^X?N(?=OR)/, '');
        const bubble = ['NAND', 'NOR', 'XNOR', 'NOT'].includes(T);
        let d;
        if (T === 'NOT') d = 'M8 4 L8 36 L44 20 Z';
        else if (T === 'AND' || T === 'NAND') d = 'M8 2 H30 A18 18 0 0 1 30 38 H8 Z';
        else d = 'M6 2 Q28 2 50 20 Q28 38 6 38 Q18 20 6 2 Z';
        g.append(el('path', Object.assign({ d }, stroke)));
        if (T === 'XOR' || T === 'XNOR') g.append(el('path', { d: 'M0 2 Q12 20 0 38', fill: 'none', stroke: '#0a3d91', 'stroke-width': 2 }));
        if (bubble) g.append(el('circle', { cx: T === 'NOT' ? 49 : 54, cy: 20, r: 4, fill: '#fff', stroke: '#0a3d91', 'stroke-width': 2 }));
        g.append(el('line', { x1: 0, y1: 10, x2: 8, y2: 10, stroke: '#0a3d91', 'stroke-width': 2 }));
        if (T !== 'NOT') g.append(el('line', { x1: 0, y1: 30, x2: 8, y2: 30, stroke: '#0a3d91', 'stroke-width': 2 }));
        if (T === 'NOT') { g.querySelectorAll('line').forEach(l => l.remove()); g.append(el('line', { x1: 0, y1: 20, x2: 8, y2: 20, stroke: '#0a3d91', 'stroke-width': 2 })); }
        { const x0 = T === 'NOT' ? 53 : bubble ? 58 : (T === 'AND' ? 48 : 50), x1 = T === 'NOT' ? 56 : 60; g.append(el('line', { x1: x0, y1: 20, x2: x1, y2: 20, stroke: '#0a3d91', 'stroke-width': 2 })); }
        g.append(el('text', { x: 30, y: 24, 'text-anchor': 'middle', 'font-size': 9, fill: '#4a6285' }, [T === 'NOT' ? '' : T]));
      }
      return g;
    }
    const wirePath = (p, q) => { const mx = Math.max(p[0] + 10, Math.round((p[0] + q[0]) / 20) * 10); return q[0] >= p[0] + 20 ? `M${p[0]} ${p[1]} H${(p[0] + q[0]) / 2} V${q[1]} H${q[0]}` : `M${p[0]} ${p[1]} H${p[0] + 12} V${(p[1] + q[1]) / 2} H${q[0] - 12} V${q[1]} H${q[0]}`; };
    function draw() {
      settle();
      svg.innerHTML = '';
      const defs = el('pattern', { id: 'gp', width: 20, height: 20, patternUnits: 'userSpaceOnUse' }, [el('circle', { cx: 1, cy: 1, r: 1, fill: '#b9cde8' })]);
      svg.append(el('defs', {}, [defs]), el('rect', { width: 1200, height: 560, fill: 'url(#gp)' }));
      st.wires.forEach((w, i) => {
        const a = byId(w.a.c), b = byId(w.b.c); if (!a || !b) return;
        const p = pinPos(a, w.a.p), q = pinPos(b, w.b.p);
        const v = st.val[st.f(st.key(w.a.c, w.a.p))];
        const path = el('path', { d: wirePath(p, q), fill: 'none', stroke: v ? '#1d6fe8' : '#7c8fa9', 'stroke-width': st.sel && st.sel.w === i ? 5 : 3, 'stroke-linejoin': 'round', 'data-w': i });
        svg.appendChild(path);
      });
      st.comps.forEach(c => {
        const g = el('g', { transform: `translate(${c.x},${c.y})`, 'data-c': c.id, style: 'cursor:' + (c.type === 'SW' || c.type === 'CLK' ? 'pointer' : 'move') });
        g.appendChild(symbol(c));
        if (st.sel && st.sel.c === c.id) g.insertBefore(el('rect', { x: -6, y: -6, width: SIZE[c.type][0] + 12, height: SIZE[c.type][1] + 12, fill: 'none', stroke: '#1d6fe8', 'stroke-dasharray': '4 3' }), g.firstChild);
        PINS[c.type].forEach(p => g.appendChild(el('circle', { cx: p[1], cy: p[2], r: 5, class: 'pin', 'data-p': p[0], 'data-c': c.id, fill: '#fff', stroke: '#1d6fe8', 'stroke-width': 1.5 })));
        svg.appendChild(g);
      });
      if (st.wiring) { const a = byId(st.wiring.c); const p = pinPos(a, st.wiring.p); svg.appendChild(el('path', { d: `M${p[0]} ${p[1]} L${st.mouse.x} ${st.mouse.y}`, stroke: '#1d6fe8', 'stroke-dasharray': '5 4', fill: 'none', 'stroke-width': 2, style: 'pointer-events:none' })); }
      const nIn = st.comps.filter(c => c.type === 'SW' || c.type === 'CLK').length, nG = st.comps.filter(c => !['SW', 'CLK', 'LED', 'VCC', 'GND'].includes(c.type)).length;
      info.textContent = (st.status ? st.status + ' · ' : '') + `${st.comps.length} componentes, ${st.wires.length} cables, ${nG} compuertas/FF, ${nIn} entradas` + (st.conflict ? ' · ⚠ dos salidas conectadas al mismo cable' : '');
      drawProps();
      if (onChange) onChange();
    }
    function drawProps() {
      props.innerHTML = '';
      const c = st.sel && st.sel.c ? byId(st.sel.c) : null;
      if (c && (c.type === 'SW' || c.type === 'CLK' || c.type === 'LED')) {
        const l = document.createElement('label'); l.textContent = 'Nombre: ';
        const i = document.createElement('input'); i.value = c.label; i.maxLength = 12;
        i.onchange = () => { c.label = (i.value.replace(/[^A-Za-z0-9]/g, '') || c.label).replace(/^(\d)/, 'X$1'); draw(); };
        l.appendChild(i); props.appendChild(l);
      } else props.textContent = 'Elige una herramienta y haz clic en el lienzo. Con la mano: arrastra un pin hasta otro pin para tender un cable; clic en un interruptor para cambiarlo; selecciona algo y pulsa Suprimir para borrarlo.';
    }

    /* ---------- interacción ---------- */
    const pt = e => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) * 1200 / r.width, y: (e.clientY - r.top) * 560 / r.height }; };
    svg.addEventListener('pointerdown', e => {
      const m = pt(e); st.mouse = m; svg.focus();
      const pinEl = e.target.closest ? e.target.closest('.pin') : null;
      const cEl = e.target.closest ? e.target.closest('[data-c]') : null;
      const wEl = e.target.getAttribute && e.target.getAttribute('data-w');
      if (st.tool === 'del') {
        if (cEl) { removeComp(+cEl.getAttribute('data-c')); } else if (wEl !== null && wEl !== undefined) { st.wires.splice(+wEl, 1); }
        draw(); return;
      }
      if (st.tool !== 'hand') { if (!cEl) { add(st.tool, m.x - SIZE[st.tool][0] / 2, m.y - SIZE[st.tool][1] / 2); draw(); } return; }
      if (pinEl) { st.wiring = { c: +pinEl.getAttribute('data-c'), p: pinEl.getAttribute('data-p') }; svg.setPointerCapture(e.pointerId); return; }
      if (cEl) {
        const c = byId(+cEl.getAttribute('data-c')); st.sel = { c: c.id };
        st.drag = { c, dx: m.x - c.x, dy: m.y - c.y, moved: false }; svg.setPointerCapture(e.pointerId); draw(); return;
      }
      if (wEl !== null && wEl !== undefined) { st.sel = { w: +wEl }; draw(); return; }
      st.sel = null; draw();
    });
    svg.addEventListener('pointermove', e => {
      const m = pt(e); st.mouse = m;
      if (st.drag) { st.drag.moved = true; st.drag.c.x = snap(m.x - st.drag.dx); st.drag.c.y = snap(m.y - st.drag.dy); draw(); }
      else if (st.wiring) draw();
    });
    svg.addEventListener('pointerup', e => {
      const m = pt(e);
      if (st.drag) { const d = st.drag; st.drag = null; if (!d.moved && (d.c.type === 'SW' || d.c.type === 'CLK')) { setValue(d.c, d.c.v ? 0 : 1); } draw(); return; }
      if (st.wiring) {
        const w = st.wiring; st.wiring = null;
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const pinEl = t && t.closest ? t.closest('.pin') : null;
        if (pinEl) {
          const c2 = +pinEl.getAttribute('data-c'), p2 = pinEl.getAttribute('data-p');
          const A = byId(w.c), B = byId(c2);
          const da = PINS[A.type].find(q => q[0] === w.p)[3], db = PINS[B.type].find(q => q[0] === p2)[3];
          if (c2 !== w.c && da !== db) {
            const o = da === 'o' ? { c: w.c, p: w.p } : { c: c2, p: p2 }, i = da === 'o' ? { c: c2, p: p2 } : { c: w.c, p: w.p };
            st.wires = st.wires.filter(x => !(x.b.c === i.c && x.b.p === i.p));    // una entrada recibe un solo cable
            st.wires.push({ a: o, b: i });
          }
        }
        draw();
      }
    });
    svg.addEventListener('keydown', e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel) { if (st.sel.c) removeComp(st.sel.c); else if (st.sel.w !== undefined) st.wires.splice(st.sel.w, 1); st.sel = null; draw(); e.preventDefault(); }
    });
    function removeComp(id) { st.comps = st.comps.filter(c => c.id !== id); st.wires = st.wires.filter(w => w.a.c !== id && w.b.c !== id); }

    /* ---------- reloj ---------- */
    function tick() { st.comps.filter(c => c.type === 'CLK').forEach(c => setValue(c, c.v ? 0 : 1)); draw(); }
    function run(on, ms) { if (st.timer) { clearInterval(st.timer); st.timer = null; } if (on) st.timer = setInterval(tick, ms || 500); return !!st.timer; }

    /* ---------- netlist ---------- */
    function toNetlist() {
      settle();
      const warns = [];
      const nameOf = {}; const used = new Set();
      const uniq = (b) => { let n = b, k = 2; while (used.has(n)) n = b + '_' + (k++); used.add(n); return n; };
      const nl = { name: 'circuito', gates: [], inputs: [], outputs: [], clocks: [], uid: 0 };
      const root = (c, p) => st.f(st.key(c, p));
      st.comps.forEach(c => {
        if (c.type === 'SW' || c.type === 'CLK') { const n = uniq(c.label); nameOf[root(c.id, 'out')] = n; nl.inputs.push(n); if (c.type === 'CLK') nl.clocks.push(n); }
        else if (c.type === 'VCC') nameOf[root(c.id, 'out')] = 'VCC'; else if (c.type === 'GND') nameOf[root(c.id, 'out')] = 'GND';
      });
      const outName = c => 'g' + c.id;
      st.comps.forEach(c => { if (!['SW', 'CLK', 'LED', 'VCC', 'GND'].includes(c.type)) nameOf[root(c.id, c.type === 'DFF' ? 'q' : 'out')] = c.type === 'DFF' ? 'q' + c.id : outName(c); });
      const inNet = (c, p) => { const n = nameOf[root(c.id, p)]; if (!n) { warns.push('Entrada sin conectar en ' + c.type + ' → se usa 0'); return 'GND'; } return n; };
      st.comps.forEach(c => {
        if (['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(c.type)) nl.gates.push({ t: c.type, i: [inNet(c, 'in0'), inNet(c, 'in1')], o: outName(c) });
        else if (c.type === 'NOT') nl.gates.push({ t: 'NOT', i: [inNet(c, 'in0')], o: outName(c) });
        else if (c.type === 'DFF') nl.gates.push({ t: 'DFF', i: [inNet(c, 'clk'), inNet(c, 'd')], o: 'q' + c.id });
      });
      const usedL = new Set(nl.inputs);
      st.comps.filter(c => c.type === 'LED').sort((a, b) => a.y - b.y || a.x - b.x).forEach(c => { let l = c.label || 'Y', k = 2; while (usedL.has(l)) l = c.label + (k++); usedL.add(l); nl.outputs.push({ label: l, net: inNet(c, 'in0') }); });
      nl.warns = [...new Set(warns)];
      return nl;
    }

    /* ---------- cargar netlist con autodisposición ---------- */
    function loadNetlist(nl, L2W) {
      run(false); st.comps = []; st.wires = []; st.sim = {}; st.sel = null; st.nextId = 1;
      const lay = L2W.layout(nl);
      const byOut = {}; const idOf = {};
      const isClk = n => (nl.clocks || []).includes(n);
      lay.comps.forEach(c => {
        const x = 30 + c.col * 140, y = c.y - 30;
        let comp;
        if (c.kind === 'in' || c.kind === 'clk') comp = add(c.kind === 'clk' ? 'CLK' : 'SW', x, y, c.label);
        else if (c.kind === 'const') comp = add(c.label === 'VCC' ? 'VCC' : 'GND', x, y);
        else if (c.kind === 'out') comp = add('LED', x, y, c.label);
        else comp = add(c.t, x, y);
        idOf[c.id] = comp.id;
        if (c.out) (byOut[c.out] = byOut[c.out] || []).push({ comp, c });
      });
      lay.comps.forEach(c => {
        const to = byId(idOf[c.id]);
        c.ins.forEach((n, k) => {
          const s = lay.srcOf[n]; if (!s) return;
          const from = byId(idOf[s.id]);
          const op = PINS[from.type].find(p => p[3] === 'o')[0];
          const ip = to.type === 'LED' ? 'in0' : to.type === 'DFF' ? (k === 0 ? 'clk' : 'd') : (k === 0 ? 'in0' : 'in1');
          st.wires.push({ a: { c: from.id, p: op }, b: { c: to.id, p: ip } });
        });
      });
      // ajustar la vista: reescalar al lienzo
      const xs = st.comps.map(c => c.x), ys = st.comps.map(c => c.y);
      const W = Math.max(...xs) + 120, H = Math.max(...ys) + 100;
      svg.setAttribute('viewBox', `0 0 ${Math.max(1200, W)} ${Math.max(560, H)}`);
      draw();
    }
    function clear() { run(false); st.comps = []; st.wires = []; st.sim = {}; st.sel = null; svg.setAttribute('viewBox', '0 0 1200 560'); draw(); }
    function truth() {
      const nl = toNetlist();
      const ins = nl.inputs.filter(n => !nl.clocks.includes(n));
      if (nl.gates.some(g => g.t === 'DFF')) return { error: 'La tabla de verdad es para circuitos combinacionales (sin flip-flops).' };
      if (ins.length > 8) return { error: 'Demasiadas entradas para la tabla (máx. 8).' };
      return { nl, ins, rows: [...Array(1 << ins.length).keys()].map(k => { const v = {}; ins.forEach((n, i) => { v[n] = (k >> (ins.length - 1 - i)) & 1; }); return { v, out: require_eval(nl, v) }; }) };
    }
    function require_eval(nl, v) {
      const val = Object.assign({ GND: 0, VCC: 1 }, v);
      for (let pass = 0; pass < 60; pass++) { let ch = false; for (const g of nl.gates) { const a = val[g.i[0]] | 0, b = g.i.length > 1 ? val[g.i[1]] | 0 : 0; const o = { AND: a & b, OR: a | b, XOR: a ^ b, NAND: 1 - (a & b), NOR: 1 - (a | b), XNOR: 1 - (a ^ b), NOT: 1 - a }[g.t]; if (val[g.o] !== o) { val[g.o] = o; ch = true; } } if (!ch) break; }
      const r = {}; nl.outputs.forEach(o => { r[o.label] = val[o.net] | 0; }); return r;
    }
    draw();
    return { toNetlist, loadNetlist, clear, tick, run, truth, draw, state: st, evalNL: require_eval, setStatus: s => { st.status = s; draw(); } };
  }
  return { init };
});
