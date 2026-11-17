// Prueba todas las combinaciones de 4 y 5 bits. Uso: node test.js
var L = require('./logica.js');
function bits(x) { return [x & 1, (x >> 1) & 1, (x >> 2) & 1, (x >> 3) & 1, (x >> 4) & 1]; }
var malos = 0, total = 0;
[4, 5].forEach(function (n) {
  var mask = (1 << n) - 1;
  for (var a = 0; a <= mask; a++) for (var b = 0; b <= mask; b++) for (var M = 0; M < 2; M++) {
    var r = L.calcular(n, bits(a), bits(b), M), esp = M ? ((a - b) & mask) : ((a + b) & mask);
    var carry = M ? (a >= b ? 1 : 0) : ((a + b) >> n) & 1;
    total++; if (r.S !== esp || r.acarreo !== carry) malos++;
  }
});
console.log(total + ' casos, ' + malos + ' errores');
process.exit(malos ? 1 : 0);
