const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ erro: res.statusText }))
    throw new Error(err.erro || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  health: () => request('/api/health'),
  clientes: () => request('/api/clientes'),
  cliente: (id) => request(`/api/clientes/${id}`),
  portfolio: (clienteId) => request(`/api/clientes/${clienteId}/portfolio`),

  chat: (body) => request('/api/chat/mensagem', { method: 'POST', body: JSON.stringify(body) }),
  mensagens: (sessaoId) => request(`/api/chat/sessoes/${sessaoId}/mensagens`),

  kpis: () => request('/api/dashboard/kpis'),
  volume: () => request('/api/dashboard/volume'),
  atrito: () => request('/api/dashboard/atrito'),
  transbordo: () => request('/api/dashboard/transbordo'),
  personas: () => request('/api/dashboard/personas'),

  conversas: () => request('/api/conversas'),
  conversa: (id) => request(`/api/conversas/${id}`),
  transferir: (id) => request(`/api/conversas/${id}/transferir`, { method: 'PUT' }),
  encerrar: (id) => request(`/api/conversas/${id}/encerrar`, { method: 'PUT' }),
}
