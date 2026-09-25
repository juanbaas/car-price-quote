/*
 * Condiciones de referencia por institución. Son ESTIMADOS para comparar:
 * la tasa real depende de tu buró, el auto (nuevo/seminuevo) y promociones.
 * Sustitúyelos con la cotización por escrito de cada institución.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Instituciones = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PREDEFINIDAS = [
    { id: 'bbva', nombre: 'BBVA', tipo: 'Banco', tasaAnual: 13.5, tipoTasa: 'insoluto', aperturaPct: 2.0, engancheMinPct: 20, plazoMax: 60 },
    { id: 'banorte', nombre: 'Banorte', tipo: 'Banco', tasaAnual: 13.9, tipoTasa: 'insoluto', aperturaPct: 2.0, engancheMinPct: 20, plazoMax: 60 },
    { id: 'scotiabank', nombre: 'Scotiabank', tipo: 'Banco', tasaAnual: 12.99, tipoTasa: 'insoluto', aperturaPct: 2.5, engancheMinPct: 20, plazoMax: 60 },
    { id: 'santander', nombre: 'Santander', tipo: 'Banco', tasaAnual: 14.2, tipoTasa: 'insoluto', aperturaPct: 2.5, engancheMinPct: 20, plazoMax: 60 },
    { id: 'hsbc', nombre: 'HSBC', tipo: 'Banco', tasaAnual: 13.8, tipoTasa: 'insoluto', aperturaPct: 2.0, engancheMinPct: 20, plazoMax: 60 },
    { id: 'afirme', nombre: 'Afirme', tipo: 'Banco', tasaAnual: 14.5, tipoTasa: 'insoluto', aperturaPct: 2.0, engancheMinPct: 20, plazoMax: 60 },
    { id: 'caja', nombre: 'Caja popular (típica)', tipo: 'Caja', tasaAnual: 16, tipoTasa: 'insoluto', aperturaPct: 1.0, engancheMinPct: 20, plazoMax: 60,
      nota: 'Suelen pedir ser socio y un ahorro previo. Algunas cobran tasa global: pregunta.' },
    { id: 'financiera', nombre: 'Financiera automotriz (típica)', tipo: 'Financiera', tasaAnual: 22, tipoTasa: 'insoluto', aperturaPct: 3.5, engancheMinPct: 15, plazoMax: 60,
      nota: 'Aceptan buró más débil a cambio de tasa y comisiones altas.' },
    { id: 'global', nombre: 'Tasa global / fija (agencia o financiera)', tipo: 'Financiera', tasaAnual: 13, tipoTasa: 'global', aperturaPct: 3.0, engancheMinPct: 20, plazoMax: 60,
      nota: 'Una tasa global "baja" suele costar más que una tasa sobre saldo insoluto alta.' },
  ];

  return { PREDEFINIDAS, FECHA_REFERENCIA: 'septiembre 2026' };
});
