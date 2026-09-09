const { getDb } = require('../database')

const DIGITAL_TERMS = /\b(protocolo|throttling|lat[eê]ncia|dns|api|msisdn|esim|e-sim|ipv6|bgp|olt|cpe|pppoe|dhcp|fibra\s*[oó]ptica|onu|ont|snr|bss|oss|bandwidth|throughput|configure|reset\s*de\s*f[aá]brica|factory\s*reset)\b/i
const ASSISTIDO_TERMS = /\b(n[aã]o\s*entendo|n[aã]o\s*sei|como\s*(faz|fa[cç]o)|me\s*ajuda|n[aã]o\s*consigo|t[aá]\s*dif[ií]cil|n[aã]o\s*sei\s*usar|pode\s*explicar|n[aã]o\s*entend|como\s*funciona|explica\s*direit|passo\s*a\s*passo)\b/i

function classificarDoTexto(texto) {
  if (DIGITAL_TERMS.test(texto)) return 'digital'
  if (ASSISTIDO_TERMS.test(texto)) return 'assistido'
  return 'intermediario'
}

function obterPerfil(clienteId, textoAtual) {
  try {
    const db = getDb()
    const cliente = db.prepare('SELECT perfil_persona FROM clientes WHERE id = ?').get(clienteId)
    const perfilSalvo = cliente?.perfil_persona || 'intermediario'

    const detecado = classificarDoTexto(textoAtual)

    // Blending: se detectamos 'digital' e o perfil é 'assistido', mantém intermediario
    let perfilFinal = perfilSalvo
    if (detecado === 'digital') {
      perfilFinal = perfilSalvo === 'assistido' ? 'intermediario' : 'digital'
    } else if (detecado === 'assistido' && perfilSalvo !== 'digital') {
      perfilFinal = 'assistido'
    }

    return perfilFinal
  } catch (_) {
    return 'intermediario'
  }
}

function adaptarTom(texto, persona) {
  // Persona engine adapts response tone at LLM level; this is a post-processor
  if (persona === 'digital') {
    return texto // already concise and technical
  }
  if (persona === 'assistido') {
    // Ensure ends with offer of help
    if (!texto.includes('Precisa') && !texto.includes('posso ajudar') && !texto.includes('mais alguma coisa')) {
      return texto + '\n\nPrecisa que eu explique melhor ou tem mais alguma dúvida? 😊'
    }
  }
  return texto
}

function getConfig() {
  try {
    const db = getDb()
    return db.prepare('SELECT * FROM personas_config WHERE id = 1').get() || { limiar_digital: 6, limiar_assistido: 3, sensibilidade: 7, delay_interv: 3 }
  } catch (_) {
    return { limiar_digital: 6, limiar_assistido: 3, sensibilidade: 7, delay_interv: 3 }
  }
}

module.exports = { classificarDoTexto, obterPerfil, adaptarTom, getConfig }
