# Sumador y restador de 4 y 5 bits (circuito físico)

Maqueta 3D del montaje en una sola protoboard. Abre `index.html` (o la página de GitHub Pages) y sigue los pasos.

## Piezas
- 1 × SN74LS86N (7486, 4 compuertas XOR, 14 patas) y 1 × SN74LS283N (sumador de 4 bits, 16 patas). Para 5 bits, 2 de cada uno.
- 1 × interruptor DIP de 12 palancas.
- 1 × protoboard y 1 × módulo de energía MB102 (HW-131) con USB, en 5 V.
- Resistencias de 330 Ω a 1 kΩ: 9 para las palancas (11 en 5 bits) y 1 por cada LED. No usar de 10 kΩ.
- 5 LED (6 en 5 bits) y unos 40 cables macho-macho.

## Interruptor
- Palancas 1 a 5: A1 a A5. Palancas 6 a 10: B1 a B5. Palanca 12: M (abajo suma, arriba resta).
- Hacia ON vale 1. Hacia abajo vale 0.

## Pines
74LS283: A1..A4 = 5, 3, 14, 12 · B1..B4 = 6, 2, 15, 11 · C0 = 7 · Σ1..Σ4 = 4, 1, 13, 10 · C4 = 9 · VCC = 16 · GND = 8.
7486: compuertas (entrada, entrada → salida) 1,2→3 · 4,5→6 · 9,10→8 · 12,13→11 · VCC = 14 · GND = 7.

## Cómo funciona
B pasa por una XOR con M (B XOR M). Con M = 1 se invierte y además C0 = 1, así A − B = A + ~B + 1.
- Suma: el LED verde (acarreo) encendido significa que el resultado se pasó del máximo.
- Resta: verde encendido = resultado positivo. Apagado = negativo (los rojos muestran el complemento a 2).

## Lógica
`logica.js` tiene la función que hace lo mismo que los chips. `node test.js` prueba todas las combinaciones de 4 y 5 bits.

## Pruebas del circuito (4 bits)
1. Todas abajo: todos los LED apagados.
2. Palanca 1: enciende S0.
3. Palancas 1 y 6: enciende S1 (1 + 1 = 2).
4. Palancas 1, 2, 4, 7, 8: 11 + 6 = 17, enciende el verde y S0.
5. Con lo anterior, sube la 12: 11 − 6 = 5, enciende verde, S2 y S0.
