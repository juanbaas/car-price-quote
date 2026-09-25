# Cotizador de crédito automotriz

App móvil (PWA) en español para saber cuánto vas a pagar **de verdad** por un auto a crédito en México.
Se instala en el teléfono desde el navegador y funciona sin internet.

## Qué calcula

- Mensualidad desglosada: capital, interés, **IVA sobre intereses (16%)**, seguros y otros cargos.
- **Desembolso inicial**: enganche, comisión por apertura + IVA, primer año de seguro, placas y trámites.
- **Costo total real** y cuánto pagas de más contra el precio de contado.
- **CAT estimado** (sin IVA, como lo publica la banca).
- Tasa **sobre saldo insoluto** (bancos) o **tasa global** (algunas financieras y cajas; mucho más cara).
- Seguro de auto de contado anual, prorrateado o multianual financiado (con intereses).
- Escenarios con otras tasas y plazos, resumen por año y tabla de amortización mes por mes.
- Alertas: enganche bajo, plazos largos, meses en que debes más de lo que vale el auto, % de tu ingreso.
- Compartir la cotización por enlace y exportar a PDF.

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
- `app.js` — interfaz.
- `sw.js` / `manifest.webmanifest` — soporte offline e instalación.

> Estimación informativa. La tasa, comisiones y seguro reales dependen de la institución y de tu buró.
