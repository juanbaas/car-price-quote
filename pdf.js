/*
 * Exporta la cotización a PDF con jsPDF + AutoTable (incluidas en /vendor para funcionar sin conexión).
 * Recibe el objeto "contenido" que arma app.js, así el PDF muestra exactamente lo mismo que la pantalla.
 */
(function () {
  const AZUL = [31, 95, 191];
  const GRIS = [91, 100, 112];
  const COLOR_ALERTA = { rojo: [180, 35, 24], amarillo: [138, 90, 0], verde: [28, 122, 62], info: AZUL };

  function cargarScript(src) {
    return new Promise((ok, falla) => {
      if (document.querySelector(`script[src="${src}"]`)) return ok();
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => falla(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function cargarLibrerias() {
    if (!window.jspdf) await cargarScript('vendor/jspdf.umd.min.js');
    if (!window.autoTable) await cargarScript('vendor/jspdf.plugin.autotable.min.js');
  }

  // Helvetica de jsPDF sólo cubre Latin-1: quitamos símbolos que no puede dibujar.
  const limpiar = (t) => String(t).replace(/[−–]/g, '-').replace(/[≈]/g, '~').replace(/[^\x20-\xFF\n]/g, '');

  async function ExportarPDF(k) {
    await cargarLibrerias();
    const { jsPDF } = window.jspdf;
    const autoTable = window.autoTable;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    const M = 40;
    let y = M;

    const espacio = (necesario) => {
      if (y + necesario > alto - 50) { doc.addPage(); y = M; }
    };
    const titulo = (texto, minimo = 90) => {
      espacio(minimo);
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...AZUL).text(limpiar(texto), M, y);
      y += 8;
    };
    const parrafo = (texto, color = GRIS, tam = 9) => {
      doc.setFont('helvetica', 'normal').setFontSize(tam).setTextColor(...color);
      const lineas = doc.splitTextToSize(limpiar(texto), ancho - 2 * M);
      espacio(lineas.length * (tam + 3));
      doc.text(lineas, M, y);
      y += lineas.length * (tam + 3) + 4;
    };
    const base = { margin: { left: M, right: M, bottom: 50 }, styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: AZUL, textColor: 255 }, theme: 'grid' };

    // Tabla concepto / monto con filas de total en negritas.
    const tablaDos = (filas, x, w) => {
      autoTable(doc, {
        ...base,
        theme: 'plain',
        startY: y,
        margin: { left: x },
        tableWidth: w,
        body: filas.map(([a, b]) => [limpiar(a), limpiar(b)]),
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (c) => {
          const clase = filas[c.row.index][2];
          if (clase === 'total') { c.cell.styles.fontStyle = 'bold'; c.cell.styles.lineWidth = { top: 1 }; c.cell.styles.lineColor = 0; }
          if (clase === 'sub') c.cell.styles.textColor = GRIS;
        },
      });
      return doc.lastAutoTable.finalY;
    };
    const tablaCols = (cab, filas, opciones = {}) => {
      if (filas.length <= 15) espacio(filas.length * 18 + 30); // las tablas cortas no se parten
      autoTable(doc, {
        ...base,
        startY: y,
        head: [cab.map(limpiar)],
        body: filas.map((f) => f.map(limpiar)),
        columnStyles: Object.fromEntries(cab.map((_, i) => [i, { halign: i ? 'right' : 'left' }])),
        ...opciones,
      });
      y = doc.lastAutoTable.finalY + 16;
    };

    // Encabezado
    doc.setFillColor(...AZUL).rect(0, 0, ancho, 64, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(255).text('Cotización de crédito automotriz', M, 30);
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFont('helvetica', 'normal').setFontSize(10)
      .text(limpiar([k.d.auto, k.nombreInst, fecha].filter(Boolean).join('  ·  ')), M, 48);
    y = 90;

    // Tarjetas de resumen
    const n = k.tarjetas.length;
    const wT = (ancho - 2 * M - (n - 1) * 6) / n;
    k.tarjetas.forEach(([t, v, extra], i) => {
      const x = M + i * (wT + 6);
      doc.setDrawColor(i ? 221 : AZUL[0], i ? 225 : AZUL[1], i ? 230 : AZUL[2]).setLineWidth(i ? 0.5 : 1.2).roundedRect(x, y, wT, 52, 4, 4);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRIS).text(doc.splitTextToSize(limpiar(t), wT - 12), x + 6, y + 12);
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...(i ? [27, 31, 36] : AZUL)).text(limpiar(v), x + 6, y + 34);
      if (extra) doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...GRIS).text(doc.splitTextToSize(limpiar(extra), wT - 12)[0], x + 6, y + 45);
    });
    y += 70;

    // Alertas
    titulo('Puntos a considerar');
    y += 6;
    k.alertas.forEach(([tipo, m]) => {
      doc.setFont('helvetica', 'normal').setFontSize(9);
      const lineas = doc.splitTextToSize(limpiar(m), ancho - 2 * M - 14);
      espacio(lineas.length * 12 + 4);
      doc.setFillColor(...COLOR_ALERTA[tipo]).rect(M, y - 8, 3, lineas.length * 12, 'F');
      doc.setTextColor(27, 31, 36).text(lineas, M + 10, y);
      y += lineas.length * 12 + 5;
    });
    y += 8;

    // Cuatro bloques en dos columnas
    const wCol = (ancho - 2 * M - 16) / 2;
    const bloque = (izq, der) => {
      espacio(40 + Math.max(izq[1].length, der[1].length) * 17);
      titulo(izq[0]);
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...AZUL).text(limpiar(der[0]), M + wCol + 16, y - 8);
      const inicio = y;
      const fin1 = tablaDos(izq[1], M, wCol);
      y = inicio;
      const fin2 = tablaDos(der[1], M + wCol + 16, wCol);
      y = Math.max(fin1, fin2) + 16;
    };
    bloque(['1. Datos del crédito', k.datos], ['2. Mensualidad desglosada', k.mensualidad]);
    if (k.notaMensualidad) parrafo(k.notaMensualidad);
    bloque(['3. Pago inicial', k.desembolso], [`4. Costo total en ${k.r.plazoMeses} meses`, k.costo]);

    if (k.agregados.length) {
      titulo('Agregados y equipamiento');
      tablaCols(['Concepto', 'Monto', 'Pago'], k.agregados);
    }

    const T = k.tablas;
    titulo('5. Comparativo de instituciones');
    y += 4;
    parrafo('Mismo auto, enganche y plazo. De la más barata a la más cara. (!) = no cumples sus requisitos. Las condiciones precargadas son estimados de referencia, no ofertas.');
    tablaCols(T.CAB.comparativo, T.filasComparativo(k), {
      didParseCell: (c) => {
        if (c.section === 'body' && k.comparativo[c.row.index].inst.id === k.d.institucion) c.cell.styles.fontStyle = 'bold';
      },
    });

    titulo('6. Escenarios: si la tasa real es otra', k.escenarios.porTasa.length * 18 + 60);
    y += 4;
    tablaCols(T.CAB.tasas, T.filasTasas(k));
    titulo('Escenarios: si cambias el plazo', k.escenarios.plazos.length * 18 + 60);
    y += 4;
    tablaCols(T.CAB.plazos, T.filasPlazos(k));

    titulo('7. Resumen por año', k.anual.length * 18 + 60);
    y += 4;
    tablaCols(T.CAB.anual, T.filasAnual(k));

    titulo('8. Tabla de amortización', 160);
    y += 4;
    tablaCols(T.CAB.amortizacion, T.filasAmortizacion(k), { styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5 } });

    // Pie de página en todas las hojas
    const paginas = doc.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GRIS);
      doc.text(limpiar('Estimación informativa. La tasa, comisiones, CAT y seguro reales los define cada institución según tu buró. Pide la tabla de amortización y el CAT por escrito.'),
        M, alto - 24, { maxWidth: ancho - 2 * M - 50 });
      doc.text(`${p} / ${paginas}`, ancho - M, alto - 24, { align: 'right' });
    }

    const nombre = limpiar(`cotizacion-${(k.d.auto || 'auto').split(',')[0]}`).trim().replace(/\s+/g, '-').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ]/g, '').toLowerCase() + '.pdf';
    const blob = doc.output('blob');
    const archivo = new File([blob], nombre, { type: 'application/pdf' });
    // En el teléfono se abre el menú de compartir (WhatsApp, correo, Archivos); si no, se descarga.
    if (navigator.canShare && navigator.canShare({ files: [archivo] }) && matchMedia('(max-width: 900px)').matches) {
      try {
        await navigator.share({ files: [archivo], title: 'Cotización de auto' });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    doc.save(nombre);
  }

  window.ExportarPDF = ExportarPDF;
})();
