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
    seguroForma: 'contado', // 'contado' | 'mensual' | 'financiado' | 'financiado1'
    seguroBajaAnualPct: 5, // cuánto baja la prima cada año
    seguroVidaMensual: 0,
    otrosMensual: 0, // GPS, membresías, etc.
    gastosIniciales: 0, // placas, tenencia, trámites, gestoría
    depreciacionAnualPct: 15,
    ingresoMensual: 0,
    descuento: 0, // bono o descuento del vendedor
    autoACuenta: 0, // valor de tu auto actual que se toma como parte del enganche
    agregados: [], // [{ nombre, monto, financiado }] equipamiento, garantía extendida, etc.
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

    const precioNeto = Math.max(0, e.precio - e.descuento);
    const engancheTotal = e.enganche + e.autoACuenta;
    const montoAuto = Math.max(0, precioNeto - engancheTotal);

    const agregados = (e.agregados || []).filter((a) => a && a.monto > 0);
    const sumar = (lista) => lista.reduce((acc, a) => acc + a.monto, 0);
    const agregadosFinanciados = sumar(agregados.filter((a) => a.financiado));
    const agregadosContado = sumar(agregados.filter((a) => !a.financiado));

    // La comisión se cobra sobre lo que presta la institución (auto + agregados financiados).
    const baseApertura = montoAuto + agregadosFinanciados;
    const aperturaSinIva = (baseApertura * e.aperturaPct) / 100;
    const apertura = aperturaSinIva * (1 + IVA);
    const primas = primasSeguro(e.seguroAnual, anios, e.seguroBajaAnualPct);
    const seguroTotal = primas.reduce((a, b) => a + b, 0);
    const seguroFinanciado = e.seguroForma === 'financiado' ? seguroTotal : e.seguroForma === 'financiado1' ? primas[0] : 0;

    let montoFinanciado = baseApertura + seguroFinanciado;
    if (e.aperturaForma === 'financiada') montoFinanciado += apertura;

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
    const flujosCat = [baseApertura - (e.aperturaForma === 'contado' ? aperturaSinIva : 0) + seguroFinanciado];
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
      // Financiado 1er año: igual, pero la primera prima ya va dentro del crédito.
      const anualAparte = e.seguroForma === 'contado' || e.seguroForma === 'financiado1';
      if (anualAparte && m > 1 && (m - 1) % 12 === 0) seguro = primas[anioIdx];

      const pagoTotal = capital + interes + iva + seguro + e.seguroVidaMensual + e.otrosMensual;
      const valorAuto = precioNeto * Math.pow(1 - e.depreciacionAnualPct / 100, m / 12);
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
    const desembolsoInicial = e.enganche + aperturaInicial + seguroInicial + agregadosContado + e.gastosIniciales;

    const seguroPagado = tot.seguro + seguroInicial + seguroFinanciado;
    // Lo que realmente entregas: efectivo al firmar + pagos + el auto que dejas a cuenta.
    const costoTotal = desembolsoInicial + tot.pagos + e.autoACuenta;
    const precioContado = precioNeto + agregadosFinanciados + agregadosContado;
    const primerMes = tabla[0];
    const anualAparte = e.seguroForma === 'contado' || e.seguroForma === 'financiado1';
    const mensualidadTipica = n > 1 && anualAparte ? tabla[1].pagoTotal : primerMes.pagoTotal;

    // Seguro pagado por año (contado o 1er año financiado): cuánto apartar al mes para las renovaciones.
    // El 1er año ya está pagado (al firmar o dentro del crédito); las renovaciones vencen en los meses 13, 25…
    const renovaciones = anualAparte ? primas.slice(1).reduce((a, b) => a + b, 0) : 0;
    const seguroAhorroMensual = renovaciones > 0 ? renovaciones / (12 * (primas.length - 1)) : 0;

    const cat = Math.pow(1 + irr(flujosCat), 12) - 1;
    const valorFinal = tabla[n - 1].valorAuto;

    return {
      entrada: e,
      plazoMeses: n,
      precioNeto,
      engancheTotal,
      enganchePct: precioNeto > 0 ? (engancheTotal / precioNeto) * 100 : 0,
      montoAuto,
      agregados,
      agregadosFinanciados,
      agregadosContado,
      seguroFinanciado,
      seguroAhorroMensual,
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
        autoACuenta: e.autoACuenta,
        agregados: agregadosContado,
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
        agregados: agregadosFinanciados + agregadosContado,
        precioContado,
        costoTotal,
        // Costo del crédito: lo que pagas de más por financiarte. El seguro de auto, placas y trámites
        // se pagarían igual comprando de contado, así que no cuentan.
        sobreprecio: costoTotal - precioContado - seguroPagado - e.gastosIniciales,
        sobreprecioPct: precioContado > 0 ? ((costoTotal - precioContado - seguroPagado - e.gastosIniciales) / precioContado) * 100 : 0,
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

  // Cotiza el mismo auto con cada institución y revisa si cumples sus requisitos.
  function compararInstituciones(entrada, instituciones) {
    const base = Object.assign({}, DEFAULTS, entrada);
    return instituciones
      .map((inst) => {
        const plazo = Math.min(base.plazoMeses, inst.plazoMax || base.plazoMeses);
        const r = cotizar({ ...base, tasaAnual: inst.tasaAnual, tipoTasa: inst.tipoTasa, aperturaPct: inst.aperturaPct, plazoMeses: plazo });
        const avisos = [];
        if (inst.engancheMinPct && r.enganchePct + 1e-9 < inst.engancheMinPct) avisos.push(`Pide ${inst.engancheMinPct}% de enganche mínimo`);
        if (inst.plazoMax && base.plazoMeses > inst.plazoMax) avisos.push(`Plazo máximo ${inst.plazoMax} meses`);
        return { inst, plazo, r, avisos };
      })
      .sort((a, b) => a.r.totales.costoTotal - b.r.totales.costoTotal);
  }

  return { IVA, DEFAULTS, pmt, irr, cotizar, escenarios, compararInstituciones };
});
