import { useEffect, useState } from 'react'

function AtritionBar({ value }) {
  const [width, setWidth] = useState(0)
  const color = value >= 40 ? '#EF4444' : value >= 25 ? '#F59E0B' : '#10B981'

  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 150)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-gray-400">Nível de atrito</span>
        <span className="text-[11px] font-semibold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default AtritionBar
