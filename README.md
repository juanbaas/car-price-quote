# Cotizador de crédito automotriz

App móvil (PWA) en español para saber cuánto vas a pagar **de verdad** por un auto a crédito en México.
Se instala en el teléfono desde el navegador y funciona sin internet.

## Qué calcula

- Mensualidad desglosada: capital, interés, **IVA sobre intereses (16%)**, seguros y otros cargos.
- **Pago inicial**: enganche, comisión por apertura + IVA, primer año de seguro, agregados de contado, placas y trámites.
- **Costo total real** y **costo del crédito** (lo que pagas de más por financiarte, sin contar el seguro).
- **CAT estimado** (sin IVA, como lo publica la banca).
- **Institución**: condiciones de referencia por banco, caja y financiera (tasa, tipo de tasa, apertura,
  enganche mínimo, plazo máximo). Son *estimados*: guarda tu cotización real por institución en el teléfono.
- **Comparativo de instituciones** con el mismo auto, ordenado de la más barata a la más cara.
- Tasa **sobre saldo insoluto** (bancos) o **tasa global** (mucho más cara).
- **Seguro de auto**: de contado cada año, prorrateado, 1er año financiado o multianual financiado.
- **Agregados y equipamiento** (polarizado, GPS, garantía extendida, etc.), cada uno de contado o financiado.
- **Descuento** del vendedor y **auto a cuenta** del enganche.
- Escenarios con otras tasas y plazos, resumen por año y tabla de amortización mes por mes.
- Alertas: enganche bajo o por debajo del mínimo del banco, plazos largos, meses en que debes más de lo que vale el auto, % de tu ingreso.
- **Exportar a PDF** (en el teléfono se abre el menú para enviarlo por WhatsApp o correo) y compartir la cotización por enlace.

## Instalar en el teléfono

1. Publica el sitio (ver abajo) y abre la URL en el teléfono.
2. **Android (Chrome):** menú ⋮ → *Instalar app* (o el botón "Instalar app" dentro de la app).
3. **iPhone (Safari):** botón Compartir → *Agregar a pantalla de inicio*.

## Publicar

El workflow `.github/workflows/pages.yml` publica en GitHub Pages en cada push a `main`.
Actívalo una vez en *Settings → Pages → Source: GitHub Actions*.

## Desarrollo

Sin dependencias ni compilación.

```bash
npm test        # pruebas del motor de cálculo
npm start       # servidor local en http://localhost:8080
```

- `calc.js` — motor de cálculo (puro, reutilizable en React Native si algún día se hace app nativa).
- `instituciones.js` — condiciones de referencia por institución (edítalas aquí).
- `app.js` — interfaz.
- `pdf.js` — exportación a PDF con jsPDF + AutoTable (MIT), incluidas en `vendor/` para funcionar sin conexión.
- `sw.js` / `manifest.webmanifest` — soporte offline e instalación.

> Estimación informativa. La tasa, comisiones y seguro reales dependen de la institución y de tu buró.
