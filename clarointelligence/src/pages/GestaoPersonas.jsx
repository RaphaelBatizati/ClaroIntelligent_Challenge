import { useState, useEffect, useCallback } from 'react'
import { Zap, SlidersHorizontal, BookOpen, Plus, Trash2, Check, X } from 'lucide-react'
import { api } from '../services/api'

const PERSONAS = [
  {
    id: 'digital',
    nome: 'Usuário Digital',
    badge: 'Literacia alta',
    cor: '#3B82F6',
    descricao: 'Domina o vocabulário técnico e quer autonomia. Prefere resposta curta, dado cru e link direto.',
    tags: ['Respostas objetivas', 'Dados técnicos', 'Sem redundância', 'Autoatendimento'],
    clientMsg: 'Qual o throughput real do meu plano de 500 Mega e como funciona a política de throttling?',
    sysMsg: 'Claro Fibra 500 Mega: 500 Mbps down / 250 Mbps up. Sem throttling contratual. Medição atual do seu CPE: 487 Mbps down.',
  },
  {
    id: 'intermediario',
    nome: 'Usuário Intermediário',
    badge: 'Literacia média',
    cor: '#F59E0B',
    descricao: 'Conforto razoável com tecnologia. Aprecia clareza, passo a passo e alternativas de contato.',
    tags: ['Linguagem clara', 'Passo a passo', 'Confirmação de entendimento'],
    clientMsg: 'Recebi uma cobrança diferente esse mês e não entendi o motivo.',
    sysMsg: 'Entendi! Vou verificar agora 😊 Identifiquei um ajuste de plano aplicado no dia 15. Quer que eu detalhe ou prefere a segunda via com tudo descrito?',
  },
  {
    id: 'assistido',
    nome: 'Usuário Assistido',
    badge: 'Literacia baixa',
    cor: '#8B5CF6',
    descricao: 'Precisa de suporte reforçado. Linguagem simples, confirmações frequentes e nenhum jargão.',
    tags: ['Linguagem simples', 'Confirmações', 'Sem jargão', 'Proatividade'],
    clientMsg: 'Meu telefone não tá pegando sinal, o que eu faço?',
    sysMsg: 'Olá! Vamos resolver juntos 😊 Primeiro: seu telefone está ligado? Me confirma isso que já te passo o próximo passo com calma.',
  },
  {
    id: 'informal',
    nome: 'Usuário Informal',
    badge: 'Linguagem coloquial',
    cor: '#14B8A6',
    descricao: 'Escreve como fala: gíria, abreviação e emoji. Não é menos capaz — é outro registro, e merece tom espelhado em vez de uma resposta formal e distante.',
    tags: ['Tom espelhado', 'Frases curtas', 'Sem formalidade', 'Direto ao ponto'],
    clientMsg: 'eae, blz? minha net tá osso hj, vc consegue dar um jeito?',
    sysMsg: 'E aí! 👋 Dei uma olhada aqui e teu sinal tá oscilando mesmo. Tira o modem da tomada, conta até 30 e liga de novo. Testa aí e me fala 👊',
  },
]

const CATEGORIAS = ['tecnico', 'ajuda', 'giria', 'formal', 'personalizado']

function PersonaCard({ p, total }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border-t-[3px]" style={{ borderTopColor: p.cor }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{p.nome}</h3>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
            style={{ backgroundColor: `${p.cor}15`, color: p.cor }}>
            {p.badge}
          </span>
        </div>
        {total !== undefined && (
          <div className="text-right">
            <div className="text-lg font-black leading-none" style={{ color: p.cor }}>{total}</div>
            <div className="text-[9px] text-gray-400">termos</div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{p.descricao}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {p.tags.map(t => (
          <span key={t} className="px-2 py-0.5 rounded text-[9px] font-medium bg-gray-50 text-gray-500">{t}</span>
        ))}
      </div>

      <div className="space-y-1.5 bg-gray-50 rounded-lg p-2.5">
        <div className="flex justify-end">
          <div className="bg-white rounded-lg rounded-br-sm px-2.5 py-1.5 max-w-[85%] text-[10px] text-gray-600 shadow-sm">
            {p.clientMsg}
          </div>
        </div>
        <div className="flex justify-start">
          <div className="rounded-lg rounded-bl-sm px-2.5 py-1.5 max-w-[90%] text-[10px] text-white"
            style={{ backgroundColor: p.cor }}>
            {p.sysMsg}
          </div>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min = 1, max = 10, onChange, description }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs font-bold text-[#E8002A] tabular-nums">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#E8002A' }} />
      <p className="text-[10px] text-gray-400">{description}</p>
    </div>
  )
}

/** Dicionário léxico editável — o que o motor usa para classificar. */
function Dicionario() {
  const [termos, setTermos] = useState([])
  const [personaAtiva, setPersonaAtiva] = useState('informal')
  const [novoTermo, setNovoTermo] = useState('')
  const [categoria, setCategoria] = useState('giria')
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setTermos(await api.dicionario())
      setErro(null)
    } catch {
      setErro('API offline — inicie o backend')
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function adicionar() {
    const t = novoTermo.trim()
    if (!t) return
    setCarregando(true)
    try {
      await api.adicionarTermo({ persona: personaAtiva, termo: t, categoria, peso: 2 })
      setNovoTermo('')
      await carregar()
      setErro(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  async function remover(id) {
    try { await api.removerTermo(id); await carregar() } catch (e) { setErro(e.message) }
  }

  async function alternar(id, ativo) {
    try { await api.alternarTermo(id, !ativo); await carregar() } catch (e) { setErro(e.message) }
  }

  const doPersona = termos.filter(t => t.persona === personaAtiva)
  const personaInfo = PERSONAS.find(p => p.id === personaAtiva)

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={16} className="text-[#E8002A]" />
        <h3 className="text-sm font-semibold text-gray-900">Dicionário de personas</h3>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-4 max-w-3xl">
        A classificação não está codificada no sistema: ela vem deste dicionário. Cada termo encontrado na mensagem
        soma peso para uma persona, e a de maior pontuação define o tom da resposta. A equipe de atendimento
        <strong className="text-gray-700"> adiciona uma gíria nova sem precisar de deploy</strong> — é o que mantém o
        modelo acompanhando o jeito como as pessoas realmente escrevem.
      </p>

      {erro && <div className="bg-red-50 text-red-600 text-[11px] rounded-lg px-3 py-2 mb-3">{erro}</div>}

      {/* Abas de persona */}
      <div className="flex gap-2 mb-4">
        {PERSONAS.map(p => {
          const total = termos.filter(t => t.persona === p.id).length
          const ativo = personaAtiva === p.id
          return (
            <button key={p.id} onClick={() => { setPersonaAtiva(p.id); setCategoria(p.id === 'informal' ? 'giria' : p.id === 'digital' ? 'tecnico' : p.id === 'assistido' ? 'ajuda' : 'formal') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${ativo ? 'text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              style={ativo ? { backgroundColor: p.cor } : {}}>
              {p.nome.replace('Usuário ', '')}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${ativo ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>{total}</span>
            </button>
          )
        })}
      </div>

      {/* Adicionar termo */}
      <div className="flex gap-2 mb-3">
        <input value={novoTermo} onChange={e => setNovoTermo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && adicionar()}
          placeholder={`Novo termo para ${personaInfo?.nome.replace('Usuário ', '')} (ex: ${personaAtiva === 'informal' ? '"de boa", "tamo junto"' : personaAtiva === 'digital' ? '"packet loss", "jitter"' : '"me explica"'})`}
          className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 placeholder:text-gray-400" />
        <select value={categoria} onChange={e => setCategoria(e.target.value)}
          className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 text-gray-600 focus:outline-none">
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={adicionar} disabled={!novoTermo.trim() || carregando}
          className="px-3 rounded-lg text-white text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40"
          style={{ backgroundColor: personaInfo?.cor || '#E8002A' }}>
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {/* Termos */}
      <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto p-1">
        {doPersona.map(t => (
          <span key={t.id}
            className={`group inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${t.ativo ? '' : 'opacity-40 line-through'}`}
            style={{ backgroundColor: `${personaInfo?.cor}12`, color: personaInfo?.cor }}>
            {t.termo}
            <span className="text-[8px] opacity-50">·{t.peso}</span>
            <button onClick={() => alternar(t.id, t.ativo)} title={t.ativo ? 'Desativar' : 'Ativar'}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100">
              {t.ativo ? <X size={10} /> : <Check size={10} />}
            </button>
            <button onClick={() => remover(t.id)} title="Remover"
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500">
              <Trash2 size={10} />
            </button>
          </span>
        ))}
        {doPersona.length === 0 && (
          <p className="text-[11px] text-gray-400 py-4">Nenhum termo cadastrado para esta persona.</p>
        )}
      </div>
    </div>
  )
}

/** Simulador que chama o classificador real do backend. */
function Simulador() {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)

  const exemplos = [
    'eae blz? minha net tá osso hj',
    'qual a latência e o throughput real do link?',
    'não sei mexer nisso, pode me explicar devagar?',
    'boa tarde, gostaria de solicitar a segunda via por gentileza',
  ]

  async function classificar(t) {
    const alvo = (t ?? texto).trim()
    if (!alvo) return
    if (t) setTexto(t)
    setCarregando(true)
    try {
      setResultado(await api.classificarPersona(alvo))
    } catch {
      setResultado(null)
    } finally {
      setCarregando(false)
    }
  }

  const personaInfo = PERSONAS.find(p => p.id === resultado?.persona)

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={16} className="text-[#E8002A]" />
        <h3 className="text-sm font-semibold text-gray-900">Testar classificação ao vivo</h3>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        Roda o mesmo classificador do backend e mostra quais termos do dicionário pesaram na decisão.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {exemplos.map((ex, i) => (
          <button key={i} onClick={() => classificar(ex)}
            className="text-[10px] px-2 py-1 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors truncate max-w-[220px]">
            {ex}
          </button>
        ))}
      </div>

      <textarea value={texto} onChange={e => setTexto(e.target.value)}
        placeholder="Digite uma mensagem como se fosse o cliente…"
        className="w-full min-h-[70px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder:text-gray-400 resize-none focus:outline-none focus:border-gray-400" />

      <button onClick={() => classificar()} disabled={!texto.trim() || carregando}
        className="w-full mt-2 py-2 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-40"
        style={{ backgroundColor: '#E8002A' }}>
        {carregando ? 'Classificando…' : 'Classificar mensagem →'}
      </button>

      {resultado && (
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: `${personaInfo?.cor || '#6B7280'}10` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold" style={{ color: personaInfo?.cor }}>{personaInfo?.nome || resultado.persona}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: personaInfo?.cor }}>
              {personaInfo?.badge}
            </span>
          </div>

          <div className="space-y-1 mb-2">
            {Object.entries(resultado.pontuacoes || {}).map(([p, v]) => {
              const info = PERSONAS.find(x => x.id === p)
              const max = Math.max(...Object.values(resultado.pontuacoes), 1)
              return (
                <div key={p} className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 w-20 capitalize">{p}</span>
                  <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(v / max) * 100}%`, backgroundColor: info?.cor || '#9CA3AF' }} />
                  </div>
                  <span className="text-[9px] font-bold w-4 text-right" style={{ color: info?.cor }}>{v}</span>
                </div>
              )
            })}
          </div>

          {resultado.termos?.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Termos encontrados</div>
              <div className="flex flex-wrap gap-1">
                {resultado.termos.map((t, i) => {
                  const info = PERSONAS.find(x => x.id === t.persona)
                  return (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white"
                      style={{ color: info?.cor }}>
                      {t.termo} +{t.peso}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GestaoPersonas() {
  const [config, setConfig] = useState({ limiar_digital: 6, limiar_assistido: 3, sensibilidade: 7, delay_interv: 3 })
  const [totais, setTotais] = useState({})
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    api.personaConfig().then(setConfig).catch(() => setErro('API offline — inicie o backend'))
    api.dicionario().then(ts => {
      const t = {}
      for (const x of ts) t[x.persona] = (t[x.persona] || 0) + 1
      setTotais(t)
    }).catch(() => {})
  }, [])

  async function salvar() {
    try {
      await api.salvarPersonaConfig(config)
      setSalvo(true); setErro(null)
      setTimeout(() => setSalvo(false), 2000)
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 shadow-sm border-l-4" style={{ borderLeftColor: '#E8002A' }}>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Como o Persona Engine funciona</h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-4xl">
          O <strong className="text-gray-700">Persona Engine</strong> lê o jeito de escrever do cliente e adapta o tom da
          resposta sem que ele perceba a transição. São <strong className="text-gray-700">quatro perfis</strong>: os três
          níveis de literacia digital mais a <strong style={{ color: '#14B8A6' }}>persona informal</strong>, criada porque
          tratar gíria e abreviação como ruído produz respostas frias com quem só escreve como fala.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {['Classificação por dicionário editável', 'Blending com o perfil salvo', 'Reclassificação a cada turno', 'Zero interrupção para o cliente'].map(tag => (
            <span key={tag} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-[#E8002A]">{tag}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {PERSONAS.map(p => <PersonaCard key={p.id} p={p} total={totais[p.id]} />)}
      </div>

      <Dicionario />

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-[#E8002A]" />
            <h3 className="text-sm font-semibold text-gray-900">Configurações do engine</h3>
          </div>
          {erro && <div className="bg-red-50 text-red-600 text-[11px] rounded-lg px-3 py-2">{erro}</div>}

          <Slider label="Limiar de detecção de literacia" value={config.limiar_digital}
            onChange={v => setConfig(c => ({ ...c, limiar_digital: v }))}
            description="Pontuação mínima de termos técnicos para classificar como Digital" />
          <Slider label="Limiar de suporte reforçado" value={config.limiar_assistido}
            onChange={v => setConfig(c => ({ ...c, limiar_assistido: v }))}
            description="Pontuação mínima de pedidos de ajuda para classificar como Assistido" />
          <Slider label="Sensibilidade de adaptação" value={config.sensibilidade}
            onChange={v => setConfig(c => ({ ...c, sensibilidade: v }))}
            description="Quão agressivamente o sistema adapta a linguagem (1 = sutil, 10 = máximo)" />
          <Slider label="Delay para reclassificação (turnos)" value={config.delay_interv} min={1} max={5}
            onChange={v => setConfig(c => ({ ...c, delay_interv: v }))}
            description="Mensagens necessárias antes de alterar o perfil salvo do cliente" />

          <button onClick={salvar}
            className={`w-full py-2.5 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${salvo ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
            {salvo ? <><Check size={13} /> Configurações salvas</> : 'Salvar configurações'}
          </button>
        </div>

        <Simulador />
      </div>
    </div>
  )
}
