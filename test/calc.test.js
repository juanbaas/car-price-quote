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

test('agregados financiados generan intereses; de contado van al pago inicial', () => {
  const base = C.cotizar({});
  const fin = C.cotizar({ agregados: [{ nombre: 'Polarizado', monto: 10000, financiado: true }] });
  const con = C.cotizar({ agregados: [{ nombre: 'Polarizado', monto: 10000, financiado: false }] });
  cerca(fin.montoFinanciado, base.montoFinanciado + 10000, 0.01);
  assert.ok(fin.totales.intereses > base.totales.intereses);
  cerca(con.desembolso.total, base.desembolso.total + 10000, 0.01);
  // Financiar cuesta más que pagar de contado el mismo agregado.
  assert.ok(fin.totales.costoTotal > con.totales.costoTotal);
  cerca(con.totales.sobreprecio, base.totales.sobreprecio, 0.01);
});

test('descuento y auto a cuenta reducen el monto a financiar', () => {
  const r = C.cotizar({ descuento: 9000, autoACuenta: 40000 });
  cerca(r.montoAuto, 229000 - 9000 - 50000 - 40000, 0.01);
  cerca(r.enganchePct, (90000 / 220000) * 100, 0.01);
  // El auto a cuenta cuenta como dinero entregado en el costo total.
  cerca(r.totales.costoTotal - r.desembolso.total - r.tabla.reduce((a, f) => a + f.pagoTotal, 0), 40000, 0.5);
});

test('seguro financiado solo el primer año', () => {
  const r = C.cotizar({ seguroForma: 'financiado1' });
  cerca(r.montoFinanciado, 179000 + 14000, 0.01);
  cerca(r.desembolso.seguro, 0);
  cerca(r.tabla[12].seguro, 14000 * 0.95, 0.01);
  cerca(r.totales.seguroAuto, r.seguroTotal, 0.01);
});

test('comparar instituciones ordena por costo total y marca requisitos', () => {
  const I = require('../instituciones');
  const res = C.compararInstituciones({ enganche: 20000 }, I.PREDEFINIDAS);
  for (let i = 1; i < res.length; i++) assert.ok(res[i].r.totales.costoTotal >= res[i - 1].r.totales.costoTotal);
  assert.ok(res.find((x) => x.inst.id === 'bbva').avisos.length > 0);
});

test('el costo del crédito no incluye el seguro de auto ni gastos iniciales', () => {
  const sin = C.cotizar({ seguroAnual: 0, gastosIniciales: 0 });
  const con = C.cotizar({ seguroAnual: 14000, gastosIniciales: 5000 });
  cerca(sin.totales.sobreprecio, con.totales.sobreprecio, 0.01);
  cerca(sin.totales.sobreprecio, sin.totales.intereses + sin.totales.ivaIntereses + sin.totales.apertura, 0.5);
});
