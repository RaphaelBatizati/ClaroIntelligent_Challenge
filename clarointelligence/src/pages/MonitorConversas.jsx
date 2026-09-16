import { useState, useEffect, useCallback } from 'react'
import {
  Search, X, MessageSquare, Smartphone, Globe, Phone, Clock, FileText,
  SlidersHorizontal, ChevronLeft, ChevronRight, AlertTriangle, Brain, Shield,
  RotateCw, CheckCircle,
} from 'lucide-react'
import { api } from '../services/api'

const CANAIS = {
  site: { label: 'Site', Icon: Globe, cor: '#8B5CF6' },
  app: { label: 'App Minha Claro', Icon: Smartphone, cor: '#3B82F6' },
  whatsapp: { label: 'WhatsApp', Icon: MessageSquare, cor: '#25D366' },
  callcenter: { label: 'Call Center', Icon: Phone, cor: '#E8002A' },
}

const NIVEIS = {
  normal: { label: 'Normal', cor: '#10B981' },
  alerta: { label: 'Alerta', cor: '#F97316' },
  risco: { label: 'Risco', cor: '#F59E0B' },
  transbordo: { label: 'Transbordo', cor: '#EF4444' },
}

const STATUS = {
  ativa: { label: 'Ativa', cor: '#3B82F6' },
  transferida: { label: 'Transferida', cor: '#F59E0B' },
  em_atendimento_humano: { label: 'Com atendente', cor: '#0EA5E9' },
  encerrada: { label: 'Encerrada', cor: '#10B981' },
}

const LINHAS = {
  residencial: 'Residencial', movel: 'Móvel', tv: 'Claro tv+', empresas: 'Empresas',
}

const PERSONAS = {
  digital: 'Digital', intermediario: 'Intermediário', assistido: 'Assistido', informal: 'Informal',
}

const FILTROS_INICIAIS = {
  busca: '', canal: '', status: '', linha: '', persona: '', risco: '',
  data_inicio: '', data_fim: '', hora_inicio: '', hora_fim: '',
  ordenar: 'recentes', pagina: 1, limite: 24,
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

/** Chip de filtro com contador vindo das facetas. */
function Chip({ ativo, cor, children, total, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${ativo ? 'text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
      style={ativo ? { backgroundColor: cor || '#E8002A' } : {}}>
      {children}
      {total !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${ativo ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
          {total}
        </span>
      )}
    </button>
  )
}

/** Drawer com o detalhe real da conversa, alimentado pela API. */
function DrawerConversa({ sessaoId, onFechar }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let cancelado = false
    api.conversa(sessaoId)
      .then(d => { if (!cancelado) setDados(d) })
      .catch(e => { if (!cancelado) setErro(e.message) })
    return () => { cancelado = true }
  }, [sessaoId])

  const s = dados?.sessao
  const canal = CANAIS[s?.canal] || CANAIS.site

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onFechar} />
      <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <canal.Icon size={15} style={{ color: canal.cor }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-900 truncate">{s?.cliente_nome || 'Carregando…'}</h3>
            <p className="text-[11px] text-gray-400">
              {canal.label} · {s?.produto_nome || 'produto não resolvido'}
            </p>
          </div>
          <button onClick={onFechar} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {erro && <div className="p-5 text-xs text-red-500">{erro}</div>}

        {dados && (
          <div className="p-5 space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Atrito', valor: s.score_atrito, cor: NIVEIS[nivelDe(s.score_atrito)].cor },
                { label: 'Churn', valor: `${s.risco_churn || 0}%`, cor: '#EF4444' },
                { label: 'Mensagens', valor: dados.mensagens.length, cor: '#6B7280' },
                { label: 'Status', valor: STATUS[s.status]?.label || s.status, cor: STATUS[s.status]?.cor || '#6B7280' },
              ].map(m => (
                <div key={m.label} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="text-[9px] text-gray-400 uppercase">{m.label}</div>
                  <div className="text-sm font-bold" style={{ color: m.cor }}>{m.valor}</div>
                </div>
              ))}
            </div>

            {/* Protocolo e jornada */}
            {dados.protocolo && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={12} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Protocolo {dados.protocolo.numero_formatado}</span>
                  <span className="ml-auto text-[10px] font-semibold text-slate-600 capitalize">{dados.protocolo.status}</span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2">{dados.protocolo.assunto}</p>
                <div className="space-y-1.5">
                  {dados.protocolo.eventos?.map((e, i) => (
                    <div key={i} className="flex gap-2 text-[10px] text-slate-600">
                      <span className="text-slate-400 font-mono flex-shrink-0">{e.created_at?.slice(11, 16)}</span>
                      <span className="uppercase text-slate-400 flex-shrink-0 w-16">{e.canal}</span>
                      <span className="leading-snug">{e.descricao}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sinais de atrito */}
            {dados.sinais_atrito?.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="text-[10px] font-bold text-red-500 uppercase">Sinais de atrito detectados</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dados.sinais_atrito.map((sig, i) => (
                    <span key={i} className="text-[10px] bg-white text-red-600 px-2 py-1 rounded-lg font-medium capitalize">
                      {sig.tipo?.replace(/_/g, ' ')} <strong>+{sig.valor}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Eventos de segurança */}
            {dados.eventos_seguranca?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield size={12} className="text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Eventos de segurança</span>
                </div>
                {dados.eventos_seguranca.map((e, i) => (
                  <div key={i} className="text-[10px] text-amber-700 mb-1">
                    <span className="font-semibold capitalize">{e.tipo?.replace(/_/g, ' ')}</span> · {e.padrao_detectado?.replace(/_/g, ' ')} · <em>{e.acao}</em>
                  </div>
                ))}
              </div>
            )}

            {/* Transcrição */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Transcrição ({dados.mensagens.length})</div>
              <div className="space-y-2">
                {dados.mensagens.map(m => {
                  const isCliente = m.papel === 'cliente'
                  const isAtendente = m.papel === 'atendente'
                  return (
                    <div key={m.id} className={`flex ${isCliente ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-[80%] rounded-xl px-3 py-2"
                        style={{
                          backgroundColor: m.bloqueado_guardrail ? '#FEF2F2' : isCliente ? '#F3F4F6' : isAtendente ? '#E0F2FE' : '#FFF1F2',
                          border: m.bloqueado_guardrail ? '1px solid #FECACA' : 'none',
                        }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-bold uppercase text-gray-400">
                            {isCliente ? 'Cliente' : isAtendente ? 'Atendente' : 'IA'}
                          </span>
                          {m.intencao_codigo && (
                            <span className="text-[9px] text-gray-400">· {m.intencao_codigo.replace(/_/g, ' ')}</span>
                          )}
                          <span className="text-[9px] text-gray-300 ml-auto font-mono">{m.created_at?.slice(11, 16)}</span>
                        </div>
                        <p className="text-[12px] text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{m.conteudo}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Memória */}
            {dados.memoria?.length > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Brain size={12} className="text-green-600" />
                  <span className="text-[10px] font-bold text-green-600 uppercase">ClaroMemory gravado</span>
                </div>
                {dados.memoria.map((m, i) => (
                  <p key={i} className="text-[10px] text-green-700 leading-snug mb-1">{m.resumo}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MonitorConversas() {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [resultado, setResultado] = useState(null)
  const [facetas, setFacetas] = useState(null)
  const [selecionada, setSelecionada] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [avancados, setAvancados] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const buscar = useCallback(async (f) => {
    setCarregando(true)
    try {
      const [dados, fac] = await Promise.all([
        api.conversas(f),
        api.conversaFacetas({ data_inicio: f.data_inicio, data_fim: f.data_fim }),
      ])
      setResultado(dados)
      setFacetas(fac)
      setErro(null)
    } catch {
      setErro('API offline — inicie o backend com npm run server')
    } finally {
      setCarregando(false)
    }
  }, [])

  // Debounce na busca textual; os demais filtros aplicam imediatamente
  useEffect(() => {
    const t = setTimeout(() => buscar(filtros), filtros.busca ? 350 : 0)
    return () => clearTimeout(t)
  }, [filtros, buscar])

  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(() => buscar(filtros), 10000)
    return () => clearInterval(iv)
  }, [autoRefresh, filtros, buscar])

  function set(campo, valor) {
    setFiltros(f => ({ ...f, [campo]: f[campo] === valor ? '' : valor, pagina: 1 }))
  }
  function setDireto(campo, valor) {
    setFiltros(f => ({ ...f, [campo]: valor, pagina: 1 }))
  }

  const facetaTotal = (dim, chave) => facetas?.[dim]?.find(x => x.chave === chave)?.total ?? 0
  const filtrosAtivos = Object.entries(filtros).filter(([k, v]) => v && !['ordenar', 'pagina', 'limite'].includes(k)).length

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 space-y-3">
          {/* Linha 1: busca + ordenação */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={filtros.busca}
                onChange={e => setDireto('busca', e.target.value)}
                placeholder="Buscar por cliente, protocolo, produto ou id da sessão…"
                className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E8002A]/30 focus:border-[#E8002A] transition-all" />
            </div>

            <select value={filtros.ordenar} onChange={e => setDireto('ordenar', e.target.value)}
              className="text-[11px] font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-gray-600 focus:outline-none">
              <option value="recentes">Mais recentes</option>
              <option value="score">Maior atrito</option>
              <option value="duracao">Maior duração</option>
              <option value="antigas">Mais antigas</option>
            </select>

            <button onClick={() => setAvancados(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${avancados ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              <SlidersHorizontal size={12} />
              Data e hora
              {(filtros.data_inicio || filtros.hora_inicio) && <span className="w-1.5 h-1.5 rounded-full bg-[#E8002A]" />}
            </button>

            <button onClick={() => setAutoRefresh(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${autoRefresh ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'}`}>
              <RotateCw size={12} className={autoRefresh && carregando ? 'animate-spin' : ''} />
              {autoRefresh ? 'Ao vivo' : 'Pausado'}
            </button>

            {filtrosAtivos > 0 && (
              <button onClick={() => setFiltros(FILTROS_INICIAIS)}
                className="text-[11px] text-gray-400 hover:text-gray-600 px-2">
                Limpar ({filtrosAtivos})
              </button>
            )}
          </div>

          {/* Linha 2: canal — a origem da interação */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase w-14">Canal</span>
            {Object.entries(CANAIS).map(([key, c]) => (
              <Chip key={key} ativo={filtros.canal === key} cor={c.cor} total={facetaTotal('canal', key)} onClick={() => set('canal', key)}>
                <c.Icon size={11} /> {c.label}
              </Chip>
            ))}
          </div>

          {/* Linha 3: nível de atrito */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase w-14">Atrito</span>
            {Object.entries(NIVEIS).map(([key, n]) => (
              <Chip key={key} ativo={filtros.risco === key} cor={n.cor} total={facetaTotal('risco', key)} onClick={() => set('risco', key)}>
                {n.label}
              </Chip>
            ))}
            <span className="text-[10px] font-bold text-gray-400 uppercase ml-3">Status</span>
            {Object.entries(STATUS).map(([key, s]) => (
              <Chip key={key} ativo={filtros.status === key} cor={s.cor} total={facetaTotal('status', key)} onClick={() => set('status', key)}>
                {s.label}
              </Chip>
            ))}
          </div>

          {/* Linha 4: produto e persona */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase w-14">Produto</span>
            {Object.entries(LINHAS).map(([key, label]) => (
              <Chip key={key} ativo={filtros.linha === key} total={facetaTotal('linha', key)} onClick={() => set('linha', key)}>
                {label}
              </Chip>
            ))}
            <span className="text-[10px] font-bold text-gray-400 uppercase ml-3">Persona</span>
            {Object.entries(PERSONAS).map(([key, label]) => (
              <Chip key={key} ativo={filtros.persona === key} total={facetaTotal('persona', key)} onClick={() => set('persona', key)}>
                {label}
              </Chip>
            ))}
          </div>

          {/* Linha 5: recorte temporal */}
          {avancados && (
            <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Data inicial</label>
                <input type="date" value={filtros.data_inicio} onChange={e => setDireto('data_inicio', e.target.value)}
                  className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Data final</label>
                <input type="date" value={filtros.data_fim} onChange={e => setDireto('data_fim', e.target.value)}
                  className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Hora inicial</label>
                <input type="time" value={filtros.hora_inicio} onChange={e => setDireto('hora_inicio', e.target.value)}
                  className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Hora final</label>
                <input type="time" value={filtros.hora_fim} onChange={e => setDireto('hora_fim', e.target.value)}
                  className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none" />
              </div>
              <button onClick={() => setFiltros(f => ({ ...f, data_inicio: hoje(), data_fim: hoje(), pagina: 1 }))}
                className="text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5">
                Somente hoje
              </button>
              <button onClick={() => setFiltros(f => ({ ...f, hora_inicio: '18:00', hora_fim: '21:00', pagina: 1 }))}
                className="text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5">
                Pico 18h–21h
              </button>

              {/* Distribuição por hora — mostra onde está o volume */}
              {facetas?.hora?.length > 0 && (
                <div className="flex items-end gap-0.5 h-10 ml-auto">
                  {facetas.hora.map(h => {
                    const max = Math.max(...facetas.hora.map(x => x.total))
                    return (
                      <div key={h.chave} className="flex flex-col items-center gap-0.5" title={`${h.chave}h — ${h.total} conversas`}>
                        <div className="w-2.5 rounded-t bg-[#E8002A]/60" style={{ height: `${Math.max((h.total / max) * 28, 2)}px` }} />
                        <span className="text-[7px] text-gray-400">{h.chave}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé: total e paginação */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-xl">
          <span className="text-[11px] text-gray-500">
            {carregando ? 'Buscando…' : (
              <><strong className="text-gray-800">{resultado?.total ?? 0}</strong> conversa(s)
                {facetas?.total ? <span className="text-gray-400"> de {facetas.total} no período</span> : null}</>
            )}
          </span>
          {resultado?.paginas > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={filtros.pagina <= 1}
                onClick={() => setFiltros(f => ({ ...f, pagina: f.pagina - 1 }))}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                <ChevronLeft size={14} className="text-gray-500" />
              </button>
              <span className="text-[11px] text-gray-500">{filtros.pagina} / {resultado.paginas}</span>
              <button disabled={filtros.pagina >= resultado.paginas}
                onClick={() => setFiltros(f => ({ ...f, pagina: f.pagina + 1 }))}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                <ChevronRight size={14} className="text-gray-500" />
              </button>
            </div>
          )}
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">{erro}</div>}

      {/* Grade de conversas */}
      <div className="grid grid-cols-3 gap-4">
        {resultado?.itens?.map(c => {
          const canal = CANAIS[c.canal] || CANAIS.site
          const nivel = NIVEIS[c.nivel] || NIVEIS.normal
          const status = STATUS[c.status] || STATUS.ativa

          return (
            <button key={c.id} onClick={() => setSelecionada(c.id)}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-100 hover:-translate-y-0.5 text-left">
              <div className="flex items-start gap-3 mb-2.5">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-gray-600 text-[11px] font-semibold">
                  {c.cliente.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 text-xs truncate">{c.cliente.nome}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: status.cor }}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                    <canal.Icon size={9} style={{ color: canal.cor }} />
                    <span>{canal.label}</span>
                    <span className="text-gray-200">•</span>
                    <span className="truncate">{c.produto.nome || 'produto não resolvido'}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 leading-snug line-clamp-2 mb-2.5 min-h-[28px]">
                {c.ultima_mensagem || <em className="text-gray-300">sem mensagem do cliente</em>}
              </p>

              {/* Barra de atrito */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-gray-400">Atrito</span>
                  <span className="font-bold" style={{ color: nivel.cor }}>{c.score_atrito} · {nivel.label}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${c.score_atrito}%`, backgroundColor: nivel.cor }} />
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                <span className="flex items-center gap-1"><Clock size={9} /> {c.tempo_aberto}min</span>
                <span className="flex items-center gap-1"><MessageSquare size={9} /> {c.total_mensagens}</span>
                {c.verificado && <span className="flex items-center gap-1 text-green-500"><CheckCircle size={9} /> 2FA</span>}
                {c.protocolo_formatado && (
                  <span className="ml-auto font-mono text-[9px] text-gray-400 truncate">{c.protocolo_formatado}</span>
                )}
              </div>
            </button>
          )
        })}

        {resultado?.itens?.length === 0 && !carregando && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Search size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma conversa encontrada com esses filtros.</p>
            <button onClick={() => setFiltros(FILTROS_INICIAIS)} className="text-xs text-[#E8002A] font-semibold mt-2 hover:underline">
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {selecionada && <DrawerConversa sessaoId={selecionada} onFechar={() => setSelecionada(null)} />}
    </div>
  )
}

function nivelDe(score) {
  if (score >= 80) return 'transbordo'
  if (score >= 65) return 'risco'
  if (score >= 40) return 'alerta'
  return 'normal'
}
