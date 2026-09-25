(function () {
  const C = window.Cotizador;
  const form = document.getElementById('form');
  const out = document.getElementById('resultados');

  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const mxn2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n, d = 1) => `${n.toFixed(d)}%`;
  const $ = (n) => mxn.format(n);

  const NUMERICOS = ['precio', 'enganche', 'plazoMeses', 'tasaAnual', 'aperturaPct', 'seguroAnual', 'seguroBajaAnualPct',
    'seguroVidaMensual', 'otrosMensual', 'gastosIniciales', 'depreciacionAnualPct', 'ingresoMensual'];

  function escribir(datos) {
    for (const [k, v] of Object.entries(datos)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
    }
  }

  function leer() {
    const d = {};
    for (const k of NUMERICOS) d[k] = parseFloat(form.elements[k].value) || 0;
    d.tipoTasa = form.elements.tipoTasa.value;
    d.aperturaForma = form.elements.aperturaForma.value;
    d.seguroForma = form.elements.seguroForma.value;
    d.ivaIntereses = form.elements.ivaIntereses.checked;
    return d;
  }

  function fila(concepto, monto, clase = '') {
    return `<tr class="${clase}"><td>${concepto}</td><td class="num">${monto}</td></tr>`;
  }

  function alertas(r) {
    const e = r.entrada;
    const a = [];
    if (e.tipoTasa === 'global') {
      a.push(['rojo', `Tasa global: los intereses se calculan sobre el monto original durante todo el plazo, aunque ya hayas pagado capital. El costo equivale a un CAT cercano a ${pct(r.cat * 100)}.`]);
    }
    if (r.enganchePct < 20) a.push(['rojo', `Tu enganche es ${pct(r.enganchePct)}. Menos del 20% te deja más tiempo debiendo más de lo que vale el auto.`]);
    if (r.mesesPatrimonioNegativo > 0) {
      a.push(['amarillo', `Durante ${r.mesesPatrimonioNegativo} meses deberás más de lo que vale el auto (con ${e.depreciacionAnualPct}% de depreciación anual). Si lo chocas o lo vendes en ese periodo, pierdes dinero.`]);
    }
    if (r.plazoMeses > 48) a.push(['amarillo', `Plazo de ${r.plazoMeses} meses: al terminar, el auto valdrá aprox. ${$(r.valorFinalAuto)} y habrás pagado ${$(r.totales.costoTotal)}.`]);
    if (r.totales.sobreprecioPct > 40) a.push(['rojo', `Pagarás ${pct(r.totales.sobreprecioPct, 0)} más que el precio de contado.`]);
    if (e.seguroForma === 'financiado') a.push(['amarillo', 'Financiar el seguro multianual te hace pagar intereses sobre la prima. Si puedes, págalo de contado.']);
    if (r.pctIngreso !== null) {
      if (r.pctIngreso > 30) a.push(['rojo', `La mensualidad es ${pct(r.pctIngreso)} de tu ingreso. Arriba del 30% es riesgoso; muchos bancos lo rechazan.`]);
      else if (r.pctIngreso > 20) a.push(['amarillo', `La mensualidad es ${pct(r.pctIngreso)} de tu ingreso. Lo sano para un auto es 20% o menos.`]);
      else a.push(['verde', `La mensualidad es ${pct(r.pctIngreso)} de tu ingreso. Está en un rango sano.`]);
    }
    a.push(['info', 'Las tasas "desde" son para el mejor perfil de buró. Pide la tasa, el CAT y la tabla de amortización por escrito antes de firmar.']);
    return a.map(([t, m]) => `<li class="alerta ${t}">${m}</li>`).join('');
  }

  function tablaAmortizacion(r) {
    const filas = r.tabla.map((f) => `<tr>
      <td>${f.mes}</td><td class="num">${mxn2.format(f.capital)}</td><td class="num">${mxn2.format(f.interes)}</td>
      <td class="num">${mxn2.format(f.iva)}</td><td class="num">${mxn2.format(f.seguro + f.vida + f.otros)}</td>
      <td class="num fuerte">${mxn2.format(f.pagoTotal)}</td><td class="num">${mxn2.format(f.saldo)}</td>
      <td class="num ${f.saldo > f.valorAuto ? 'neg' : ''}">${$(f.valorAuto)}</td></tr>`).join('');
    return `<div class="scroll"><table class="amort">
      <thead><tr><th>Mes</th><th>Capital</th><th>Interés</th><th>IVA</th><th>Seguros y otros</th><th>Pago total</th><th>Saldo</th><th>Valor del auto</th></tr></thead>
      <tbody>${filas}</tbody></table></div>`;
  }

  function resumenAnual(r) {
    const anios = [];
    r.tabla.forEach((f) => {
      const i = Math.floor((f.mes - 1) / 12);
      anios[i] = anios[i] || { capital: 0, interes: 0, iva: 0, otros: 0, total: 0, saldo: 0 };
      const a = anios[i];
      a.capital += f.capital; a.interes += f.interes; a.iva += f.iva;
      a.otros += f.seguro + f.vida + f.otros; a.total += f.pagoTotal; a.saldo = f.saldo;
    });
    if (r.desembolso.seguro) anios[0].otros += r.desembolso.seguro, anios[0].total += r.desembolso.seguro;
    return `<div class="scroll"><table class="amort">
      <thead><tr><th>Año</th><th>Capital</th><th>Interés</th><th>IVA</th><th>Seguros y otros</th><th>Pagado en el año</th><th>Saldo al cierre</th></tr></thead>
      <tbody>${anios.map((a, i) => `<tr><td>${i + 1}</td><td class="num">${$(a.capital)}</td><td class="num">${$(a.interes)}</td>
        <td class="num">${$(a.iva)}</td><td class="num">${$(a.otros)}</td><td class="num fuerte">${$(a.total)}</td><td class="num">${$(a.saldo)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function escenarios(d) {
    const s = C.escenarios(d);
    const fT = s.porTasa.map((x) => `<tr class="${x.tasa === d.tasaAnual && !x.etiqueta.includes('global') && d.tipoTasa === 'insoluto' ? 'actual' : ''}">
      <td>${x.etiqueta}</td><td class="num">${$(x.r.mensualidad.total)}</td><td class="num">${$(x.r.totales.intereses + x.r.totales.ivaIntereses)}</td>
      <td class="num">${$(x.r.totales.costoTotal)}</td><td class="num">${pct(x.r.cat * 100)}</td></tr>`).join('');
    const fP = s.plazos.map((x) => `<tr class="${x.plazo === d.plazoMeses ? 'actual' : ''}">
      <td>${x.plazo} meses</td><td class="num">${$(x.r.mensualidad.total)}</td><td class="num">${$(x.r.totales.intereses + x.r.totales.ivaIntereses)}</td>
      <td class="num">${$(x.r.totales.costoTotal)}</td><td class="num">${x.r.mesesPatrimonioNegativo}</td></tr>`).join('');
    return `
      <h3>Si la tasa real es otra</h3>
      <div class="scroll"><table><thead><tr><th>Tasa</th><th>Mensualidad</th><th>Intereses + IVA</th><th>Costo total</th><th>CAT est.</th></tr></thead><tbody>${fT}</tbody></table></div>
      <h3>Si cambias el plazo</h3>
      <div class="scroll"><table><thead><tr><th>Plazo</th><th>Mensualidad</th><th>Intereses + IVA</th><th>Costo total</th><th>Meses debiendo más de lo que vale</th></tr></thead><tbody>${fP}</tbody></table></div>`;
  }

  function render() {
    const d = leer();
    const r = C.cotizar(d);
    const t = r.totales;
    document.getElementById('tabMensualidad').textContent = $(r.mensualidad.total);
    document.getElementById('enganchePct').textContent = d.precio ? `${pct(r.enganchePct)} del precio` : '';

    const m = r.mensualidad;
    const notaSeguro = d.seguroForma === 'contado' ? `<p class="nota">El seguro se paga aparte: ${$(r.primas[0])} al firmar y luego una vez al año.</p>`
      : d.seguroForma === 'financiado' ? `<p class="nota">El seguro (${$(r.seguroTotal)}) está sumado al monto del crédito.</p>` : '';

    out.innerHTML = `
      <div class="tarjetas">
        <div class="tarjeta principal"><span>Mensualidad real</span><strong>${$(m.total)}</strong>${d.seguroForma === 'contado' && r.seguroTotal
          ? `<em>≈ ${$(m.total + r.seguroTotal / r.plazoMeses)}/mes si apartas para el seguro</em>` : ''}</div>
        <div class="tarjeta"><span>Pagas al firmar</span><strong>${$(r.desembolso.total)}</strong></div>
        <div class="tarjeta"><span>Costo total del auto</span><strong>${$(t.costoTotal)}</strong></div>
        <div class="tarjeta"><span>Pagas de más vs. contado</span><strong>${$(t.sobreprecio)}</strong><em>${pct(t.sobreprecioPct, 0)}</em></div>
        <div class="tarjeta"><span>CAT estimado (sin IVA)</span><strong>${pct(r.cat * 100)}</strong></div>
      </div>

      <ul class="alertas">${alertas(r)}</ul>

      <div class="columnas">
        <section>
          <h2>1. Datos del crédito</h2>
          <table>
            ${fila('Precio del vehículo', $(d.precio))}
            ${fila(`Enganche (${pct(r.enganchePct)})`, $(d.enganche))}
            ${fila('Monto del auto a financiar', $(r.montoAuto))}
            ${r.montoFinanciado !== r.montoAuto ? fila('Monto total del crédito (con lo financiado)', $(r.montoFinanciado)) : ''}
            ${fila('Plazo', `${r.plazoMeses} meses`)}
            ${fila('Tasa anual', `${pct(d.tasaAnual, 2)} ${d.tipoTasa === 'global' ? 'global' : 'sobre saldo insoluto'}`)}
          </table>
        </section>

        <section>
          <h2>2. Tu mensualidad desglosada</h2>
          <table>
            ${fila('Capital + intereses', mxn2.format(m.capitalMasInteres))}
            ${fila('IVA sobre intereses (1er mes)', mxn2.format(m.ivaPrimerMes))}
            ${fila('Pago al banco', mxn2.format(m.credito), 'sub')}
            ${m.seguro ? fila('Seguro de auto prorrateado', mxn2.format(m.seguro)) : ''}
            ${m.vida ? fila('Seguro de vida / desempleo', mxn2.format(m.vida)) : ''}
            ${m.otros ? fila('Otros cargos', mxn2.format(m.otros)) : ''}
            ${fila('Mensualidad real', mxn2.format(m.total), 'total')}
          </table>
          ${notaSeguro}
        </section>

        <section>
          <h2>3. Desembolso inicial</h2>
          <table>
            ${fila('Enganche', $(r.desembolso.enganche))}
            ${r.desembolso.apertura ? fila('Comisión por apertura + IVA', $(r.desembolso.apertura)) : ''}
            ${r.desembolso.seguro ? fila('Seguro de auto (1er año)', $(r.desembolso.seguro)) : ''}
            ${r.desembolso.gastos ? fila('Placas, trámites y otros', $(r.desembolso.gastos)) : ''}
            ${fila('Total al firmar', $(r.desembolso.total), 'total')}
          </table>
        </section>

        <section>
          <h2>4. Costo total en ${r.plazoMeses} meses</h2>
          <table>
            ${fila('Precio del auto', $(d.precio))}
            ${fila('Intereses', $(t.intereses))}
            ${t.ivaIntereses ? fila('IVA sobre intereses', $(t.ivaIntereses)) : ''}
            ${t.seguroAuto ? fila(`Seguro de auto (${r.primas.length} años)`, $(t.seguroAuto)) : ''}
            ${t.apertura ? fila('Comisión por apertura + IVA', $(t.apertura)) : ''}
            ${t.vida ? fila('Seguro de vida / desempleo', $(t.vida)) : ''}
            ${t.otros ? fila('Otros cargos mensuales', $(t.otros)) : ''}
            ${t.gastosIniciales ? fila('Gastos iniciales', $(t.gastosIniciales)) : ''}
            ${fila('Costo total real', $(t.costoTotal), 'total')}
          </table>
        </section>
      </div>

      <section>
        <h2>5. Escenarios</h2>
        ${escenarios(d)}
      </section>

      <section>
        <h2>6. Resumen por año</h2>
        ${resumenAnual(r)}
      </section>

      <details>
        <summary>7. Tabla de amortización mes por mes</summary>
        ${tablaAmortizacion(r)}
      </details>`;

    history.replaceState(null, '', '?' + new URLSearchParams(Object.entries(d).map(([k, v]) => [k, String(v)])).toString());
  }

  function desdeURL() {
    const p = new URLSearchParams(location.search);
    if (!p.has('precio')) return null;
    const d = {};
    for (const [k, v] of p) d[k] = v === 'true' ? true : v === 'false' ? false : v;
    return d;
  }

  escribir(Object.assign({}, C.DEFAULTS, desdeURL() || {}));
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  document.getElementById('ejemplo').addEventListener('click', () => { escribir(C.DEFAULTS); render(); });
  document.getElementById('imprimir').addEventListener('click', () => {
    document.querySelectorAll('details').forEach((x) => (x.open = true));
    window.print();
  });
  document.getElementById('compartir').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const r = C.cotizar(leer());
    const texto = `Cotización: mensualidad real ${$(r.mensualidad.total)}, pago inicial ${$(r.desembolso.total)}, costo total ${$(r.totales.costoTotal)}.`;
    try {
      if (navigator.share) return await navigator.share({ title: 'Cotización de auto', text: texto, url: location.href });
      await navigator.clipboard.writeText(location.href);
      btn.textContent = '¡Enlace copiado!';
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      btn.textContent = 'Copia la URL del navegador';
    }
    setTimeout(() => (btn.textContent = 'Compartir'), 2000);
  });

  // Navegación por pestañas (solo visible en pantallas angostas).
  const main = document.querySelector('main');
  function irA(vista) {
    main.dataset.vista = vista;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === vista));
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => irA(b.dataset.ir)));
  document.getElementById('verResultados').addEventListener('click', () => {
    irA('resultados');
    if (window.matchMedia('(min-width: 901px)').matches) out.scrollIntoView({ behavior: 'smooth' });
  });

  // Instalación como app.
  let promptInstalar = null;
  const btnInstalar = document.getElementById('instalar');
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    promptInstalar = ev;
    btnInstalar.hidden = false;
  });
  btnInstalar.addEventListener('click', async () => {
    if (!promptInstalar) return;
    promptInstalar.prompt();
    await promptInstalar.userChoice;
    promptInstalar = null;
    btnInstalar.hidden = true;
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  render();
})();
