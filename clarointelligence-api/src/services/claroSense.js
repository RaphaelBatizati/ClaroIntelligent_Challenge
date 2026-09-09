const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')

const LIMIARES = { alerta: 40, risco: 65, transbordo: 80 }

function calcular(sessao, textoCliente, historico, intencaoAtual) {
  let score = sessao.score_atrito || 0
  const sinais = []

  // Sinal 1: Repetição da mesma intenção nas últimas 3 mensagens do cliente
  const clienteMsgs = historico.filter(m => m.papel === 'cliente').slice(-3)
  const repInt = clienteMsgs.filter(m => m.intencao_codigo === intencaoAtual && intencaoAtual !== 'geral').length
  if (repInt >= 2) {
    const delta = 22
    score += delta
    sinais.push({ tipo: 'repeticao_intencao', valor: delta, descricao: `Intenção "${intencaoAtual}" repetida ${repInt}x` })
  }

  // Sinal 2: Mensagem muito curta (monossilábica / frustração)
  const palavras = textoCliente.trim().split(/\s+/).length
  if (palavras <= 3 && historico.length > 1) {
    const delta = 10
    score += delta
    sinais.push({ tipo: 'monossilabico', valor: delta, descricao: 'Resposta muito curta detectada' })
  }

  // Sinal 3: Sentimento negativo explícito
  const negativoRegex = /\b(absurdo|horrivel|p[eé]ssimo|rid[ií]culo|inad|insat|raiva|aborrecid|frustrad|cansad|irrit|estou\s*com\s*raiva|n[aã]o\s*aguento|uma\s*merda|uma\s*droga|v[aá]rias\s*vezes|j[aá]\s*tentei)\b/i
  if (negativoRegex.test(textoCliente)) {
    const delta = 28
    score += delta
    sinais.push({ tipo: 'sentimento_negativo', valor: delta, descricao: 'Linguagem de frustração detectada' })
  }

  // Sinal 4: Solicitação explícita de humano
  const humanoRegex = /\b(falar\s*com\s*(humano|atendente|pessoa|gerente)|quero\s*um\s*atendente|chamar\s*um\s*atendente)\b/i
  if (humanoRegex.test(textoCliente)) {
    const delta = 35
    score += delta
    sinais.push({ tipo: 'solicita_humano', valor: delta, descricao: 'Solicitação explícita de atendente humano' })
  }

  // Sinal 5: Histórico de múltiplos canais (vem de sessão anterior)
  // (Seria calculado via ClaroMemory ao recuperar contexto entre sessões)

  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Determinação do nível
  let nivel = 'normal'
  if (score >= LIMIARES.transbordo) nivel = 'transbordo'
  else if (score >= LIMIARES.risco) nivel = 'risco'
  else if (score >= LIMIARES.alerta) nivel = 'alerta'

  // Intervenção automática
  let intervencao = null
  if (nivel === 'transbordo' && sessao.status !== 'transferida') {
    intervencao = {
      tipo: 'transferencia_humano',
      gatilho: `score_atrito=${score} >= ${LIMIARES.transbordo}`,
      acao: 'Transferência automática para fila prioritária com contexto completo',
    }
  } else if (nivel === 'risco') {
    intervencao = {
      tipo: 'simplificacao',
      gatilho: `score_atrito=${score} >= ${LIMIARES.risco}`,
      acao: 'Linguagem simplificada e oferta de suporte humano',
    }
  } else if (nivel === 'alerta') {
    intervencao = {
      tipo: 'antecipacao',
      gatilho: `score_atrito=${score} >= ${LIMIARES.alerta}`,
      acao: 'Antecipar próximos passos para reduzir fricção',
    }
  }

  // Persistir sinais no banco
  if (sinais.length > 0) {
    try {
      const db = getDb()
      const insertSinal = db.prepare(`INSERT INTO sinais_atrito (id, sessao_id, tipo, valor, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      for (const s of sinais) {
        insertSinal.run(uuidv4(), sessao.id, s.tipo, s.valor)
      }
    } catch (_) {}
  }

  return { score, nivel, sinais, intervencao }
}

module.exports = { calcular, LIMIARES }
