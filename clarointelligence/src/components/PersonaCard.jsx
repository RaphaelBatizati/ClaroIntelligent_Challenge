function PersonaCard({ perfil }) {
  const { nome, badge, badgeColor, descricao, tags, clientMsg, sysMsg, color } = perfil

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-50">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-sm">{nome}</h3>
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {badge}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{descricao}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium"
              style={{ backgroundColor: `${color}12`, color }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Chat bubbles */}
      <div className="p-5 bg-gray-50/50 space-y-3">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Exemplo de adaptação</div>

        {/* Client message */}
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-semibold text-gray-500 mt-0.5">
            C
          </div>
          <div className="bg-white px-3 py-2 rounded-xl rounded-tl-sm shadow-sm border border-gray-100 text-xs text-gray-700 max-w-[85%] leading-relaxed">
            {clientMsg}
          </div>
        </div>

        {/* System response */}
        <div className="flex items-start gap-2 justify-end">
          <div
            className="px-3 py-2 rounded-xl rounded-tr-sm text-xs text-white max-w-[85%] leading-relaxed"
            style={{ backgroundColor: color }}
          >
            {sysMsg}
          </div>
          <div
            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-semibold text-white mt-0.5"
            style={{ backgroundColor: color }}
          >
            IA
          </div>
        </div>
      </div>
    </div>
  )
}

export default PersonaCard
