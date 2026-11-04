/* Lab 2 · generadores de HDL (Verilog y VHDL): estructural desde la netlist, comportamental y secuencial con reloj. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L2H = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const bus = list => {                      // agrupa A0,A1.. en buses (índices 0..k sin huecos); lo demás queda escalar
    const idx = {};
    list.forEach(n => { const m = /^([A-Za-z]+)(\d+)$/.exec(n); if (m && m[1] !== 'n') (idx[m[1]] = idx[m[1]] || []).push(+m[2]); });
    const isBus = p => { const a = idx[p]; if (!a) return false; const st = new Set(a), mx = Math.max(...a); for (let i = 0; i <= mx; i++) if (!st.has(i)) return false; return st.size >= 2 || mx === 0; };
    const out = [], seen = new Set();
    list.forEach(n => {
      const m = /^([A-Za-z]+)(\d+)$/.exec(n);
      if (m && m[1] !== 'n' && isBus(m[1])) { if (!seen.has(m[1])) { seen.add(m[1]); out.push({ name: m[1], max: Math.max(...idx[m[1]]) }); } }
      else if (!seen.has(n)) { seen.add(n); out.push({ name: n, max: null }); }
    });
    return out;
  };
  const isBusBit = (n, buses) => { const m = /^([A-Za-z]+)(\d+)$/.exec(n); return m && buses.find(b => b.name === m[1] && b.max !== null); };

  /* ---------- Verilog estructural ---------- */
  function verilogStruct(nl, name) {
    const hasClk = nl.gates.some(g => g.t === 'DFF');
    const ins = nl.inputs.filter(n => !(nl.clocks || []).includes(n)), clks = nl.clocks || [];
    const inB = bus(ins), outB = bus(nl.outputs.map(o => o.label));
    const ref = n => {
      if (n === 'VCC') return "1'b1"; if (n === 'GND') return "1'b0";
      if (clks.includes(n)) return n;
      if (ins.includes(n)) { const m = /^([A-Za-z]+)(\d+)$/.exec(n); const b = inB.find(x => m && x.name === m[1] && x.max !== null); return b ? `${m[1]}[${m[2]}]` : n; }
      return 'w_' + n;
    };
    const ports = [...clks.map(c => '  input ' + c), ...inB.map(b => '  input ' + (b.max !== null ? `[${b.max}:0] ` : '') + b.name), ...outB.map(b => '  output ' + (b.max !== null ? `[${b.max}:0] ` : '') + b.name)];
    const lines = [`// ${name}: circuito generado por Lab 2 (estructural, compuerta por compuerta)`, `module ${name}(`, ports.join(',\n'), ');'];
    const ffo = new Set(nl.gates.filter(g => g.t === 'DFF').map(g => g.o));
    const wires = nl.gates.filter(g => g.t !== 'DFF').map(g => 'w_' + g.o);
    if (wires.length) lines.push('  wire ' + wires.join(', ') + ';');
    if (ffo.size) { lines.push('  reg ' + [...ffo].map(n => 'w_' + n).join(', ') + ';'); lines.push('  initial begin ' + [...ffo].map(n => 'w_' + n + " = 1'b0;").join(' ') + ' end'); }
    for (const g of nl.gates) {
      const a = ref(g.i[0]), b = g.i[1] !== undefined ? ref(g.i[1]) : null;
      const ex = { AND: `${a} & ${b}`, OR: `${a} | ${b}`, XOR: `${a} ^ ${b}`, NAND: `~(${a} & ${b})`, NOR: `~(${a} | ${b})`, XNOR: `~(${a} ^ ${b})`, NOT: `~${a}` }[g.t];
      if (g.t === 'DFF') lines.push(`  always @(posedge ${a}) w_${g.o} <= ${b};`);
      else lines.push(`  assign w_${g.o} = ${ex};`);
    }
    nl.outputs.forEach(o => { const m = /^([A-Za-z]+)(\d+)$/.exec(o.label); const b = m && outB.find(x => x.name === m[1] && x.max !== null); lines.push(`  assign ${b ? `${m[1]}[${m[2]}]` : o.label} = ${ref(o.net)};`); });
    lines.push('endmodule');
    return lines.join('\n') + '\n';
  }

  /* ---------- VHDL estructural ---------- */
  function vhdlStruct(nl, name) {
    const clks = nl.clocks || [];
    const ins = nl.inputs.filter(n => !clks.includes(n));
    const inB = bus(ins), outB = bus(nl.outputs.map(o => o.label));
    const ref = n => {
      if (n === 'VCC') return "'1'"; if (n === 'GND') return "'0'";
      if (clks.includes(n)) return n;
      if (ins.includes(n)) { const m = /^([A-Za-z]+)(\d+)$/.exec(n); const b = inB.find(x => m && x.name === m[1] && x.max !== null); return b ? `${m[1]}(${m[2]})` : n; }
      return 'w_' + n;
    };
    const ty = b => b.max !== null ? `std_logic_vector(${b.max} downto 0)` : 'std_logic';
    const ports = [...clks.map(c => `    ${c} : in std_logic`), ...inB.map(b => `    ${b.name} : in ${ty(b)}`), ...outB.map(b => `    ${b.name} : out ${ty(b)}`)];
    const L = ['library ieee;', 'use ieee.std_logic_1164.all;', '', `-- ${name}: circuito generado por Lab 2 (estructural)`, `entity ${name} is`, '  port (', ports.join(';\n'), '  );', `end entity ${name};`, '', `architecture rtl of ${name} is`];
    nl.gates.forEach(g => L.push(`  signal w_${g.o} : std_logic${g.t === 'DFF' ? " := '0'" : ''};`));
    L.push('begin');
    const ffs = [];
    for (const g of nl.gates) {
      const a = ref(g.i[0]), b = g.i[1] !== undefined ? ref(g.i[1]) : null;
      if (g.t === 'DFF') { ffs.push(g); continue; }
      const ex = { AND: `${a} and ${b}`, OR: `${a} or ${b}`, XOR: `${a} xor ${b}`, NAND: `${a} nand ${b}`, NOR: `${a} nor ${b}`, XNOR: `${a} xnor ${b}`, NOT: `not ${a}` }[g.t];
      L.push(`  w_${g.o} <= ${ex};`);
    }
    ffs.forEach((g, i) => { L.push(`  ff${i}: process(${ref(g.i[0])}) begin if rising_edge(${ref(g.i[0])}) then w_${g.o} <= ${ref(g.i[1])}; end if; end process;`); });
    nl.outputs.forEach(o => { const m = /^([A-Za-z]+)(\d+)$/.exec(o.label); const b = m && outB.find(x => x.name === m[1] && x.max !== null); L.push(`  ${b ? `${m[1]}(${m[2]})` : o.label} <= ${ref(o.net)};`); });
    L.push(`end architecture rtl;`);
    return L.join('\n') + '\n';
  }

  /* ---------- Verilog comportamental y secuencial ---------- */
  function verilogBehav(op, N) {
    const n1 = N - 1;
    const hd = (nm, io) => `module ${nm}(\n${io}\n);\n`;
    if (op === 'add') return hd('sumador' + N, `  input [${n1}:0] A, B,\n  input Cin,\n  output [${n1}:0] S,\n  output Cout`) + `  assign {Cout, S} = A + B + Cin;\nendmodule\n`;
    if (op === 'sub') return hd('restador' + N, `  input [${n1}:0] A, B,\n  output [${n1}:0] D,\n  output Cout, Prestamo`) + `  wire [${N}:0] t = {1'b0, A} + {1'b0, ~B} + 1'b1;\n  assign D = t[${n1}:0];\n  assign Cout = t[${N}];\n  assign Prestamo = ~t[${N}];\nendmodule\n`;
    if (op === 'mul') return hd('multiplicador' + N, `  input [${n1}:0] A, B,\n  output [${2 * N - 1}:0] P`) + `  assign P = A * B;\nendmodule\n`;
    return hd('divisor' + N, `  input [${n1}:0] A, B,\n  output [${n1}:0] Q, R`) + `  assign Q = (B == 0) ? {${N}{1'b0}} : A / B;\n  assign R = (B == 0) ? {${N}{1'b0}} : A % B;\nendmodule\n`;
  }

  function verilogSeq(op, N) {
    const n1 = N - 1;
    if (op === 'add' || op === 'sub') {
      const isA = op === 'add';
      return `// ${isA ? 'Sumador' : 'Restador'} de ${N} bits con registro de salida (un ciclo de reloj)
module ${isA ? 'sumador' : 'restador'}${N}_seq(
  input clk, rst, start,
  input [${n1}:0] A, B,${isA ? '\n  input Cin,' : ''}
  output reg [${n1}:0] ${isA ? 'S' : 'D'},
  output reg ${isA ? 'Cout' : 'Cout, Prestamo'}, done
);
  wire [${N}:0] t = ${isA ? '{1\'b0, A} + {1\'b0, B} + Cin' : '{1\'b0, A} + {1\'b0, ~B} + 1\'b1'};
  always @(posedge clk) begin
    if (rst) begin ${isA ? 'S' : 'D'} <= 0; Cout <= 0; ${isA ? '' : 'Prestamo <= 0; '}done <= 0; end
    else begin
      done <= start;
      if (start) begin ${isA ? 'S' : 'D'} <= t[${n1}:0]; Cout <= t[${N}]; ${isA ? '' : 'Prestamo <= ~t[' + N + ']; '}end
    end
  end
endmodule
`;
    }
    if (op === 'mul') return `// Multiplicador de ${N} bits secuencial (suma y desplazamiento): ${N} ciclos
module multiplicador${N}_seq(
  input clk, rst, start,
  input [${n1}:0] A, B,
  output reg [${2 * N - 1}:0] P,
  output reg done
);
  reg busy;
  reg [${2 * N - 1}:0] acc, m;
  reg [${n1}:0] q;
  reg [7:0] cnt;
  always @(posedge clk) begin
    if (rst) begin busy <= 0; done <= 0; P <= 0; acc <= 0; m <= 0; q <= 0; cnt <= 0; end
    else begin
      done <= 0;
      if (start && !busy) begin busy <= 1; acc <= 0; m <= {${N}'d0, A}; q <= B; cnt <= 0; end
      else if (busy) begin
        if (cnt == ${N}) begin busy <= 0; done <= 1; P <= acc; end
        else begin
          if (q[0]) acc <= acc + m;
          m <= m << 1; q <= q >> 1; cnt <= cnt + 1;
        end
      end
    end
  end
endmodule
`;
    return `// Divisor de ${N} bits secuencial con restauración: ${N} ciclos
module divisor${N}_seq(
  input clk, rst, start,
  input [${n1}:0] A, B,
  output reg [${n1}:0] Q, R,
  output reg done, error
);
  reg busy;
  reg [${N}:0] rem;
  reg [${n1}:0] quo, dv;
  reg [7:0] cnt;
  wire [${N}:0] t = {rem[${n1}:0], quo[${n1}]};
  always @(posedge clk) begin
    if (rst) begin busy <= 0; done <= 0; error <= 0; Q <= 0; R <= 0; rem <= 0; quo <= 0; dv <= 0; cnt <= 0; end
    else begin
      done <= 0;
      if (start && !busy) begin
        error <= (B == 0);
        if (B == 0) begin Q <= 0; R <= 0; done <= 1; end
        else begin busy <= 1; rem <= 0; quo <= A; dv <= B; cnt <= 0; end
      end else if (busy) begin
        if (cnt == ${N}) begin busy <= 0; done <= 1; Q <= quo; R <= rem[${n1}:0]; end
        else begin
          if (t >= {1'b0, dv}) begin rem <= t - {1'b0, dv}; quo <= (quo << 1) | 1'b1; end
          else begin rem <= t; quo <= quo << 1; end
          cnt <= cnt + 1;
        end
      end
    end
  end
endmodule
`;
  }

  /* ---------- VHDL comportamental y secuencial ---------- */
  const VH = 'library ieee;\nuse ieee.std_logic_1164.all;\nuse ieee.numeric_std.all;\n\n';
  function vhdlBehav(op, N) {
    const n1 = N - 1, SLV = k => `std_logic_vector(${k} downto 0)`;
    if (op === 'add') return VH + `entity sumador${N} is
  port (A, B : in ${SLV(n1)}; Cin : in std_logic; S : out ${SLV(n1)}; Cout : out std_logic);
end entity;
architecture rtl of sumador${N} is
  signal t : unsigned(${N} downto 0);
begin
  t <= ('0' & unsigned(A)) + ('0' & unsigned(B)) + resize(unsigned'("" & Cin), ${N + 1});
  S <= std_logic_vector(t(${n1} downto 0));
  Cout <= t(${N});
end architecture;
`;
    if (op === 'sub') return VH + `entity restador${N} is
  port (A, B : in ${SLV(n1)}; D : out ${SLV(n1)}; Cout, Prestamo : out std_logic);
end entity;
architecture rtl of restador${N} is
  signal t : unsigned(${N} downto 0);
begin
  t <= ('0' & unsigned(A)) + ('0' & unsigned(not B)) + 1;
  D <= std_logic_vector(t(${n1} downto 0));
  Cout <= t(${N});
  Prestamo <= not t(${N});
end architecture;
`;
    if (op === 'mul') return VH + `entity multiplicador${N} is
  port (A, B : in ${SLV(n1)}; P : out ${SLV(2 * N - 1)});
end entity;
architecture rtl of multiplicador${N} is
begin
  P <= std_logic_vector(unsigned(A) * unsigned(B));
end architecture;
`;
    return VH + `entity divisor${N} is
  port (A, B : in ${SLV(n1)}; Q, R : out ${SLV(n1)});
end entity;
architecture rtl of divisor${N} is
begin
  process(A, B)
  begin
    if unsigned(B) = 0 then
      Q <= (others => '0'); R <= (others => '0');
    else
      Q <= std_logic_vector(unsigned(A) / unsigned(B));
      R <= std_logic_vector(unsigned(A) rem unsigned(B));
    end if;
  end process;
end architecture;
`;
  }

  function vhdlSeq(op, N) {
    const n1 = N - 1, SLV = k => `std_logic_vector(${k} downto 0)`;
    if (op === 'add' || op === 'sub') {
      const isA = op === 'add', o = isA ? 'S' : 'D';
      return VH + `-- ${isA ? 'Sumador' : 'Restador'} de ${N} bits con registro de salida (un ciclo)
entity ${isA ? 'sumador' : 'restador'}${N}_seq is
  port (clk, rst, start : in std_logic; A, B : in ${SLV(n1)};${isA ? ' Cin : in std_logic;' : ''}
        ${o} : out ${SLV(n1)}; Cout : out std_logic;${isA ? '' : ' Prestamo : out std_logic;'} done : out std_logic);
end entity;
architecture rtl of ${isA ? 'sumador' : 'restador'}${N}_seq is
  signal t : unsigned(${N} downto 0);
  signal ${o}_r : ${SLV(n1)} := (others => '0');
  signal c_r, p_r, dn_r : std_logic := '0';
begin
  t <= ${isA ? "('0' & unsigned(A)) + ('0' & unsigned(B)) + resize(unsigned'(\"\" & Cin), " + (N + 1) + ')' : "('0' & unsigned(A)) + ('0' & unsigned(not B)) + 1"};
  process(clk) begin
    if rising_edge(clk) then
      if rst = '1' then ${o}_r <= (others => '0'); c_r <= '0'; p_r <= '0'; dn_r <= '0';
      else
        dn_r <= start;
        if start = '1' then ${o}_r <= std_logic_vector(t(${n1} downto 0)); c_r <= t(${N}); p_r <= not t(${N}); end if;
      end if;
    end if;
  end process;
  ${o} <= ${o}_r; Cout <= c_r;${isA ? '' : ' Prestamo <= p_r;'} done <= dn_r;
end architecture;
`;
    }
    if (op === 'mul') return VH + `-- Multiplicador de ${N} bits secuencial (suma y desplazamiento)
entity multiplicador${N}_seq is
  port (clk, rst, start : in std_logic; A, B : in ${SLV(n1)}; P : out ${SLV(2 * N - 1)}; done : out std_logic);
end entity;
architecture rtl of multiplicador${N}_seq is
  signal busy : std_logic := '0';
  signal acc, m : unsigned(${2 * N - 1} downto 0) := (others => '0');
  signal q : unsigned(${n1} downto 0) := (others => '0');
  signal cnt : integer range 0 to ${N} := 0;
  signal P_r : ${SLV(2 * N - 1)} := (others => '0');
  signal d_r : std_logic := '0';
begin
  P <= P_r; done <= d_r;
  process(clk) begin
    if rising_edge(clk) then
      if rst = '1' then busy <= '0'; d_r <= '0'; P_r <= (others => '0'); acc <= (others => '0'); m <= (others => '0'); q <= (others => '0'); cnt <= 0;
      else
        d_r <= '0';
        if start = '1' and busy = '0' then
          busy <= '1'; acc <= (others => '0'); m <= resize(unsigned(A), ${2 * N}); q <= unsigned(B); cnt <= 0;
        elsif busy = '1' then
          if cnt = ${N} then busy <= '0'; d_r <= '1'; P_r <= std_logic_vector(acc);
          else
            if q(0) = '1' then acc <= acc + m; end if;
            m <= shift_left(m, 1); q <= shift_right(q, 1); cnt <= cnt + 1;
          end if;
        end if;
      end if;
    end if;
  end process;
end architecture;
`;
    return VH + `-- Divisor de ${N} bits secuencial con restauración
entity divisor${N}_seq is
  port (clk, rst, start : in std_logic; A, B : in ${SLV(n1)}; Q, R : out ${SLV(n1)}; done, error : out std_logic);
end entity;
architecture rtl of divisor${N}_seq is
  signal busy : std_logic := '0';
  signal remr : unsigned(${N} downto 0) := (others => '0');
  signal quo, dv : unsigned(${n1} downto 0) := (others => '0');
  signal cnt : integer range 0 to ${N} := 0;
  signal t : unsigned(${N} downto 0);
  signal Q_r, R_r : ${SLV(n1)} := (others => '0');
  signal d_r, e_r : std_logic := '0';
begin
  t <= remr(${n1} downto 0) & quo(${n1});
  Q <= Q_r; R <= R_r; done <= d_r; error <= e_r;
  process(clk) begin
    if rising_edge(clk) then
      if rst = '1' then busy <= '0'; d_r <= '0'; e_r <= '0'; Q_r <= (others => '0'); R_r <= (others => '0'); remr <= (others => '0'); quo <= (others => '0'); dv <= (others => '0'); cnt <= 0;
      else
        d_r <= '0';
        if start = '1' and busy = '0' then
          if unsigned(B) = 0 then e_r <= '1'; Q_r <= (others => '0'); R_r <= (others => '0'); d_r <= '1';
          else e_r <= '0'; busy <= '1'; remr <= (others => '0'); quo <= unsigned(A); dv <= unsigned(B); cnt <= 0; end if;
        elsif busy = '1' then
          if cnt = ${N} then busy <= '0'; d_r <= '1'; Q_r <= std_logic_vector(quo); R_r <= std_logic_vector(remr(${n1} downto 0));
          else
            if t >= resize(dv, ${N + 1}) then remr <= t - resize(dv, ${N + 1}); quo <= shift_left(quo, 1) or to_unsigned(1, ${N});
            else remr <= t; quo <= shift_left(quo, 1); end if;
            cnt <= cnt + 1;
          end if;
        end if;
      end if;
    end if;
  end process;
end architecture;
`;
  }

  /* ---------- bancos de prueba ---------- */
  const NM = { add: 'sumador', sub: 'restador', mul: 'multiplicador', div: 'divisor' };
  function exp(op) { return { add: 'S + (Cout<<N)', sub: '', mul: '', div: '' }[op]; }

  function verilogTB(op, N, dut, seq, noCin) {
    const M = 1 << N, full = N <= 5;
    const ports = { add: noCin ? '.S(S), .Cout(Cout)' : '.S(S), .Cout(Cout), .Cin(Cin)', sub: '.D(D), .Cout(Cout), .Prestamo(Prestamo)', mul: '.P(P)', div: '.Q(Q), .R(R)' }[op];
    const decl = { add: `wire [${N - 1}:0] S; wire Cout; reg Cin = 0;`, sub: `wire [${N - 1}:0] D; wire Cout, Prestamo;`, mul: `wire [${2 * N - 1}:0] P;`, div: `wire [${N - 1}:0] Q, R;` }[op];
    const chk = {
      add: `{Cout, S} !== a + b + Cin`,
      sub: `D !== ((a - b) & ${M - 1}) || Prestamo !== (a < b)`,
      mul: `P !== a * b`,
      div: `Q !== a / b || R !== a % b`
    }[op];
    const seqIo = seq ? `reg clk = 0, rst = 1, start = 0; wire done; ${op === 'div' ? 'wire error;' : ''}\n  always #5 clk = ~clk;` : '';
    const extra = seq ? `, .clk(clk), .rst(rst), .start(start), .done(done)${op === 'div' ? ', .error(error)' : ''}` : '';
    const apply = seq ? `A = a; B = b; ${op === 'add' ? 'Cin = cn; ' : ''}start = 1; @(posedge clk); #1 start = 0; ${op === 'add' || op === 'sub' ? '@(posedge clk); #1;' : 'while (!done) @(posedge clk); #1;'}` : `A = a; B = b; ${op === 'add' ? 'Cin = cn; ' : ''}#1;`;
    return `\`timescale 1ns/1ps
module tb;
  reg [${N - 1}:0] A, B; ${decl}
  ${seqIo}
  ${NM[op]}${N}${seq ? '_seq' : ''} dut(.A(A), .B(B), ${ports}${extra});
  integer a, b, cn, n, bad, it;
  initial begin
    bad = 0; n = 0;
    ${seq ? 'repeat (3) @(posedge clk); #1 rst = 0;' : ''}
    for (it = 0; it < ${full ? M * M * (op === 'add' ? 2 : 1) : 600}; it = it + 1) begin
      ${full ? `a = (it / ${M}) % ${M}; b = it % ${M}; cn = it / ${M * M};` : `a = $urandom % ${M}; b = $urandom % ${M}; cn = $urandom % 2;`}
      ${op === 'div' ? 'if (b != 0) begin' : 'begin'}
        ${apply}
        n = n + 1;
        if (${chk}) begin bad = bad + 1; if (bad < 5) $display("FAIL a=%0d b=%0d", a, b); end
      end
    end
    $display("RESULT %0d casos, %0d errores", n, bad);
    $finish;
  end
endmodule
`;
  }

  function verilogTBstruct(nl, op, N, dut) {   // netlist estructural: puertos por bus iguales a los de la versión comportamental
    const noCin = !nl.inputs.includes('Cin');
    let t = verilogTB(op, N, dut, false, noCin).replace(`${NM[op]}${N} dut`, `${dut} dut`);
    if (noCin && op === 'add') t = t.replace(/Cin = cn;/g, '').replace(/ \+ Cin/g, '');
    if (op === 'sub' && !nl.outputs.some(o => o.label === 'Cout')) t = t.replace('.Cout(Cout), ', '');
    return t;
  }

  function vhdlTB(op, N, dut, seq) {
    const M = 1 << N, n1 = N - 1;
    const full = N <= 5;
    const sig = {
      add: `signal S : std_logic_vector(${n1} downto 0); signal Cout, Cin : std_logic := '0';`,
      sub: `signal D : std_logic_vector(${n1} downto 0); signal Cout, Prestamo : std_logic;`,
      mul: `signal P : std_logic_vector(${2 * N - 1} downto 0);`,
      div: `signal Q, R : std_logic_vector(${n1} downto 0);${seq ? ' signal err : std_logic;' : ''}`
    }[op];
    const pm = { add: 'S => S, Cout => Cout, Cin => Cin', sub: 'D => D, Cout => Cout, Prestamo => Prestamo', mul: 'P => P', div: 'Q => Q, R => R' }[op] + (seq ? ', clk => clk, rst => rst, start => start, done => done' + (op === 'div' ? ', error => err' : '') : '');
    const chk = {
      add: `(unsigned(Cout & S) /= to_unsigned(va + vb + cn, ${N + 1}))`,
      sub: `(unsigned(D) /= to_unsigned((va - vb + ${M}) mod ${M}, ${N})) or ((Prestamo = '1') /= (va < vb))`,
      mul: `(unsigned(P) /= to_unsigned(va * vb, ${2 * N}))`,
      div: `(unsigned(Q) /= to_unsigned(va / vb, ${N})) or (unsigned(R) /= to_unsigned(va mod vb, ${N}))`
    }[op];
    const body = seq
      ? `A <= std_logic_vector(to_unsigned(va, ${N})); B <= std_logic_vector(to_unsigned(vb, ${N}));${op === 'add' ? " if cn = 1 then Cin <= '1'; else Cin <= '0'; end if;" : ''} start <= '1'; wait until rising_edge(clk); wait for 1 ns; start <= '0';\n      ${op === 'add' || op === 'sub' ? 'wait until rising_edge(clk); wait for 1 ns;' : "while done = '0' loop wait until rising_edge(clk); wait for 1 ns; end loop;"}`
      : `A <= std_logic_vector(to_unsigned(va, ${N})); B <= std_logic_vector(to_unsigned(vb, ${N}));${op === 'add' ? " if cn = 1 then Cin <= '1'; else Cin <= '0'; end if;" : ''} wait for 1 ns;`;
    const loop = full ? `for it in 0 to ${M * M * (op === 'add' ? 2 : 1) - 1} loop va := (it / ${M}) mod ${M}; vb := it mod ${M}; cn := it / ${M * M};` : `for it in 0 to 599 loop uniform(s1, s2, rr); va := integer(rr * real(${M}) - 0.5); uniform(s1, s2, rr); vb := integer(rr * real(${M}) - 0.5); cn := va mod 2;`;
    return `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.math_real.all;
use std.textio.all;

entity tb is end entity;
architecture sim of tb is
  signal A, B : std_logic_vector(${n1} downto 0) := (others => '0');
  ${sig}
  signal clk, rst, start, done : std_logic := '0';
begin
  ${seq ? "clk <= not clk after 5 ns;" : ''}
  dut: entity work.${dut} port map (A => A, B => B, ${pm.replace(/^, /, '')});
  process
    variable va, vb, cn, n, bad : integer := 0;
    variable s1, s2 : positive := 7; variable rr : real;
    variable l : line;
  begin
    ${seq ? "rst <= '1'; wait for 30 ns; wait until rising_edge(clk); wait for 1 ns; rst <= '0';" : ''}
    ${loop}
      ${op === 'div' ? 'if vb /= 0 then' : 'if true then'}
        ${body}
        n := n + 1;
        if ${chk} then bad := bad + 1; end if;
      end if;
    end loop;
    write(l, string'("RESULT ") & integer'image(n) & string'(" casos, ") & integer'image(bad) & string'(" errores")); writeline(output, l);
    std.env.finish;
    wait;
  end process;
end architecture;
`;
  }

  return { verilogStruct, vhdlStruct, verilogBehav, vhdlBehav, verilogSeq, vhdlSeq, verilogTB, verilogTBstruct, vhdlTB, bus };
});
