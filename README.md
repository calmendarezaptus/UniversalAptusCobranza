# Cobranza

Slate del proyecto Reportes (`ReportsForAptusFinancials`). **Solo consulta.**

- **Estado de cuenta** por cliente: facturas con saldo o todas, fecha de corte, antigüedad de saldos por
  moneda, saldo por cobrar y créditos sin aplicar de Books, responsable de cobranza; CSV.
- **Facturas y CFDI**: Prebills facturadas, estado de la factura en Books y su CFDI (según el proveedor
  configurado en el despacho); "Volver a leer CFDI" pide `forzar=1`.
- **LEDES 1998B** por Prebill: vista previa de las líneas, avisos (códigos UTBMS faltantes) y descarga `.txt`.

Abre con `?organization_id=<org de Books>`; opcional `?origin=` para el botón Regresar.
Variables (opcionales): `VITE_API_BASE_URL` (URL de `aptus_report_services`), `VITE_CALENDAR_URL`.

```bash
npm install
npm test
npm run build   # salida en dist/
```
