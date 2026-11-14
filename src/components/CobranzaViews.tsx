import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Building2, CheckCircle2, Download, FileCode2, Loader2, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/SearchSelect'
import { cn } from '@/lib/utils'
import { inputCls, labelCls } from '@/lib/ui'
import {
  ANTIGUEDAD, archivo, clienteOptions, descargar, estadoCuentaCsv, formatFecha, formatMoney, getClientes, getEstadoCuenta, getFacturasCfdi, getLedes,
  PROVEEDOR_LABEL, STATUS_LABEL, validateEstadoCuenta, validateLedes, type EstadoCuenta, type FacturasCfdi, type FiltrosEc, type Ledes, type OpcionesLedes, type Option,
} from '@/lib/cobranza'

const th = 'py-1.5 pr-3 font-medium text-[11px] text-slate-500'
const num = 'tabular-nums text-right whitespace-nowrap'
const box = 'border border-slate-200 rounded-xl bg-white p-3 sm:p-4'
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
const aborted = (e: unknown) => (e as Error)?.name === 'AbortError'

function Aviso({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'warn' }) {
  return <p role="alert" className={cn('text-xs rounded-lg border p-2 flex items-start gap-1.5', tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>
    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{children}</p>
}
const statusCls = (s: string) => s === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' : s === 'paid' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
const Status = ({ s }: { s: string }) => <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5 border whitespace-nowrap', statusCls(s))}>{STATUS_LABEL[s] ?? s}</span>

// ── Estado de cuenta ──
export function EstadoCuentaTab({ org }: { org: string }) {
  const [clientes, setClientes] = useState<{ rows: Option[]; loading: boolean; error: string }>({ rows: [], loading: false, error: '' })
  const loadClientes = async () => {
    setClientes(s => ({ ...s, loading: true, error: '' }))
    try { setClientes({ rows: clienteOptions(await getClientes(org)), loading: false, error: '' }) }
    catch (e) { setClientes({ rows: [], loading: false, error: errMsg(e, 'No se pudieron cargar los clientes.') }) }
  }
  useEffect(() => { void loadClientes() }, [org]) // eslint-disable-line react-hooks/exhaustive-deps

  const [f, setF] = useState<FiltrosEc>({ cliente_id: '', estado: 'pendientes', desde: '', hasta: '' })
  const error = f.cliente_id ? validateEstadoCuenta(f) : null
  const [ec, setEc] = useState<EstadoCuenta | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const ctrl = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!f.cliente_id || validateEstadoCuenta(f)) return
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c
    setLoading(true); setLoadError('')
    getEstadoCuenta(org, f, c.signal)
      .then(r => { if (!c.signal.aborted) { setEc(r); setLoading(false) } })
      .catch(e => { if (!aborted(e) && !c.signal.aborted) { setLoading(false); setLoadError(errMsg(e, 'No se pudo cargar el estado de cuenta.')) } })
    return () => c.abort()
  }, [org, f])

  const mostrado = ec && ec.cliente.zoho_id === f.cliente_id ? ec : null
  return (
    <div className="space-y-4">
      <div className={cn(box, 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_160px_160px] gap-3 items-end')}>
        <SearchSelect label="Cliente" icon={<Building2 className="w-3.5 h-3.5 text-slate-400" />} options={clientes.rows} value={f.cliente_id}
          onChange={id => setF(x => ({ ...x, cliente_id: id }))} loading={clientes.loading} placeholder="Elegir cliente" searchPlaceholder="Buscar cliente..."
          emptyText="No se encontraron clientes." onRefresh={() => void loadClientes()} allowClear={false} />
        <div className="space-y-2"><span className={cn(labelCls, 'block ml-1')}>Facturas</span>
          <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 w-max" role="radiogroup" aria-label="Facturas">
            {(['pendientes', 'todas'] as const).map(v => (
              <button key={v} type="button" role="radio" aria-checked={f.estado === v} onClick={() => setF(x => ({ ...x, estado: v }))}
                className={cn('px-3 h-7 text-xs font-semibold rounded-md border', f.estado === v ? 'bg-white text-theme-text shadow-sm border-slate-200' : 'text-slate-500 border-transparent hover:bg-theme-light')}>
                {v === 'pendientes' ? 'Con saldo' : 'Todas'}</button>
            ))}
          </div>
        </div>
        <label className="space-y-2"><span className={cn(labelCls, 'block ml-1')}>Desde (fecha factura)</span>
          <Input type="date" className={inputCls} value={f.desde} onChange={e => setF(x => ({ ...x, desde: e.target.value }))} /></label>
        <label className="space-y-2"><span className={cn(labelCls, 'block ml-1')}>Fecha de corte</span>
          <Input type="date" className={inputCls} value={f.hasta} onChange={e => setF(x => ({ ...x, hasta: e.target.value }))} /></label>
      </div>
      {clientes.error && <Aviso>{clientes.error}</Aviso>}
      {error && <Aviso>{error}</Aviso>}
      {loadError && <Aviso>{loadError}</Aviso>}
      {!f.cliente_id && <p className="text-sm text-slate-500">Elige un cliente para ver su estado de cuenta.</p>}
      {loading && <p role="status" className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-theme-text" />Consultando Books…</p>}
      {mostrado && (
        <div className={cn('space-y-4 transition-opacity', loading && 'opacity-50')}>
          <div className={cn(box, 'flex flex-wrap justify-between gap-3')}>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{mostrado.cliente.razon_social || mostrado.cliente.nombre}</p>
              <p className="text-xs text-slate-500">{[mostrado.cliente.rfc, ...(mostrado.cliente.domicilio ?? [])].filter(Boolean).join(' · ')}</p>
              <p className="text-xs text-slate-500 mt-1">Responsable de cobranza: <span className="text-slate-700">{mostrado.responsable_cobranza || 'sin asignar'}</span> · Corte {formatFecha(mostrado.fecha_corte)}</p>
            </div>
            <div className="flex gap-4 text-right">
              {mostrado.cliente.saldo_por_cobrar != null && <div><p className="text-[11px] text-slate-500">Saldo por cobrar (Books)</p><p className="text-lg font-bold tabular-nums">{formatMoney(mostrado.cliente.saldo_por_cobrar, mostrado.cliente.moneda)}</p></div>}
              {!!mostrado.cliente.creditos_sin_aplicar && <div><p className="text-[11px] text-slate-500">Créditos sin aplicar</p><p className="text-lg font-bold tabular-nums text-emerald-700">{formatMoney(mostrado.cliente.creditos_sin_aplicar, mostrado.cliente.moneda)}</p></div>}
            </div>
          </div>

          {mostrado.totales_por_moneda.map(t => {
            const max = Math.max(...ANTIGUEDAD.map(a => t.antiguedad[a.key]), 0)
            return (
              <div key={t.moneda} className={box}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <p className="text-sm font-semibold text-slate-800">{t.moneda} · {t.facturas} factura(s)</p>
                  <p className="text-xs text-slate-500">Total {formatMoney(t.total)} · pagado {formatMoney(t.pagos)} · <span className="font-semibold text-slate-900 text-sm">saldo {formatMoney(t.saldo, t.moneda)}</span></p>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {ANTIGUEDAD.map((a, i) => {
                    const v = t.antiguedad[a.key]
                    return (
                      <div key={a.key} className="min-w-0">
                        <div className="h-16 flex items-end bg-slate-50 rounded border border-slate-100">
                          <div className={cn('w-full rounded-b', i === 0 ? 'bg-emerald-400' : i < 3 ? 'bg-amber-400' : 'bg-red-400')} style={{ height: max ? `${Math.max(4, (v / max) * 100)}%` : '0%', opacity: v ? 1 : 0 }} />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500 truncate">{a.label}</p>
                        <p className="text-xs font-semibold tabular-nums truncate">{formatMoney(v)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className={box}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-slate-800">Facturas ({mostrado.facturas.length})</h2>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-slate-200" disabled={!mostrado.facturas.length}
                onClick={() => descargar(`Estado de cuenta ${archivo(mostrado.cliente.nombre)} ${mostrado.fecha_corte}.csv`, estadoCuentaCsv(mostrado))}><Download className="w-3.5 h-3.5" />CSV</Button>
            </div>
            {!mostrado.facturas.length ? <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Sin facturas {f.estado === 'pendientes' ? 'con saldo' : 'en el rango'}.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-xs">
                  <thead><tr className="text-left border-b border-slate-200">
                    <th className={th}>Factura</th><th className={th}>Fecha</th><th className={th}>Vence</th><th className={cn(th, 'text-right')}>Días vencida</th>
                    <th className={cn(th, 'text-right')}>Total</th><th className={cn(th, 'text-right')}>Pagos</th><th className={cn(th, 'text-right')}>Saldo</th><th className={th}>CFDI</th><th className={th}>Estado</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {mostrado.facturas.map(x => (
                      <tr key={x.zoho_invoice_id ?? x.numero}>
                        <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{x.numero}{x.prebill_id ? <span className="block text-[10px] text-slate-500 font-normal">Prebill #{x.prebill_id}</span> : null}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{formatFecha(x.fecha)}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{formatFecha(x.vence)}</td>
                        <td className={cn(num, 'py-1.5 pr-3', x.dias_vencidos > 90 ? 'text-red-700 font-semibold' : x.dias_vencidos > 0 ? 'text-amber-700' : '')}>{x.dias_vencidos > 0 ? x.dias_vencidos : '—'}</td>
                        <td className={cn(num, 'py-1.5 pr-3')}>{formatMoney(x.total)} <span className="text-[10px] text-slate-500">{x.moneda}</span></td>
                        <td className={cn(num, 'py-1.5 pr-3')}>{formatMoney(x.pagos)}</td>
                        <td className={cn(num, 'py-1.5 pr-3 font-semibold')}>{formatMoney(x.saldo)}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{x.folio_cfdi || <span className="text-slate-400">—</span>}</td>
                        <td className="py-1.5"><Status s={x.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {mostrado.avisos?.map(a => <p key={a} className="mt-2 text-[11px] text-amber-800">• {a}</p>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Prebills facturadas y su CFDI ──
export function FacturasCfdiTab({ org, onLedes }: { org: string; onLedes: (prebillId: number) => void }) {
  const [data, setData] = useState<FacturasCfdi | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const load = async (forzar = false) => {
    setLoading(true); setError('')
    try { setData(await getFacturasCfdi(org, forzar)) } catch (e) { setError(errMsg(e, 'No se pudieron cargar las facturas.')) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [org]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => {
    const words = texto.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (data?.facturas ?? []).filter(x => words.every(w => `${x.cliente_nombre} ${x.factura.numero} ${x.prebill_id} ${x.cfdi?.uuid ?? ''}`.toLowerCase().includes(w)))
  }, [data, texto])
  const conProblema = (data?.facturas ?? []).filter(x => x.problemas?.length).length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {data ? <>CFDI desde <span className="font-semibold text-slate-700">{PROVEEDOR_LABEL[data.proveedor] ?? data.proveedor}</span>{data.solo_pagadas ? ' · solo cuentan las facturas pagadas' : ''}{conProblema ? ` · ${conProblema} con algo que revisar` : ''}</> : ' '}
        </p>
        <div className="flex gap-2 items-center">
          <div className="relative w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input className={cn(inputCls, 'pl-8')} placeholder="Buscar cliente o factura" value={texto} onChange={e => setTexto(e.target.value)} aria-label="Buscar factura" />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-200" disabled={loading} onClick={() => void load(true)}><RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Volver a leer CFDI</Button>
        </div>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {loading && !data && <p role="status" className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-theme-text" />Cargando…</p>}
      {data && (
        <div className={cn(box, 'overflow-x-auto')}>
          {!rows.length ? <p className="text-sm text-slate-500">{data.facturas.length ? 'Ninguna factura coincide.' : 'Todavía no hay Prebills facturadas.'}</p> : (
            <table className="w-full min-w-[860px] text-xs">
              <thead><tr className="text-left border-b border-slate-200">
                <th className={th}>Prebill</th><th className={th}>Cliente</th><th className={th}>Factura</th><th className={cn(th, 'text-right')}>Total</th><th className={th}>CFDI</th><th className={th}>Qué revisar</th><th className={th}></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(x => (
                  <tr key={x.prebill_id} className="align-top">
                    <td className="py-1.5 pr-3 font-medium">#{x.prebill_id}</td>
                    <td className="py-1.5 pr-3">{x.cliente_nombre}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{x.factura.numero} <Status s={x.factura.status} />{x.factura.fecha && <span className="block text-[10px] text-slate-500">{formatFecha(x.factura.fecha)}</span>}</td>
                    <td className={cn(num, 'py-1.5 pr-3')}>{formatMoney(x.factura.total)} <span className="text-[10px] text-slate-500">{x.factura.moneda}</span></td>
                    <td className="py-1.5 pr-3">
                      {x.cfdi ? <><span className="font-medium">{[x.cfdi.serie, x.cfdi.folio].filter(Boolean).join('-') || 'Registrado'}</span> <span className="text-[10px] text-slate-500">{x.cfdi.estado}</span>
                        {x.cfdi.uuid && <span className="block text-[10px] text-slate-500 break-all">{x.cfdi.uuid}</span>}</>
                        : x.aplica === false ? <span className="text-slate-500" title={x.motivo ?? ''}>Aún no aplica</span> : <span className="text-amber-700">Sin CFDI</span>}
                    </td>
                    <td className="py-1.5 pr-3 max-w-[280px]">
                      {x.aplica === false && x.motivo && <span className="block text-[11px] text-slate-500">{x.motivo}</span>}
                      {x.problemas?.map(p => <span key={p.tipo} className={cn('block text-[11px]', p.severidad === 'error' ? 'text-red-700' : 'text-amber-800')}>{p.descripcion}{p.detalle ? ` (${p.detalle})` : ''}</span>)}
                    </td>
                    <td className="py-1.5"><Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 border-slate-200" onClick={() => onLedes(x.prebill_id)}><FileCode2 className="w-3 h-3" />LEDES</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <p className="text-[11px] text-slate-500">El CFDI se registra en Aptus o en Zoho Creator según la configuración del despacho; aquí solo se consulta.</p>
    </div>
  )
}

// ── LEDES 1998B ──
const COLS: [string, string][] = [['LINE_ITEM_NUMBER', '#'], ['EXP/FEE/INV_ADJ_TYPE', 'Tipo'], ['LINE_ITEM_DATE', 'Fecha'], ['TIMEKEEPER_NAME', 'Abogado'], ['LINE_ITEM_TASK_CODE', 'Tarea'],
  ['LINE_ITEM_EXPENSE_CODE', 'Gasto'], ['LINE_ITEM_DESCRIPTION', 'Descripción'], ['LINE_ITEM_NUMBER_OF_UNITS', 'Unidades'], ['LINE_ITEM_UNIT_COST', 'Costo'], ['LINE_ITEM_ADJUSTMENT_AMOUNT', 'Ajuste'], ['LINE_ITEM_TOTAL', 'Total']]
const RIGHT = new Set(['LINE_ITEM_NUMBER_OF_UNITS', 'LINE_ITEM_UNIT_COST', 'LINE_ITEM_ADJUSTMENT_AMOUNT', 'LINE_ITEM_TOTAL'])
const ledesFecha = (s: string) => /^\d{8}$/.test(s) ? `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}` : s

export function LedesTab({ org, prebillInicial }: { org: string; prebillInicial: string }) {
  const [prebill, setPrebill] = useState(prebillInicial)
  const [o, setO] = useState<OpcionesLedes>({ client_id: '', client_matter_id: '', law_firm_id: '' })
  const [ledes, setLedes] = useState<Ledes | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const invalid = validateLedes(prebill, o)
  const generar = async (p = prebill) => {
    if (validateLedes(p, o)) return
    setLoading(true); setError('')
    try { setLedes(await getLedes(org, p, o)) } catch (e) { setLedes(null); setError(errMsg(e, 'No se pudo armar el LEDES.')) } finally { setLoading(false) }
  }
  useEffect(() => { setPrebill(prebillInicial); if (prebillInicial) void generar(prebillInicial) }, [prebillInicial]) // eslint-disable-line react-hooks/exhaustive-deps
  const factura = ledes?.filas[0]?.INVOICE_NUMBER
  return (
    <div className="space-y-4">
      <form className={cn(box, 'grid grid-cols-2 lg:grid-cols-[120px_repeat(3,minmax(0,1fr))_auto] gap-3 items-end')} onSubmit={e => { e.preventDefault(); void generar() }}>
        <label className="space-y-1"><span className={labelCls}>Prebill</span>
          <Input inputMode="numeric" className={inputCls} placeholder="Ej. 3" value={prebill} onChange={e => setPrebill(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="space-y-1"><span className={labelCls}>ID del cliente (opcional)</span>
          <Input className={inputCls} placeholder="Por omisión: ID de Books" value={o.client_id} onChange={e => setO(x => ({ ...x, client_id: e.target.value }))} /></label>
        <label className="space-y-1"><span className={labelCls}>Asunto del cliente (opcional)</span>
          <Input className={inputCls} placeholder="CLIENT_MATTER_ID" value={o.client_matter_id} onChange={e => setO(x => ({ ...x, client_matter_id: e.target.value }))} /></label>
        <label className="space-y-1"><span className={labelCls}>ID del despacho (opcional)</span>
          <Input className={inputCls} placeholder="Por omisión: RFC o nombre" value={o.law_firm_id} onChange={e => setO(x => ({ ...x, law_firm_id: e.target.value }))} /></label>
        <Button type="submit" className="h-9 col-span-2 lg:col-span-1" disabled={!!invalid || loading}>{loading ? 'Armando…' : 'Generar'}</Button>
      </form>
      {prebill && invalid && <Aviso>{invalid}</Aviso>}
      {error && <Aviso>{error}</Aviso>}
      {ledes && (
        <div className={cn('space-y-3 transition-opacity', loading && 'opacity-50')}>
          <div className={cn(box, 'flex flex-wrap items-center justify-between gap-3')}>
            <div>
              <p className="text-sm font-semibold text-slate-800">Prebill #{ledes.prebill_id}{factura ? ` · ${factura}` : ''}</p>
              <p className="text-xs text-slate-500">{ledes.lineas} línea(s) · INVOICE_TOTAL {formatMoney(ledes.invoice_total)} (sin impuestos)</p>
            </div>
            <Button className="h-9 gap-1.5" onClick={() => descargar(`LEDES ${archivo(factura || 'Prebill ' + ledes.prebill_id)}.txt`, ledes.texto, 'text/plain;charset=utf-8')}><Download className="w-4 h-4" />Descargar .txt</Button>
          </div>
          {ledes.avisos?.map(a => <Aviso key={a} tone="warn">{a}</Aviso>)}
          <div className={cn(box, 'overflow-x-auto')}>
            <table className="w-full min-w-[900px] text-xs">
              <thead><tr className="text-left border-b border-slate-200">{COLS.map(([k, l]) => <th key={k} className={cn(th, RIGHT.has(k) && 'text-right')}>{l}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {ledes.filas.map((r, i) => (
                  <tr key={i} className="align-top">
                    {COLS.map(([k]) => <td key={k} className={cn('py-1.5 pr-3', RIGHT.has(k) && num, k === 'LINE_ITEM_DESCRIPTION' && 'max-w-[280px] break-words')}>
                      {k === 'LINE_ITEM_DATE' ? ledesFecha(r[k] ?? '') : (r[k] || <span className="text-slate-300">—</span>)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-[11px] text-slate-500">LEDES 1998B: una línea por tiempo, honorario fijo y gasto; el descuento de la Prebill se reparte en el ajuste de cada línea de honorarios.</p>
    </div>
  )
}
