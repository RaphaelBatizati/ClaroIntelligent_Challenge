import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, ChevronDown } from 'lucide-react'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/mapa-atrito': 'Mapa de Atrito',
  '/monitor-conversas': 'Monitor de Conversas',
  '/log-clarosense': 'Log do ClaroSense',
  '/gestao-personas': 'Gestão de Personas',
  '/perfis-usuario': 'Perfis de Usuário',
  '/configuracoes': 'Configurações',
  '/chat': 'Chat do Cliente — Demo Interativo',
}

const PERIODS = ['Últimos 7 dias', 'Últimos 30 dias', 'Últimos 90 dias']

function Topbar() {
  const { pathname } = useLocation()
  const [period, setPeriod] = useState('Últimos 7 dias')
  const [open, setOpen] = useState(false)

  const title = PAGE_TITLES[pathname] || 'Dashboard'

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4 flex-shrink-0 z-10"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {/* Título */}
      <h1 className="flex-1 text-sm font-semibold text-gray-900 truncate">{title}</h1>

      {/* Badge claro. */}
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg border border-red-100 bg-red-50">
        <span className="text-[11px] font-black leading-none" style={{ color: '#E8002A' }}>claro.</span>
        <span className="text-[10px] text-gray-400 font-medium">intelligence</span>
      </div>

      {/* Seletor de período */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium transition-colors"
        >
          {period}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[155px]">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setOpen(false) }}
                className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-gray-50 ${
                  p === period ? 'font-semibold text-[#E8002A]' : 'text-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notificações */}
      <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
        <Bell size={17} className="text-gray-500" />
        <span
          className="absolute top-1 right-1 w-4 h-4 text-white text-[9px] rounded-full flex items-center justify-center font-bold leading-none"
          style={{ backgroundColor: '#E8002A' }}
        >
          3
        </span>
      </button>

      {/* Avatar */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
          style={{ backgroundColor: '#E8002A' }}
        >
          RB
        </div>
        <div className="hidden sm:block">
          <div className="text-xs font-semibold text-gray-900 leading-tight">Raphael Batizati</div>
          <div className="text-[10px] text-gray-400">Administrador</div>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ backgroundColor: '#FFF1F2', color: '#E8002A' }}
        >
          ADMIN
        </span>
      </div>
    </header>
  )
}

export default Topbar
