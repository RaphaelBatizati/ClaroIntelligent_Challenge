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

/** Monta query string ignorando filtros vazios. */
function qs(params = {}) {
  const limpo = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  return limpo.length ? `?${new URLSearchParams(Object.fromEntries(limpo))}` : ''
}

export const api = {
  health: () => request('/api/health'),

  // Clientes e produtos
  clientes: () => request('/api/clientes'),
  cliente: (id) => request(`/api/clientes/${id}`),
  portfolio: (clienteId) => request(`/api/clientes/${clienteId}/portfolio`),
  catalogo: (filtros) => request(`/api/produtos/catalogo${qs(filtros)}`),

  // Chat
  chat: (body) => request('/api/chat/mensagem', { method: 'POST', body: JSON.stringify(body) }),
  mensagens: (sessaoId) => request(`/api/chat/sessoes/${sessaoId}/mensagens`),
  estadoSessao: (sessaoId) => request(`/api/chat/sessoes/${sessaoId}/estado`),

  // Dashboard — todos aceitam ?periodo=1h|1d|7d|30d (seletor da Topbar)
  kpis: (periodo) => request(`/api/dashboard/kpis${qs({ periodo })}`),
  volume: (periodo) => request(`/api/dashboard/volume${qs({ periodo })}`),
  canais: (periodo) => request(`/api/dashboard/canais${qs({ periodo })}`),
  mapaAtrito: (filtros) => request(`/api/dashboard/mapa-atrito${qs(filtros)}`),
  transbordo: (periodo) => request(`/api/dashboard/transbordo${qs({ periodo })}`),
  personas: (periodo) => request(`/api/dashboard/personas${qs({ periodo })}`),
  contencao: (periodo) => request(`/api/dashboard/contencao${qs({ periodo })}`),
  sinais: (periodo) => request(`/api/dashboard/sinais${qs({ periodo })}`),

  // Monitor de conversas
  conversas: (filtros) => request(`/api/conversas${qs(filtros)}`),
  conversaFacetas: (filtros) => request(`/api/conversas/facetas${qs(filtros)}`),
  conversa: (id) => request(`/api/conversas/${id}`),
  transferir: (id) => request(`/api/conversas/${id}/transferir`, { method: 'PUT' }),
  encerrar: (id) => request(`/api/conversas/${id}/encerrar`, { method: 'PUT' }),

  // Fila de atendimento humano
  fila: (filtros) => request(`/api/fila${qs(typeof filtros === 'string' ? { status: filtros } : filtros)}`),
  filaMetricas: () => request('/api/fila/metricas'),
  filaConversa: (id) => request(`/api/fila/${id}/conversa`),
  filaAssumir: (id, atendente) => request(`/api/fila/${id}/assumir`, { method: 'PUT', body: JSON.stringify({ atendente }) }),
  filaResponder: (id, texto, atendente) => request(`/api/fila/${id}/mensagem`, { method: 'POST', body: JSON.stringify({ texto, atendente }) }),
  filaEncerrar: (id, observacao) => request(`/api/fila/${id}/encerrar`, { method: 'PUT', body: JSON.stringify({ observacao }) }),
  filaEntrar: (body) => request('/api/fila/entrar', { method: 'POST', body: JSON.stringify(body) }),

  // Protocolos
  protocolos: (filtros) => request(`/api/protocolos${qs(filtros)}`),
  protocolo: (numero) => request(`/api/protocolos/${numero}`),
  protocolosAbertos: (clienteId, canal) => request(`/api/protocolos/cliente/${clienteId}/abertos${qs({ canal })}`),

  // Personas
  personaConfig: () => request('/api/produtos/personas/config'),
  salvarPersonaConfig: (body) => request('/api/produtos/personas/config', { method: 'PUT', body: JSON.stringify(body) }),
  dicionario: (persona) => request(`/api/produtos/personas/dicionario${qs({ persona })}`),
  adicionarTermo: (body) => request('/api/produtos/personas/dicionario', { method: 'POST', body: JSON.stringify(body) }),
  removerTermo: (id) => request(`/api/produtos/personas/dicionario/${id}`, { method: 'DELETE' }),
  alternarTermo: (id, ativo) => request(`/api/produtos/personas/dicionario/${id}`, { method: 'PUT', body: JSON.stringify({ ativo }) }),
  classificarPersona: (texto) => request('/api/produtos/personas/classificar', { method: 'POST', body: JSON.stringify({ texto }) }),

  // ClaroSense e segurança
  sinaisCatalogo: () => request('/api/produtos/clarosense/sinais'),
  segurancaEventos: (filtros) => request(`/api/seguranca/eventos${qs(filtros)}`),
  segurancaResumo: () => request('/api/seguranca/resumo'),
  segurancaPoliticas: () => request('/api/seguranca/politicas'),
}

export const BASE_URL = BASE
