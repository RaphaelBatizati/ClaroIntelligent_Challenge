import { Shield, Clock } from 'lucide-react'
import PermissaoTable from '../components/PermissaoTable'

const ROLES = [
  {
    titulo: 'Administrador Geral',
    cor: '#E8002A',
    descricao: 'Acesso irrestrito à plataforma. Configura ClaroSense, ajusta personas, exporta dados e gerencia usuários.',
    permissoes: ['Todas as telas', 'Configuração do ClaroSense', 'Ajuste de Personas', 'Exportação de dados', 'Gestão de usuários'],
  },
  {
    titulo: 'Analista de CX',
    cor: '#3B82F6',
    descricao: 'Foco em monitoramento e análise de jornadas. Visualiza atendimentos sem acesso a configurações do sistema.',
    permissoes: ['Dashboard', 'Mapa de Atrito', 'Monitor (visualização)', 'Log ClaroSense (leitura)'],
  },
  {
    titulo: 'Analista de Produto',
    cor: '#8B5CF6',
    descricao: 'Foco no comportamento das personas e métricas de produto. Sem acesso a dados individuais de clientes.',
    permissoes: ['Dashboard', 'Gestão de Personas (edição)', 'Mapa de Atrito'],
  },
  {
    titulo: 'Operações / Atendimento',
    cor: '#10B981',
    descricao: 'Acesso operacional em tempo real. Monitora conversas ativas e visualiza resumo do ClaroSense.',
    permissoes: ['Monitor de Conversas (tempo real)', 'Log ClaroSense (resumo)'],
  },
]

const USERS = [
  { nome: 'Raphael Batizati', iniciais: 'RB', role: 'Administrador Geral', cor: '#E8002A', ultimo: 'Agora', status: 'online' },
  { nome: 'Carlos Mota', iniciais: 'CM', role: 'Analista de CX', cor: '#3B82F6', ultimo: 'há 12 min', status: 'online' },
  { nome: 'Priya Sharma', iniciais: 'PS', role: 'Analista de Produto', cor: '#8B5CF6', ultimo: 'há 2h', status: 'offline' },
  { nome: 'Marcos Henrique', iniciais: 'MH', role: 'Operações / Atendimento', cor: '#10B981', ultimo: 'há 5 min', status: 'online' },
]

function PerfisUsuario() {
  return (
    <div className="space-y-5">
      {/* Role cards */}
      <div className="grid grid-cols-4 gap-4">
        {ROLES.map((role) => (
          <div key={role.titulo} className="bg-white rounded-xl p-5 shadow-sm border-t-4 hover:shadow-md transition-all duration-200" style={{ borderTopColor: role.cor }}>
            <div className="flex items-start gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${role.cor}18` }}>
                <Shield size={15} style={{ color: role.cor }} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-900 leading-tight">{role.titulo}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: `${role.cor}15`, color: role.cor }}>
                  {role.permissoes.length} acessos
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{role.descricao}</p>
            <ul className="space-y-1.5">
              {role.permissoes.map((p) => (
                <li key={p} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: role.cor }} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Permission table */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Matriz de Permissões</h3>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 font-medium">RBAC</span>
        </div>
        <PermissaoTable />
      </div>

      {/* Active users */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Usuários Ativos</h3>
        <div className="grid grid-cols-4 gap-4">
          {USERS.map((u) => (
            <div key={u.nome} className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
              <div className="relative flex-shrink-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{ backgroundColor: u.cor }}
                >
                  {u.iniciais}
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    u.status === 'online' ? 'bg-green-400' : 'bg-gray-300'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-900 truncate">{u.nome}</div>
                <div className="text-[10px] font-medium truncate mt-0.5" style={{ color: u.cor }}>{u.role}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={9} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400">{u.ultimo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PerfisUsuario
