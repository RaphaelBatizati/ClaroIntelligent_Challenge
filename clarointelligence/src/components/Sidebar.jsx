import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  MessageSquare,
  Brain,
  UserCog,
  Users,
  Settings,
  Activity,
  MessagesSquare,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    title: 'Monitoramento',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Mapa de Atrito', icon: AlertTriangle, path: '/mapa-atrito' },
      { label: 'Monitor de Conversas', icon: MessageSquare, path: '/monitor-conversas' },
    ],
  },
  {
    title: 'Atendimento',
    items: [
      { label: 'Chat do Cliente', icon: MessagesSquare, path: '/chat', badge: 'DEMO' },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { label: 'Log do ClaroSense', icon: Brain, path: '/log-clarosense' },
      { label: 'Gestão de Personas', icon: UserCog, path: '/gestao-personas' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Perfis de Usuário', icon: Users, path: '/perfis-usuario' },
      { label: 'Configurações', icon: Settings, path: '/configuracoes' },
    ],
  },
]

function Sidebar() {
  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #0A1628 0%, #102040 100%)' }}
    >
      {/* ── Logo claro. ──────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        <div>
          <div className="text-2xl font-black leading-none tracking-tight">
            <span style={{ color: '#E8002A' }}>claro</span>
            <span className="text-white">.</span>
          </div>
          <div className="text-[10px] text-white/40 font-semibold tracking-widest uppercase mt-1">
            Intelligence Platform
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div
            className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wide"
            style={{ backgroundColor: 'rgba(232,0,42,0.25)', color: '#FF6B6B' }}
          >
            ENTERPRISE
          </div>
          <div className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wide bg-white/10 text-white/50">
            IA GENERATIVA
          </div>
        </div>
      </div>

      {/* ── Navegação ────────────────────────────────── */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="px-5 mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                {section.title}
              </span>
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2.5 text-xs font-medium transition-all duration-150 border-l-2 ${
                    isActive
                      ? 'text-white bg-white/10 border-l-[#E8002A]'
                      : 'text-white/55 hover:text-white hover:bg-white/5 border-transparent'
                  }`
                }
              >
                <item.icon size={15} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300">{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Rodapé ───────────────────────────────────── */}
      <div className="border-t border-white/10 p-4 flex-shrink-0">
        {/* ClaroSense status */}
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 mb-3 border border-white/5">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-green-400 text-[11px] font-semibold flex-1">ClaroSense ativo</span>
          <Activity size={11} className="text-green-400" />
        </div>

        {/* Usuário logado */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: '#E8002A' }}
          >
            RB
          </div>
          <div className="min-w-0">
            <div className="text-white text-[11px] font-semibold leading-tight truncate">
              Raphael Batizati
            </div>
            <div className="text-white/40 text-[10px]">Administrador</div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-3 pt-3 border-t border-white/5 text-center">
          <span className="text-white/20 text-[9px]">© 2025 Claro Brasil S.A.</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
