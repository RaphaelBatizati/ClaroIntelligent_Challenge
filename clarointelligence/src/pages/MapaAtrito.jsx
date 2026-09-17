import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, TrendingUp, Flame, Filter, X, Inbox, MessageSquare } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import KPICard from '../components/KPICard'
import ChartCard from '../components/ChartCard'
import { api } from '../services/api'
import { usePeriodo } from '../contexts/periodo'

const ROTULO_PERSONA = {
  digital: 'Digital', intermediario: 'Intermediário', assistido: 'Assistido', informal: 'Informal',
}
const ROTULO_LINHA = {
  residencial: 'Residencial', movel: 'Móvel', tv: 'Claro tv+', empresas: 'Empresas', 'sem-produto': 'Sem produto',
}
const ROTULO_CANAL = {
  site: 'Site', app: 'App Minha Claro', whatsapp: 'WhatsApp', callcenter: 'Call Center',
}

// A tela inteira fala em percentual de atendimentos com atrito — é a leitura
// que permite comparar canais de volumes muito diferentes. Os cortes abaixo
// dividem a escala em três faixas de leitura imediata.
const FAIXA_ALTA = 60
const FAIXA_MEDIA = 35

function corDaCelula(v) {
  if (v === null || v === undefined) return '#F9FAFB'
  if (v >= 80) return '#FECACA'
  if (v >= FAIXA_ALTA) return '#FEE2E2'
  if (v >= FAIXA_MEDIA) return '#FEF3C7'
  if (v >= 15) return '#D1FAE5'
  return '#F0FDF4'
}
function corDoTexto(v) {
  if (v === null || v === undefined) return '#D1D5DB'
  if (v >= FAIXA_ALTA) return '#B91C1C'
  if (v >= FAIXA_MEDIA) return '#92400E'
  if (v >= 15) return '#065F46'
  return '#14532D'
}
function corDaBarra(v) {
  if (v >= FAIXA_ALTA) return '#EF4444'
  if (v >= FAIXA_MEDIA) return '#F59E0B'
  return '#10B981'
}

const compacto = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

/**
 * Grupo de filtro em chips.
 * Cada opção carrega quantos atendimentos existem *com os demais filtros já
 * aplicados* — quando a contagem é zero a opção some, porque um filtro que
 * leva a uma tela vazia não deveria ser oferecido.
 */
function GrupoFiltro({ titulo, valor, facetas, rotulos, onSelecionar }) {
  const opcoes = Object.entries(facetas || {})
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])

  if (opcoes.length <= 1 && !valor) return null

  return (
    <div>
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{titulo}</div>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map(([chave, total]) => {
          const ativo = valor === chave
          return (
            <button
              key={chave}
              onClick={() => onSelecionar(ativo ? null : chave)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                ativo
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              <span className="truncate max-w-[180px]">{rotulos?.[chave] || chave}</span>
              <span className={`text-[10px] font-bold ${ativo ? 'text-white/60' : 'text-gray-400'}`}>{total}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const TooltipJornada = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700">{d.jornada}</p>
      <p className="mt-1 font-bold" style={{ color: corDaBarra(d.pct_atrito) }}>
        {d.pct_atrito}% dos atendimentos com atrito
      </p>
      <p className="text-gray-500 mt-0.5">
        {d.total.toLocaleString('pt-BR')} atendimento(s) · índice médio {d.indice}/100
      </p>
      <p className="text-gray-400">{d.transferidos.toLocaleString('pt-BR')} foram para atendente humano</p>
    </div>
  )
}

export default function MapaAtrito() {
  const { periodo, rotulo } = usePeriodo()
  const [filtros, setFiltros] = useState({ canal: null, jornada: null, persona: null, linha: null })
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setDados(await api.mapaAtrito({ periodo, ...filtros }))
      setErro(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [periodo, filtros])

  useEffect(() => { carregar() }, [carregar])

  const definir = (campo) => (valor) => setFiltros(f => ({ ...f, [campo]: valor }))
  const limpar = () => setFiltros({ canal: null, jornada: null, persona: null, linha: null })
  const ativos = Object.entries(filtros).filter(([, v]) => v)

  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
        Falha ao carregar o mapa de atrito: {erro}
        <div className="text-xs text-red-400 mt-1">Verifique se a API está rodando: <code>cd clarointelligence-api &amp;&amp; npm run server</code></div>
      </div>
    )
  }

  const kpis = dados?.kpis
  const vazio = dados && kpis.atendimentos === 0

  return (
    <div className="space-y-5">
      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-gray-400" />
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Recorte da análise</span>
          <span className="text-[11px] text-gray-400">
            · {rotulo} · {kpis?.atendimentos ?? '—'} atendimento(s)
          </span>
          {ativos.length > 0 && (
            <button onClick={limpar}
              className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800">
              <X size={11} /> limpar {ativos.length} filtro(s)
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <GrupoFiltro titulo="Canal de origem" valor={filtros.canal} facetas={dados?.facetas?.canal}
            rotulos={ROTULO_CANAL} onSelecionar={definir('canal')} />
          <GrupoFiltro titulo="Linha de produto" valor={filtros.linha} facetas={dados?.facetas?.linha}
            rotulos={ROTULO_LINHA} onSelecionar={definir('linha')} />
          <GrupoFiltro titulo="Persona" valor={filtros.persona} facetas={dados?.facetas?.persona}
            rotulos={ROTULO_PERSONA} onSelecionar={definir('persona')} />
          <GrupoFiltro titulo="Jornada" valor={filtros.jornada} facetas={dados?.facetas?.jornada}
            onSelecionar={definir('jornada')} />
        </div>

        <p className="text-[10px] text-gray-400 leading-snug border-t border-gray-100 pt-2">
          Todo número desta tela vem do mesmo conjunto filtrado: os contadores ao lado de cada opção já
          consideram os demais filtros, e uma opção sem atendimento correspondente não aparece.
        </p>
      </div>

      {vazio ? (
        <div className="bg-white rounded-xl p-10 text-center">
          <Inbox size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 font-medium">Nenhum atendimento neste recorte</p>
          <p className="text-xs text-gray-400 mt-1">Amplie o período na barra superior ou remova um filtro.</p>
        </div>
      ) : (
        <>
          {/* ── KPIs ────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <KPICard label="Atendimentos no recorte" value={(kpis?.atendimentos ?? 0).toLocaleString('pt-BR')}
              numericValue={kpis?.atendimentos} icon={MessageSquare} accentColor="#3B82F6" subtitle={rotulo} />
            <KPICard label="Pontos de atrito detectados" value={(kpis?.pontos_atrito ?? 0).toLocaleString('pt-BR')}
              numericValue={kpis?.pontos_atrito} icon={AlertTriangle} accentColor="#EF4444"
              subtitle="Sinais do ClaroSense" />
            <KPICard label="Atendimentos com atrito" value={`${kpis?.pct_com_atrito ?? 0}%`}
              numericValue={kpis?.pct_com_atrito} icon={Flame} accentColor="#F59E0B"
              subtitle={`Índice médio ${kpis?.indice_medio ?? 0}/100`} />
            <KPICard label="Resolvidos sem atendente" value={kpis?.taxa_recuperacao !== null ? `${kpis?.taxa_recuperacao}%` : '—'}
              numericValue={kpis?.taxa_recuperacao} icon={TrendingUp} accentColor="#10B981"
              subtitle="Taxa de contenção" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ── Índice por jornada ────────────────────────── */}
            <ChartCard title="Atrito por jornada"
              subtitle={`% dos atendimentos que passaram do limiar de atrito · ${dados?.por_jornada?.length || 0} jornada(s)`}>
              <ResponsiveContainer width="100%" height={Math.max(220, (dados?.por_jornada?.length || 1) * 26)}>
                <BarChart data={dados?.por_jornada || []} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="jornada" width={165} tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipJornada />} cursor={{ fill: '#F9FAFB' }} />
                  <Bar dataKey="pct_atrito" radius={[0, 5, 5, 0]}>
                    {(dados?.por_jornada || []).map((d, i) => <Cell key={i} fill={corDaBarra(d.pct_atrito)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ── Sinais ────────────────────────────────────── */}
            <ChartCard title="Sinais de atrito detectados"
              subtitle="Quantas vezes cada sinal do ClaroSense disparou no recorte">
              {dados?.sinais?.length > 0 ? (
                <div className="space-y-2.5">
                  {dados.sinais.map((s) => {
                    const maximo = dados.sinais[0].total || 1
                    return (
                      <div key={s.tipo} className="p-2.5 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-medium text-gray-700">{s.rotulo}</span>
                          <span className="text-xs font-bold text-gray-800">
                            {s.total.toLocaleString('pt-BR')}
                            <span className="text-[9px] text-gray-400 font-normal ml-1">+{s.peso} cada</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(s.total / maximo) * 100}%`, backgroundColor: corDaBarra(s.peso * 2) }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-6 text-center">Nenhum sinal de atrito neste recorte.</p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['Crítico', '≥ 60%', '#FEE2E2', '#B91C1C'], ['Atenção', '35–59%', '#FEF3C7', '#92400E'], ['Saudável', '< 35%', '#D1FAE5', '#065F46']].map(([t, f, bg, cor]) => (
                  <div key={t} className="p-2 rounded-lg" style={{ backgroundColor: bg }}>
                    <div className="text-xs font-bold" style={{ color: cor }}>{t}</div>
                    <div className="text-[10px]" style={{ color: cor, opacity: 0.7 }}>{f}</div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* ── Mapa de calor ─────────────────────────────── */}
          <ChartCard title="Mapa de calor — jornada × canal"
            subtitle={`% dos atendimentos com atrito acima de ${dados?.heatmap?.limiar ?? 40}/100 em cada cruzamento. Passe o mouse para ver o volume.`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left pb-3 pr-4 text-gray-400 font-medium w-56">Jornada</th>
                    {dados?.heatmap?.canais?.map(c => (
                      <th key={c.chave} className="pb-3 px-2 text-center text-gray-600 font-semibold">{c.rotulo}</th>
                    ))}
                    <th className="pb-3 pl-3 text-right text-gray-400 font-medium">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {dados?.heatmap?.linhas?.map(linha => {
                    // O pior canal da linha ganha um contorno: é a leitura que a
                    // tela existe para entregar — onde esta jornada dói mais.
                    const pior = Math.max(...linha.celulas.map(c => c.pct_atrito ?? -1))
                    return (
                      <tr key={linha.jornada}>
                        <td className="py-1.5 pr-4 text-gray-600 font-medium">{linha.jornada}</td>
                        {linha.celulas.map(cel => (
                          <td key={cel.canal} className="py-1.5 px-2 text-center">
                            <span
                              className="inline-flex flex-col items-center justify-center w-16 h-9 rounded-lg transition-all hover:scale-105 cursor-default"
                              style={{
                                backgroundColor: corDaCelula(cel.pct_atrito),
                                color: corDoTexto(cel.pct_atrito),
                                outline: cel.pct_atrito === pior && pior >= FAIXA_MEDIA ? '1.5px solid #B91C1C' : 'none',
                              }}
                              title={cel.total
                                ? `${cel.com_atrito.toLocaleString('pt-BR')} de ${cel.total.toLocaleString('pt-BR')} atendimentos com atrito · índice médio ${cel.indice}/100`
                                : 'Sem atendimento neste cruzamento'}
                            >
                              <span className="text-xs font-bold leading-none">
                                {cel.pct_atrito === null ? '—' : `${cel.pct_atrito}%`}
                              </span>
                              {cel.total > 0 && (
                                <span className="text-[8px] opacity-60 leading-none mt-0.5">{compacto(cel.total)}</span>
                              )}
                            </span>
                          </td>
                        ))}
                        <td className="py-1.5 pl-3 text-right text-[10px] text-gray-400 tabular-nums">
                          {linha.total.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-gray-400 leading-snug mt-3 pt-2 border-t border-gray-100">
              O número é a <strong>fatia dos atendimentos daquele cruzamento que deu problema</strong>, não o
              volume — é assim que se compara um canal que recebe 30 mil contatos com outro que recebe 10 mil.
              O contorno marca o canal em que cada jornada dói mais.
            </p>
          </ChartCard>
        </>
      )}

      {carregando && !dados && (
        <div className="text-center text-xs text-gray-400 py-6">Carregando dados do período…</div>
      )}
    </div>
  )
}
