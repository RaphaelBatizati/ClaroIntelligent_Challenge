import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

function KPICard({ label, value, numericValue, delta, deltaType, icon: Icon, accentColor = '#E8002A', subtitle }) {
  const [display, setDisplay] = useState(numericValue ? '0' : value)
  // Valor de onde a contagem parte. Como os KPIs agora mudam com o filtro de
  // período, a animação precisa reagir a cada novo valor — e não rodar só na
  // primeira montagem, o que deixaria o cartão exibindo um número velho.
  const anterior = useRef(0)

  useEffect(() => {
    if (numericValue === null || numericValue === undefined) {
      setDisplay(value)
      return
    }

    const de = anterior.current
    const para = numericValue
    anterior.current = para

    if (de === para) { setDisplay(value); return }

    const duration = 900
    const start = performance.now()
    let frame

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(de + (para - de) * eased).toLocaleString('pt-BR'))
      if (progress < 1) frame = requestAnimationFrame(step)
      else setDisplay(value)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [numericValue, value])

  const bgAccent = `${accentColor}18`

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: bgAccent }}
        >
          {Icon && <Icon size={20} style={{ color: accentColor }} />}
        </div>
        {delta && (
          <div
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              deltaType === 'positive'
                ? 'bg-green-50 text-green-600'
                : deltaType === 'negative'
                ? 'bg-red-50 text-red-500'
                : 'bg-gray-50 text-gray-500'
            }`}
          >
            {deltaType === 'positive' && <TrendingUp size={10} />}
            {deltaType === 'negative' && <TrendingDown size={10} />}
            {delta}
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{display}</div>
        <div className="text-xs font-medium text-gray-500">{label}</div>
        {subtitle && <div className="text-[11px] text-gray-400">{subtitle}</div>}
      </div>
    </div>
  )
}

export default KPICard
