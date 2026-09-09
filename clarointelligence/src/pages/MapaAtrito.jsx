import { AlertTriangle, TrendingUp, Flame } from 'lucide-react'
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

const atritionData = [
  { jornada: 'Cancelamento', atrito: 55 },
  { jornada: 'Troca de titularidade', atrito: 42 },
  { jornada: 'Segunda via', atrito: 38 },
  { jornada: 'Suporte técnico', atrito: 31 },
  { jornada: 'Upgrade de plano', atrito: 24 },
  { jornada: 'Contratação', atrito: 18 },
]

const sinais = [
  { sinal: 'Repetição de intenção', qtd: 4218, cor: '#EF4444' },
  { sinal: 'Mudança de canal', qtd: 3102, cor: '#F59E0B' },
  { sinal: 'Silêncio prolongado', qtd: 2441, cor: '#8B5CF6' },
  { sinal: 'Respostas monossilábicas', qtd: 1671, cor: '#6B7280' },
]

const CANAIS = ['WhatsApp', 'App', 'Site', 'Call Center']
const JORNADAS = ['Cancelamento', 'Troca titularidade', 'Segunda via', 'Suporte técnico', 'Upgrade', 'Contratação']

const HEAT = [
  [65, 45, 38, 78],
  [35, 28, 22, 55],
  [25, 18, 32, 45],
  [28, 22, 35, 40],
  [18, 14, 16, 28],
  [12, 10, 15, 22],
]

function heatColor(v) {
  if (v >= 50) return '#FEE2E2'
  if (v >= 35) return '#FEF3C7'
  if (v >= 20) return '#D1FAE5'
  return '#F0FDF4'
}
function heatTextColor(v) {
  if (v >= 50) return '#B91C1C'
  if (v >= 35) return '#92400E'
  if (v >= 20) return '#065F46'
  return '#14532D'
}
function barColor(v) {
  if (v >= 40) return '#EF4444'
  if (v >= 25) return '#F59E0B'
  return '#10B981'
}

const CustomTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700">{payload[0]?.payload?.jornada}</p>
      <p className="mt-1" style={{ color: barColor(payload[0]?.value) }}>
        Índice de atrito: {payload[0]?.value}%
      </p>
    </div>
  )
}

function MapaAtrito() {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Pontos de Atrito Detectados" value="11.432" numericValue={11432} delta="-8,3%" deltaType="positive" icon={AlertTriangle} accentColor="#EF4444" />
        <KPICard label="Taxa de Recuperação" value="84,1%" numericValue={84} delta="+6,1%" deltaType="positive" icon={TrendingUp} accentColor="#10B981" />
        <KPICard label="Jornada Crítica" value="Cancelamento" icon={Flame} accentColor="#F59E0B" subtitle="Índice de atrito: 55%" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Horizontal bar */}
        <ChartCard title="Índice de Atrito por Jornada" subtitle="Escala 0–100 · Verde &lt;25% · Âmbar 25–40% · Vermelho &gt;40%">
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={atritionData} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" domain={[0, 70]} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="jornada" width={145} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTip />} />
              <Bar dataKey="atrito" radius={[0, 5, 5, 0]}>
                {atritionData.map((d, i) => (
                  <Cell key={i} fill={barColor(d.atrito)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Sinais */}
        <ChartCard title="Sinais de Atrito Detectados" subtitle="Total acumulado no período">
          <div className="space-y-3">
            {sinais.map((s) => (
              <div key={s.sinal} className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-gray-700">{s.sinal}</span>
                  <span className="text-sm font-bold" style={{ color: s.cor }}>
                    {s.qtd.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${(s.qtd / 4500) * 100}%`, backgroundColor: s.cor }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
              <div className="text-xs font-bold" style={{ color: '#B91C1C' }}>Alta</div>
              <div className="text-[10px] text-red-400">&gt; 40%</div>
            </div>
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
              <div className="text-xs font-bold" style={{ color: '#92400E' }}>Média</div>
              <div className="text-[10px] text-amber-400">25–40%</div>
            </div>
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
              <div className="text-xs font-bold" style={{ color: '#065F46' }}>Baixa</div>
              <div className="text-[10px] text-green-500">&lt; 25%</div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Heat map */}
      <ChartCard title="Mapa de Calor — Canal × Jornada" subtitle="Intensidade do atrito por cruzamento de canal e jornada">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-3 pr-4 text-gray-400 font-medium w-40">Jornada</th>
                {CANAIS.map((c) => (
                  <th key={c} className="pb-3 px-2 text-center text-gray-600 font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JORNADAS.map((j, ji) => (
                <tr key={j}>
                  <td className="py-1.5 pr-4 text-gray-600 font-medium">{j}</td>
                  {CANAIS.map((c, ci) => {
                    const v = HEAT[ji][ci]
                    return (
                      <td key={c} className="py-1.5 px-2 text-center">
                        <span
                          className="inline-flex items-center justify-center w-14 h-8 rounded-lg text-xs font-bold transition-all hover:scale-105 cursor-default"
                          style={{ backgroundColor: heatColor(v), color: heatTextColor(v) }}
                        >
                          {v}%
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

export default MapaAtrito
