import { useState, useEffect } from 'react'
import {
  Brain, Users, TrendingDown, Shield, AlertTriangle, ArrowRight, Repeat,
  MessageSquareWarning, UserX, Flame, Radio, CheckCircle,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { api } from '../services/api'
import { usePeriodo } from '../contexts/periodo'

const ICONE_SINAL = {
  repeticao_intencao: Repeat,
  monossilabico: MessageSquareWarning,
  sentimento_negativo: MessageSquareWarning,
  tom_agressivo: Flame,
  solicita_humano: UserX,
  intencao_cancelamento: TrendingDown,
  recontato_multicanal: Radio,
}

const COR_SINAL = {
  repeticao_intencao: '#F59E0B',
  monossilabico: '#94A3B8',
  sentimento_negativo: '#F97316',
  tom_agressivo: '#EF4444',
  solicita_humano: '#8B5CF6',
  intencao_cancelamento: '#DC2626',
  recontato_multicanal: '#3B82F6',
}

const NIVEL_CHURN = {
  baixo: { cor: '#10B981', label: 'Baixo' },
  moderado: { cor: '#F59E0B', label: 'Moderado' },
  alto: { cor: '#F97316', label: 'Alto' },
  critico: { cor: '#EF4444', label: 'Crítico' },
}

function nivelChurnDe(p) {
  if (p >= 80) return 'critico'
  if (p >= 60) return 'alto'
  if (p >= 30) return 'moderado'
  return 'baixo'
}

function KPI({ label, valor, sub, cor, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cor}15` }}>
          <Icon size={16} style={{ color: cor }} />
        </div>
      </div>
      <div className="text-2xl font-black text-gray-800 leading-none">{valor}</div>
      <div className="text-[11px] text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

/**
 * Explicação da régua — o ponto central do painel.
 * Mostra, com os pesos reais do motor, como repetição e agressividade
 * empurram o score até o transbordo e o risco de cancelamento.
 */
function ComoFuncionaScore({ catalogo, limiares }) {
  const [exemplo, setExemplo] = useState(0)

  // Escalada didática, com os mesmos pesos que o backend aplica
  const escalada = [
    { turno: 1, fala: '"minha internet está lenta"', sinais: [], score: 0 },
    { turno: 2, fala: '"já tentei isso, não adianta"', sinais: ['repeticao_intencao', 'sentimento_negativo'], score: 50 },
    { turno: 3, fala: '"ISSO É UM ABSURDO! vou no PROCON"', sinais: ['tom_agressivo'], score: 85 },
    { turno: 4, fala: '"quero cancelar tudo"', sinais: ['intencao_cancelamento', 'solicita_humano'], score: 100 },
  ]
  const atual = escalada[exemplo]
  const churnEstimado = Math.min(Math.round(atual.score * 0.7 + (atual.sinais.includes('intencao_cancelamento') ? 25 : 0) + (atual.sinais.includes('tom_agressivo') ? 15 : 0)), 100)
  const nivelChurn = NIVEL_CHURN[nivelChurnDe(churnEstimado)]

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={16} className="text-[#E8002A]" />
        <h3 className="text-sm font-semibold text-gray-900">Como o score de atrito vira risco de cancelamento</h3>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-4 max-w-3xl">
        Cada sinal detectado soma um peso fixo ao score da sessão — a régua é determinística e auditável, não uma caixa-preta.
        <strong className="text-gray-700"> Repetir o mesmo pedido</strong> e <strong className="text-gray-700">escalar o tom </strong>
        são justamente os comportamentos que antecedem o pedido de cancelamento, por isso têm os pesos mais altos.
        Quando o score cruza {limiares?.transbordo ?? 80}, o sistema para de insistir no bot e leva o cliente para um humano.
      </p>

      {/* Régua de pesos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
        {catalogo?.map(s => {
          const Icon = ICONE_SINAL[s.tipo] || AlertTriangle
          const cor = COR_SINAL[s.tipo] || '#6B7280'
          return (
            <div key={s.tipo} className="rounded-lg p-2.5 border" style={{ backgroundColor: `${cor}08`, borderColor: `${cor}25` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} style={{ color: cor }} />
                <span className="text-[10px] font-bold flex-1 leading-tight" style={{ color: cor }}>{s.rotulo}</span>
                <span className="text-[11px] font-black" style={{ color: cor }}>+{s.peso}</span>
              </div>
              <p className="text-[9px] text-gray-500 leading-snug">{s.explicacao}</p>
            </div>
          )
        })}
      </div>

      {/* Simulação da escalada */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="text-[10px] font-bold text-gray-400 uppercase mb-3">Escalada de uma conversa real</div>

        <div className="flex gap-1.5 mb-4">
          {escalada.map((e, i) => (
            <button key={i} onClick={() => setExemplo(i)}
              className={`flex-1 text-left p-2 rounded-lg border transition-all ${exemplo === i ? 'bg-white border-gray-900 shadow-sm' : 'bg-white/50 border-transparent hover:bg-white'}`}>
              <div className="text-[9px] text-gray-400 uppercase font-bold">Turno {e.turno}</div>
              <div className="text-[10px] text-gray-600 leading-snug mt-0.5 line-clamp-2">{e.fala}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 items-center">
          {/* Sinais do turno */}
          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Sinais detectados</div>
            {atual.sinais.length === 0 ? (
              <span className="text-[10px] text-gray-400 italic">Nenhum — conversa saudável</span>
            ) : (
              <div className="space-y-1">
                {atual.sinais.map(t => {
                  const def = catalogo?.find(c => c.tipo === t)
                  const Icon = ICONE_SINAL[t] || AlertTriangle
                  return (
                    <div key={t} className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: COR_SINAL[t] }}>
                      <Icon size={10} /> {def?.rotulo || t} <span className="ml-auto">+{def?.peso}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Score acumulado */}
          <div className="text-center">
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Score acumulado</div>
            <div className="text-4xl font-black leading-none"
              style={{ color: atual.score >= 80 ? '#EF4444' : atual.score >= 65 ? '#F59E0B' : atual.score >= 40 ? '#F97316' : '#10B981' }}>
              {atual.score}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2 relative">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${atual.score}%`, backgroundColor: atual.score >= 80 ? '#EF4444' : atual.score >= 65 ? '#F59E0B' : atual.score >= 40 ? '#F97316' : '#10B981' }} />
              <div className="absolute top-0 h-full w-px bg-gray-400" style={{ left: `${limiares?.transbordo ?? 80}%` }} />
            </div>
            <div className="text-[9px] text-gray-400 mt-1">transbordo em {limiares?.transbordo ?? 80}</div>
          </div>

          {/* Risco de churn resultante */}
          <div className="text-center">
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Risco de cancelamento</div>
            <div className="text-4xl font-black leading-none" style={{ color: nivelChurn.cor }}>{churnEstimado}%</div>
            <span className="inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: nivelChurn.cor }}>
              {nivelChurn.label.toUpperCase()}
            </span>
          </div>
        </div>

        {atual.score >= 80 && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-[11px] text-red-600 font-semibold">
            <ArrowRight size={13} />
            Intervenção automática: transferência para fila prioritária com contexto completo, antes que o cliente peça o cancelamento.
          </div>
        )}
      </div>
    </div>
  )
}

export default function LogClaroSense() {
  const { periodo, rotulo } = usePeriodo()
  const [sinais, setSinais] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [limiares, setLimiares] = useState(null)
  const [contencao, setContencao] = useState(null)
  const [seguranca, setSeguranca] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    Promise.all([
      api.sinais(periodo), api.sinaisCatalogo(), api.contencao(periodo), api.segurancaResumo(),
    ])
      .then(([s, cat, cont, seg]) => {
        setSinais(s); setCatalogo(cat.sinais); setLimiares(cat.limiares)
        setContencao(cont); setSeguranca(seg); setErro(null)
      })
      .catch(() => setErro('API offline — inicie o backend com npm run server'))
  }, [periodo])

  const dadosGrafico = (sinais?.por_tipo || []).map(s => ({
    tipo: catalogo?.find(c => c.tipo === s.tipo)?.rotulo || s.tipo.replace(/_/g, ' '),
    total: s.total,
    cor: COR_SINAL[s.tipo] || '#6B7280',
  }))

  return (
    <div className="space-y-4">
      {erro && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">{erro}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPI label="Sinais de atrito detectados" valor={sinais?.por_tipo?.reduce((a, s) => a + s.total, 0) ?? 0}
          sub={rotulo} cor="#8B5CF6" icon={Brain} />
        <KPI label="Intervenções automáticas" valor={sinais?.intervencoes?.reduce((a, i) => a + i.total, 0) ?? 0}
          sub="antecipação, simplificação e transbordo" cor="#F59E0B" icon={Users} />
        <KPI label="Taxa de contenção" valor={`${contencao?.taxa_contencao_pct ?? 0}%`}
          sub={`${contencao?.resolvidos_autoatendimento ?? 0} resolvidos sem humano`} cor="#10B981" icon={CheckCircle} />
        <KPI label="Bloqueios de segurança" valor={seguranca?.bloqueados ?? 0}
          sub="prompt injection e extração de dados" cor="#EF4444" icon={Shield} />
      </div>

      {/* Explicação da régua */}
      <ComoFuncionaScore catalogo={catalogo} limiares={limiares} />

      <div className="grid grid-cols-5 gap-4">
        {/* Gráfico de sinais */}
        <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Sinais por tipo</h3>
          <p className="text-[11px] text-gray-400 mb-3">Frequência real registrada no banco</p>
          {dadosGrafico.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dadosGrafico} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="tipo" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                <Bar dataKey="total" radius={[5, 5, 0, 0]}>
                  {dadosGrafico.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 py-12 text-center">Nenhum sinal registrado ainda.</p>
          )}
        </div>

        {/* Clientes em risco de churn */}
        <div className="col-span-3 bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={15} className="text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900">Clientes em risco de cancelamento</h3>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">Sessões com risco de churn acima de 30% — ordenadas por prioridade de retenção</p>

          {sinais?.clientes_em_risco?.length > 0 ? (
            <div className="space-y-2">
              {sinais.clientes_em_risco.map((c, i) => {
                const nivel = NIVEL_CHURN[nivelChurnDe(c.risco_churn)]
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ backgroundColor: `${nivel.cor}08`, borderColor: `${nivel.cor}25` }}>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                      {c.cliente_nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-gray-800 truncate">{c.cliente_nome}</div>
                      <div className="text-[10px] text-gray-400">
                        {c.canal} · atrito {c.score_atrito} · {c.status?.replace(/_/g, ' ')}
                        {c.protocolo_numero && <span className="font-mono"> · {c.protocolo_numero}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-black leading-none" style={{ color: nivel.cor }}>{c.risco_churn}%</div>
                      <div className="text-[9px] font-bold uppercase" style={{ color: nivel.cor }}>{nivel.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-8 text-center">Nenhum cliente em risco no momento.</p>
          )}
        </div>
      </div>

      {/* Log de sinais */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Log de sinais detectados</h3>
        <p className="text-[11px] text-gray-400 mb-3">Cada linha é um sinal individual que somou pontos ao score de uma sessão</p>
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100 text-gray-400">
                <th className="text-left pb-2 font-semibold">Horário</th>
                <th className="text-left pb-2 font-semibold">Canal</th>
                <th className="text-left pb-2 font-semibold">Cliente</th>
                <th className="text-left pb-2 font-semibold">Sinal detectado</th>
                <th className="text-right pb-2 font-semibold">Peso</th>
                <th className="text-right pb-2 font-semibold">Score da sessão</th>
              </tr>
            </thead>
            <tbody>
              {sinais?.log?.map((l, i) => {
                const def = catalogo?.find(c => c.tipo === l.tipo)
                const cor = COR_SINAL[l.tipo] || '#6B7280'
                const Icon = ICONE_SINAL[l.tipo] || AlertTriangle
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 pr-3 font-mono text-gray-400">{l.created_at?.slice(11, 16)}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 capitalize">{l.canal}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-600 truncate max-w-[140px]">{l.cliente_nome}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5 font-medium" style={{ color: cor }}>
                        <Icon size={11} /> {def?.rotulo || l.tipo?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 text-right font-bold" style={{ color: cor }}>+{l.valor}</td>
                    <td className="py-2 text-right font-semibold text-gray-700">{l.score_atrito}</td>
                  </tr>
                )
              })}
              {(!sinais?.log || sinais.log.length === 0) && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Nenhum sinal registrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
