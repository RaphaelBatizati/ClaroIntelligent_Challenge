import { Brain, Users, TrendingDown, Sliders } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import KPICard from '../components/KPICard'
import ChartCard from '../components/ChartCard'

const intervencoes = [
  { tipo: 'Atendimento humano', valor: 847, cor: '#F59E0B' },
  { tipo: 'Simplificação', valor: 612, cor: '#3B82F6' },
  { tipo: 'Mudança de canal', valor: 489, cor: '#10B981' },
  { tipo: 'Antecipação', valor: 341, cor: '#8B5CF6' },
]

const LOGS = [
  { hora: '14:22', canal: 'WhatsApp', sinal: 'Repetição de intenção', acao: 'Transferência para humano', resultado: 'Resolvido' },
  { hora: '14:19', canal: 'App', sinal: 'Silêncio prolongado', acao: 'Simplificação de fluxo', resultado: 'Resolvido' },
  { hora: '14:16', canal: 'Site', sinal: 'Mudança de canal', acao: 'Recuperação de contexto', resultado: 'Resolvido' },
  { hora: '14:13', canal: 'Call Center', sinal: 'Tom negativo detectado', acao: 'Oferta preventiva', resultado: 'Resolvido' },
  { hora: '14:11', canal: 'WhatsApp', sinal: 'Intenção de cancelamento', acao: 'Especialista de retenção', resultado: 'Retido' },
  { hora: '14:08', canal: 'App', sinal: 'Abandono de funil', acao: 'Gatilho de recuperação', resultado: 'Resolvido' },
  { hora: '14:05', canal: 'Site', sinal: 'Respostas monossilábicas', acao: 'Adaptação de persona', resultado: 'Em andamento' },
  { hora: '14:02', canal: 'WhatsApp', sinal: 'Repetição de intenção', acao: 'Escalamento N2', resultado: 'Resolvido' },
  { hora: '13:58', canal: 'App', sinal: 'Tempo de resolução alto', acao: 'Antecipação de resposta', resultado: 'Resolvido' },
  { hora: '13:55', canal: 'Call Center', sinal: 'NPS negativo previsto', acao: 'Alerta para atendente', resultado: 'Retido' },
  { hora: '13:51', canal: 'Site', sinal: 'Mudança de canal', acao: 'Handoff com contexto', resultado: 'Resolvido' },
  { hora: '13:48', canal: 'WhatsApp', sinal: 'Silêncio prolongado', acao: 'Mensagem proativa', resultado: 'Resolvido' },
]

const CANAL_BADGE = {
  WhatsApp: { bg: '#F0FDF4', color: '#16A34A' },
  App: { bg: '#EFF6FF', color: '#2563EB' },
  Site: { bg: '#F5F3FF', color: '#7C3AED' },
  'Call Center': { bg: '#FFF1F2', color: '#E8002A' },
}

const RESULT_BADGE = {
  Resolvido: { bg: '#F0FDF4', color: '#16A34A' },
  Retido: { bg: '#EFF6FF', color: '#2563EB' },
  'Em andamento': { bg: '#FEF3C7', color: '#D97706' },
}

const CustomTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{payload[0]?.payload?.tipo}</p>
      <p style={{ color: payload[0]?.payload?.cor }}>{payload[0]?.value} intervenções</p>
    </div>
  )
}

function LogClaroSense() {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Intervenções Hoje" value="94" numericValue={94} delta="+7" deltaType="positive" icon={Brain} accentColor="#8B5CF6" />
        <KPICard label="Atendimento Humano Ativado" value="1.243" numericValue={1243} delta="-12,4%" deltaType="positive" icon={Users} accentColor="#F59E0B" subtitle="Redução vs. período anterior" />
        <KPICard label="Churn Evitado (estimado)" value="2.391" numericValue={2391} delta="+23,1%" deltaType="positive" icon={TrendingDown} accentColor="#10B981" />
        <KPICard label="Adaptações Persona Engine" value="19.430" numericValue={19430} delta="+34,8%" deltaType="positive" icon={Sliders} accentColor="#3B82F6" />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Chart */}
        <ChartCard title="Intervenções por Tipo" subtitle="Acumulado no período" className="col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={intervencoes} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="tipo" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTip />} />
              <Bar dataKey="valor" radius={[5, 5, 0, 0]}>
                {intervencoes.map((d, i) => (
                  <Cell key={i} fill={d.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {intervencoes.map((d) => (
              <div key={d.tipo} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: `${d.cor}12` }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.cor }} />
                <span className="text-[10px] text-gray-600 flex-1 truncate">{d.tipo}</span>
                <span className="text-[10px] font-bold" style={{ color: d.cor }}>{d.valor}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Log table */}
        <ChartCard title="Log de Intervenções" subtitle="Tempo real · atualizado a cada 30s" className="col-span-3">
          <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-gray-400 font-semibold">Horário</th>
                  <th className="text-left pb-2 text-gray-400 font-semibold">Canal</th>
                  <th className="text-left pb-2 text-gray-400 font-semibold">Sinal Detectado</th>
                  <th className="text-left pb-2 text-gray-400 font-semibold">Ação Tomada</th>
                  <th className="text-center pb-2 text-gray-400 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {LOGS.map((log, i) => {
                  const canal = CANAL_BADGE[log.canal] || { bg: '#F9FAFB', color: '#6B7280' }
                  const res = RESULT_BADGE[log.resultado] || { bg: '#F9FAFB', color: '#6B7280' }
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 pr-3 font-mono text-gray-400">{log.hora}</td>
                      <td className="py-2.5 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: canal.bg, color: canal.color }}>
                          {log.canal}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">{log.sinal}</td>
                      <td className="py-2.5 pr-3 text-gray-600">{log.acao}</td>
                      <td className="py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: res.bg, color: res.color }}>
                          {log.resultado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

export default LogClaroSense
