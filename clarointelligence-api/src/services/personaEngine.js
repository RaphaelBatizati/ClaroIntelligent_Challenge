// Persona Engine — classifica o jeito de falar do cliente para adaptar o tom
// da resposta. Quatro perfis:
//
//   digital       — domina o vocabulário técnico, quer objetividade
//   intermediario — conforto médio, quer clareza e passo a passo
//   assistido     — precisa de apoio, linguagem simples e confirmação
//   informal      — fala coloquial, gíria, abreviação ("blz", "vc", "tá osso")
//
// A persona informal não é um cliente "menos capaz": é alguém que escreve como
// fala. Tratar essa linguagem como ruído produz respostas frias e distantes —
// por isso ela é um perfil próprio, com tom espelhado, e não um caso de erro.
//
// A classificação é feita por um DICIONÁRIO LÉXICO editável no painel, não por
// regex fixa no código: a equipe de atendimento ajusta os termos sem deploy.

const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')

const PERSONAS = ['digital', 'intermediario', 'assistido', 'informal']

// Dicionário semente — usado quando a tabela está vazia e como base do seed.
const DICIONARIO_PADRAO = [
  // Digital — jargão técnico de telecom e de rede
  ...['protocolo', 'throughput', 'latência', 'dns', 'api', 'msisdn', 'esim', 'ipv6',
      'olt', 'onu', 'ont', 'cpe', 'pppoe', 'dhcp', 'snr', 'bss', 'oss', 'bandwidth',
      'throttling', 'fibra óptica', 'reset de fábrica', 'factory reset', 'downstream',
      'upstream', 'traceroute', 'ping', 'mtu', 'vlan', 'qos', 'sla']
    .map(termo => ({ persona: 'digital', termo, categoria: 'tecnico', peso: 3 })),

  // Assistido — pedidos explícitos de ajuda e declarações de dificuldade
  ...['não entendo', 'não sei', 'como faço', 'como faz', 'me ajuda', 'não consigo',
      'tá difícil', 'está difícil', 'não sei usar', 'pode explicar', 'como funciona',
      'explica direito', 'passo a passo', 'me ensina', 'sou leigo', 'não sou bom nisso',
      'meu filho que resolve', 'devagar por favor']
    .map(termo => ({ persona: 'assistido', termo, categoria: 'ajuda', peso: 3 })),

  // Informal — gíria, abreviação de internet e oralidade
  ...['blz', 'vlw', 'flw', 'tmj', 'pprt', 'kkk', 'rsrs', 'mano', 'cara', 'véi', 'mds',
      'pfv', 'pfvr', 'vc', 'vcs', 'tbm', 'tb', 'pq', 'qdo', 'msg', 'agr', 'dps',
      'tá osso', 'ta osso', 'e aí', 'eae', 'salve', 'top', 'massa', 'suave', 'tipo assim',
      'né', 'ne', 'poxa', 'affs', 'bora', 'tá ligado', 'ta ligado', 'brother', 'parça']
    .map(termo => ({ persona: 'informal', termo, categoria: 'giria', peso: 2 })),

  // Intermediário — marcadores de formalidade cordial padrão
  ...['por gentileza', 'poderia', 'gostaria de', 'boa tarde', 'bom dia', 'boa noite',
      'obrigado', 'obrigada', 'agradeço', 'por favor']
    .map(termo => ({ persona: 'intermediario', termo, categoria: 'formal', peso: 1 })),
]

let _cache = null
let _cacheEm = 0
const CACHE_MS = 30_000

/** Carrega o dicionário do banco com cache curto (o painel edita ao vivo). */
function carregarDicionario() {
  const agora = Date.now()
  if (_cache && agora - _cacheEm < CACHE_MS) return _cache

  try {
    const db = getDb()
    const rows = db.prepare('SELECT persona, termo, categoria, peso FROM persona_dicionario WHERE ativo = 1').all()
    _cache = rows.length > 0 ? rows : DICIONARIO_PADRAO
  } catch (_) {
    _cache = DICIONARIO_PADRAO
  }
  _cacheEm = agora
  return _cache
}

function invalidarCache() {
  _cache = null
  _cacheEm = 0
}

/** Escapa um termo para uso seguro dentro de expressão regular. */
function escaparRegex(termo) {
  return termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Classifica o texto somando os pesos dos termos encontrados por persona.
 * Devolve a persona vencedora e os termos que a justificaram — a transparência
 * importa: o painel mostra POR QUE o cliente foi classificado assim.
 */
function classificarDoTexto(texto) {
  if (!texto) return { persona: 'intermediario', pontuacoes: {}, termos: [] }

  const dicionario = carregarDicionario()
  const alvo = texto.toLowerCase()
  const pontuacoes = { digital: 0, intermediario: 0, assistido: 0, informal: 0 }
  const termos = []

  for (const item of dicionario) {
    // \b não funciona bem com acento em JS; usamos limites explícitos
    const padrao = new RegExp(`(^|[^\\wÀ-ÿ])${escaparRegex(item.termo.toLowerCase())}([^\\wÀ-ÿ]|$)`, 'i')
    if (padrao.test(alvo)) {
      pontuacoes[item.persona] = (pontuacoes[item.persona] || 0) + (item.peso || 1)
      termos.push({ termo: item.termo, persona: item.persona, peso: item.peso || 1, categoria: item.categoria })
    }
  }

  const vencedora = Object.entries(pontuacoes).sort((a, b) => b[1] - a[1])[0]
  const persona = vencedora && vencedora[1] > 0 ? vencedora[0] : 'intermediario'

  return { persona, pontuacoes, termos }
}

/**
 * Perfil final do cliente: combina o perfil salvo com o detectado agora.
 *
 * O blending evita que uma única mensagem vire uma mudança de perfil. A regra
 * de negócio: alguém classificado como assistido que usou um termo técnico não
 * vira "digital" de imediato — passa por intermediário. Já a informalidade é
 * aceita em cima de qualquer perfil, porque é forma de falar, não competência.
 */
function obterPerfil(clienteId, textoAtual) {
  try {
    const db = getDb()
    const cliente = db.prepare('SELECT perfil_persona FROM clientes WHERE id = ?').get(clienteId)
    const perfilSalvo = cliente?.perfil_persona || 'intermediario'

    const { persona: detectada, pontuacoes, termos } = classificarDoTexto(textoAtual)

    let perfilFinal = perfilSalvo

    if (detectada === 'informal') {
      // Informalidade domina o tom, mas não apaga a necessidade de apoio:
      // quem é assistido e fala informal continua precisando de explicação simples.
      perfilFinal = perfilSalvo === 'assistido' ? 'assistido' : 'informal'
    } else if (detectada === 'digital') {
      perfilFinal = perfilSalvo === 'assistido' ? 'intermediario' : 'digital'
    } else if (detectada === 'assistido' && perfilSalvo !== 'digital') {
      perfilFinal = 'assistido'
    }

    return { persona: perfilFinal, detectada, perfil_salvo: perfilSalvo, pontuacoes, termos }
  } catch (_) {
    return { persona: 'intermediario', detectada: 'intermediario', perfil_salvo: 'intermediario', pontuacoes: {}, termos: [] }
  }
}

/** Ajuste fino no texto já gerado, por persona. */
function adaptarTom(texto, persona) {
  if (persona === 'digital') return texto

  if (persona === 'assistido') {
    if (!texto.includes('Precisa') && !texto.includes('posso ajudar') && !texto.includes('mais alguma coisa')) {
      return texto + '\n\nPrecisa que eu explique melhor ou tem mais alguma dúvida? 😊'
    }
  }

  if (persona === 'informal') {
    if (!/[?]\s*$/.test(texto.trim())) {
      return texto + '\n\nQualquer coisa é só chamar! 👊'
    }
  }

  return texto
}

// ─── CRUD do dicionário (usado pelo painel Gestão de Personas) ───────────────

function listarDicionario(persona = null) {
  try {
    const db = getDb()
    const rows = persona
      ? db.prepare('SELECT * FROM persona_dicionario WHERE persona = ? ORDER BY categoria, termo').all(persona)
      : db.prepare('SELECT * FROM persona_dicionario ORDER BY persona, categoria, termo').all()
    return rows
  } catch (_) {
    return []
  }
}

function adicionarTermo({ persona, termo, categoria, peso = 2 }) {
  if (!PERSONAS.includes(persona)) return { ok: false, erro: 'Persona inválida' }
  const limpo = String(termo || '').trim().toLowerCase()
  if (limpo.length < 2) return { ok: false, erro: 'Termo muito curto' }

  try {
    const db = getDb()
    const existe = db.prepare('SELECT id FROM persona_dicionario WHERE persona = ? AND termo = ?').get(persona, limpo)
    if (existe) return { ok: false, erro: 'Termo já cadastrado para esta persona' }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO persona_dicionario (id, persona, termo, categoria, peso, ativo, created_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(id, persona, limpo, categoria || 'personalizado', Number(peso) || 2)

    invalidarCache()
    return { ok: true, id }
  } catch (err) {
    return { ok: false, erro: err.message }
  }
}

function removerTermo(id) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM persona_dicionario WHERE id = ?').run(id)
    invalidarCache()
    return { ok: true }
  } catch (err) {
    return { ok: false, erro: err.message }
  }
}

function alternarTermo(id, ativo) {
  try {
    const db = getDb()
    db.prepare('UPDATE persona_dicionario SET ativo = ? WHERE id = ?').run(ativo ? 1 : 0, id)
    invalidarCache()
    return { ok: true }
  } catch (err) {
    return { ok: false, erro: err.message }
  }
}

function getConfig() {
  try {
    const db = getDb()
    return db.prepare('SELECT * FROM personas_config WHERE id = 1').get()
      || { limiar_digital: 6, limiar_assistido: 3, sensibilidade: 7, delay_interv: 3 }
  } catch (_) {
    return { limiar_digital: 6, limiar_assistido: 3, sensibilidade: 7, delay_interv: 3 }
  }
}

module.exports = {
  classificarDoTexto,
  obterPerfil,
  adaptarTom,
  getConfig,
  listarDicionario,
  adicionarTermo,
  removerTermo,
  alternarTermo,
  invalidarCache,
  DICIONARIO_PADRAO,
  PERSONAS,
}
