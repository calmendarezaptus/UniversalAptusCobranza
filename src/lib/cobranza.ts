import { API_BASE } from './api'

// Cobranza vía aptus_report_services (solo lectura): estado de cuenta por cliente, Prebills facturadas
// con su CFDI y LEDES 1998B por Prebill. Nada de aquí escribe en Aptus ni en Books.
export interface Option { ID: string; display: string; secondary?: string; fotoUrl?: string }

export interface Cliente { id: string; zoho_id?: string; nombre: string; status?: string; moneda?: string }
export interface FacturaEc {
  zoho_invoice_id?: string; numero: string; fecha: string; vence: string; referencia?: string; status: string; moneda: string
  total: number; pagos: number; saldo: number; dias_vencidos: number; folio_cfdi?: string; uuid_cfdi?: string; prebill_id?: number | null
}
export interface Antiguedad { por_vencer: number; d1_30: number; d31_60: number; d61_90: number; mas_90: number }
export interface TotalEc { moneda: string; facturas: number; total: number; pagos: number; saldo: number; antiguedad: Antiguedad }
export interface EstadoCuenta {
  tipo: 'estado_cuenta'; fecha_corte: string; estado: 'pendientes' | 'todas'; rango?: unknown
  cliente: { zoho_id: string; nombre: string; razon_social?: string; rfc?: string; domicilio?: string[]; moneda?: string; creditos_sin_aplicar?: number; saldo_por_cobrar?: number }
  responsable_cobranza?: string; proveedor_cfdi?: string; facturas: FacturaEc[]; totales_por_moneda: TotalEc[]; avisos?: string[]
}

export interface FacturaCfdi {
  prebill_id: number; cliente_id?: string; cliente_nombre: string; zoho_invoice_id?: string
  factura: { numero: string; status: string; total: number; moneda: string; fecha?: string }
  cfdi?: { estado?: string; serie?: string; folio?: string; uuid?: string; total?: number; moneda?: string } | null
  aplica?: boolean; motivo?: string | null; problemas?: { tipo: string; severidad: string; descripcion: string; detalle?: string }[]
}
export interface FacturasCfdi { proveedor: string; solo_pagadas?: boolean; cfdi_cargados_en?: string; facturas: FacturaCfdi[] }

export interface Ledes { formato: string; prebill_id: number; invoice_total: number; lineas: number; filas: Record<string, string>[]; avisos?: string[]; texto: string }

// ── Lectura ──
type Fail = Error & { status?: number }
async function read<T>(org: string, path: string, valid: (d: unknown) => boolean, signal?: AbortSignal): Promise<T> {
  let response: Response
  try { response = await fetch(`${API_BASE}/${encodeURIComponent(org)}/${path}`, { signal }) }
  catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new Error('No hay conexión con el servicio de reportes.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw Object.assign(new Error(typeof data?.error === 'string' ? data.error : 'No se pudo consultar.'), { status: response.status }) as Fail
  if (!valid(data)) throw new Error('Respuesta inesperada del servicio de reportes.')
  return data as T
}
const isObj = (d: unknown): d is Record<string, unknown> => !!d && typeof d === 'object' && !Array.isArray(d)

export const getClientes = (org: string, signal?: AbortSignal) => read<Cliente[]>(org, 'clientes', Array.isArray, signal)

export interface FiltrosEc { cliente_id: string; estado: 'pendientes' | 'todas'; desde: string; hasta: string }
export function queryEstadoCuenta(f: FiltrosEc): string {
  const q = new URLSearchParams({ cliente_id: f.cliente_id })
  if (f.estado === 'todas') q.set('estado', 'todas')
  if (f.desde) q.set('desde', f.desde)
  if (f.hasta) q.set('hasta', f.hasta)
  return q.toString()
}
export function validateEstadoCuenta(f: FiltrosEc): string | null {
  if (!/^\d{1,20}$/.test(f.cliente_id)) return 'Elige el cliente.'
  if (f.desde && f.hasta && f.desde > f.hasta) return 'La fecha inicial es posterior a la final.'
  return null
}
export const getEstadoCuenta = (org: string, f: FiltrosEc, signal?: AbortSignal) =>
  read<EstadoCuenta>(org, `estado-cuenta?${queryEstadoCuenta(f)}`, d => isObj(d) && d.tipo === 'estado_cuenta' && Array.isArray(d.facturas), signal)

export const getFacturasCfdi = (org: string, forzar = false, signal?: AbortSignal) =>
  read<FacturasCfdi>(org, `facturas-cfdi${forzar ? '?forzar=1' : ''}`, d => isObj(d) && Array.isArray(d.facturas), signal)

export interface OpcionesLedes { client_id: string; client_matter_id: string; law_firm_id: string }
const LEDES_ID = /^[\w .,:/-]{1,40}$/
export function validateLedes(prebill: string, o: OpcionesLedes): string | null {
  if (!/^\d{1,10}$/.test(prebill.trim())) return 'Escribe el número de Prebill.'
  for (const [k, label] of [['client_id', 'ID del cliente'], ['client_matter_id', 'Asunto del cliente'], ['law_firm_id', 'ID del despacho']] as const) {
    const v = o[k].trim()
    if (v && !LEDES_ID.test(v)) return `${label}: hasta 40 caracteres, sin símbolos especiales.`
  }
  return null
}
export function queryLedes(o: OpcionesLedes): string {
  const q = new URLSearchParams()
  for (const k of ['client_id', 'client_matter_id', 'law_firm_id'] as const) if (o[k].trim()) q.set(k, o[k].trim())
  const s = q.toString()
  return s ? '?' + s : ''
}
export const getLedes = (org: string, prebill: string, o: OpcionesLedes, signal?: AbortSignal) =>
  read<Ledes>(org, `ledes/${encodeURIComponent(prebill.trim())}${queryLedes(o)}`, d => isObj(d) && typeof d.texto === 'string' && Array.isArray(d.filas), signal)

// ── Presentación ──
export const STATUS_LABEL: Record<string, string> = { paid: 'Pagada', partially_paid: 'Pago parcial', overdue: 'Vencida', sent: 'Enviada', void: 'Anulada', draft: 'Borrador', unpaid: 'Sin pagar' }
export const PROVEEDOR_LABEL: Record<string, string> = { ninguno: 'Sin CFDI', interno: 'Registro interno', creator: 'Zoho Creator' }
export const ANTIGUEDAD: { key: keyof Antiguedad; label: string }[] = [
  { key: 'por_vencer', label: 'Por vencer' }, { key: 'd1_30', label: '1–30 días' }, { key: 'd31_60', label: '31–60 días' },
  { key: 'd61_90', label: '61–90 días' }, { key: 'mas_90', label: 'Más de 90' },
]

export function formatMoney(n: number, moneda?: string) {
  const s = (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return moneda ? `${s} ${moneda}` : s
}
export function formatFecha(iso: string) {
  const [y, m, d] = (iso || '').slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}
export const clienteOptions = (rows: Cliente[]): Option[] =>
  rows.filter(c => c.status !== 'inactive').map(c => ({ ID: String(c.zoho_id ?? c.id), display: c.nombre, secondary: c.moneda }))

const csvCell = (v: unknown) => {
  let s = String(v ?? '')
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function estadoCuentaCsv(ec: EstadoCuenta): string {
  const head = ['Cliente', 'Factura', 'Fecha', 'Vence', 'Días vencidos', 'Estado', 'Moneda', 'Total', 'Pagos', 'Saldo', 'Folio CFDI', 'UUID CFDI', 'Prebill', 'Referencia']
  const rows = ec.facturas.map(f => [ec.cliente.nombre, f.numero, f.fecha, f.vence, f.dias_vencidos, STATUS_LABEL[f.status] ?? f.status, f.moneda, f.total, f.pagos, f.saldo, f.folio_cfdi ?? '', f.uuid_cfdi ?? '', f.prebill_id ?? '', f.referencia ?? ''])
  return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
}

export function descargar(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
// Nombre de archivo seguro (sin / \ : * ? " < > |).
export const archivo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80)
