const test = require('node:test');
const assert = require('node:assert');
const C = require('../calc');

const cerca = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('sin IVA, apertura ni seguro coincide con amortización clásica', () => {
  const r = C.cotizar({ ivaIntereses: false, aperturaPct: 0, seguroAnual: 0 });
  cerca(r.pagoCredito, 3980.85, 0.5);
  cerca(r.totales.costoTotal, 50000 + 3980.85 * 60, 30);
  cerca(r.tabla.at(-1).saldo, 0, 0.01);
});

test('el IVA se cobra sobre los intereses', () => {
  const r = C.cotizar({ aperturaPct: 0, seguroAnual: 0 });
  cerca(r.totales.ivaIntereses, r.totales.intereses * 0.16, 0.5);
  cerca(r.tabla[0].iva, 179000 * (0.1199 / 12) * 0.16, 0.01);
});

test('la tasa global cuesta más que saldo insoluto con la misma tasa', () => {
  const ins = C.cotizar({});
  const glob = C.cotizar({ tipoTasa: 'global' });
  assert.ok(glob.totales.intereses > ins.totales.intereses * 1.5);
  cerca(glob.totales.intereses, 179000 * 0.1199 * 5, 1);
});

test('desembolso inicial suma enganche, apertura con IVA y primer año de seguro', () => {
  const r = C.cotizar({ gastosIniciales: 3000 });
  cerca(r.desembolso.total, 50000 + 179000 * 0.025 * 1.16 + 14000 + 3000, 0.01);
});

test('seguro financiado genera intereses sobre la prima', () => {
  const contado = C.cotizar({});
  const fin = C.cotizar({ seguroForma: 'financiado' });
  assert.ok(fin.totales.intereses > contado.totales.intereses);
  assert.ok(fin.totales.costoTotal > contado.totales.costoTotal);
});

test('CAT sin comisiones ni IVA equivale a la tasa efectiva anual', () => {
  const r = C.cotizar({ ivaIntereses: false, aperturaPct: 0, seguroAnual: 0 });
  cerca(r.cat * 100, (Math.pow(1 + 0.1199 / 12, 12) - 1) * 100, 0.01);
});

test('escenarios incluye tasa global y varios plazos', () => {
  const s = C.escenarios({});
  assert.ok(s.porTasa.some((x) => x.etiqueta.includes('global')));
  assert.strictEqual(s.plazos.length, 5);
});
