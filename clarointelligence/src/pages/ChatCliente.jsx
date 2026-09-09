import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, User, Bot, Wifi, Smartphone, MessageCircle, Activity, Brain, Shield, ChevronRight, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { api } from '../services/api'

// ─── Configuração visual de cada canal ──────────────────────────────────────
const CANAL_CONFIG = {
  site: {
    label: 'Site claro.com.br',
    icon: Wifi,
    headerBg: '#0A1628',
    headerText: '#FFFFFF',
    accentColor: '#E8002A',
    botColor: '#E8002A',
    botAvatar: 'CI',
    msgBotBg: '#FFF1F2',
    msgBotText: '#1a1a1a',
    msgUserBg: '#E8002A',
    msgUserText: '#fff',
    inputBg: '#F7F8FC',
    description: 'Chat no portal web – experiência padrão Claro',
  },
  app: {
    label: 'App Minha Claro',
    icon: Smartphone,
    headerBg: '#E8002A',
    headerText: '#FFFFFF',
    accentColor: '#E8002A',
    botColor: '#E8002A',
    botAvatar: 'CI',
    msgBotBg: '#fff',
    msgBotText: '#1a1a1a',
    msgUserBg: '#E8002A',
    msgUserText: '#fff',
    inputBg: '#F7F8FC',
    description: 'Assistente no app mobile – fluxo integrado',
  },
  whatsapp: {
    label: 'WhatsApp Claro',
    icon: MessageCircle,
    headerBg: '#075E54',
    headerText: '#FFFFFF',
    accentColor: '#25D366',
    botColor: '#075E54',
    botAvatar: 'C',
    msgBotBg: '#FFFFFF',
    msgBotText: '#111',
    msgUserBg: '#DCF8C6',
    msgUserText: '#111',
    inputBg: '#fff',
    description: 'Atendimento via WhatsApp – número 21 99591-2000',
  },
}

const CLIENTES_ROTEIRO = [
  { id: 'cli-ana-souza', nome: 'Ana Souza', initials: 'AS', cor: '#3B82F6', roteiro: 'A – Continuidade entre canais', dica: 'Tente: "minha internet caiu" ou "ainda está lenta"' },
  { id: 'cli-carlos-mota', nome: 'Carlos Mota', initials: 'CM', cor: '#8B5CF6', roteiro: 'B – Desambiguação multiproduto', dica: 'Tente: "quero a segunda via" — sistema vai perguntar qual produto' },
  { id: 'cli-fernanda-lima', nome: 'Fernanda Lima', initials: 'FL', cor: '#F59E0B', roteiro: 'C – ClaroSense + transbordo', dica: 'Tente: "absurdo, não funciona! quero falar com humano"' },
  { id: 'cli-joao-santos', nome: 'João Santos', initials: 'JS', cor: '#10B981', roteiro: 'D – Multiproduto móvel+fibra', dica: 'Tente: "quero fazer uma recarga" ou "como está meu saldo"' },
]

// ─── Componente PainelTransparência ─────────────────────────────────────────
function PainelTransparencia({ ultimo }) {
  if (!ultimo) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center px-4">
        <Brain size={28} className="mb-2 opacity-40" />
        <p>Envie uma mensagem para ver o raciocínio do ClaroIntelligence em tempo real</p>
      </div>
    )
  }

  const nivel = ultimo.nivel_atrito || 'normal'
  const scoreCor = nivel === 'transbordo' ? '#EF4444' : nivel === 'risco' ? '#F59E0B' : nivel === 'alerta' ? '#F97316' : '#10B981'
  const memCount = ultimo.trechos_memoria?.length || 0

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <Brain size={14} style={{ color: '#E8002A' }} />
        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Painel de Transparência</span>
      </div>

      {/* Intenção */}
      <div className="bg-blue-50 rounded-lg p-3">
        <div className="text-[10px] font-semibold text-blue-400 uppercase mb-1">Intenção Detectada</div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-blue-800 capitalize">{(ultimo.intencao || 'geral').replace(/_/g, ' ')}</span>
          <span className="text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-bold">
            {ultimo.confianca_intencao ? Math.round(ultimo.confianca_intencao * 100) + '%' : '—'}
          </span>
        </div>
      </div>

      {/* Produto */}
      <div className="bg-purple-50 rounded-lg p-3">
        <div className="text-[10px] font-semibold text-purple-400 uppercase mb-1">Produto Resolvido</div>
        {ultimo.produto_foco ? (
          <>
            <div className="text-sm font-semibold text-purple-800">{ultimo.produto_foco}</div>
            <div className="text-[10px] text-purple-500 mt-0.5 capitalize">{ultimo.linha || 'linha não definida'}</div>
            {ultimo.produto_confirmado && (
              <div className="flex items-center gap-1 mt-1"><CheckCircle size={10} className="text-green-500" /><span className="text-[10px] text-green-600">Confirmado nesta sessão</span></div>
            )}
          </>
        ) : (
          <div className="text-sm text-purple-400 italic">Aguardando desambiguação</div>
        )}
      </div>

      {/* Persona */}
      <div className="bg-amber-50 rounded-lg p-3">
        <div className="text-[10px] font-semibold text-amber-400 uppercase mb-1">Persona Detectada</div>
        <div className="text-sm font-semibold text-amber-800 capitalize">{ultimo.persona || 'intermediario'}</div>
        <div className="text-[10px] text-amber-500 mt-0.5">
          {ultimo.persona === 'digital' ? 'Tom técnico, respostas diretas' : ultimo.persona === 'assistido' ? 'Tom simplificado, suporte contínuo' : 'Tom equilibrado e claro'}
        </div>
      </div>

      {/* ClaroSense Score */}
      <div className="rounded-lg p-3" style={{ backgroundColor: `${scoreCor}15` }}>
        <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: scoreCor }}>ClaroSense — Score de Atrito</div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black leading-none" style={{ color: scoreCor }}>{ultimo.score_atrito ?? '—'}</span>
          <span className="text-xs text-gray-500 mb-0.5">/ 100</span>
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: scoreCor }}>
            {nivel.toUpperCase()}
          </span>
        </div>
        <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${ultimo.score_atrito || 0}%`, backgroundColor: scoreCor }} />
        </div>
        {ultimo.sinais_atrito?.length > 0 && (
          <div className="mt-2 space-y-1">
            {ultimo.sinais_atrito.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: scoreCor }}>
                <AlertTriangle size={9} />
                <span className="capitalize">{s.tipo?.replace(/_/g, ' ')}: +{s.valor}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ClaroMemory */}
      <div className={`rounded-lg p-3 ${memCount > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
        <div className={`text-[10px] font-semibold uppercase mb-1 ${memCount > 0 ? 'text-green-500' : 'text-gray-400'}`}>ClaroMemory</div>
        {memCount > 0 ? (
          <div className="space-y-1">
            {ultimo.trechos_memoria.map((t, i) => (
              <div key={i} className="text-[10px] text-green-700 bg-white rounded p-1.5">
                <span className="font-semibold uppercase">{t.canal}</span> · {t.minutosAtras}min atrás
                <p className="text-gray-500 mt-0.5 line-clamp-2">{t.resumo}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-gray-400">Nenhum contexto anterior recuperado</div>
        )}
      </div>

      {/* Intervenção */}
      {ultimo.intervencao && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-[10px] font-semibold text-red-400 uppercase mb-1">Intervenção Automática</div>
          <div className="text-xs font-bold text-red-700">{ultimo.intervencao.tipo?.replace(/_/g, ' ')}</div>
          <div className="text-[10px] text-red-500 mt-0.5">{ultimo.intervencao.acao}</div>
          <div className="text-[9px] text-red-300 mt-1">Gatilho: {ultimo.intervencao.gatilho}</div>
        </div>
      )}

      {/* Sessão */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Sessão</div>
        <div className="text-[10px] text-gray-500 font-mono truncate">{ultimo.sessao_id}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">{ultimo.aguardando_desambiguacao ? '⏳ Aguardando resposta do cliente' : '✅ Processado'}</div>
      </div>
    </div>
  )
}

// ─── Render de mensagem em Markdown light ────────────────────────────────────
function renderMsg(texto) {
  const lines = texto.split('\n')
  return lines.map((line, i) => {
    // Bold **text**
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    return (
      <span key={i}>
        {parts.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>
          if (p.startsWith('*') && p.endsWith('*')) return <em key={j}>{p.slice(1, -1)}</em>
          if (p.startsWith('`') && p.endsWith('`')) return <code key={j} className="bg-black/10 px-1 py-0.5 rounded text-[11px] font-mono">{p.slice(1, -1)}</code>
          return <span key={j}>{p}</span>
        })}
        {i < lines.length - 1 && <br />}
      </span>
    )
  })
}

// ─── Componente principal ChatCliente ────────────────────────────────────────
export default function ChatCliente() {
  const [canal, setCanal] = useState('site')
  const [clienteId, setClienteId] = useState('cli-ana-souza')
  const [sessaoId, setSessaoId] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [typing, setTyping] = useState(false)
  const [ultimoRetorno, setUltimoRetorno] = useState(null)
  const [mostrarPainel, setMostrarPainel] = useState(true)
  const [apiOnline, setApiOnline] = useState(null)
  const [portfolio, setPortfolio] = useState([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const cfg = CANAL_CONFIG[canal]
  const clienteAtual = CLIENTES_ROTEIRO.find(c => c.id === clienteId)

  // Verificar API
  useEffect(() => {
    api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false))
  }, [])

  // Carregar portfolio do cliente
  useEffect(() => {
    if (clienteId) api.portfolio(clienteId).then(setPortfolio).catch(() => setPortfolio([]))
  }, [clienteId])

  // Scroll para o fundo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, typing])

  // Trocar de cliente ou canal = reiniciar chat
  const reiniciar = useCallback(() => {
    setMensagens([])
    setSessaoId(null)
    setUltimoRetorno(null)
    setInput('')
  }, [])

  useEffect(() => { reiniciar() }, [clienteId, canal])

  // Animação de "digitando"
  function typewriterEffect(texto, cb) {
    let i = 0
    setTyping(true)
    const interval = setInterval(() => {
      i++
      if (i >= texto.length) {
        clearInterval(interval)
        setTyping(false)
        cb()
      }
    }, 18)
  }

  async function enviarMensagem() {
    const txt = input.trim()
    if (!txt || carregando) return
    setInput('')
    setCarregando(true)

    const msgCliente = { id: Date.now(), papel: 'cliente', conteudo: txt }
    setMensagens(prev => [...prev, msgCliente])

    try {
      const retorno = await api.chat({ cliente_id: clienteId, canal, mensagem: txt, sessao_id: sessaoId })
      setSessaoId(retorno.sessao_id)
      setUltimoRetorno(retorno)

      // Simula digitação
      const msgBot = { id: Date.now() + 1, papel: 'sistema', conteudo: '', retorno }
      setMensagens(prev => [...prev, msgBot])

      let idx = 0
      const total = retorno.resposta.length
      setTyping(true)
      const iv = setInterval(() => {
        idx += 3
        setMensagens(prev => {
          const clone = [...prev]
          clone[clone.length - 1] = { ...msgBot, conteudo: retorno.resposta.slice(0, idx) }
          return clone
        })
        if (idx >= total) {
          clearInterval(iv)
          setTyping(false)
          setMensagens(prev => {
            const clone = [...prev]
            clone[clone.length - 1] = { ...msgBot, conteudo: retorno.resposta }
            return clone
          })
        }
      }, 20)

    } catch (err) {
      setMensagens(prev => [...prev, { id: Date.now() + 1, papel: 'erro', conteudo: 'Erro ao conectar com a API: ' + err.message }])
    } finally {
      setCarregando(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <div className="flex gap-4 h-full">
      {/* ─── Coluna esquerda: seleção ──────────────────── */}
      <div className="w-56 flex-shrink-0 space-y-3">
        {/* Status API */}
        <div className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-2 ${apiOnline ? 'bg-green-50 text-green-600' : apiOnline === false ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {apiOnline ? 'API online' : apiOnline === false ? 'API offline – inicie npm run server' : 'Verificando…'}
        </div>

        {/* Seleção de canal */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Canal de Atendimento</p>
          <div className="space-y-1">
            {Object.entries(CANAL_CONFIG).map(([key, c]) => (
              <button
                key={key}
                onClick={() => setCanal(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${canal === key ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                style={{ backgroundColor: canal === key ? c.headerBg : undefined }}
              >
                <c.icon size={13} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Seleção de cliente */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Cliente (Roteiro)</p>
          <div className="space-y-1">
            {CLIENTES_ROTEIRO.map(c => (
              <button
                key={c.id}
                onClick={() => setClienteId(c.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-[11px] transition-all ${clienteId === c.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: c.cor }}>
                  {c.initials}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.nome}</div>
                  <div className={`text-[9px] truncate ${clienteId === c.id ? 'text-gray-400' : 'text-gray-400'}`}>Roteiro {c.roteiro.split(' – ')[0]}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dica */}
        {clienteAtual && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[9px] font-bold text-amber-500 uppercase mb-1">Roteiro {clienteAtual.roteiro}</p>
            <p className="text-[10px] text-amber-700">{clienteAtual.dica}</p>
          </div>
        )}

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Portfólio Claro</p>
            <div className="space-y-1">
              {portfolio.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="truncate">{c.produto_nome}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={reiniciar} className="w-full text-[11px] text-gray-400 hover:text-gray-600 py-1">
          ↺ Nova conversa
        </button>
      </div>

      {/* ─── Chat principal ─────────────────────────────── */}
      <div className="flex-1 flex gap-3 min-w-0">
        {/* Janela de chat */}
        <div className="flex-1 flex flex-col rounded-2xl shadow-md overflow-hidden border border-gray-200 min-w-0">
          {/* Header do canal */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ backgroundColor: cfg.headerBg }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: cfg.accentColor }}>
              {cfg.botAvatar}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: cfg.headerText }}>Claro Assistente</div>
              <div className="text-[10px] opacity-60" style={{ color: cfg.headerText }}>{cfg.label}</div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] opacity-60" style={{ color: cfg.headerText }}>online</span>
            </div>
          </div>

          {/* Mensagens */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ backgroundColor: canal === 'whatsapp' ? '#ECE5DD' : '#F7F8FC' }}
          >
            {mensagens.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">👋</div>
                <p className="text-sm text-gray-500 font-medium">Olá, {clienteAtual?.nome?.split(' ')[0]}!</p>
                <p className="text-xs text-gray-400 mt-1">{cfg.description}</p>
              </div>
            )}

            {mensagens.map((msg) => {
              const isUser = msg.papel === 'cliente'
              const isErr = msg.papel === 'erro'
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && !isErr && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold mr-2 mt-1 flex-shrink-0" style={{ backgroundColor: cfg.botColor }}>
                      {cfg.botAvatar}
                    </div>
                  )}
                  <div
                    className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                    style={{
                      backgroundColor: isErr ? '#FEE2E2' : isUser ? cfg.msgUserBg : cfg.msgBotBg,
                      color: isErr ? '#EF4444' : isUser ? cfg.msgUserText : cfg.msgBotText,
                      borderBottomRightRadius: isUser ? 4 : 16,
                      borderBottomLeftRadius: isUser ? 16 : 4,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                    }}
                  >
                    <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{renderMsg(msg.conteudo)}</div>
                    {/* Badge de intervenção */}
                    {msg.retorno?.intervencao && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-red-500">
                        <AlertTriangle size={10} />
                        <span>ClaroSense: {msg.retorno.intervencao.tipo?.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {/* Badge de memória */}
                    {msg.retorno?.trechos_memoria?.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-green-600 font-medium">
                        <Brain size={9} />
                        <span>ClaroMemory recuperou {msg.retorno.trechos_memoria.length} contexto(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {typing && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold mr-2 mt-1" style={{ backgroundColor: cfg.botColor }}>
                  {cfg.botAvatar}
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-3 border-t border-gray-100 flex-shrink-0" style={{ backgroundColor: cfg.inputBg }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
              placeholder="Digite sua mensagem..."
              disabled={carregando || !apiOnline}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 bg-white placeholder:text-gray-300 disabled:opacity-50"
            />
            <button
              onClick={enviarMensagem}
              disabled={!input.trim() || carregando || !apiOnline}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: cfg.accentColor }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* ─── Painel de Transparência ─────────── */}
        <div className={`transition-all duration-300 ${mostrarPainel ? 'w-64' : 'w-0 overflow-hidden'} flex-shrink-0`}>
          <div className="w-64 h-full bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="text-[11px] font-bold text-gray-600">IA Transparência</span>
              <button onClick={() => setMostrarPainel(false)} className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PainelTransparencia ultimo={ultimoRetorno} />
            </div>
          </div>
        </div>
      </div>

      {/* Botão para reabrir painel */}
      {!mostrarPainel && (
        <button
          onClick={() => setMostrarPainel(true)}
          className="fixed right-6 bottom-24 flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
        >
          <Brain size={13} style={{ color: '#E8002A' }} />
          IA
        </button>
      )}
    </div>
  )
}
