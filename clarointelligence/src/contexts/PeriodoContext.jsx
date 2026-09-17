import { useState, useMemo } from 'react'
import { PeriodoContext, PERIODOS } from './periodo'

export function PeriodoProvider({ children }) {
  const [periodo, setPeriodo] = useState('7d')

  const valor = useMemo(() => ({
    periodo,
    setPeriodo,
    rotulo: PERIODOS.find(p => p.chave === periodo)?.label || '',
  }), [periodo])

  return <PeriodoContext.Provider value={valor}>{children}</PeriodoContext.Provider>
}
