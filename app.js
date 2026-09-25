(function () {
  const C = window.Cotizador;
  const I = window.Instituciones;
  const form = document.getElementById('form');
  const out = document.getElementById('resultados');
  const selInst = document.getElementById('institucion');
  const contAgregados = document.getElementById('agregados');

  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const mxn2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n, d = 1) => `${n.toFixed(d)}%`;
  const $ = (n) => mxn.format(n);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const NUMERICOS = ['precio', 'enganche', 'descuento', 'autoACuenta', 'plazoMeses', 'tasaAnual', 'aperturaPct', 'seguroAnual',
    'seguroBajaAnualPct', 'seguroVidaMensual', 'otrosMensual', 'gastosIniciales', 'depreciacionAnualPct', 'ingresoMensual'];
  const SUGERENCIAS = ['Polarizado', 'Alarma / GPS', 'Garantía extendida', 'Tapetes y accesorios', 'Película de protección', 'Rines / llantas'];
  const EJEMPLO = Object.assign({}, C.DEFAULTS, { auto: 'MG5 Style 2025, manual, 25,000 km', institucion: 'manual' });

  // ---------- Almacenamiento local (tolerante a navegadores que lo bloquean) ----------
  const CLAVE_INST = 'cotizador.instituciones';
  function leerPropias() {
    try { return JSON.parse(localStorage.getItem(CLAVE_INST)) || []; } catch { return []; }
  }
  function guardarPropias(lista) {
    try { localStorage.setItem(CLAVE_INST, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  }
  const todasInstituciones = () => [...I.PREDEFINIDAS, ...leerPropias()];
  const buscarInst = (id) => todasInstituciones().find((x) => x.id === id);

  // ---------- Instituciones ----------
  function pintarInstituciones(seleccion) {
    const opt = (x) => `<option value="${esc(x.id)}">${esc(x.nombre)} — ${x.tasaAnual}%${x.tipoTasa === 'global' ? ' global' : ''}</option>`;
    const propias = leerPropias();
    selInst.innerHTML = `<option value="manual">Manual / otra</option>
      ${propias.length ? `<optgroup label="Mis cotizaciones">${propias.map(opt).join('')}</optgroup>` : ''}
      <optgroup label="Bancos (estimado)">${I.PREDEFINIDAS.filter((x) => x.tipo === 'Banco').map(opt).join('')}</optgroup>
      <optgroup label="Cajas y financieras (estimado)">${I.PREDEFINIDAS.filter((x) => x.tipo !== 'Banco').map(opt).join('')}</optgroup>`;
    selInst.value = buscarInst(seleccion) ? seleccion : 'manual';
  }

  function aplicarInstitucion(id) {
    const x = buscarInst(id);
    if (!x) return;
    form.elements.tasaAnual.value = x.tasaAnual;
    form.elements.tipoTasa.value = x.tipoTasa;
    form.elements.aperturaPct.value = x.aperturaPct;
    if (x.plazoMax && +form.elements.plazoMeses.value > x.plazoMax) form.elements.plazoMeses.value = x.plazoMax;
  }

  function notaInstitucion() {
    const x = buscarInst(selInst.value);
    const nota = document.getElementById('notaInstitucion');
    document.getElementById('borrarInst').hidden = !(x && x.propia);
    if (!x) { nota.textContent = 'Captura la tasa y comisión que te dieron por escrito.'; return; }
    const req = [x.engancheMinPct ? `enganche mín. ${x.engancheMinPct}%` : '', x.plazoMax ? `plazo máx. ${x.plazoMax} meses` : ''].filter(Boolean).join(', ');
    nota.textContent = x.propia
      ? 'Tu cotización guardada en este teléfono.'
      : `Estimado de referencia (${I.FECHA_REFERENCIA}), no es una oferta. ${req ? 'Requisitos típicos: ' + req + '. ' : ''}${x.nota || ''} Confírmalo por escrito.`;
  }

  // ---------- Agregados ----------
  function filaAgregado(a = {}) {
    const div = document.createElement('div');
    div.className = 'agregado';
    div.innerHTML = `
      <input type="text" class="ag-nombre" maxlength="60" placeholder="Concepto" aria-label="Concepto">
      <input type="number" inputmode="decimal" class="ag-monto" min="0" step="100" placeholder="$" aria-label="Monto">
      <select class="ag-forma" aria-label="Forma de pago"><option value="contado">Contado</option><option value="financiado">Financiado</option></select>
      <button type="button" class="ag-quitar" aria-label="Quitar">×</button>`;
    div.querySelector('.ag-nombre').value = a.nombre || '';
    div.querySelector('.ag-monto').value = a.monto || '';
    div.querySelector('.ag-forma').value = a.financiado ? 'financiado' : 'contado';
    div.querySelector('.ag-quitar').addEventListener('click', () => { div.remove(); render(); });
    contAgregados.appendChild(div);
    return div;
  }

  function leerAgregados() {
    return [...contAgregados.querySelectorAll('.agregado')].map((f) => ({
      nombre: f.querySelector('.ag-nombre').value.trim() || 'Agregado',
      monto: parseFloat(f.querySelector('.ag-monto').value) || 0,
      financiado: f.querySelector('.ag-forma').value === 'financiado',
    }));
  }

  // ---------- Formulario ----------
  function escribir(datos) {
    for (const [k, v] of Object.entries(datos)) {
      const el = form.elements[k];
      if (!el || k === 'institucion' || el instanceof RadioNodeList) continue;
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
    }
    contAgregados.innerHTML = '';
    (datos.agregados || []).forEach(filaAgregado);
    pintarInstituciones(datos.institucion || 'manual');
  }

  function leer() {
    const d = {};
    for (const k of NUMERICOS) d[k] = parseFloat(form.elements[k].value) || 0;
    d.auto = form.elements.auto.value.trim();
    d.institucion = selInst.value;
    d.tipoTasa = form.elements.tipoTasa.value;
    d.aperturaForma = form.elements.aperturaForma.value;
    d.seguroForma = form.elements.seguroForma.value;
    d.ivaIntereses = form.elements.ivaIntereses.checked;
    d.agregados = leerAgregados();
    return d;
  }

  // ---------- Contenido (lo usan la pantalla y el PDF, así nunca difieren) ----------
  function contenido(d) {
    const r = C.cotizar(d);
    const t = r.totales;
    const m = r.mensualidad;
    const inst = buscarInst(d.institucion);
    const nombreInst = inst ? inst.nombre : 'Manual / otra';
    const seguroTxt = { contado: 'de contado cada año', mensual: 'prorrateado mensual', financiado: 'multianual financiado', financiado1: '1er año financiado' }[d.seguroForma];

    const datos = [
      ['Institución', nombreInst],
      ['Precio del vehículo', $(d.precio)],
      d.descuento ? ['Descuento / bono', '-' + $(d.descuento)] : null,
      d.descuento ? ['Precio con descuento', $(r.precioNeto)] : null,
      ['Enganche en efectivo', $(d.enganche)],
      d.autoACuenta ? ['Tu auto a cuenta', $(d.autoACuenta)] : null,
      [`Enganche total (${pct(r.enganchePct)})`, $(r.engancheTotal)],
      ['Monto del auto a financiar', $(r.montoAuto)],
      r.agregadosFinanciados ? ['Agregados financiados', $(r.agregadosFinanciados)] : null,
      r.seguroFinanciado ? ['Seguro financiado', $(r.seguroFinanciado)] : null,
      d.aperturaForma === 'financiada' && r.apertura ? ['Comisión financiada', $(r.apertura)] : null,
      ['Monto total del crédito', $(r.montoFinanciado), 'total'],
      ['Plazo', `${r.plazoMeses} meses`],
      ['Tasa anual', `${pct(d.tasaAnual, 2)} ${d.tipoTasa === 'global' ? 'global' : 'sobre saldo insoluto'}`],
      ['Comisión por apertura', `${pct(d.aperturaPct, 2)} + IVA (${d.aperturaForma === 'contado' ? 'de contado' : 'financiada'})`],
      ['Seguro de auto', d.seguroAnual ? `${$(d.seguroAnual)}/año, ${seguroTxt}` : 'No incluido'],
    ].filter(Boolean);

    const mensualidad = [
      ['Capital + intereses', mxn2.format(m.capitalMasInteres)],
      ['IVA sobre intereses (1er mes)', mxn2.format(m.ivaPrimerMes)],
      ['Pago al banco', mxn2.format(m.credito), 'sub'],
      m.seguro ? ['Seguro de auto prorrateado', mxn2.format(m.seguro)] : null,
      m.vida ? ['Seguro de vida / desempleo', mxn2.format(m.vida)] : null,
      m.otros ? ['Otros cargos', mxn2.format(m.otros)] : null,
      ['Mensualidad real', mxn2.format(m.total), 'total'],
    ].filter(Boolean);

    const conAparte = (d.seguroForma === 'contado' || d.seguroForma === 'financiado1') && r.seguroTotal > 0;
    const apartarSeguro = conAparte ? (r.seguroTotal - r.seguroFinanciado) / r.plazoMeses : 0;
    const notaMensualidad = conAparte
      ? `El seguro se paga aparte una vez al año. Si apartas dinero para él, tu gasto mensual real es de unos ${$(m.total + apartarSeguro)}.`
      : '';

    const desembolso = [
      ['Enganche en efectivo', $(r.desembolso.enganche)],
      r.desembolso.apertura ? ['Comisión por apertura + IVA', $(r.desembolso.apertura)] : null,
      r.desembolso.seguro ? ['Seguro de auto (1er año)', $(r.desembolso.seguro)] : null,
      r.desembolso.agregados ? ['Agregados de contado', $(r.desembolso.agregados)] : null,
      r.desembolso.gastos ? ['Placas, trámites y otros', $(r.desembolso.gastos)] : null,
      ['Efectivo al firmar', $(r.desembolso.total), 'total'],
      d.autoACuenta ? ['Además entregas tu auto', $(d.autoACuenta), 'sub'] : null,
    ].filter(Boolean);

    const costo = [
      ['Precio del auto' + (d.descuento ? ' (con descuento)' : ''), $(r.precioNeto)],
      t.agregados ? ['Agregados y equipamiento', $(t.agregados)] : null,
      ['Intereses', $(t.intereses)],
      t.ivaIntereses ? ['IVA sobre intereses', $(t.ivaIntereses)] : null,
      t.seguroAuto ? [`Seguro de auto (${r.primas.length} años)`, $(t.seguroAuto)] : null,
      t.apertura ? ['Comisión por apertura + IVA', $(t.apertura)] : null,
      t.vida ? ['Seguro de vida / desempleo', $(t.vida)] : null,
      t.otros ? ['Otros cargos mensuales', $(t.otros)] : null,
      t.gastosIniciales ? ['Gastos iniciales', $(t.gastosIniciales)] : null,
      ['Costo total real', $(t.costoTotal), 'total'],
    ].filter(Boolean);

    const tarjetas = [
      ['Mensualidad real', $(m.total), conAparte ? `+ ${$(apartarSeguro)}/mes para el seguro` : ''],
      ['Pagas al firmar', $(r.desembolso.total), ''],
      ['Costo total', $(t.costoTotal), ''],
      ['Costo del crédito', $(t.sobreprecio), `${pct(t.sobreprecioPct, 0)} más que de contado, sin contar seguro`],
      ['CAT estimado (sin IVA)', pct(r.cat * 100), ''],
    ];

    return {
      r, d, inst, nombreInst, datos, mensualidad, notaMensualidad, desembolso, costo, tarjetas,
      agregados: r.agregados.map((a) => [a.nombre, $(a.monto), a.financiado ? 'Financiado' : 'Contado']),
      alertas: alertas(r, inst),
      comparativo: C.compararInstituciones(d, todasInstituciones()),
      escenarios: C.escenarios(d),
      anual: resumenAnual(r),
      fmt: { $, mxn2, pct },
    };
  }

  function alertas(r, inst) {
    const e = r.entrada;
    const a = [];
    if (inst && inst.engancheMinPct && r.enganchePct + 1e-9 < inst.engancheMinPct) {
      a.push(['rojo', `${inst.nombre} pide al menos ${inst.engancheMinPct}% de enganche y llevas ${pct(r.enganchePct)}. Te faltan ${$((inst.engancheMinPct / 100) * r.precioNeto - r.engancheTotal)}.`]);
    }
    if (inst && inst.plazoMax && r.plazoMeses > inst.plazoMax) a.push(['rojo', `${inst.nombre} presta a máximo ${inst.plazoMax} meses.`]);
    if (e.tipoTasa === 'global') {
      a.push(['rojo', `Tasa global: los intereses se calculan sobre el monto original durante todo el plazo, aunque ya hayas pagado capital. Equivale a un CAT cercano a ${pct(r.cat * 100)}.`]);
    }
    if (r.enganchePct < 20) a.push(['rojo', `Tu enganche es ${pct(r.enganchePct)}. Con menos del 20% pasas más tiempo debiendo más de lo que vale el auto.`]);
    if (r.mesesPatrimonioNegativo > 0) {
      a.push(['amarillo', `Durante ${r.mesesPatrimonioNegativo} meses deberás más de lo que vale el auto (con ${e.depreciacionAnualPct}% de depreciación anual). Si lo chocas o lo vendes en ese periodo, pierdes dinero.`]);
    }
    if (r.plazoMeses > 48) a.push(['amarillo', `Plazo de ${r.plazoMeses} meses: al terminar, el auto valdrá aprox. ${$(r.valorFinalAuto)} y habrás pagado ${$(r.totales.costoTotal)}.`]);
    if (r.totales.sobreprecioPct > 30) a.push(['rojo', `Solo por financiarte pagarás ${$(r.totales.sobreprecio)} (${pct(r.totales.sobreprecioPct, 0)} más que de contado), sin contar el seguro.`]);
    if (r.seguroFinanciado > 0) a.push(['amarillo', 'Financiar el seguro te hace pagar intereses sobre la prima. Cotízalo también por fuera: el de la agencia suele ser más caro.']);
    if (r.agregadosFinanciados > 0) a.push(['amarillo', `Financias ${$(r.agregadosFinanciados)} en agregados: los pagarás con intereses durante ${r.plazoMeses} meses, aunque pierden valor más rápido que el auto.`]);
    if (r.pctIngreso !== null) {
      if (r.pctIngreso > 30) a.push(['rojo', `La mensualidad es ${pct(r.pctIngreso)} de tu ingreso. Arriba del 30% es riesgoso y muchos bancos lo rechazan.`]);
      else if (r.pctIngreso > 20) a.push(['amarillo', `La mensualidad es ${pct(r.pctIngreso)} de tu ingreso. Lo sano para un auto es 20% o menos.`]);
      else a.push(['verde', `La mensualidad es ${pct(r.pctIngreso)} de tu ingreso. Está en un rango sano.`]);
    }
    a.push(['info', 'Las tasas "desde" son para el mejor perfil de buró. Pide la tasa, el CAT y la tabla de amortización por escrito antes de firmar.']);
    return a;
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
    if (r.desembolso.seguro) { anios[0].otros += r.desembolso.seguro; anios[0].total += r.desembolso.seguro; }
    return anios;
  }

  // Filas de tablas de varias columnas (también las usa el PDF).
  function filasComparativo(k) {
    return k.comparativo.map((x) => [x.inst.nombre + (x.avisos.length ? ' (!)' : ''), `${x.inst.tasaAnual}%${x.inst.tipoTasa === 'global' ? ' global' : ''}`,
      $(x.r.mensualidad.total), $(x.r.desembolso.total), $(x.r.totales.costoTotal), pct(x.r.cat * 100)]);
  }
  function filasTasas(k) {
    return k.escenarios.porTasa.map((x) => [x.etiqueta, $(x.r.mensualidad.total), $(x.r.totales.intereses + x.r.totales.ivaIntereses), $(x.r.totales.costoTotal), pct(x.r.cat * 100)]);
  }
  function filasPlazos(k) {
    return k.escenarios.plazos.map((x) => [`${x.plazo} meses`, $(x.r.mensualidad.total), $(x.r.totales.intereses + x.r.totales.ivaIntereses),
      $(x.r.totales.costoTotal), String(x.r.mesesPatrimonioNegativo)]);
  }
  function filasAnual(k) {
    return k.anual.map((a, i) => [String(i + 1), $(a.capital), $(a.interes), $(a.iva), $(a.otros), $(a.total), $(a.saldo)]);
  }
  function filasAmortizacion(k) {
    return k.r.tabla.map((f) => [String(f.mes), mxn2.format(f.capital), mxn2.format(f.interes), mxn2.format(f.iva),
      mxn2.format(f.seguro + f.vida + f.otros), mxn2.format(f.pagoTotal), mxn2.format(f.saldo), $(f.valorAuto)]);
  }
  const CAB = {
    comparativo: ['Institución', 'Tasa', 'Mensualidad', 'Al firmar', 'Costo total', 'CAT'],
    tasas: ['Tasa', 'Mensualidad', 'Intereses + IVA', 'Costo total', 'CAT'],
    plazos: ['Plazo', 'Mensualidad', 'Intereses + IVA', 'Costo total', 'Meses debiendo más de lo que vale'],
    anual: ['Año', 'Capital', 'Interés', 'IVA', 'Seguros y otros', 'Pagado en el año', 'Saldo al cierre'],
    amortizacion: ['Mes', 'Capital', 'Interés', 'IVA', 'Seguros y otros', 'Pago total', 'Saldo', 'Valor del auto'],
  };

  // ---------- Pintado en pantalla ----------
  const tabla = (filas) => `<table>${filas.map(([k, v, c = '']) => `<tr class="${c}"><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join('')}</table>`;
  const tablaCols = (cab, filas, clases = []) => `<div class="scroll"><table class="amort"><thead><tr>${cab.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f, i) => `<tr class="${clases[i] || ''}">${f.map((c, j) => `<td class="${j ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  let ultimo = null;

  function render() {
    const d = leer();
    const k = contenido(d);
    const { r } = k;
    notaInstitucion();
    document.getElementById('tabMensualidad').textContent = $(r.mensualidad.total);
    document.getElementById('enganchePct').textContent = d.precio ? `Enganche total: ${pct(r.enganchePct)} del precio` : '';

    const compClases = k.comparativo.map((x) => ['clic', x.inst.id === d.institucion ? 'actual' : '', x.avisos.length ? 'con-aviso' : ''].join(' '));
    const plazoClases = k.escenarios.plazos.map((x) => (x.plazo === r.plazoMeses ? 'actual' : ''));

    out.innerHTML = `
      <div class="acciones acciones-res">
        <button type="button" data-accion="pdf" class="primario">Exportar PDF</button>
        <button type="button" data-accion="compartir">Compartir</button>
      </div>
      ${d.auto ? `<p class="auto-desc">${esc(d.auto)} · ${esc(k.nombreInst)}</p>` : ''}
      <div class="tarjetas">${k.tarjetas.map(([t, v, x], i) => `<div class="tarjeta ${i ? '' : 'principal'}"><span>${t}</span><strong>${v}</strong>${x ? `<em>${x}</em>` : ''}</div>`).join('')}</div>
      <ul class="alertas">${k.alertas.map(([t, m]) => `<li class="alerta ${t}">${esc(m)}</li>`).join('')}</ul>

      <div class="columnas">
        <section><h2>1. Datos del crédito</h2>${tabla(k.datos)}</section>
        <section><h2>2. Tu mensualidad desglosada</h2>${tabla(k.mensualidad)}${k.notaMensualidad ? `<p class="nota">${k.notaMensualidad}</p>` : ''}</section>
        <section><h2>3. Pago inicial</h2>${tabla(k.desembolso)}</section>
        <section><h2>4. Costo total en ${r.plazoMeses} meses</h2>${tabla(k.costo)}</section>
      </div>

      ${k.agregados.length ? `<section><h2>Agregados y equipamiento</h2>${tablaCols(['Concepto', 'Monto', 'Pago'], k.agregados)}</section>` : ''}

      <section id="comparativo">
        <h2>5. Compara instituciones</h2>
        <p class="nota">Mismo auto, enganche y plazo con cada institución, de la más barata a la más cara. (!) = no cumples sus requisitos.
          Los valores precargados son estimados: toca una fila para usarla y ajústala con tu cotización real.</p>
        ${tablaCols(CAB.comparativo, filasComparativo(k), compClases)}
      </section>

      <section>
        <h2>6. Escenarios</h2>
        <h3>Si la tasa real es otra</h3>${tablaCols(CAB.tasas, filasTasas(k))}
        <h3>Si cambias el plazo</h3>${tablaCols(CAB.plazos, filasPlazos(k), plazoClases)}
      </section>

      <section><h2>7. Resumen por año</h2>${tablaCols(CAB.anual, filasAnual(k))}</section>

      <details>
        <summary>8. Tabla de amortización mes por mes</summary>
        ${tablaCols(CAB.amortizacion, filasAmortizacion(k))}
      </details>`;

    out.querySelectorAll('#comparativo tbody tr').forEach((tr, i) => tr.addEventListener('click', () => {
      const id = k.comparativo[i].inst.id;
      selInst.value = id;
      aplicarInstitucion(id);
      render();
      irA('datos');
    }));

    const params = Object.assign({}, d, { agregados: JSON.stringify(d.agregados) });
    history.replaceState(null, '', '?' + new URLSearchParams(Object.entries(params).map(([kk, v]) => [kk, String(v)])).toString());
    ultimo = Object.assign(k, { tablas: { CAB, filasComparativo, filasTasas, filasPlazos, filasAnual, filasAmortizacion } });
  }

  function desdeURL() {
    const p = new URLSearchParams(location.search);
    if (!p.has('precio')) return null;
    const d = {};
    for (const [k, v] of p) d[k] = v === 'true' ? true : v === 'false' ? false : v;
    try {
      d.agregados = JSON.parse(d.agregados || '[]').filter((a) => a && typeof a === 'object').slice(0, 30)
        .map((a) => ({ nombre: String(a.nombre || '').slice(0, 60), monto: +a.monto || 0, financiado: !!a.financiado }));
    } catch { d.agregados = []; }
    return d;
  }

  // ---------- Navegación ----------
  const main = document.querySelector('main');
  function irA(vista) {
    main.dataset.vista = vista;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === vista));
    window.scrollTo({ top: 0 });
  }

  // ---------- Eventos ----------
  escribir(Object.assign({}, EJEMPLO, desdeURL() || {}));

  const chips = document.getElementById('chipsAgregados');
  chips.innerHTML = SUGERENCIAS.map((s) => `<button type="button" class="chip">+ ${s}</button>`).join('');
  chips.querySelectorAll('.chip').forEach((b, i) => b.addEventListener('click', () => {
    filaAgregado({ nombre: SUGERENCIAS[i] }).querySelector('.ag-monto').focus();
  }));
  document.getElementById('nuevoAgregado').addEventListener('click', () => filaAgregado().querySelector('.ag-nombre').focus());

  form.addEventListener('input', (ev) => {
    // Si editas a mano las condiciones de una institución de referencia, ya no es su cotización.
    if (['tasaAnual', 'tipoTasa', 'aperturaPct'].includes(ev.target.name)) {
      const x = buscarInst(selInst.value);
      if (x && !x.propia) selInst.value = 'manual';
    }
    render();
  });
  form.addEventListener('change', (ev) => {
    if (ev.target === selInst) aplicarInstitucion(selInst.value);
    render();
  });

  document.getElementById('guardarInst').addEventListener('click', () => {
    const d = leer();
    const actual = buscarInst(d.institucion);
    const esPropia = actual && actual.propia;
    const nombre = (prompt('Nombre de esta cotización (ej. "BBVA - asesor Juan")', esPropia ? actual.nombre : '') || '').trim();
    if (!nombre) return;
    const nueva = { id: esPropia ? actual.id : 'mia-' + Date.now(), nombre: nombre.slice(0, 50), tipo: 'Mía', propia: true,
      tasaAnual: d.tasaAnual, tipoTasa: d.tipoTasa, aperturaPct: d.aperturaPct, engancheMinPct: 0, plazoMax: 0 };
    guardarPropias([...leerPropias().filter((x) => x.id !== nueva.id), nueva]);
    pintarInstituciones(nueva.id);
    render();
  });
  document.getElementById('borrarInst').addEventListener('click', () => {
    const x = buscarInst(selInst.value);
    if (!x || !x.propia || !confirm(`¿Eliminar "${x.nombre}"?`)) return;
    guardarPropias(leerPropias().filter((y) => y.id !== x.id));
    pintarInstituciones('manual');
    render();
  });

  document.getElementById('ejemplo').addEventListener('click', () => { escribir(EJEMPLO); render(); });

  async function exportarPDF(btn) {
    btn.disabled = true;
    btn.textContent = 'Generando PDF…';
    try {
      await window.ExportarPDF(ultimo);
    } catch (err) {
      console.error(err);
      alert('No se pudo generar el PDF. Si es la primera vez, revisa tu conexión a internet.');
    }
    btn.disabled = false;
    btn.textContent = 'Exportar PDF';
  }

  async function compartir(btn) {
    const r = ultimo.r;
    const texto = `Cotización${ultimo.d.auto ? ' ' + ultimo.d.auto : ''}: mensualidad real ${$(r.mensualidad.total)}, al firmar ${$(r.desembolso.total)}, costo total ${$(r.totales.costoTotal)}.`;
    try {
      if (navigator.share) return await navigator.share({ title: 'Cotización de auto', text: texto, url: location.href });
      await navigator.clipboard.writeText(location.href);
      btn.textContent = '¡Enlace copiado!';
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      btn.textContent = 'Copia la URL del navegador';
    }
    setTimeout(() => (btn.textContent = 'Compartir'), 2000);
  }

  document.getElementById('pdf').addEventListener('click', (ev) => exportarPDF(ev.currentTarget));
  document.getElementById('compartir').addEventListener('click', (ev) => compartir(ev.currentTarget));
  out.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-accion]');
    if (!btn) return;
    if (btn.dataset.accion === 'pdf') exportarPDF(btn);
    if (btn.dataset.accion === 'compartir') compartir(btn);
  });

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
