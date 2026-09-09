import { Check, X } from 'lucide-react'

const ROLES = [
  { nome: 'Administrador Geral', cor: '#E8002A', abbr: 'ADMIN' },
  { nome: 'Analista de CX', cor: '#3B82F6', abbr: 'CX' },
  { nome: 'Analista de Produto', cor: '#8B5CF6', abbr: 'PROD' },
  { nome: 'Operações / Atendimento', cor: '#10B981', abbr: 'OPS' },
]

const FEATURES = [
  { label: 'Dashboard', perms: [true, true, true, false] },
  { label: 'Mapa de Atrito', perms: [true, true, true, false] },
  { label: 'Monitor de Conversas', perms: [true, true, false, true] },
  { label: 'Log do ClaroSense (completo)', perms: [true, true, false, false] },
  { label: 'Log do ClaroSense (resumo)', perms: [true, true, false, true] },
  { label: 'Gestão de Personas', perms: [true, false, true, false] },
  { label: 'Perfis de Usuário', perms: [true, false, false, false] },
  { label: 'Configurações do sistema', perms: [true, false, false, false] },
  { label: 'Exportação de dados', perms: [true, false, false, false] },
]

function Tick({ ok }) {
  return ok ? (
    <div className="flex justify-center">
      <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center">
        <Check size={13} className="text-green-600" strokeWidth={2.5} />
      </div>
    </div>
  ) : (
    <div className="flex justify-center">
      <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center">
        <X size={12} className="text-red-400" strokeWidth={2.5} />
      </div>
    </div>
  )
}

function PermissaoTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-5 py-3 font-semibold text-gray-600 w-56">Funcionalidade</th>
            {ROLES.map((role) => (
              <th key={role.abbr} className="px-4 py-3 text-center">
                <span
                  className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: role.cor }}
                >
                  {role.abbr}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((feat, i) => (
            <tr
              key={feat.label}
              className={`border-b border-gray-50 transition-colors hover:bg-gray-50/50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
            >
              <td className="px-5 py-3 text-gray-700 font-medium">{feat.label}</td>
              {feat.perms.map((ok, pi) => (
                <td key={pi} className="px-4 py-3">
                  <Tick ok={ok} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PermissaoTable
