import { createContext, useContext } from 'react'

// Período global do painel: o seletor da Topbar vale para todas as telas de
// monitoramento, e cada uma repassa a chave para a API. É um contexto, e não
// estado local de cada página, para que o recorte não se perca ao navegar
// entre Dashboard, Mapa de Atrito e Log do ClaroSense.

export const PERIODOS = [
  { chave: '1h', label: 'Última hora' },
  { chave: '1d', label: 'Último dia' },
  { chave: '7d', label: 'Últimos 7 dias' },
  { chave: '30d', label: 'Últimos 30 dias' },
]

export const PeriodoContext = createContext(null)

export function usePeriodo() {
  const ctx = useContext(PeriodoContext)
  if (!ctx) throw new Error('usePeriodo precisa estar dentro de <PeriodoProvider>')
  return ctx
}
