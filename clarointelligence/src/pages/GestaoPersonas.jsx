import { useState } from 'react'
import { X, Zap, SlidersHorizontal } from 'lucide-react'
import PersonaCard from '../components/PersonaCard'

const PERSONAS = [
  {
    nome: 'Usuário Digital',
    badge: 'Literacia Alta',
    color: '#3B82F6',
    descricao: 'Cliente com alta familiaridade digital. Prefere autonomia, respostas diretas e acesso imediato a informações técnicas.',
    tags: ['Respostas objetivas', 'Links diretos', 'Linguagem técnica', 'Autoatendimento'],
    clientMsg: 'Qual é o limite de dados do plano turbo 50GB e como funciona a política de throttling?',
    sysMsg: 'Plano Turbo 50GB: 50GB em velocidade plena (até 300Mbps). Após o limite, throttling em 1Mbps sem cobrança extra. Gerencie em claro.com.br/minhaconta → Consumo.',
  },
  {
    nome: 'Usuário Intermediário',
    badge: 'Literacia Média',
    color: '#F59E0B',
    descricao: 'Cliente com conforto razoável com tecnologia. Aprecia clareza, passo a passo e ter alternativas de contato disponíveis.',
    tags: ['Linguagem clara', 'Passo a passo', 'Alternativas', 'Confirmação de entendimento'],
    clientMsg: 'Recebi uma cobrança diferente esse mês e não entendo o motivo.',
    sysMsg: 'Entendido! Vou verificar agora 😊 Identifiquei um ajuste de plano aplicado no dia 15. Quer que eu explique o detalhamento ou prefere receber a segunda via com tudo descrito?',
  },
  {
    nome: 'Usuário Assistido',
    badge: 'Literacia Baixa',
    color: '#8B5CF6',
    descricao: 'Cliente que necessita de suporte reforçado. Linguagem simples, confirmações frequentes e proatividade no contato humano.',
    tags: ['Linguagem simples', 'Confirmações', 'Ligação proativa', 'Sem jargão técnico'],
    clientMsg: 'Meu telefone não tá pegando sinal, o que eu faço?',
    sysMsg: 'Olá! Fico feliz em ajudar 😊 Vamos resolver juntos! Primeiro: seu telefone está desligado ou está ligado? Me confirme isso e já te passo o próximo passo com calma.',
  },
]

function Slider({ label, value, min = 1, max = 10, onChange, description }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs font-bold text-[#E8002A] tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#E8002A' }}
      />
      <p className="text-[10px] text-gray-400">{description}</p>
    </div>
  )
}

function classifyPersona(msg) {
  const m = msg.toLowerCase()
  const hasComplex = /protocolo|throttling|especificações|técnico|configurar|api|mbps|latência|dns/.test(m)
  const hasSenior = /não entendo|não sei|ajuda|difícil|complicado|não consigo|o que eu faço|não tô|tô com|não tá/.test(m)
  if (hasComplex) return { nome: 'Usuário Digital', color: '#3B82F6', badge: 'Literacia Alta' }
  if (hasSenior) return { nome: 'Usuário Assistido', color: '#8B5CF6', badge: 'Literacia Baixa' }
  return { nome: 'Usuário Intermediário', color: '#F59E0B', badge: 'Literacia Média' }
}

function GestaoPersonas() {
  const [limiar, setLimiar] = useState(6)
  const [sensib, setSensib] = useState(7)
  const [delay, setDelay] = useState(3)
  const [showModal, setShowModal] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [result, setResult] = useState(null)

  const handleTest = () => {
    if (!testMsg.trim()) return
    const persona = classifyPersona(testMsg)
    setResult(persona)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm border-l-4" style={{ borderLeftColor: '#E8002A' }}>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Como o Persona Engine funciona</h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
          O <strong className="text-gray-700">Persona Engine</strong> constrói silenciosamente um perfil comportamental de cada cliente a partir de padrões de linguagem, histórico de interações e sinais em tempo real — adaptando a comunicação automaticamente sem que o cliente perceba a transição.
        </p>
        <div className="flex gap-3 mt-3">
          {['Análise em tempo real', 'Adaptação automática', 'Reclassificação dinâmica', 'Zero interrupção para o cliente'].map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-[#E8002A]">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Persona cards */}
      <div className="grid grid-cols-3 gap-4">
        {PERSONAS.map((p) => (
          <PersonaCard key={p.nome} perfil={p} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Sliders */}
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal size={16} className="text-[#E8002A]" />
            <h3 className="text-sm font-semibold text-gray-900">Configurações do Engine</h3>
          </div>
          <Slider
            label="Limiar de detecção de literacia"
            value={limiar}
            onChange={setLimiar}
            description="Número mínimo de sinais para classificação definitiva do perfil"
          />
          <Slider
            label="Sensibilidade de adaptação"
            value={sensib}
            onChange={setSensib}
            description="Quão agressivamente o sistema adapta a linguagem (1 = sutil, 10 = máximo)"
          />
          <Slider
            label="Delay para reclassificação (turnos)"
            value={delay}
            min={1}
            max={5}
            onChange={setDelay}
            description="Número de mensagens necessárias antes de alterar o perfil do cliente"
          />
          <button
            onClick={() => {}}
            className="w-full py-2.5 text-xs font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors mt-2"
          >
            Salvar configurações
          </button>
        </div>

        {/* Test button */}
        <div className="bg-white rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-[#E8002A]" />
            <h3 className="text-sm font-semibold text-gray-900">Testar adaptação ao vivo</h3>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            Digite uma mensagem como se fosse um cliente e veja qual persona seria identificada pelo engine em tempo real.
          </p>
          <textarea
            value={testMsg}
            onChange={(e) => setTestMsg(e.target.value)}
            placeholder="Ex: Não consigo entender minha conta, o que significa esse valor?"
            className="flex-1 min-h-[100px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#E8002A]/30 focus:border-[#E8002A] transition-all"
          />
          <button
            onClick={() => { handleTest(); setShowModal(true) }}
            disabled={!testMsg.trim()}
            className="mt-3 py-2.5 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#E8002A' }}
            onMouseEnter={(e) => { if (testMsg.trim()) e.currentTarget.style.backgroundColor = '#C40022' }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8002A')}
          >
            Classificar mensagem →
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { setShowModal(false); setResult(null) }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slideUp">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Resultado da classificação</h3>
              <button onClick={() => { setShowModal(false); setResult(null) }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center py-4">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
                  style={{ backgroundColor: `${result.color}15` }}
                >
                  <span className="text-2xl font-bold" style={{ color: result.color }}>
                    {result.nome.charAt(8)}
                  </span>
                </div>
                <div className="text-base font-bold text-gray-900">{result.nome}</div>
                <span
                  className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: `${result.color}15`, color: result.color }}
                >
                  {result.badge}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Mensagem analisada</p>
                <p className="text-xs text-gray-700 italic">"{testMsg}"</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowModal(false); setResult(null); setTestMsg('') }}
                  className="flex-1 py-2.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Testar outra mensagem
                </button>
                <button
                  onClick={() => { setShowModal(false); setResult(null) }}
                  className="flex-1 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors"
                  style={{ backgroundColor: '#E8002A' }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GestaoPersonas
