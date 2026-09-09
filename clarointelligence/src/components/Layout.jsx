import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function Layout() {
  const location = useLocation()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Barra de Marca Claro ─────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 z-20"
        style={{ height: '34px', backgroundColor: '#E8002A' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-black text-xl leading-none tracking-tight">claro.</span>
          <span className="h-4 w-px bg-white/30" />
          <span className="text-white/75 text-[11px] font-semibold tracking-wide">
            ClaroIntelligence™ Platform
          </span>
        </div>
        <div className="flex items-center gap-4 text-white/60 text-[10px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
            Plataforma operacional
          </span>
          <span className="text-white/30">|</span>
          <span>SLA 99,9%</span>
          <span className="text-white/30">|</span>
          <span>v2.4.1</span>
        </div>
      </div>

      {/* ── Layout principal ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0 bg-surface">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Topbar />
          <main key={location.pathname} className="flex-1 overflow-y-auto p-6 animate-fadeIn">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout
