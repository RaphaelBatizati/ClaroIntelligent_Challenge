import { useState, useEffect, useCallback } from 'react'
import { Users, CheckCircle, Zap, TrendingDown, Activity, ShieldCheck } from 'lucide-react'
import { api } from '../services/api'
import { usePeriodo } from '../contexts/periodo'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import KPICard from '../components/KPICard'
import ChartCard from '../components/ChartCard'

// Cada canal tem cor fixa em todas as telas — quem olha o painel todo dia
// aprende a cor antes de ler a legenda.
const COR_CANAL = {
  whatsapp: '#25D366', app: '#3B82F6', site: '#8B5CF6', callcenter: '#E8002A',
}
const NOME_CANAL = {
  whatsapp: 'WhatsApp', app: 'App Minha Claro', site: 'Site', callcenter: 'Call Center',
}

const corTransbordo = (v) => (v >= 20 ? '#EF4444' : v >= 12 ? '#F59E0B' : '#10B981')

const TooltipVolume = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.filter(p => p.value > 0).map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  )
}

function Dashboard() {
  const { periodo, rotulo } = usePeriodo()
  const [kpis, setKpis] = useState(null)
  const [volume, setVolume] = useState([])
  const [canais, setCanais] = useState([])
  const [transbordo, setTransbordo] = useState([])
  const [personas, setPersonas] = useState([])
  const [apiStatus, setApiStatus] = useState('checking')

  const carregar = useCallback(async () => {
    try {
      await api.health()
      setApiStatus('online')
      const [k, v, c, t, p] = await Promise.all([
        api.kpis(periodo), api.volume(periodo), api.canais(periodo),
        api.transbordo(periodo), api.personas(periodo),
      ])
      setKpis(k)
      setVolume(v.serie)
      setCanais(c)
      setTransbordo(t.serie)
      setPersonas(p.filter(x => x.total > 0))
    } catch {
      setApiStatus('offline')
    }
  }, [periodo])

  useEffect(() => { carregar() }, [carregar])

  const totalCanais = canais.reduce((a, c) => a + c.total, 0)

  return (
    <div className="space-y-5">
      {/* Barra de status da API */}
      <div className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium ${
        apiStatus === 'online' ? 'bg-green-50 text-green-700'
          : apiStatus === 'offline' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
        <Activity size={13} />
        {apiStatus === 'online' && kpis
          ? `${rotulo} · ${kpis.total_sessoes.toLocaleString('pt-BR')} atendimento(s) · ${kpis.sessoes_ativas} sessão(ões) ativa(s) · ${kpis.protocolos.toLocaleString('pt-BR')} protocolo(s)`
          : apiStatus === 'offline' ? 'API offline — execute: cd clarointelligence-api && npm run server'
            : 'Conectando à API…'}
        {apiStatus === 'online' && (
          <span className="ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />dado real do banco
          </span>
        )}
      </div>

      {/* Destaque de contenção */}
      <div className="rounded-xl p-4 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1A3050 100%)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(232,0,42,0.2)' }}>
          <TrendingDown size={20} style={{ color: '#E8002A' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">
            {kpis?.contencao_pct !== null && kpis?.contencao_pct !== undefined
              ? `${kpis.contencao_pct}% das demandas encerradas sem atendente humano`
              : 'Taxa de contenção'}
          </p>
          <p className="text-white/60 text-xs mt-0.5">
            {rotulo} · transbordo de {kpis?.transbordo_pct ?? 0}% · atrito médio {kpis?.score_atrito_medio ?? 0}/100
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}>
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Ao vivo</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Atendimentos no período" value={(kpis?.total_sessoes ?? 0).toLocaleString('pt-BR')}
          numericValue={kpis?.total_sessoes} icon={Users} accentColor="#E8002A" subtitle={rotulo} />
        <KPICard label="Taxa de contenção" value={kpis?.contencao_pct !== null && kpis?.contencao_pct !== undefined ? `${kpis.contencao_pct}%` : '—'}
          numericValue={kpis?.contencao_pct} icon={CheckCircle} accentColor="#10B981" subtitle="Resolvidos sem humano" />
        <KPICard label="Risco médio de churn" value={`${kpis?.risco_churn_medio ?? 0}%`}
          numericValue={kpis?.risco_churn_medio} icon={ShieldCheck} accentColor="#F59E0B" subtitle="Leitura do ClaroSense" />
        <KPICard label="Intervenções ClaroSense" value={(kpis?.intervencoes ?? 0).toLocaleString('pt-BR')}
          numericValue={kpis?.intervencoes} icon={Zap} accentColor="#8B5CF6" subtitle="Automáticas no período" />
      </div>

      {/* Volume + distribuição */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Volume por canal" subtitle={rotulo} className="col-span-2">
          {volume.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={volume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<TooltipVolume />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {Object.entries(COR_CANAL).map(([chave, cor]) => (
                  <Line key={chave} type="monotone" dataKey={chave} name={NOME_CANAL[chave]}
                    stroke={cor} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-16">Sem atendimentos neste período.</p>
          )}
        </ChartCard>

        <ChartCard title="Distribuição por canal" subtitle={`${totalCanais.toLocaleString('pt-BR')} atendimento(s)`}>
          {canais.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={canais} cx="50%" cy="50%" innerRadius={48} outerRadius={70} dataKey="total" paddingAngle={3}>
                    {canais.map((d) => <Cell key={d.canal} fill={COR_CANAL[d.canal] || '#9CA3AF'} />)}
                  </Pie>
                  <Tooltip formatter={(v, _n, item) => [`${v} (${item.payload.pct}%)`, item.payload.rotulo]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                {canais.map((d) => (
                  <div key={d.canal} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COR_CANAL[d.canal] }} />
                    <span className="text-[10px] text-gray-500 truncate">{d.rotulo}</span>
                    <span className="text-[10px] font-semibold text-gray-700 ml-auto">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-16">Sem dados.</p>
          )}
        </ChartCard>
      </div>

      {/* Transbordo + personas */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="Taxa de transbordo" subtitle="% de conversas que precisaram de atendente humano" className="col-span-2">
          {transbordo.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={transbordo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} minTickGap={10} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={35} />
                <Tooltip formatter={(v, _n, item) => [`${v}% (${item.payload.humanos} de ${item.payload.total})`, 'Transbordo']} />
                <Bar dataKey="taxa" radius={[5, 5, 0, 0]}>
                  {transbordo.map((d, i) => <Cell key={i} fill={corTransbordo(d.taxa)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-16">Sem atendimentos neste período.</p>
          )}
        </ChartCard>

        <ChartCard title="Personas atendidas" subtitle="Perfil de linguagem detectado">
          {personas.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {personas.map(p => {
                const maximo = Math.max(...personas.map(x => x.total)) || 1
                return (
                  <div key={p.chave}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-medium text-gray-700">{p.persona}</span>
                      <span className="text-[11px] font-bold" style={{ color: p.cor }}>{p.total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(p.total / maximo) * 100}%`, backgroundColor: p.cor }} />
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">atrito médio {p.score_medio}/100</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-16">Sem dados.</p>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

export default Dashboard
