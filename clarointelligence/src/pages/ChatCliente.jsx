import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Wifi, Smartphone, MessageCircle, Brain, Shield, ShieldCheck, ShieldAlert,
  AlertTriangle, CheckCircle, FileText, Users, Clock, Headphones, TrendingDown,
} from 'lucide-react'
import { api } from '../services/api'

// ─── Configuração visual de cada canal ──────────────────────────────────────
const CANAL_CONFIG = {
  site: {
    label: 'Site claro.com.br', icon: Wifi, headerBg: '#0A1628', headerText: '#FFFFFF',
    accentColor: '#E8002A', botColor: '#E8002A', botAvatar: 'CI',
    msgBotBg: '#FFF1F2', msgBotText: '#1a1a1a', msgUserBg: '#E8002A', msgUserText: '#fff',
    inputBg: '#F7F8FC', fundo: '#F7F8FC',
    description: 'Chat no portal web — experiência padrão Claro',
  },
  app: {
    label: 'App Minha Claro', icon: Smartphone, headerBg: '#E8002A', headerText: '#FFFFFF',
    accentColor: '#E8002A', botColor: '#E8002A', botAvatar: 'CI',
    msgBotBg: '#fff', msgBotText: '#1a1a1a', msgUserBg: '#E8002A', msgUserText: '#fff',
    inputBg: '#F7F8FC', fundo: '#F7F8FC',
    description: 'Assistente no app mobile — fluxo integrado',
  },
  whatsapp: {
    label: 'WhatsApp Claro', icon: MessageCircle, headerBg: '#075E54', headerText: '#FFFFFF',
    accentColor: '#25D366', botColor: '#075E54', botAvatar: 'C',
    msgBotBg: '#FFFFFF', msgBotText: '#111', msgUserBg: '#DCF8C6', msgUserText: '#111',
    inputBg: '#fff', fundo: '#ECE5DD',
    description: 'Atendimento via WhatsApp — identifica pelo número e confirma por SMS',
  },
}

// Clientes do roteiro do pitch (docs/ROTEIRO_PITCH.md), na ordem em que
// aparecem na gravação. As falas de cada um ficam clicáveis no painel lateral,
// para não haver erro de digitação no meio da demonstração.
const CLIENTES_PITCH = [
  {
    id: 'cli-tiago-ramos', nome: 'Tiago Ramos', initials: 'TR', cor: '#14B8A6', roteiro: 'H',
    persona: 'informal', plano: 'Claro Pós 50GB (móvel)',
    titulo: 'Informal — paga a conta sozinho no chat',
    dica: 'Bloco 1 do pitch: resolve tudo no chat, sem fila e sem atendente.',
    script: [
      'e aí, quero pagar a conta do meu celular',
      'isso, pode gerar o pix',
    ],
  },
  {
    id: 'cli-nexo-log', nome: 'Nexo Log Transportes', initials: 'NL', cor: '#F97316', roteiro: 'I',
    persona: 'digital', plano: 'Fibra 500 empresarial (CNPJ)',
    titulo: 'Técnica — erro repetido → transbordo automático',
    dica: 'Bloco 2 do pitch: a repetição e o tom elevam o score até a transferência automática.',
    script: [
      'o portal empresarial retorna erro CLR-4032 ao emitir a fatura',
      'continua o mesmo erro, já limpei o cache e troquei de navegador',
      'de novo isso, é a terceira vez que reporto o erro CLR-4032',
      'ISSO É INACEITÁVEL, TEMOS SLA CONTRATADO E VOU ACIONAR A ANATEL',
    ],
  },
  {
    id: 'cli-helena-duarte', nome: 'Helena Duarte', initials: 'HD', cor: '#A855F7', roteiro: 'G',
    persona: 'assistido', plano: 'Fibra 350 Mega (residencial)',
    titulo: 'Guiada — problema de internet → atendente',
    dica: 'Extensão do pitch: o atrito sobe, ela pede uma pessoa, mas não chega ao nível crítico. No WhatsApp, serve também para mostrar a identificação por SMS.',
    script: [
      'minha internet fica caindo toda hora',
      'isso é frustrante, já tentei de tudo e continua caindo',
      'prefiro falar com uma pessoa, por favor',
    ],
  },
  {
    id: 'cli-roberto-alves', nome: 'Roberto Alves', initials: 'RA', cor: '#EC4899', roteiro: 'E',
    persona: 'informal', plano: 'Claro Controle 40GB (móvel)',
    titulo: 'Call center → chat, pelo protocolo',
    dica: 'Extensão do pitch: ele tem protocolo aberto no call center há 3h — o chat retoma de onde parou.',
    script: [
      'e aí, tenho que pagar essa conta?',
    ],
  },
]

// Demais roteiros documentados em docs/COMO_RODAR.md. Ficam fora da lista
// principal para a tela do pitch não ter distração, mas continuam acessíveis.
const CLIENTES_EXTRAS = [
  { id: 'cli-ana-souza', nome: 'Ana Souza', initials: 'AS', cor: '#3B82F6', roteiro: 'A', persona: 'intermediario', plano: 'Fibra 500 Mega', titulo: 'Continuidade entre canais', dica: 'Tente: "minha internet está lenta" — e depois troque de canal para ver o ClaroMemory recuperar o contexto' },
  { id: 'cli-carlos-mota', nome: 'Carlos Mota', initials: 'CM', cor: '#8B5CF6', roteiro: 'B', persona: 'digital', plano: '4 contratos em 3 linhas', titulo: 'Desambiguação multiproduto', dica: 'Tente: "quero a segunda via" — ele tem 4 contratos, o sistema vai perguntar qual' },
  { id: 'cli-fernanda-lima', nome: 'Fernanda Lima', initials: 'FL', cor: '#F59E0B', roteiro: 'C', persona: 'assistido', plano: 'Fibra 350 Mega', titulo: 'ClaroSense → fila humana', dica: 'Tente: "já tentei várias vezes" e depois "ISSO É UM ABSURDO, quero falar com humano"' },
  { id: 'cli-joao-santos', nome: 'João Santos', initials: 'JS', cor: '#10B981', roteiro: 'D', persona: 'intermediario', plano: 'Fibra 500 + Max Flex', titulo: 'Autoatendimento com upgrade', dica: 'Tente: "quero aumentar a velocidade da internet" e confirme' },
  { id: 'cli-vega-solucoes', nome: 'Vega Soluções', initials: 'VS', cor: '#0EA5E9', roteiro: 'F', persona: 'digital', plano: 'Empresarial: 18 chips + link dedicado', titulo: 'Cliente empresarial (CNPJ)', dica: 'Tente: "o link dedicado está oscilando" — chip empresarial + link dedicado com SLA' },
]

// No WhatsApp a conversa começa pela identificação: o número é reconhecido e um
// código sai por SMS. Por isso o roteiro ganha um cumprimento na frente — é ele
// que dispara o código, antes de qualquer fala sobre o contrato.
const ABERTURA_WHATSAPP = 'Oi, tudo bem?'

const PERSONA_INFO = {
  digital: { label: 'Digital', cor: '#3B82F6', desc: 'Tom técnico, respostas diretas' },
  intermediario: { label: 'Intermediário', cor: '#F59E0B', desc: 'Tom equilibrado e claro' },
  assistido: { label: 'Assistido', cor: '#8B5CF6', desc: 'Tom simplificado, suporte contínuo' },
  informal: { label: 'Informal', cor: '#14B8A6', desc: 'Linguagem coloquial, tom espelhado' },
}

// ─── Renderização de markdown leve ──────────────────────────────────────────
function renderMsg(texto) {
  if (!texto) return null
  return texto.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    return (
      <span key={i}>
        {parts.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>
          if (p.startsWith('*') && p.endsWith('*')) return <em key={j}>{p.slice(1, -1)}</em>
          if (p.startsWith('`') && p.endsWith('`')) return <code key={j} className="bg-black/10 px-1 py-0.5 rounded text-[10px] font-mono break-all">{p.slice(1, -1)}</code>
          return <span key={j}>{p}</span>
        })}
        {i < texto.split('\n').length - 1 && <br />}
      </span>
    )
  })
}

// ─── Painel de transparência da IA ──────────────────────────────────────────
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
  const persona = PERSONA_INFO[ultimo.persona] || PERSONA_INFO.intermediario
  const churn = ultimo.risco_churn

  return (
    <div className="p-3 space-y-2.5 overflow-y-auto h-full">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <Brain size={14} style={{ color: '#E8002A' }} />
        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Transparência da IA</span>
      </div>

      {/* Guardrail acionado */}
      {ultimo.bloqueado_guardrail && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldAlert size={12} className="text-red-500" />
            <span className="text-[10px] font-bold text-red-600 uppercase">Guardrail acionado</span>
          </div>
          <div className="text-xs font-semibold text-red-700 capitalize">{ultimo.guardrail?.tipo?.replace(/_/g, ' ')}</div>
          <div className="text-[10px] text-red-500 mt-0.5">Padrão: {ultimo.guardrail?.padrao?.replace(/_/g, ' ')}</div>
          <div className="text-[10px] text-red-400 mt-1 leading-snug">
            A mensagem foi bloqueada antes de chegar ao resolver de produto, aos adaptadores e ao LLM.
          </div>
        </div>
      )}

      {/* Protocolo */}
      {ultimo.protocolo && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={11} className="text-slate-500" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Protocolo</span>
          </div>
          <div className="text-xs font-mono font-bold text-slate-700">{ultimo.protocolo}</div>
          {ultimo.protocolo_status === 'resolvido' && (
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle size={10} className="text-green-500" />
              <span className="text-[10px] text-green-600 font-semibold">Encerrado via {ultimo.resolvido_por?.replace(/_/g, ' ')}</span>
            </div>
          )}
          {ultimo.protocolos_abertos?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Outros em aberto</div>
              {ultimo.protocolos_abertos.map((p, i) => (
                <div key={i} className="text-[10px] text-slate-600">
                  <span className="font-mono">{p.numero}</span> · {p.canal} · há {p.horasAtras}h
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verificação 2FA */}
      {ultimo.verificacao?.pendente && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield size={11} className="text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600 uppercase">Verificação em 2 etapas</span>
          </div>
          <div className="text-[10px] text-amber-700">Aguardando código enviado para {ultimo.verificacao.destino_mascarado}</div>
        </div>
      )}

      {/* Intenção */}
      <div className="bg-blue-50 rounded-lg p-3">
        <div className="text-[10px] font-semibold text-blue-400 uppercase mb-1">Intenção detectada</div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-800 capitalize">{(ultimo.intencao || 'geral').replace(/_/g, ' ')}</span>
          <span className="text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-bold">
            {ultimo.confianca_intencao ? Math.round(ultimo.confianca_intencao * 100) + '%' : '—'}
          </span>
        </div>
      </div>

      {/* Produto */}
      <div className="bg-purple-50 rounded-lg p-3">
        <div className="text-[10px] font-semibold text-purple-400 uppercase mb-1">Produto resolvido</div>
        {ultimo.produto_foco ? (
          <>
            <div className="text-xs font-semibold text-purple-800">{ultimo.contrato?.plano || ultimo.produto_foco}</div>
            <div className="text-[10px] text-purple-500 mt-0.5 capitalize">{ultimo.linha} · {ultimo.produto_foco}</div>
            {ultimo.produto_confirmado && (
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle size={10} className="text-green-500" />
                <span className="text-[10px] text-green-600">Confirmado nesta sessão</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-purple-400 italic">Aguardando desambiguação</div>
        )}
      </div>

      {/* Persona com os termos que a justificaram */}
      <div className="rounded-lg p-3" style={{ backgroundColor: `${persona.cor}12` }}>
        <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: persona.cor }}>Persona detectada</div>
        <div className="text-xs font-semibold" style={{ color: persona.cor }}>{persona.label}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{persona.desc}</div>
        {ultimo.persona_detalhe?.termos?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {ultimo.persona_detalhe.termos.slice(0, 5).map((t, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/70 font-mono" style={{ color: persona.cor }}>
                {t.termo}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ClaroSense */}
      <div className="rounded-lg p-3" style={{ backgroundColor: `${scoreCor}15` }}>
        <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: scoreCor }}>ClaroSense — atrito</div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black leading-none" style={{ color: scoreCor }}>{ultimo.score_atrito ?? '—'}</span>
          <span className="text-[10px] text-gray-500 mb-0.5">/ 100</span>
          <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: scoreCor }}>
            {nivel.toUpperCase()}
          </span>
        </div>
        <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${ultimo.score_atrito || 0}%`, backgroundColor: scoreCor }} />
        </div>
        {ultimo.sinais_atrito?.length > 0 && (
          <div className="mt-2 space-y-1">
            {ultimo.sinais_atrito.map((s, i) => (
              <div key={i} className="bg-white/70 rounded p-1.5">
                <div className="flex items-center justify-between text-[10px] font-semibold" style={{ color: scoreCor }}>
                  <span>{s.rotulo || s.tipo?.replace(/_/g, ' ')}</span>
                  <span>+{s.valor}</span>
                </div>
                {s.explicacao && <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{s.explicacao}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Risco de churn */}
      {churn && churn.percentual > 0 && (
        <div className={`rounded-lg p-3 border ${churn.nivel === 'critico' || churn.nivel === 'alto' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={11} className={churn.nivel === 'critico' || churn.nivel === 'alto' ? 'text-red-500' : 'text-amber-500'} />
            <span className={`text-[10px] font-bold uppercase ${churn.nivel === 'critico' || churn.nivel === 'alto' ? 'text-red-600' : 'text-amber-600'}`}>
              Risco de cancelamento
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-black ${churn.nivel === 'critico' || churn.nivel === 'alto' ? 'text-red-600' : 'text-amber-600'}`}>{churn.percentual}%</span>
            <span className="text-[10px] font-semibold uppercase text-gray-500">{churn.nivel}</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1 leading-snug">{churn.acao_recomendada}</p>
        </div>
      )}

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
          <div className="text-[10px] font-semibold text-red-400 uppercase mb-1">Intervenção automática</div>
          <div className="text-xs font-bold text-red-700 capitalize">{ultimo.intervencao.tipo?.replace(/_/g, ' ')}</div>
          <div className="text-[10px] text-red-500 mt-0.5">{ultimo.intervencao.acao}</div>
          {ultimo.intervencao.justificativa && (
            <div className="text-[9px] text-red-400 mt-1 italic">{ultimo.intervencao.justificativa}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function ChatCliente() {
  const [canal, setCanal] = useState('site')
  const [clienteId, setClienteId] = useState('cli-tiago-ramos')
  const [mostrarExtras, setMostrarExtras] = useState(false)
  // Quantas falas do roteiro já foram enviadas. Contar cliques (e não mensagens)
  // é o que mantém o destaque correto quando o WhatsApp insere a abertura e o
  // código de verificação no meio do caminho.
  const [passoRoteiro, setPassoRoteiro] = useState(0)
  const [sessaoId, setSessaoId] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [typing, setTyping] = useState(false)
  const [ultimoRetorno, setUltimoRetorno] = useState(null)
  const [mostrarPainel, setMostrarPainel] = useState(true)
  const [apiOnline, setApiOnline] = useState(null)
  const [portfolio, setPortfolio] = useState([])
  const [smsSimulado, setSmsSimulado] = useState(null)
  const [estadoFila, setEstadoFila] = useState(null)
  const [protocolo, setProtocolo] = useState(null)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const cfg = CANAL_CONFIG[canal]
  const listaClientes = mostrarExtras ? [...CLIENTES_PITCH, ...CLIENTES_EXTRAS] : CLIENTES_PITCH
  const clienteAtual = [...CLIENTES_PITCH, ...CLIENTES_EXTRAS].find(c => c.id === clienteId)

  // No WhatsApp o roteiro ganha dois passos na frente: a abertura, que dispara
  // o código por SMS, e o próprio envio do código. Deixar a confirmação fora da
  // lista fazia a demonstração travar — quem clicava as falas em sequência
  // seguia falando com uma sessão que ainda esperava a identificação.
  const falasRoteiro = !clienteAtual?.script ? null
    : canal === 'whatsapp'
      ? [
        { texto: ABERTURA_WHATSAPP, nota: 'dispara o código por SMS' },
        { codigo: true, nota: 'confirma a identidade' },
        ...clienteAtual.script.map(texto => ({ texto })),
      ]
      : clienteAtual.script.map(texto => ({ texto }))
  const emFila = estadoFila?.na_fila || estadoFila?.em_atendimento

  useEffect(() => {
    api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false))
  }, [])

  useEffect(() => {
    if (clienteId) api.portfolio(clienteId).then(setPortfolio).catch(() => setPortfolio([]))
  }, [clienteId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, typing, estadoFila])

  const reiniciar = useCallback(() => {
    setMensagens([]); setSessaoId(null); setUltimoRetorno(null)
    setInput(''); setSmsSimulado(null); setEstadoFila(null); setProtocolo(null)
    setPassoRoteiro(0)
  }, [])

  useEffect(() => { reiniciar() }, [clienteId, canal, reiniciar])

  // Enquanto o cliente está na fila ou em atendimento humano, a interface
  // busca o estado e as mensagens do atendente — é o outro lado do Console.
  useEffect(() => {
    if (!sessaoId || !emFila) return

    const intervalo = setInterval(async () => {
      try {
        const [estado, msgs] = await Promise.all([
          api.estadoSessao(sessaoId),
          api.mensagens(sessaoId),
        ])
        setEstadoFila(estado.fila)

        const doServidor = msgs
          .filter(m => m.papel === 'atendente' || (m.papel === 'sistema' && m.intencao_codigo === 'atendimento_humano'))
          .map(m => ({ id: m.id, papel: m.papel, conteudo: m.conteudo, servidor: true }))

        setMensagens(prev => {
          const idsExistentes = new Set(prev.filter(m => m.servidor).map(m => m.id))
          const novas = doServidor.filter(m => !idsExistentes.has(m.id))
          return novas.length ? [...prev, ...novas] : prev
        })
      } catch { /* servidor indisponível: tenta de novo no próximo ciclo */ }
    }, 2500)

    return () => clearInterval(intervalo)
  }, [sessaoId, emFila])

  async function enviarMensagem(textoForcado, { roteiro = false } = {}) {
    const txt = (textoForcado ?? input).trim()
    if (!txt || carregando) return
    if (!textoForcado) setInput('')
    if (roteiro) setPassoRoteiro(p => p + 1)
    setCarregando(true)

    setMensagens(prev => [...prev, { id: `local-${Date.now()}`, papel: 'cliente', conteudo: txt }])

    try {
      const retorno = await api.chat({ cliente_id: clienteId, canal, mensagem: txt, sessao_id: sessaoId })
      setSessaoId(retorno.sessao_id)
      setUltimoRetorno(retorno)
      if (retorno.protocolo) setProtocolo(retorno.protocolo)
      if (retorno.fila) setEstadoFila(retorno.fila)
      if (retorno.modo === 'atendimento_humano') { setEstadoFila(retorno.fila); return }

      // Código de verificação "enviado por SMS" — apenas no protótipo
      if (retorno.verificacao?.codigo_simulado) {
        setSmsSimulado({ codigo: retorno.verificacao.codigo_simulado, destino: retorno.verificacao.destino_mascarado })
      }
      if (retorno.intencao !== 'verificacao_2fa') setSmsSimulado(null)

      if (!retorno.resposta) return

      // Efeito de digitação
      const msgBot = { id: `bot-${Date.now()}`, papel: 'sistema', conteudo: '', retorno }
      setMensagens(prev => [...prev, msgBot])

      let idx = 0
      const total = retorno.resposta.length
      setTyping(true)
      const iv = setInterval(() => {
        idx += 4
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
      }, 16)
    } catch (err) {
      setMensagens(prev => [...prev, { id: `err-${Date.now()}`, papel: 'erro', conteudo: 'Erro ao conectar com a API: ' + err.message }])
    } finally {
      setCarregando(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <div className="flex gap-4 h-full">
      {/* ─── Coluna esquerda ─────────────────────────── */}
      <div className="w-56 flex-shrink-0 space-y-3 overflow-y-auto">
        <div className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-2 ${apiOnline ? 'bg-green-50 text-green-600' : apiOnline === false ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {apiOnline ? 'API online' : apiOnline === false ? 'API offline — rode npm run server' : 'Verificando…'}
        </div>

        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Canal de atendimento</p>
          <div className="space-y-1">
            {Object.entries(CANAL_CONFIG).map(([key, c]) => (
              <button key={key} onClick={() => setCanal(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${canal === key ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                style={{ backgroundColor: canal === key ? c.headerBg : undefined }}>
                <c.icon size={13} />
                <span className="flex-1 text-left">{c.label}</span>
                {key === 'whatsapp' && <Shield size={11} className={canal === key ? 'text-white/70' : 'text-amber-500'} />}
              </button>
            ))}
          </div>
          {canal === 'whatsapp' && (
            <p className="text-[9px] text-amber-600 mt-2 leading-snug bg-amber-50 rounded p-1.5">
              <Shield size={9} className="inline mr-0.5" />
              Único canal com verificação em duas etapas: o número identifica o cliente e o
              código de 6 dígitos confirma que é ele. Site, app e call center já têm
              autenticação própria.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">
            {mostrarExtras ? 'Cliente (roteiro)' : 'Clientes do pitch'}
          </p>
          <div className="space-y-1">
            {listaClientes.map(c => (
              <button key={c.id} onClick={() => setClienteId(c.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-[11px] transition-all ${clienteId === c.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: c.cor }}>
                  {c.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{c.nome}</div>
                  <div className="text-[9px] truncate text-gray-400">Roteiro {c.roteiro} · {c.titulo}</div>
                  <div className={`text-[9px] truncate ${clienteId === c.id ? 'text-gray-500' : 'text-gray-300'}`}>
                    {PERSONA_INFO[c.persona]?.label} · {c.plano}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Os demais roteiros continuam acessíveis, mas fora do caminho da
              gravação — a tela do pitch não precisa de distração. */}
          <button onClick={() => setMostrarExtras(v => !v)}
            className="w-full mt-2 pt-2 border-t border-gray-100 text-[9px] text-gray-400 hover:text-gray-600">
            {mostrarExtras ? '− ocultar outros roteiros' : `+ outros ${CLIENTES_EXTRAS.length} roteiros (A–F)`}
          </button>
        </div>

        {clienteAtual && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[9px] font-bold text-amber-500 uppercase mb-1">Roteiro {clienteAtual.roteiro} — {clienteAtual.titulo}</p>
            <p className="text-[10px] text-amber-700 leading-snug">{clienteAtual.dica}</p>

            {/* Roteiro guiado: as falas na ordem, clicáveis. Evita erro de
                digitação na hora da apresentação e mantém o tempo da demo. */}
            {falasRoteiro && (
              <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                <p className="text-[9px] font-bold text-amber-500 uppercase">Falas do roteiro</p>
                {falasRoteiro.map((fala, i) => {
                  const proxima = i === passoRoteiro
                  // O passo do código só existe depois que o SMS simulado chega
                  const aguardandoSms = fala.codigo && !smsSimulado
                  const rotulo = fala.codigo
                    ? (smsSimulado ? `enviar o código ${smsSimulado.codigo}` : 'aguardando o SMS…')
                    : fala.texto

                  return (
                    <button key={i}
                      onClick={() => enviarMensagem(fala.codigo ? smsSimulado.codigo : fala.texto, { roteiro: true })}
                      disabled={carregando || !apiOnline || aguardandoSms}
                      className={`w-full text-left text-[10px] leading-snug px-2 py-1.5 rounded-lg border transition-all disabled:opacity-40 ${
                        proxima ? 'bg-white border-amber-300 text-amber-800 font-semibold shadow-sm'
                          : i < passoRoteiro ? 'bg-amber-100/50 border-transparent text-amber-400 line-through'
                            : 'bg-white/60 border-transparent text-amber-600'
                      }`}>
                      <span className="font-bold mr-1">{i + 1}.</span>
                      {fala.codigo ? <span className="font-mono">🔐 {rotulo}</span> : rotulo}
                      {fala.nota && (
                        <span className="block text-[9px] font-normal text-amber-500 mt-0.5">{fala.nota}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {portfolio.length > 0 && (
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Portfólio Claro ({portfolio.length})</p>
            <div className="space-y-2">
              {portfolio.map(c => (
                <div key={c.id} className="text-[10px] border-l-2 pl-2" style={{ borderColor: linhaCor(c.produto_linha) }}>
                  <div className="font-semibold text-gray-700 leading-tight">{c.plano_nome}</div>
                  <div className="text-gray-400 flex items-center gap-1 mt-0.5">
                    <span className="capitalize">{c.produto_linha}</span>
                    <span>·</span>
                    <span>R$ {Number(c.valor_mensal).toFixed(2).replace('.', ',')}</span>
                  </div>
                  {(c.velocidade_mbps || c.franquia_gb || c.tipo_chip) && (
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      {c.velocidade_mbps ? `${c.velocidade_mbps >= 1000 ? c.velocidade_mbps / 1000 + ' Giga' : c.velocidade_mbps + ' Mega'}` : ''}
                      {c.franquia_gb ? `${c.velocidade_mbps ? ' · ' : ''}${c.franquia_gb}GB` : ''}
                      {c.tipo_chip ? ` · ${c.tipo_chip}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={reiniciar} className="w-full text-[11px] text-gray-400 hover:text-gray-600 py-1">
          ↺ Nova conversa
        </button>
      </div>

      {/* ─── Chat ───────────────────────────────────── */}
      <div className="flex-1 flex gap-3 min-w-0">
        <div className="flex-1 flex flex-col rounded-2xl shadow-md overflow-hidden border border-gray-200 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ backgroundColor: cfg.headerBg }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: cfg.accentColor }}>
              {estadoFila?.em_atendimento ? <Headphones size={14} /> : cfg.botAvatar}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: cfg.headerText }}>
                {estadoFila?.em_atendimento ? estadoFila.atendente || 'Atendente Claro' : 'Claro Assistente'}
              </div>
              <div className="text-[10px] opacity-60 truncate" style={{ color: cfg.headerText }}>{cfg.label}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {protocolo && (
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/10">
                  <FileText size={10} style={{ color: cfg.headerText }} className="opacity-70" />
                  <span className="text-[10px] font-mono" style={{ color: cfg.headerText }}>{protocolo}</span>
                </div>
              )}
              {ultimoRetorno?.verificacao === undefined && sessaoId && (
                <ShieldCheck size={13} style={{ color: cfg.headerText }} className="opacity-40" />
              )}
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: cfg.fundo }}>
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
              const isAtendente = msg.papel === 'atendente'
              const bloqueado = msg.retorno?.bloqueado_guardrail

              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && !isErr && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold mr-2 mt-1 flex-shrink-0"
                      style={{ backgroundColor: isAtendente ? '#0EA5E9' : bloqueado ? '#EF4444' : cfg.botColor }}>
                      {isAtendente ? <Headphones size={11} /> : bloqueado ? <ShieldAlert size={11} /> : cfg.botAvatar}
                    </div>
                  )}
                  <div className="max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                    style={{
                      backgroundColor: isErr ? '#FEE2E2' : bloqueado ? '#FEF2F2' : isAtendente ? '#E0F2FE' : isUser ? cfg.msgUserBg : cfg.msgBotBg,
                      color: isErr ? '#EF4444' : isUser ? cfg.msgUserText : cfg.msgBotText,
                      border: bloqueado ? '1px solid #FECACA' : isAtendente ? '1px solid #BAE6FD' : 'none',
                      borderBottomRightRadius: isUser ? 4 : 16,
                      borderBottomLeftRadius: isUser ? 16 : 4,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                    }}>
                    {isAtendente && (
                      <div className="text-[9px] font-bold text-sky-600 uppercase mb-1 flex items-center gap-1">
                        <Headphones size={9} /> Atendente humano
                      </div>
                    )}
                    <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{renderMsg(msg.conteudo)}</div>

                    {bloqueado && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-red-500">
                        <ShieldAlert size={10} />
                        <span>Bloqueado pelo guardrail: {msg.retorno.guardrail?.tipo?.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {msg.retorno?.intervencao && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-red-500">
                        <AlertTriangle size={10} />
                        <span>ClaroSense: {msg.retorno.intervencao.tipo?.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {msg.retorno?.trechos_memoria?.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-green-600 font-medium">
                        <Brain size={9} />
                        <span>ClaroMemory recuperou {msg.retorno.trechos_memoria.length} contexto(s)</span>
                      </div>
                    )}
                    {msg.retorno?.protocolo_status === 'resolvido' && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-green-700 font-semibold bg-green-50 rounded px-2 py-1">
                        <CheckCircle size={10} />
                        <span>Resolvido no autoatendimento — sem atendente humano</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* SMS simulado do 2FA */}
            {smsSimulado && (
              <div className="flex justify-center">
                <div className="bg-slate-800 text-white rounded-xl px-4 py-3 max-w-xs shadow-lg">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Smartphone size={11} className="text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">SMS simulado · {smsSimulado.destino}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Claro: seu código de verificação é
                  </p>
                  <p className="text-2xl font-black tracking-[0.3em] text-center my-2 text-white">{smsSimulado.codigo}</p>
                  <button onClick={() => enviarMensagem(smsSimulado.codigo)}
                    className="w-full text-[10px] font-semibold bg-white/15 hover:bg-white/25 rounded-lg py-1.5 transition-colors">
                    Usar este código
                  </button>
                  <p className="text-[8px] text-slate-500 mt-1.5 text-center leading-snug">
                    Só no protótipo: em produção o código existe apenas no SMS
                  </p>
                </div>
              </div>
            )}

            {/* Ação de autoatendimento aguardando confirmação */}
            {ultimoRetorno?.acao_proposta && !typing && !emFila && (
              <div className="flex justify-center">
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm max-w-sm w-full">
                  <div className="text-[9px] font-bold text-gray-400 uppercase mb-2">Ação aguardando sua confirmação</div>
                  <div className="flex gap-2">
                    <button onClick={() => enviarMensagem('sim, pode confirmar')}
                      className="flex-1 text-[11px] font-semibold text-white rounded-lg py-2 transition-colors"
                      style={{ backgroundColor: '#10B981' }}>
                      ✓ Confirmar {ultimoRetorno.acao_proposta.tipo === 'pagamento' ? 'pagamento' : 'upgrade'}
                    </button>
                    <button onClick={() => enviarMensagem('não, agora não')}
                      className="px-3 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-colors">
                      Agora não
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Estado da fila de atendimento humano */}
            {estadoFila?.na_fila && (
              <div className="flex justify-center">
                <div className="bg-white border-2 border-amber-200 rounded-xl p-4 shadow-sm max-w-sm w-full text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Users size={13} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-600 uppercase">Na fila de atendimento</span>
                  </div>
                  <div className="flex items-center justify-center gap-6 my-3">
                    <div>
                      <div className="text-3xl font-black text-amber-600">{estadoFila.posicao}º</div>
                      <div className="text-[9px] text-gray-400 uppercase">Posição</div>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-amber-600">~{estadoFila.espera_estimada_min}</div>
                      <div className="text-[9px] text-gray-400 uppercase">Min de espera</div>
                    </div>
                  </div>
                  {estadoFila.prioridade === 'alta' && (
                    <span className="inline-block text-[9px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full mb-2">
                      PRIORIDADE ALTA
                    </span>
                  )}
                  <p className="text-[10px] text-gray-500 leading-snug">
                    Um atendente vai assumir no <strong>Console do Atendente</strong>. Todo o histórico e o protocolo
                    {estadoFila.protocolo_formatado ? ` ${estadoFila.protocolo_formatado}` : ''} vão junto — você não vai repetir nada.
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-[9px] text-amber-500">
                    <Clock size={9} className="animate-pulse" />
                    <span>Aguardando atendente…</span>
                  </div>
                </div>
              </div>
            )}

            {estadoFila?.em_atendimento && (
              <div className="flex justify-center">
                <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 text-[10px] text-sky-700 font-semibold flex items-center gap-1.5">
                  <Headphones size={11} />
                  Em atendimento com {estadoFila.atendente}
                </div>
              </div>
            )}

            {typing && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold mr-2 mt-1" style={{ backgroundColor: cfg.botColor }}>
                  {cfg.botAvatar}
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white shadow-sm flex items-center gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-3 border-t border-gray-100 flex-shrink-0" style={{ backgroundColor: cfg.inputBg }}>
            <input ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
              placeholder={estadoFila?.em_atendimento ? 'Converse com o atendente…' : ultimoRetorno?.verificacao?.pendente ? 'Digite o código de 6 dígitos…' : 'Digite sua mensagem…'}
              disabled={carregando || !apiOnline}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 bg-white placeholder:text-gray-300 disabled:opacity-50" />
            <button onClick={() => enviarMensagem()} disabled={!input.trim() || carregando || !apiOnline}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: cfg.accentColor }}>
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* Painel de transparência */}
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

      {!mostrarPainel && (
        <button onClick={() => setMostrarPainel(true)}
          className="fixed right-6 bottom-24 flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
          <Brain size={13} style={{ color: '#E8002A' }} /> IA
        </button>
      )}
    </div>
  )
}

function linhaCor(linha) {
  return { residencial: '#3B82F6', movel: '#8B5CF6', tv: '#F59E0B', empresas: '#0EA5E9' }[linha] || '#9CA3AF'
}
