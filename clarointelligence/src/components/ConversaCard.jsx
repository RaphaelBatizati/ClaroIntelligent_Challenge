import { MessageSquare, Smartphone, Globe, Phone, Clock } from 'lucide-react'
import StatusBadge from './StatusBadge'
import AtritionBar from './AtritionBar'

const CHANNEL_ICON = {
  WhatsApp: { Icon: MessageSquare, color: '#25D366' },
  App: { Icon: Smartphone, color: '#3B82F6' },
  Site: { Icon: Globe, color: '#8B5CF6' },
  'Call Center': { Icon: Phone, color: '#E8002A' },
}

function ConversaCard({ conversa, onVerConversa }) {
  const { nome, iniciais, canal, jornada, status, atrito, tempo, ultimaAcao } = conversa
  const ch = CHANNEL_ICON[canal] || { Icon: MessageSquare, color: '#6B7280' }
  const { Icon: ChannelIcon, color: channelColor } = ch

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:-translate-y-0.5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-gray-600 text-sm font-semibold">{iniciais}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-gray-900 text-sm truncate">{nome}</span>
            <StatusBadge status={status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <ChannelIcon size={10} style={{ color: channelColor }} />
              {canal}
            </span>
            <span className="text-gray-200">•</span>
            <span className="truncate">{jornada}</span>
            <span className="ml-auto flex items-center gap-1 whitespace-nowrap">
              <Clock size={10} />
              {tempo}
            </span>
          </div>
        </div>
      </div>

      {/* Last action */}
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">{ultimaAcao}</p>

      <AtritionBar value={atrito} />

      <button
        onClick={() => onVerConversa(conversa)}
        className="mt-3 w-full py-2 text-[11px] font-semibold text-[#E8002A] border border-red-100 hover:border-[#E8002A] hover:bg-red-50 rounded-lg transition-all duration-150"
      >
        Ver conversa completa →
      </button>
    </div>
  )
}

export default ConversaCard
