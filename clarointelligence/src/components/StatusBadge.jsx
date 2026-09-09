const STATUS = {
  'Em risco': { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', pulse: true },
  'Transferida': { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', pulse: false },
  'Resolvida': { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500', pulse: false },
  'Ativa': { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', pulse: false },
}

function StatusBadge({ status }) {
  const cfg = STATUS[status] || { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400', pulse: false }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
        {cfg.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
      </span>
      {status}
    </span>
  )
}

export default StatusBadge
