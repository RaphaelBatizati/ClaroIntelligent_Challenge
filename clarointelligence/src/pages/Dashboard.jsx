import { useState, useEffect } from 'react'
import { Users, CheckCircle, Star, Zap, TrendingDown, Activity } from 'lucide-react'
import { api } from '../services/api'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import KPICard from '../components/KPICard'
import ChartCard from '../components/ChartCard'

const volumeData = [
  { s: 'S1', WhatsApp: 8200, App: 6100, Site: 4800, 'Call Center': 12400 },
  { s: 'S2', WhatsApp: 9100, App: 6800, Site: 5200, 'Call Center': 11800 },
  { s: 'S3', WhatsApp: 10300, App: 7400, Site: 5600, 'Call Center': 10900 },
  { s: 'S4', WhatsApp: 11200, App: 8200, Site: 6100, 'Call Center': 9800 },
  { s: 'S5', WhatsApp: 12100, App: 8900, Site: 6600, 'Call Center': 8600 },
  { s: 'S6', WhatsApp: 13400, App: 9600, Site: 7200, 'Call Center': 7400 },
  { s: 'S7', WhatsApp: 14200, App: 10300, Site: 7800, 'Call Center': 6300 },
]

const distribuicao = [
  { name: 'WhatsApp', value: 34, color: '#25D366' },
  { name: 'App Minha Claro', value: 28, color: '#3B82F6' },
  { name: 'Site/Chat', value: 23, color: '#8B5CF6' },
  { name: 'Call Center', value: 15, color: '#E8002A' },
]

const transbordo = [
  { s: 'S1', taxa: 28 },
  { s: 'S2', taxa: 24 },
  { s: 'S3', taxa: 21 },
  { s: 'S4', taxa: 18 },
  { s: 'S5', taxa: 14 },
  { s: 'S6', taxa: 11 },
  { s: 'S7', taxa: 8 },
]

const barColor = (v) => (v >= 20 ? '#EF4444' : v >= 12 ? '#F59E0B' : '#10B981')

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  )
}

function Dashboard() {
  const [kpis, setKpis] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')

  useEffect(() => {
    api.health()
      .then(() => {
        setApiStatus('online')
        return api.kpis()
      })
      .then(setKpis)
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <div className="space-y-5">
      {/* Barra de status API */}
      <div className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium ${apiStatus === 'online' ? 'bg-green-50 text-green-700' : apiStatus === 'offline' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
        <Activity size={13} />
        {apiStatus === 'online' && kpis ? `API ClaroIntelligence conectada • ${kpis.sessoes_ativas} sessão(ões) ativa(s) • ${kpis.total_sessoes?.toLocaleString('pt-BR')} atendimentos totais` : apiStatus === 'offline' ? 'API offline — execute: cd clarointelligence-api && npm run server' : 'Conectando à API…'}
        {apiStatus === 'online' && <span className="ml-auto flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />ao vivo</span>}
      </div>

      {/* Banner */}
      <div
        className="rounded-xl p-4 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1A3050 100%)' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(232,0,42,0.2)' }}>
          <TrendingDown size={20} style={{ color: '#E8002A' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Call center com queda de 32% no período</p>
          <p className="text-white/60 text-xs mt-0.5">Atendimentos migrados para canais digitais via ClaroIntelligence</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}>
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Ao vivo</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Total de Atendimentos" value={kpis ? kpis.total_sessoes.toLocaleString('pt-BR') : '84.320'} numericValue={kpis?.total_sessoes || 84320} delta="+12,3%" deltaType="positive" icon={Users} accentColor="#E8002A" />
        <KPICard label="First Call Resolution" value={kpis ? kpis.fcr_pct + '%' : '73,4%'} numericValue={kpis?.fcr_pct || 73} delta="+5,2%" deltaType="positive" icon={CheckCircle} accentColor="#10B981" />
        <KPICard label="CES Médio" value={kpis ? kpis.ces + ' / 7' : '3,8 / 7'} delta="-0,4" deltaType="negative" icon={Star} accentColor="#F59E0B" />
        <KPICard label="Intervenções ClaroSense" value={kpis ? kpis.intervencoes.toLocaleString('pt-BR') : '2.847'} numericValue={kpis?.intervencoes || 2847} delta="+18,7%" deltaType="positive" icon={Zap} accentColor="#8B5CF6" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Volume por Canal" subtitle="Últimas 7 semanas" className="col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="s" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
              <Tooltip content={<CustomTip />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line type="monotone" dataKey="WhatsApp" stroke="#25D366" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="App" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Site" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Call Center" stroke="#E8002A" strokeWidth={2} dot={false} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por Canal" subtitle="Período atual">
          <div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={distribuicao} cx="50%" cy="50%" innerRadius={48} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {distribuicao.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
              {distribuicao.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-gray-500 truncate">{d.name}</span>
                  <span className="text-[10px] font-semibold text-gray-700 ml-auto">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <ChartCard title="Taxa de Transbordo Semana a Semana" subtitle="Redução progressiva — de 28% para 8% com ClaroIntelligence">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={transbordo} barSize={44}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="s" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={35} />
            <Tooltip formatter={(v) => [`${v}%`, 'Taxa de transbordo']} />
            <Bar dataKey="taxa" radius={[5, 5, 0, 0]}>
              {transbordo.map((d, i) => (
                <Cell key={i} fill={barColor(d.taxa)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

export default Dashboard
