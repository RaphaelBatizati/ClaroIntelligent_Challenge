import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Headphones, Send, Clock, AlertTriangle, FileText, User,
  TrendingDown, Package, PhoneOff, Inbox, Filter, X,
} from 'lucide-react'
import { api } from '../services/api'

const PRIORIDADE = {
  alta: { cor: '#EF4444', bg: '#FEF2F2', label: 'Alta' },
  media: { cor: '#F59E0B', bg: '#FFFBEB', label: 'Média' },
  baixa: { cor: '#10B981', bg: '#F0FDF4', label: 'Baixa' },
}

const CANAL_LABEL = {
  site: 'Site', app: 'App Minha Claro', whatsapp: 'WhatsApp', callcenter: 'Call Center',
}

/** Cartão de um cliente aguardando na fila. */
function ItemFila({ item, ativo, onSelecionar }) {
  const prio = PRIORIDADE[item.prioridade] || PRIORIDADE.media
  const emAtendimento = item.status === 'em_atendimento'

  return (
    <button onClick={() => onSelecionar(item)}
      className={`w-full text-left p-3 rounded-xl border transition-all ${ativo ? 'border-gray-900 bg-gray-900 text-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className={`text-xs font-bold truncate ${ativo ? 'text-white' : 'text-gray-800'}`}>{item.cliente_nome}</div>
          <div className={`text-[10px] ${ativo ? 'text-gray-400' : 'text-gray-400'}`}>
            {CANAL_LABEL[item.canal] || item.canal} · {item.perfil_persona}
          </div>
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: emAtendimento ? '#0EA5E9' : prio.cor, color: '#fff' }}>
          {emAtendimento ? 'ATENDENDO' : prio.label.toUpperCase()}
        </span>
      </div>

      <div className={`text-[10px] leading-snug mb-2 line-clamp-2 ${ativo ? 'text-gray-300' : 'text-gray-500'}`}>
        {item.motivo}
      </div>

      <div className="flex items-center gap-3 text-[10px]">
        <span className={`flex items-center gap-1 font-semibold ${item.score_atrito >= 80 ? 'text-red-500' : item.score_atrito >= 65 ? 'text-amber-500' : ativo ? 'text-gray-300' : 'text-gray-500'}`}
          title="Score de atrito do ClaroSense">
          <AlertTriangle size={9} /> {item.score_atrito}
        </span>
        <span className={`flex items-center gap-1 font-semibold ${item.risco_churn >= 70 ? 'text-red-500' : item.risco_churn >= 40 ? 'text-amber-500' : ativo ? 'text-gray-400' : 'text-gray-400'}`}
          title="Risco de cancelamento — é ele que define a ordem dentro da fila">
          <TrendingDown size={9} /> {item.risco_churn ?? 0}%
        </span>
        <span className={`flex items-center gap-1 ${ativo ? 'text-gray-400' : 'text-gray-400'}`}>
          <Clock size={9} /> {item.aguardando_ha_min}min
        </span>
        {item.posicao > 0 && (
          <span className={`ml-auto font-bold ${ativo ? 'text-white' : 'text-gray-600'}`}>#{item.posicao}</span>
        )}
      </div>

      <div className={`mt-1.5 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${ativo ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
        {item.tipo_servico_rotulo || 'Atendimento geral'}
      </div>

      {item.protocolo_formatado && (
        <div className={`text-[9px] font-mono mt-1.5 pt-1.5 border-t ${ativo ? 'text-gray-400 border-white/10' : 'text-gray-400 border-gray-100'}`}>
          {item.protocolo_formatado}
        </div>
      )}
    </button>
  )
}

/** Briefing que o atendente lê antes de falar — para não pedir repetição. */
function PainelContexto({ conversa }) {
  if (!conversa) return null
  const { cliente, sessao, portfolio, protocolo, sinais_atrito, entrada } = conversa
  const resumo = entrada?.resumo

  return (
    <div className="w-72 flex-shrink-0 space-y-3 overflow-y-auto">
      <div className="bg-white rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-bold">
            {cliente?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-800 truncate">{cliente?.nome}</div>
            <div className="text-[10px] text-gray-400">{cliente?.cpf_mascara || 'CNPJ protegido'}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="bg-gray-50 rounded p-1.5">
            <div className="text-gray-400">Persona</div>
            <div className="font-semibold text-gray-700 capitalize">{cliente?.perfil_persona}</div>
          </div>
          <div className="bg-gray-50 rounded p-1.5">
            <div className="text-gray-400">Canal</div>
            <div className="font-semibold text-gray-700">{CANAL_LABEL[sessao?.canal] || sessao?.canal}</div>
          </div>
        </div>
      </div>

      {protocolo && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText size={11} className="text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Protocolo</span>
          </div>
          <div className="text-xs font-mono font-bold text-slate-700">{protocolo.numero_formatado}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{protocolo.assunto}</div>
          {protocolo.eventos?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
              <div className="text-[9px] font-semibold text-slate-400 uppercase">Linha do tempo</div>
              {protocolo.eventos.map((e, i) => (
                <div key={i} className="text-[9px] text-slate-600 leading-snug flex gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                  <span>{e.descricao}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingDown size={11} className="text-red-500" />
          <span className="text-[10px] font-bold text-red-500 uppercase">Por que chegou aqui</span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-black text-red-600">{sessao?.score_atrito ?? 0}</span>
          <span className="text-[10px] text-gray-400">atrito / 100</span>
          {sessao?.risco_churn > 0 && (
            <span className="ml-auto text-[10px] font-bold text-red-600">churn {sessao.risco_churn}%</span>
          )}
        </div>
        {sinais_atrito?.length > 0 && (
          <div className="space-y-1">
            {sinais_atrito.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] bg-white rounded px-2 py-1">
                <span className="text-gray-600 capitalize">{s.tipo?.replace(/_/g, ' ')}</span>
                <span className="font-bold text-red-500">+{s.valor}</span>
              </div>
            ))}
          </div>
        )}
        {resumo?.ultimas_mensagens?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-red-100">
            <div className="text-[9px] font-semibold text-red-400 uppercase mb-1">Últimas falas do cliente</div>
            {resumo.ultimas_mensagens.filter(m => m.papel === 'cliente').map((m, i) => (
              <p key={i} className="text-[9px] text-gray-600 italic leading-snug mb-1">"{m.texto}"</p>
            ))}
          </div>
        )}
      </div>

      {portfolio?.length > 0 && (
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Package size={11} className="text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Portfólio ({portfolio.length})</span>
          </div>
          <div className="space-y-1.5">
            {portfolio.map((p, i) => (
              <div key={i} className="text-[10px]">
                <div className="font-semibold text-gray-700 leading-tight">{p.plano_nome}</div>
                <div className="text-gray-400 capitalize">{p.linha} · R$ {Number(p.valor_mensal).toFixed(2).replace('.', ',')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const GRAVIDADES = [
  { chave: 'alta', label: 'Alta', cor: '#EF4444' },
  { chave: 'media', label: 'Média', cor: '#F59E0B' },
  { chave: 'baixa', label: 'Baixa', cor: '#10B981' },
]

/**
 * Filtros da fila.
 * Uma operação real não atende "a fila" — atende a fila da sua especialidade,
 * priorizando quem está mais perto de cancelar. Por isso os dois eixos:
 * gravidade do atrito e tipo de serviço.
 */
function FiltrosFila({ filtros, facetas, tipos, onMudar, onLimpar }) {
  const ativos = Object.values(filtros).filter(Boolean).length

  const Chip = ({ ativo, cor, children, onClick, total }) => (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium border transition-all ${
        ativo ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
      style={ativo ? { backgroundColor: cor || '#111827' } : undefined}>
      <span>{children}</span>
      {total !== undefined && (
        <span className={`font-bold ${ativo ? 'text-white/70' : 'text-gray-400'}`}>{total}</span>
      )}
    </button>
  )

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Filter size={11} className="text-gray-400" />
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Filtrar fila</span>
        {ativos > 0 && (
          <button onClick={onLimpar} className="ml-auto flex items-center gap-1 text-[9px] font-semibold text-gray-400 hover:text-gray-700">
            <X size={9} /> limpar
          </button>
        )}
      </div>

      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Gravidade do atrito</div>
        <div className="flex flex-wrap gap-1">
          {GRAVIDADES.filter(g => (facetas?.gravidade?.[g.chave] || 0) > 0 || filtros.gravidade === g.chave).map(g => (
            <Chip key={g.chave} ativo={filtros.gravidade === g.chave} cor={g.cor} total={facetas?.gravidade?.[g.chave] || 0}
              onClick={() => onMudar('gravidade', filtros.gravidade === g.chave ? null : g.chave)}>
              {g.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Tipo de serviço</div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(tipos || {})
            .filter(([chave]) => (facetas?.tipo_servico?.[chave] || 0) > 0 || filtros.tipo_servico === chave)
            .map(([chave, rotulo]) => (
              <Chip key={chave} ativo={filtros.tipo_servico === chave} total={facetas?.tipo_servico?.[chave] || 0}
                onClick={() => onMudar('tipo_servico', filtros.tipo_servico === chave ? null : chave)}>
                {rotulo}
              </Chip>
            ))}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Canal de origem</div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(facetas?.canal || {}).filter(([, t]) => t > 0).map(([chave, total]) => (
            <Chip key={chave} ativo={filtros.canal === chave} total={total}
              onClick={() => onMudar('canal', filtros.canal === chave ? null : chave)}>
              {CANAL_LABEL[chave] || chave}
            </Chip>
          ))}
        </div>
      </div>

      <p className="text-[9px] text-gray-400 leading-snug border-t border-gray-100 pt-2">
        A fila é ordenada por gravidade e, dentro dela, pelo <strong>risco de cancelamento</strong> —
        quem está mais estressado é atendido primeiro, não quem chegou antes.
      </p>
    </div>
  )
}

export default function ConsoleAtendente() {
  const [fila, setFila] = useState([])
  const [facetas, setFacetas] = useState(null)
  const [tiposServico, setTiposServico] = useState(null)
  const [filtros, setFiltros] = useState({ gravidade: null, tipo_servico: null, canal: null })
  const [metricas, setMetricas] = useState(null)
  const [selecionado, setSelecionado] = useState(null)
  const [conversa, setConversa] = useState(null)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [atendente] = useState('Raphael Batizati (Retenção)')
  const bottomRef = useRef(null)

  const carregarFila = useCallback(async () => {
    try {
      const dados = await api.fila(filtros)
      setFila(dados.itens)
      setMetricas(dados.metricas)
      setFacetas(dados.facetas)
      setTiposServico(dados.tipos_servico)
      setErro(null)
    } catch {
      setErro('API offline — inicie o backend com npm run server')
    }
  }, [filtros])

  const carregarConversa = useCallback(async (filaId) => {
    try {
      setConversa(await api.filaConversa(filaId))
    } catch { /* item pode ter sido encerrado por outro atendente */ }
  }, [])

  useEffect(() => { carregarFila() }, [carregarFila])

  // Fila e conversa ativa se atualizam sozinhas: é um posto de trabalho ao vivo
  useEffect(() => {
    const iv = setInterval(() => {
      carregarFila()
      if (selecionado) carregarConversa(selecionado.id)
    }, 3000)
    return () => clearInterval(iv)
  }, [carregarFila, carregarConversa, selecionado])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversa?.mensagens?.length])

  async function selecionar(item) {
    setSelecionado(item)
    setConversa(null)
    await carregarConversa(item.id)
  }

  async function assumir() {
    if (!selecionado) return
    try {
      await api.filaAssumir(selecionado.id, atendente)
      await carregarFila()
      await carregarConversa(selecionado.id)
    } catch (e) {
      setErro(e.message)
    }
  }

  async function responder() {
    const texto = resposta.trim()
    if (!texto || !selecionado || enviando) return
    setEnviando(true)
    try {
      await api.filaResponder(selecionado.id, texto, atendente)
      setResposta('')
      await carregarConversa(selecionado.id)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  async function encerrar() {
    if (!selecionado) return
    try {
      await api.filaEncerrar(selecionado.id, `Atendimento concluído por ${atendente}`)
      setSelecionado(null)
      setConversa(null)
      await carregarFila()
    } catch (e) {
      setErro(e.message)
    }
  }

  const emAtendimento = conversa?.entrada?.status === 'em_atendimento'

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Métricas da fila */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: 'Aguardando', valor: metricas?.aguardando ?? 0, cor: '#F59E0B', icon: Inbox },
          { label: 'Em atendimento', valor: metricas?.em_atendimento ?? 0, cor: '#0EA5E9', icon: Headphones },
          { label: 'Prioridade alta', valor: metricas?.prioridade_alta ?? 0, cor: '#EF4444', icon: AlertTriangle },
          { label: 'Churn médio na fila', valor: `${metricas?.churn_medio ?? 0}%`, cor: '#8B5CF6', icon: TrendingDown },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${m.cor}15` }}>
              <m.icon size={15} style={{ color: m.cor }} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-gray-800 leading-none">{m.valor}</div>
              <div className="text-[10px] text-gray-400 truncate">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 flex-shrink-0">{erro}</div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Fila */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          <FiltrosFila
            filtros={filtros}
            facetas={facetas}
            tipos={tiposServico}
            onMudar={(campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }))}
            onLimpar={() => setFiltros({ gravidade: null, tipo_servico: null, canal: null })}
          />
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Fila de atendimento</span>
            <span className="text-[10px] text-gray-400">{fila.length} caso(s)</span>
          </div>
          {fila.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center">
              <Inbox size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-[11px] text-gray-400 leading-snug">
                Nenhum cliente neste recorte.<br />
                Limpe os filtros ou provoque um transbordo no Chat do Cliente.
              </p>
            </div>
          )}
          {fila.map(item => (
            <ItemFila key={item.id} item={item} ativo={selecionado?.id === item.id} onSelecionar={selecionar} />
          ))}
        </div>

        {/* Conversa */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 min-w-0 overflow-hidden">
          {!selecionado ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-8 text-center">
              <Headphones size={32} className="mb-3 opacity-30" />
              <p className="text-sm font-medium text-gray-500">Console do Atendente</p>
              <p className="text-xs mt-1 max-w-sm leading-relaxed">
                Selecione um cliente da fila para ver o contexto completo — protocolo, sinais de atrito e histórico —
                e assumir a conversa. É aqui que a intervenção humana acontece de verdade.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center">
                  <User size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{conversa?.cliente?.nome || selecionado.cliente_nome}</div>
                  <div className="text-[10px] text-gray-400">
                    {CANAL_LABEL[selecionado.canal]} · protocolo {selecionado.protocolo_formatado || '—'}
                  </div>
                </div>
                <div className="ml-auto flex gap-2">
                  {!emAtendimento ? (
                    <button onClick={assumir}
                      className="text-[11px] font-semibold text-white px-4 py-2 rounded-lg transition-colors"
                      style={{ backgroundColor: '#E8002A' }}>
                      Assumir atendimento
                    </button>
                  ) : (
                    <button onClick={encerrar}
                      className="text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                      <PhoneOff size={12} /> Encerrar
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-gray-50">
                {conversa?.mensagens?.map(m => {
                  const isCliente = m.papel === 'cliente'
                  const isAtendente = m.papel === 'atendente'
                  return (
                    <div key={m.id} className={`flex ${isCliente ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-[75%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed"
                        style={{
                          backgroundColor: isCliente ? '#fff' : isAtendente ? '#0EA5E9' : '#F3F4F6',
                          color: isAtendente ? '#fff' : '#1a1a1a',
                          border: isCliente ? '1px solid #E5E7EB' : 'none',
                        }}>
                        <div className={`text-[9px] font-bold uppercase mb-1 ${isAtendente ? 'text-white/70' : 'text-gray-400'}`}>
                          {isCliente ? 'Cliente' : isAtendente ? 'Você' : 'IA / Sistema'}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.conteudo}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-gray-100 flex-shrink-0">
                {!emAtendimento && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1.5 mb-2">
                    Assuma o atendimento para poder responder ao cliente.
                  </p>
                )}
                <div className="flex gap-2">
                  <input value={resposta} onChange={e => setResposta(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && responder()}
                    disabled={!emAtendimento || enviando}
                    placeholder={emAtendimento ? 'Escreva para o cliente…' : 'Assuma o atendimento primeiro'}
                    className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400" />
                  <button onClick={responder} disabled={!resposta.trim() || !emAtendimento || enviando}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40"
                    style={{ backgroundColor: '#0EA5E9' }}>
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Contexto */}
        {selecionado && conversa && <PainelContexto conversa={conversa} />}
      </div>
    </div>
  )
}
