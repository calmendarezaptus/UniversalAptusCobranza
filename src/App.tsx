import { useEffect, useState } from 'react'
import 'animate.css'
import { Toaster } from 'sonner'
import { FileCode2, HandCoins, Receipt, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusModal, type StatusModalType } from '@/components/StatusModal'
import { ThemeMenu } from '@/components/ThemeMenu'
import { EstadoCuentaTab, FacturasCfdiTab, LedesTab } from '@/components/CobranzaViews'
import { cn } from '@/lib/utils'
import { CALENDAR_URL } from '@/lib/api'
import { useTheme } from '@/lib/ui'
import { MenuButton } from '@/components/MenuButton'

type Modal = { isOpen: boolean; type: StatusModalType; title: string; message: string }
const TABS = [
  { id: 'estado', label: 'Estado de cuenta', icon: Wallet },
  { id: 'cfdi', label: 'Facturas y CFDI', icon: Receipt },
  { id: 'ledes', label: 'LEDES', icon: FileCode2 },
] as const
type Tab = typeof TABS[number]['id']
const tabInicial = (): Tab => {
  try { const t = localStorage.getItem('cobranza_tab'); return TABS.some(x => x.id === t) ? t as Tab : 'estado' } catch { return 'estado' }
}

function App() {
  const [theme, setTheme] = useTheme()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [statusModal, setStatusModal] = useState<Modal>({ isOpen: false, type: 'info', title: '', message: '' })
  useEffect(() => {
    const orgId = new URLSearchParams(window.location.search).get('organization_id')
    if (!orgId) setStatusModal({ isOpen: true, type: 'error', title: 'Error de Inicialización', message: 'No se detectó la organización relacionada. Es necesario incluir el parámetro "organization_id" en la URL.' })
    else setOrganizationId(orgId)
  }, [])

  const [tab, setTab] = useState<Tab>(tabInicial)
  useEffect(() => { try { localStorage.setItem('cobranza_tab', tab) } catch { /* sin almacenamiento */ } }, [tab])
  const [prebillLedes, setPrebillLedes] = useState('')
  const abrirLedes = (id: number) => { setPrebillLedes(String(id)); setTab('ledes') }

  function handleCancel() {
    const params = new URLSearchParams(window.location.search)
    const org = organizationId || params.get('organization_id') || ''
    try {
      const target = new URL(params.get('origin') || CALENDAR_URL)
      if (!target.searchParams.get('organization_id') && org) target.searchParams.set('organization_id', org)
      target.searchParams.set('_t', Date.now().toString())
      window.location.href = target.toString()
    } catch {
      window.location.href = `${CALENDAR_URL}?organization_id=${encodeURIComponent(org)}&_t=${Date.now()}`
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-2 sm:p-4 lg:p-8 flex justify-center items-start font-sans w-full">
      <Toaster position="top-center" richColors />
      <Card className="w-full bg-gradient-to-b from-[#F5F8FD] to-white border border-slate-200 rounded-[20px] overflow-hidden p-3 sm:p-5 lg:p-8 relative animate__animated animate__fadeIn animate__faster">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-theme-from/5 rounded-full blur-[80px] animate-blob pointer-events-none z-0"></div>
        <div className="absolute top-0 left-0 right-0 h-15 bg-gradient-to-b from-theme-light to-transparent pointer-events-none z-0"></div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-5 lg:mb-6 gap-0 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-theme-from to-theme-to flex items-center justify-center shrink-0 shadow-sm border border-black/5 text-white">
              <HandCoins className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cobranza</h1>
                <ThemeMenu theme={theme} setTheme={setTheme} />
                <MenuButton />
              </div>
              <p className="text-slate-500 text-sm mt-0.5">Estado de cuenta por cliente, facturas con su CFDI y archivo LEDES</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4 lg:mt-0 w-full lg:w-auto">
            <Button variant="outline" type="button" onClick={handleCancel}
              className="flex-1 lg:flex-none h-11 sm:h-12 px-6 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium">
              Regresar
            </Button>
          </div>
        </div>

        <div className="relative z-10 mb-4 -mx-1 overflow-x-auto">
          <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 w-max mx-1" role="tablist" aria-label="Secciones">
            {TABS.map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn('px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all',
                  tab === t.id ? 'bg-white text-theme-text shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-theme-light border border-transparent')}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {organizationId && (
          <div className="relative z-10">
            {/* Estado de cuenta se mantiene montado para no perder el cliente elegido al cambiar de pestaña. */}
            <div hidden={tab !== 'estado'}><EstadoCuentaTab org={organizationId} /></div>
            {tab === 'cfdi' && <FacturasCfdiTab org={organizationId} onLedes={abrirLedes} />}
            {tab === 'ledes' && <LedesTab org={organizationId} prebillInicial={prebillLedes} />}
          </div>
        )}
        <p className="mt-4 text-[11px] text-slate-500 relative z-10">Solo consulta: desde aquí no se escribe en Aptus ni en Books.</p>
      </Card>

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={statusModal.type === 'error' && !organizationId ? undefined : () => setStatusModal(prev => ({ ...prev, isOpen: false }))}
        type={statusModal.type} title={statusModal.title} message={statusModal.message}
      />
    </div>
  )
}

export default App
