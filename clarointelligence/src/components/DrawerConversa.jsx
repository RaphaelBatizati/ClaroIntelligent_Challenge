import { X, MessageSquare, Globe, Wifi, AlertCircle, CheckCircle, Smartphone, Phone, User, Wrench, FileText } from 'lucide-react'

// ─────────────────────────────────────────────────────────
// Dados de timeline por jornada
// ─────────────────────────────────────────────────────────
const JORNADA_DATA = {
  'Cancelamento': {
    canalPath: [
      { label: 'WhatsApp', Icon: MessageSquare, color: '#25D366', time: '14:10' },
      { label: 'ClaroSense', Icon: Wifi, color: '#E8002A', time: '14:14', alert: true },
      { label: 'Especialista', Icon: User, color: '#8B5CF6', time: '14:21' },
    ],
    events: [
      {
        time: '14:10', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [{ from: 'client', text: 'Tô pagando caro demais e o serviço está péssimo. Quero cancelar meu plano.' }],
      },
      {
        time: '14:12', isSys: true, tipo: 'alerta',
        text: 'Intenção de cancelamento detectada. Análise de sentimento: Frustração elevada. Risco: Médio.',
      },
      {
        time: '14:13', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [
          { from: 'agent', text: 'Entendo sua frustração! Antes de cancelar, posso verificar se há algo que podemos melhorar ou uma oferta mais adequada para você?' },
          { from: 'client', text: 'Não adianta, já tentei isso antes. Quero cancelar mesmo.' },
        ],
      },
      {
        time: '14:15', isSys: true, tipo: 'risco',
        text: 'Rejeição de oferta padrão detectada (2ª vez). Histórico: 3 contatos em 30 dias sem resolução. Risco: ALTO — ativando especialista de retenção.',
      },
      {
        time: '14:18', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [
          { from: 'system', text: '↻ ClaroIntelligence transferiu com histórico completo — zero retrabalho para o cliente.' },
          { from: 'agent', text: 'Olá! Sou Rafael, especialista de retenção. Vi todo o histórico da sua jornada conosco. Tenho uma proposta exclusiva que pode mudar sua experiência — posso apresentar?' },
          { from: 'client', text: 'Ok, pode falar.' },
        ],
      },
      {
        time: '14:21', isSys: true, tipo: 'sucesso',
        text: 'Protocolo de retenção ativado. Especialista com contexto completo. Probabilidade de retenção: 74%.',
      },
    ],
  },

  'Segunda via': {
    canalPath: [
      { label: 'App', Icon: Smartphone, color: '#3B82F6', time: '14:20' },
      { label: 'ClaroSense', Icon: Wifi, color: '#E8002A', time: '14:21', alert: true },
      { label: 'Resolvido', Icon: CheckCircle, color: '#10B981', time: '14:23' },
    ],
    events: [
      {
        time: '14:20', canal: 'App Minha Claro', Icon: Smartphone, iconColor: '#3B82F6',
        msgs: [{ from: 'client', text: 'Preciso pagar minha conta mas não acho a segunda via em lugar nenhum no app. Já tentei 4 vezes.' }],
      },
      {
        time: '14:21', isSys: true, tipo: 'alerta',
        text: 'Atrito de navegação detectado — 4 tentativas sem sucesso na função "Segunda via". Simplificação de fluxo ativada.',
      },
      {
        time: '14:21', canal: 'App Minha Claro', Icon: Smartphone, iconColor: '#3B82F6',
        msgs: [
          { from: 'agent', text: 'Notei que está com dificuldade de encontrar a segunda via. Já gerei para você! Vencimento: 20/07 · Valor: R$ 149,90.' },
          { from: 'client', text: 'O link não abriu, deu erro.' },
        ],
      },
      {
        time: '14:22', isSys: true, tipo: 'alerta',
        text: 'Falha técnica no link de download detectada. Alternativa: envio do código de barras diretamente por WhatsApp.',
      },
      {
        time: '14:22', canal: 'App Minha Claro', Icon: Smartphone, iconColor: '#3B82F6',
        msgs: [
          { from: 'system', text: '↻ ClaroIntelligence enviou a segunda via por canal alternativo.' },
          { from: 'agent', text: 'Código de barras: 0392.4821 0000.0014 9905.0720 1 · Copie e pague no banco ou app de pagamento.' },
          { from: 'client', text: 'Consegui! Muito mais fácil assim, obrigada.' },
        ],
      },
      {
        time: '14:23', isSys: true, tipo: 'sucesso',
        text: 'Segunda via entregue com sucesso via canal alternativo. CES estimado: 5.8/7. Atrito de navegação registrado para melhoria de produto.',
      },
    ],
  },

  'Suporte técnico': {
    canalPath: [
      { label: 'WhatsApp', Icon: MessageSquare, color: '#25D366', time: '14:05' },
      { label: 'Diagnóstico IA', Icon: Wifi, color: '#E8002A', time: '14:06', alert: true },
      { label: 'Técnico', Icon: Wrench, color: '#F59E0B', time: '14:08' },
    ],
    events: [
      {
        time: '14:05', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [{ from: 'client', text: 'Minha internet tá muito lenta desde ontem, não consigo trabalhar de casa. É inadmissível isso.' }],
      },
      {
        time: '14:06', isSys: true, tipo: 'alerta',
        text: 'Problema de conectividade identificado. Diagnóstico automático iniciado. Verificando: sinal, modem, infraestrutura regional.',
      },
      {
        time: '14:06', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [
          { from: 'agent', text: 'Rodei um diagnóstico na sua conexão e identifiquei instabilidade na torre da sua região (código zona-3B). Um técnico já está em campo.' },
          { from: 'client', text: 'Quando vai resolver? Tenho reunião em 1 hora.' },
        ],
      },
      {
        time: '14:07', isSys: true, tipo: 'alerta',
        text: 'Urgência detectada pelo cliente. Velocidade atual: 2Mbps (contratado: 300Mbps). Chamado técnico aberto automaticamente: #CR-2847193.',
      },
      {
        time: '14:08', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [
          { from: 'agent', text: 'Previsão de normalização: hoje às 17h30. Chamado aberto: #CR-2847193. Deseja receber notificação assim que resolver?' },
          { from: 'client', text: 'Sim. E quero desconto na próxima fatura por isso.' },
          { from: 'agent', text: 'Justo! Registrei o crédito de R$ 29,90 na sua próxima fatura por conta da instabilidade. Você receberá a confirmação por e-mail.' },
        ],
      },
      {
        time: '14:09', isSys: true, tipo: 'sucesso',
        text: 'Chamado aberto automaticamente. Crédito compensatório registrado proativamente. NPS estimado pré-resolução: 7.2/10.',
      },
    ],
  },

  'Upgrade de plano': {
    canalPath: [
      { label: 'Site', Icon: Globe, color: '#8B5CF6', time: '14:00' },
      { label: 'ClaroSense', Icon: Wifi, color: '#E8002A', time: '14:01', alert: true },
      { label: 'Conversão', Icon: CheckCircle, color: '#10B981', time: '14:04' },
    ],
    events: [
      {
        time: '14:00', canal: 'Site / Chat', Icon: Globe, iconColor: '#8B5CF6',
        msgs: [{ from: 'client', text: 'Meu plano atual já não atende. Pago 80GB mas preciso de mais velocidade para trabalhar em casa.' }],
      },
      {
        time: '14:01', isSys: true, tipo: 'alerta',
        text: 'Oportunidade de upsell identificada. Perfil: cliente de alto valor (18 meses), uso médio 76GB/mês. Recomendação: Plano Plus 200GB.',
      },
      {
        time: '14:01', canal: 'Site / Chat', Icon: Globe, iconColor: '#8B5CF6',
        msgs: [
          { from: 'agent', text: 'Com base no seu perfil de uso, o Plano Plus 200GB com velocidade até 600Mbps seria ideal. Comparando com o seu plano atual:' },
          { from: 'agent', text: '📊 Atual: 80GB · 100Mbps · R$ 89,90/mês\n⚡ Plus: 200GB · 600Mbps · R$ 129,90/mês' },
          { from: 'client', text: 'Parece interessante mas R$ 40 a mais é caro...' },
        ],
      },
      {
        time: '14:02', isSys: true, tipo: 'alerta',
        text: 'Objeção de preço detectada. Ativando oferta personalizada de retenção/conversão para cliente de alto valor.',
      },
      {
        time: '14:03', canal: 'Site / Chat', Icon: Globe, iconColor: '#8B5CF6',
        msgs: [
          { from: 'agent', text: '🎁 Oferta exclusiva para você: Plano Plus 200GB por R$ 99,90/mês (antes R$ 129,90) + 3 meses grátis na contratação hoje.' },
          { from: 'client', text: 'Assim fica bom! Pode fazer a troca?' },
          { from: 'agent', text: 'Perfeito! Upgrade ativado agora mesmo. Você já tem acesso à velocidade de 600Mbps. Confirmação por e-mail em instantes.' },
        ],
      },
      {
        time: '14:04', isSys: true, tipo: 'sucesso',
        text: 'Conversão concluída. Revenue incremental: +R$ 10/mês. LTV estimado prolongado em +8 meses. CES: 6.4/7.',
      },
    ],
  },

  'Troca de titularidade': {
    canalPath: [
      { label: 'WhatsApp', Icon: MessageSquare, color: '#25D366', time: '14:30' },
      { label: 'ClaroSense', Icon: Wifi, color: '#E8002A', time: '14:31', alert: true },
      { label: 'Protocolo', Icon: FileText, color: '#F59E0B', time: '14:34' },
    ],
    events: [
      {
        time: '14:30', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [{ from: 'client', text: 'Preciso passar o plano para o nome da minha filha. Como faço isso?' }],
      },
      {
        time: '14:31', isSys: true, tipo: 'alerta',
        text: 'Jornada de troca de titularidade identificada. Alta complexidade documental — orientação proativa ativada para reduzir atrito.',
      },
      {
        time: '14:31', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [
          { from: 'agent', text: 'Vou te ajudar com a troca! Você vai precisar dos seguintes documentos da nova titular:\n\n• RG ou CNH (cópia)\n• Comprovante de residência\n• Autorização assinada por você' },
          { from: 'client', text: 'Não tenho todos aqui agora, posso continuar depois?' },
        ],
      },
      {
        time: '14:33', isSys: true, tipo: 'alerta',
        text: 'Intenção de pausa detectada. Salvando contexto completo para reengajamento. Evitando que cliente precise repetir todo o processo.',
      },
      {
        time: '14:33', canal: 'WhatsApp', Icon: MessageSquare, iconColor: '#25D366',
        msgs: [
          { from: 'agent', text: 'Claro! Salvei tudo aqui. Quando reunir os documentos, é só nos chamar com o protocolo #TR-4821 — não vai precisar explicar nada de novo.' },
          { from: 'agent', text: 'Você também pode ir à loja Claro mais próxima e apresentar o protocolo. Vou te enviar o endereço da mais perto.' },
          { from: 'client', text: 'Ótimo, obrigada pela paciência!' },
        ],
      },
      {
        time: '14:34', isSys: true, tipo: 'sucesso',
        text: 'Protocolo #TR-4821 gerado com contexto completo salvo. Reengajamento automático agendado em 3 dias. Atrito de abandono: zero.',
      },
    ],
  },

  'Contratação': {
    canalPath: [
      { label: 'Site', Icon: Globe, color: '#8B5CF6', time: '15:00' },
      { label: 'ClaroSense', Icon: Wifi, color: '#E8002A', time: '15:02', alert: true },
      { label: 'Confirmado', Icon: CheckCircle, color: '#10B981', time: '15:06' },
    ],
    events: [
      {
        time: '15:00', canal: 'Site / Chat', Icon: Globe, iconColor: '#8B5CF6',
        msgs: [{ from: 'client', text: 'Quero contratar um plano de internet. Moro em apartamento, trabalho home office, somos 3 pessoas.' }],
      },
      {
        time: '15:01', isSys: true, tipo: 'alerta',
        text: 'Perfil de contratação identificado: família pequena, home office, alta demanda de velocidade. Recomendação personalizada em andamento.',
      },
      {
        time: '15:01', canal: 'Site / Chat', Icon: Globe, iconColor: '#8B5CF6',
        msgs: [
          { from: 'agent', text: 'Para 3 pessoas com home office, recomendo o Plano Família 200GB com até 400Mbps — cada um tem velocidade garantida mesmo com todos online.' },
          { from: 'client', text: 'Quanto custa? E a instalação é rápida?' },
          { from: 'agent', text: 'R$ 119,90/mês com instalação grátis e agendamento em até 48h. Temos horário amanhã à tarde, quer garantir?' },
        ],
      },
      {
        time: '15:03', isSys: true, tipo: 'alerta',
        text: 'Alta probabilidade de conversão detectada (cliente fez 2 perguntas sobre detalhes logísticos). Mantendo fluxo simplificado.',
      },
      {
        time: '15:04', canal: 'Site / Chat', Icon: Globe, iconColor: '#8B5CF6',
        msgs: [
          { from: 'client', text: 'Combinado! Pode ser amanhã das 14h às 18h.' },
          { from: 'agent', text: '✅ Contrato ativado! Técnico confirmado para amanhã entre 14h–18h. Você receberá SMS de confirmação e contato do técnico 30 min antes.' },
        ],
      },
      {
        time: '15:06', isSys: true, tipo: 'sucesso',
        text: 'Contratação concluída. Instalação agendada. NPS pós-venda estimado: 9.1/10. Tempo total: 6 minutos.',
      },
    ],
  },
}

const DEFAULT_JORNADA = 'Cancelamento'

// ─────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────
function DrawerConversa({ conversa, onClose }) {
  if (!conversa) return null

  const data = JORNADA_DATA[conversa.jornada] || JORNADA_DATA[DEFAULT_JORNADA]
  const { canalPath, events } = data

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl"
        style={{ width: '440px' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '2px solid #E8002A' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#E8002A' }}
          >
            {conversa.iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 text-sm">{conversa.nome}</div>
            <div className="text-[11px] text-gray-400">{conversa.jornada} · via {conversa.canal}</div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}
            >
              Atrito {conversa.atrito}%
            </span>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Canal path */}
        <div className="mx-5 mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 flex-shrink-0">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Jornada de canais
          </div>
          <div className="flex items-center gap-1">
            {canalPath.map((step, i) => (
              <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center min-w-0">
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-lg whitespace-nowrap"
                    style={{ backgroundColor: `${step.color}15` }}
                  >
                    <step.Icon size={11} style={{ color: step.color }} />
                    <span className="text-[10px] font-semibold" style={{ color: step.color }}>
                      {step.label}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-mono mt-0.5">{step.time}</span>
                </div>
                {i < canalPath.length - 1 && (
                  <div className="flex-1 flex items-center mt-0 mb-3">
                    <div className="h-px flex-1 bg-gray-300" />
                    {step.alert && (
                      <div className="w-1.5 h-1.5 rounded-full mx-0.5" style={{ backgroundColor: '#E8002A' }} />
                    )}
                    <div className="h-px flex-1 bg-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {events.map((event, idx) => (
            <div key={idx}>
              {/* Divisor de tempo */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono text-gray-400">{event.time}</span>
                <div className="h-px flex-1 bg-gray-100" />
                {!event.isSys && event.Icon && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <event.Icon size={10} style={{ color: event.iconColor }} />
                    {event.canal}
                  </span>
                )}
              </div>

              {event.isSys ? (
                <div
                  className={`mx-1 p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    event.tipo === 'risco'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : event.tipo === 'alerta'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                  }`}
                >
                  {event.tipo === 'sucesso' ? (
                    <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold">ClaroSense · </span>
                    {event.text}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 px-1">
                  {event.msgs.map((msg, mIdx) => {
                    if (msg.from === 'system') {
                      return (
                        <div key={mIdx} className="text-center">
                          <span className="inline-block bg-blue-50 text-blue-600 text-[10px] px-3 py-1.5 rounded-full border border-blue-100 font-medium">
                            {msg.text}
                          </span>
                        </div>
                      )
                    }
                    return (
                      <div key={mIdx} className={`flex ${msg.from === 'client' ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                            msg.from === 'client'
                              ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                              : 'text-white rounded-tr-sm'
                          }`}
                          style={msg.from !== 'client' ? { backgroundColor: '#E8002A' } : {}}
                        >
                          {msg.text}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 flex gap-3 flex-shrink-0">
          <button
            className="flex-1 py-2.5 text-xs font-bold text-white rounded-xl transition-colors"
            style={{ backgroundColor: '#E8002A' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C40022')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8002A')}
          >
            Transferir para humano
          </button>
          <button className="flex-1 py-2.5 text-xs font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-colors">
            Encerrar com resolução
          </button>
        </div>
      </div>
    </>
  )
}

export default DrawerConversa
