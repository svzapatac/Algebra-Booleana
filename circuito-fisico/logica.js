// Lógica del sumador/restador: es lo que hacen los chips 7486 + 74LS283.
// n = 4 o 5 bits. A y B son arreglos de bits (A[0] es el bit menos significativo).
// M = 0 suma, M = 1 resta (B se invierte con XOR y el acarreo de entrada vale 1).
function valBits(a, n) { var s = 0; for (var i = 0; i < n; i++) s += (a[i] << i); return s; }

function calcular(n, A, B, M) {
  var mask = (1 << n) - 1;
  var a = valBits(A, n), b = valBits(B, n);
  var bp = M ? ((~b) & mask) : b;      // 7486: B XOR M
  var total = a + bp + M;              // 74LS283: A + B' + C0
  return { a: a, b: b, bp: bp, S: total & mask, acarreo: (total >> n) & 1 };
}
// acarreo = 1 en suma: el resultado se pasó del máximo.
// acarreo = 1 en resta: no hubo préstamo (resultado positivo). 0: resultado negativo.

if (typeof module !== 'undefined') module.exports = { calcular: calcular, valBits: valBits };
