import { useState } from 'react'
import { Search } from 'lucide-react'
import ConversaCard from '../components/ConversaCard'
import DrawerConversa from '../components/DrawerConversa'

const CONVERSAS = [
  { id: 1, nome: 'R. Oliveira', iniciais: 'RO', canal: 'WhatsApp', jornada: 'Cancelamento', status: 'Em risco', atrito: 82, tempo: 'há 12 min', ultimaAcao: 'ClaroSense detectou intenção de cancelamento — aguardando especialista de retenção.' },
  { id: 2, nome: 'M. Santos', iniciais: 'MS', canal: 'App', jornada: 'Segunda via', status: 'Em risco', atrito: 74, tempo: 'há 8 min', ultimaAcao: 'Cliente solicitou segunda via 3 vezes — provável atrito de navegação no app.' },
  { id: 3, nome: 'P. Rodrigues', iniciais: 'PR', canal: 'WhatsApp', jornada: 'Suporte técnico', status: 'Em risco', atrito: 68, tempo: 'há 5 min', ultimaAcao: 'Sinal de silêncio prolongado após envio de tutorial — ClaroSense monitorando.' },
  { id: 4, nome: 'T. Mendes', iniciais: 'TM', canal: 'Call Center', jornada: 'Cancelamento', status: 'Em risco', atrito: 77, tempo: 'há 19 min', ultimaAcao: 'Tempo de espera elevado — ClaroSense recomendou oferta preventiva.' },
  { id: 5, nome: 'L. Almeida', iniciais: 'LA', canal: 'Site', jornada: 'Upgrade de plano', status: 'Em risco', atrito: 61, tempo: 'há 3 min', ultimaAcao: 'Abandono de funil detectado na etapa de pagamento — gatilho de recuperação ativado.' },
  { id: 6, nome: 'F. Nascimento', iniciais: 'FN', canal: 'App', jornada: 'Cancelamento', status: 'Em risco', atrito: 71, tempo: 'há 7 min', ultimaAcao: 'Terceiro contato em 24h sem resolução — escalamento prioritário recomendado.' },
  { id: 7, nome: 'C. Barbosa', iniciais: 'CB', canal: 'WhatsApp', jornada: 'Troca de titularidade', status: 'Em risco', atrito: 58, tempo: 'há 14 min', ultimaAcao: 'Documentação incompleta — bot orientando sobre requisitos pendentes.' },
  { id: 8, nome: 'A. Costa', iniciais: 'AC', canal: 'WhatsApp', jornada: 'Cancelamento', status: 'Transferida', atrito: 91, tempo: 'há 4 min', ultimaAcao: 'Transferida para especialista de retenção com histórico completo preservado.' },
  { id: 9, nome: 'B. Ferreira', iniciais: 'BF', canal: 'Site', jornada: 'Segunda via', status: 'Transferida', atrito: 55, tempo: 'há 9 min', ultimaAcao: 'Redirecionada para suporte humano após falha no autoatendimento.' },
  { id: 10, nome: 'K. Lima', iniciais: 'KL', canal: 'App', jornada: 'Suporte técnico', status: 'Transferida', atrito: 49, tempo: 'há 22 min', ultimaAcao: 'Solicitou falar com atendente — transferência realizada com contexto.' },
  { id: 11, nome: 'D. Silva', iniciais: 'DS', canal: 'App', jornada: 'Cancelamento', status: 'Transferida', atrito: 63, tempo: 'há 11 min', ultimaAcao: 'ClaroSense identificou risco de churn — especialista acionado proativamente.' },
  { id: 12, nome: 'G. Souza', iniciais: 'GS', canal: 'WhatsApp', jornada: 'Suporte técnico', status: 'Transferida', atrito: 44, tempo: 'há 16 min', ultimaAcao: 'Problema técnico complexo — encaminhado para nível 2.' },
  { id: 13, nome: 'J. Ferreira', iniciais: 'JF', canal: 'Site', jornada: 'Upgrade de plano', status: 'Resolvida', atrito: 22, tempo: 'há 31 min', ultimaAcao: 'Upgrade concluído com sucesso — CES 6.2/7.' },
  { id: 14, nome: 'N. Carvalho', iniciais: 'NC', canal: 'App', jornada: 'Segunda via', status: 'Resolvida', atrito: 15, tempo: 'há 45 min', ultimaAcao: 'Segunda via enviada automaticamente — cliente confirmou recebimento.' },
  { id: 15, nome: 'H. Pereira', iniciais: 'HP', canal: 'WhatsApp', jornada: 'Contratação', status: 'Resolvida', atrito: 11, tempo: 'há 28 min', ultimaAcao: 'Plano contratado com sucesso — NPS coletado (9/10).' },
  { id: 16, nome: 'I. Castro', iniciais: 'IC', canal: 'Site', jornada: 'Suporte técnico', status: 'Resolvida', atrito: 18, tempo: 'há 52 min', ultimaAcao: 'Problema resolvido via autoatendimento — tutorial contextual eficaz.' },
  { id: 17, nome: 'O. Martins', iniciais: 'OM', canal: 'App', jornada: 'Upgrade de plano', status: 'Resolvida', atrito: 20, tempo: 'há 38 min', ultimaAcao: 'Upgrade aceito após ClaroSense oferecer desconto personalizado.' },
  { id: 18, nome: 'Q. Santos', iniciais: 'QS', canal: 'WhatsApp', jornada: 'Contratação', status: 'Resolvida', atrito: 9, tempo: 'há 67 min', ultimaAcao: 'Contratação realizada — fluxo sem atrito detectado.' },
  { id: 19, nome: 'S. Lima', iniciais: 'SL', canal: 'Site', jornada: 'Segunda via', status: 'Resolvida', atrito: 13, tempo: 'há 41 min', ultimaAcao: 'Autoatendimento bem-sucedido após simplificação de interface pelo ClaroSense.' },
  { id: 20, nome: 'U. Ramos', iniciais: 'UR', canal: 'App', jornada: 'Suporte técnico', status: 'Resolvida', atrito: 25, tempo: 'há 73 min', ultimaAcao: 'Reinicialização remota de equipamento resolveu o problema.' },
  { id: 21, nome: 'V. Dias', iniciais: 'VD', canal: 'WhatsApp', jornada: 'Upgrade de plano', status: 'Resolvida', atrito: 17, tempo: 'há 84 min', ultimaAcao: 'Cliente aceitou novo plano após comparativo personalizado.' },
  { id: 22, nome: 'W. Gomes', iniciais: 'WG', canal: 'Site', jornada: 'Contratação', status: 'Resolvida', atrito: 8, tempo: 'há 90 min', ultimaAcao: 'Contratação digital sem fricção — score de satisfação 9,4/10.' },
  { id: 23, nome: 'X. Freitas', iniciais: 'XF', canal: 'App', jornada: 'Segunda via', status: 'Resolvida', atrito: 14, tempo: 'há 95 min', ultimaAcao: 'Segunda via disponibilizada no app sem necessidade de contato humano.' },
  { id: 24, nome: 'Y. Cruz', iniciais: 'YC', canal: 'WhatsApp', jornada: 'Suporte técnico', status: 'Resolvida', atrito: 21, tempo: 'há 102 min', ultimaAcao: 'Falha de sinal resolvida — técnico agendado com janela de horário confirmada.' },
]

const FILTERS = [
  { label: 'Todos', value: 'todos', count: 24 },
  { label: 'Em risco', value: 'Em risco', count: 7, color: '#EF4444' },
  { label: 'Transferidas', value: 'Transferida', count: 5, color: '#F59E0B' },
  { label: 'Resolvidas', value: 'Resolvida', count: 12, color: '#10B981' },
]

function MonitorConversas() {
  const [filter, setFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const visible = CONVERSAS.filter((c) => {
    const matchFilter = filter === 'todos' || c.status === filter
    const matchSearch = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.jornada.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.value
                  ? 'text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              style={filter === f.value ? { backgroundColor: f.color || '#E8002A' } : {}}
            >
              {f.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === f.value ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente ou jornada..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E8002A]/30 focus:border-[#E8002A] w-52 transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-4">
        {visible.map((c) => (
          <ConversaCard key={c.id} conversa={c} onVerConversa={setSelected} />
        ))}
        {visible.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400 text-sm">
            Nenhuma conversa encontrada.
          </div>
        )}
      </div>

      {/* Drawer */}
      {selected && (
        <DrawerConversa conversa={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

export default MonitorConversas
