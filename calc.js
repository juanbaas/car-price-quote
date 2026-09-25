/*
 * Motor de cálculo del cotizador de crédito automotriz.
 * Funciona en el navegador (window.Cotizador) y en Node (require).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Cotizador = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const IVA = 0.16;

  const DEFAULTS = {
    precio: 229000,
    enganche: 50000,
    plazoMeses: 60,
    tasaAnual: 11.99, // % anual, sin IVA
    tipoTasa: 'insoluto', // 'insoluto' | 'global'
    ivaIntereses: true,
    aperturaPct: 2.5, // % del monto financiado, sin IVA
    aperturaForma: 'contado', // 'contado' | 'financiada'
    seguroAnual: 14000,
    seguroForma: 'contado', // 'contado' | 'mensual' | 'financiado'
    seguroBajaAnualPct: 5, // cuánto baja la prima cada año
    seguroVidaMensual: 0,
    otrosMensual: 0, // GPS, membresías, etc.
    gastosIniciales: 0, // placas, tenencia, trámites, gestoría
    depreciacionAnualPct: 15,
    ingresoMensual: 0,
  };

  function pmt(rate, n, pv) {
    if (rate === 0) return pv / n;
    return (pv * rate) / (1 - Math.pow(1 + rate, -n));
  }

  // TIR mensual por bisección. flows[0] es lo que recibe el cliente (positivo).
  function irr(flows) {
    const npv = (r) => flows.reduce((acc, f, t) => acc + f / Math.pow(1 + r, t), 0);
    let lo = 0;
    let hi = 1;
    if (npv(lo) > 0) return 0; // no hay costo financiero
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (npv(mid) > 0) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  }

  function primasSeguro(anual, anios, bajaPct) {
    const primas = [];
    for (let k = 0; k < anios; k++) primas.push(anual * Math.pow(1 - bajaPct / 100, k));
    return primas;
  }

  function cotizar(entrada) {
    const e = Object.assign({}, DEFAULTS, entrada);
    const n = Math.max(1, Math.round(e.plazoMeses));
    const anios = Math.ceil(n / 12);
    const ivaFactor = e.ivaIntereses ? IVA : 0;

    const montoAuto = Math.max(0, e.precio - e.enganche);
    const aperturaSinIva = (montoAuto * e.aperturaPct) / 100;
    const apertura = aperturaSinIva * (1 + IVA);
    const primas = primasSeguro(e.seguroAnual, anios, e.seguroBajaAnualPct);
    const seguroTotal = primas.reduce((a, b) => a + b, 0);

    let montoFinanciado = montoAuto;
    if (e.aperturaForma === 'financiada') montoFinanciado += apertura;
    if (e.seguroForma === 'financiado') montoFinanciado += seguroTotal;

    const r = e.tasaAnual / 100 / 12;
    let pagoCredito;
    let interesGlobalMensual = 0;
    if (e.tipoTasa === 'global') {
      interesGlobalMensual = (montoFinanciado * (e.tasaAnual / 100) * n) / 12 / n;
      pagoCredito = montoFinanciado / n + interesGlobalMensual * (1 + ivaFactor);
    } else {
      // Práctica bancaria en México: el pago fijo se calcula con la tasa + IVA.
      pagoCredito = pmt(r * (1 + ivaFactor), n, montoFinanciado);
    }

    const tabla = [];
    let saldo = montoFinanciado;
    const tot = { interes: 0, iva: 0, capital: 0, seguro: 0, vida: 0, otros: 0, pagos: 0 };
    // El seguro financiado se trata como dinero recibido para que no infle el CAT.
    const flujosCat = [
      montoAuto - (e.aperturaForma === 'contado' ? aperturaSinIva : 0) + (e.seguroForma === 'financiado' ? seguroTotal : 0),
    ];
    let mesesPatrimonioNegativo = 0;

    for (let m = 1; m <= n; m++) {
      let interes, iva, capital;
      if (e.tipoTasa === 'global') {
        interes = interesGlobalMensual;
        iva = interes * ivaFactor;
        capital = montoFinanciado / n;
      } else {
        interes = saldo * r;
        iva = interes * ivaFactor;
        capital = pagoCredito - interes - iva;
      }
      if (m === n) capital = saldo; // cierra redondeos
      saldo = Math.max(0, saldo - capital);

      const anioIdx = Math.floor((m - 1) / 12);
      let seguro = 0;
      if (e.seguroForma === 'mensual') seguro = primas[anioIdx] / 12;
      // Contado: la prima del año 1 va en el desembolso inicial; las siguientes al inicio de cada año.
      if (e.seguroForma === 'contado' && m > 1 && (m - 1) % 12 === 0) seguro = primas[anioIdx];

      const pagoTotal = capital + interes + iva + seguro + e.seguroVidaMensual + e.otrosMensual;
      const valorAuto = e.precio * Math.pow(1 - e.depreciacionAnualPct / 100, m / 12);
      if (saldo > valorAuto) mesesPatrimonioNegativo++;

      tabla.push({ mes: m, capital, interes, iva, seguro, vida: e.seguroVidaMensual, otros: e.otrosMensual, pagoTotal, saldo, valorAuto });

      tot.interes += interes;
      tot.iva += iva;
      tot.capital += capital;
      tot.seguro += seguro;
      tot.vida += e.seguroVidaMensual;
      tot.otros += e.otrosMensual;
      tot.pagos += pagoTotal;
      // CAT: sin IVA y sin seguro de auto (como lo publica la banca en México).
      flujosCat.push(-(capital + interes + e.seguroVidaMensual + e.otrosMensual));
    }

    const seguroInicial = e.seguroForma === 'contado' ? primas[0] : 0;
    const aperturaInicial = e.aperturaForma === 'contado' ? apertura : 0;
    const desembolsoInicial = e.enganche + aperturaInicial + seguroInicial + e.gastosIniciales;

    const seguroPagado = e.seguroForma === 'financiado' ? seguroTotal : tot.seguro + seguroInicial;
    const costoTotal = desembolsoInicial + tot.pagos;
    const primerMes = tabla[0];
    const mensualidadTipica = n > 1 && e.seguroForma === 'contado' ? tabla[1].pagoTotal : primerMes.pagoTotal;

    const cat = Math.pow(1 + irr(flujosCat), 12) - 1;
    const valorFinal = tabla[n - 1].valorAuto;

    return {
      entrada: e,
      plazoMeses: n,
      enganchePct: e.precio > 0 ? (e.enganche / e.precio) * 100 : 0,
      montoAuto,
      montoFinanciado,
      apertura,
      primas,
      seguroTotal,
      pagoCredito,
      mensualidad: {
        capitalMasInteres: pagoCredito - (primerMes.iva || 0),
        credito: pagoCredito,
        ivaPrimerMes: primerMes.iva,
        seguro: e.seguroForma === 'mensual' ? primas[0] / 12 : 0,
        vida: e.seguroVidaMensual,
        otros: e.otrosMensual,
        total: mensualidadTipica,
      },
      desembolso: {
        enganche: e.enganche,
        apertura: aperturaInicial,
        seguro: seguroInicial,
        gastos: e.gastosIniciales,
        total: desembolsoInicial,
      },
      totales: {
        intereses: tot.interes,
        ivaIntereses: tot.iva,
        seguroAuto: seguroPagado,
        apertura,
        vida: tot.vida,
        otros: tot.otros,
        gastosIniciales: e.gastosIniciales,
        costoTotal,
        sobreprecio: costoTotal - e.precio,
        sobreprecioPct: e.precio > 0 ? ((costoTotal - e.precio) / e.precio) * 100 : 0,
      },
      cat,
      mesesPatrimonioNegativo,
      valorFinalAuto: valorFinal,
      pctIngreso: e.ingresoMensual > 0 ? (mensualidadTipica / e.ingresoMensual) * 100 : null,
      tabla,
    };
  }

  // Resumen de escenarios para comparar tasas y plazos con los mismos datos.
  function escenarios(entrada) {
    const base = Object.assign({}, DEFAULTS, entrada);
    const tasas = Array.from(new Set([base.tasaAnual, 14, 16, 18, 22])).sort((a, b) => a - b);
    const porTasa = tasas.map((t) => ({ etiqueta: `${t}% saldo insoluto`, tasa: t, r: cotizar({ ...base, tasaAnual: t, tipoTasa: 'insoluto' }) }));
    porTasa.push({ etiqueta: `${base.tasaAnual}% tasa global`, tasa: base.tasaAnual, r: cotizar({ ...base, tipoTasa: 'global' }) });
    const plazos = [24, 36, 48, 60, 72].map((p) => ({ plazo: p, r: cotizar({ ...base, plazoMeses: p }) }));
    return { porTasa, plazos };
  }

  return { IVA, DEFAULTS, pmt, irr, cotizar, escenarios };
});
