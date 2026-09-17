// ClaroSense — detecção de atrito em tempo real.
//
// A régua é simples e auditável de propósito: cada sinal detectado soma um
// número conhecido ao score da sessão, e cada soma fica registrada com a
// explicação de por que aconteceu. Ninguém precisa confiar numa caixa-preta
// para entender por que um cliente foi transferido.
//
// O score acumula ao longo da sessão (não é por mensagem): repetir o mesmo
// problema e escalar o tom são exatamente os comportamentos que fazem a
// conversa caminhar para o cancelamento, e o score reflete essa escalada.

const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')

const LIMIARES = { alerta: 40, risco: 65, transbordo: 80 }

// Catálogo de sinais: peso + explicação legível para o painel.
const SINAIS = {
  repeticao_intencao: {
    peso: 22,
    rotulo: 'Repetição de intenção',
    explicacao: 'O cliente pediu a mesma coisa mais de uma vez — sinal clássico de que a resposta anterior não resolveu.',
  },
  monossilabico: {
    peso: 10,
    rotulo: 'Resposta monossilábica',
    explicacao: 'Respostas muito curtas depois de uma explicação longa costumam indicar impaciência ou desengajamento.',
  },
  sentimento_negativo: {
    peso: 28,
    rotulo: 'Linguagem de frustração',
    explicacao: 'Vocabulário de insatisfação ("absurdo", "já tentei", "cansado") indica que o problema já vinha de antes deste contato.',
  },
  tom_agressivo: {
    peso: 35,
    rotulo: 'Tom agressivo',
    explicacao: 'Agressividade explícita (xingamento, caixa alta, ameaça de órgão regulador) é o estágio mais avançado do atrito e precede o pedido de cancelamento.',
  },
  solicita_humano: {
    peso: 35,
    rotulo: 'Pedido de atendente humano',
    explicacao: 'O cliente desistiu do autoatendimento e pediu uma pessoa — insistir com o bot a partir daqui aumenta o risco de perda.',
  },
  intencao_cancelamento: {
    peso: 30,
    rotulo: 'Menção a cancelamento',
    explicacao: 'O cliente verbalizou a intenção de cancelar ou migrar para a concorrência.',
  },
  recontato_multicanal: {
    peso: 15,
    rotulo: 'Recontato em outro canal',
    explicacao: 'O cliente já havia procurado a Claro por outro canal nas últimas horas e voltou — o problema atravessou canais sem solução.',
  },
}

// Agressividade explícita: xingamento, ameaça regulatória, caixa alta sustentada.
const AGRESSIVO_REGEX = /\b(merda|porcaria|lixo|droga\s*de|palha[cç]ada|vergonha|roubo|ladr[oõ]es?|enganar?am|golpe|processar|procon|anatel|justi[cç]a|advogado|nunca\s*mais|odeio|inferno|caralh|porra|fdp|idiota|incompetent|descaso|desrespeito)\b/i

// Frustração sem agressão direta.
const NEGATIVO_REGEX = /\b(absurdo|horr[ií]vel|p[eé]ssimo|rid[ií]culo|inadmiss[ií]vel|insatisfeit|raiva|aborrecid|frustrad|cansad|irritad|n[aã]o\s*aguento|saco|chateado|revoltado|indignado|v[aá]rias\s*vezes|j[aá]\s*tentei|de\s*novo\s*isso|toda\s*vez)\b/i

// "falar com uma pessoa" é tão pedido de humano quanto "quero um atendente" —
// o artigo feminino ("uma") precisa entrar, senão o sinal mais importante da
// régua passa em branco justamente com quem fala de forma mais educada.
const HUMANO_REGEX = /\b((falar|conversar|atendimento)\s*(com\s*)?(um|uma|umas|uns)?\s*(humano|atendente|pessoa|gerente|supervisor|especialista)|prefiro\s*(falar|um)|quero\s*(um|uma)?\s*(atendente|humano|pessoa)|chamar?\s*(um|uma)?\s*(atendente|pessoa)|atendimento\s*humano|me\s*transfere|transferir\s*para\s*(um|uma)?\s*(humano|atendente|pessoa))\b/i

const CANCELAMENTO_REGEX = /\b(cancel\w*|rescind\w*|encerrar\s*(o\s*)?(plano|contrato)|quero\s*sair|mudar\s*de\s*operadora|portar\s*para|vivo|tim\b|oi\s*fibra)\b/i

/** Caixa alta sustentada também conta como escalada de tom. */
function temCaixaAlta(texto) {
  const letras = texto.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letras.length < 10) return false
  const maiusculas = letras.replace(/[^A-ZÀ-Þ]/g, '').length
  return maiusculas / letras.length > 0.7
}

/**
 * Calcula o score de atrito do turno e decide a intervenção.
 * Recebe a sessão (score acumulado), o texto do cliente, o histórico e a
 * intenção detectada. Devolve score, nível, sinais explicados, intervenção e
 * a leitura de risco de churn.
 */
function calcular(sessao, textoCliente, historico, intencaoAtual, contextoMemoria = null) {
  let score = sessao.score_atrito || 0
  const sinais = []

  function somar(tipo, detalhe) {
    const def = SINAIS[tipo]
    score += def.peso
    sinais.push({
      tipo,
      valor: def.peso,
      rotulo: def.rotulo,
      descricao: detalhe || def.rotulo,
      explicacao: def.explicacao,
    })
  }

  // Sinal 1 — mesma intenção repetida nas últimas 3 falas do cliente
  const clienteMsgs = historico.filter(m => m.papel === 'cliente').slice(-3)
  const repInt = clienteMsgs.filter(m => m.intencao_codigo === intencaoAtual && intencaoAtual !== 'geral').length
  if (repInt >= 2) {
    somar('repeticao_intencao', `Intenção "${intencaoAtual}" repetida ${repInt}x nesta sessão`)
  }

  // Sinal 2 — mensagem monossilábica depois de já haver conversa.
  // Um código de verificação é curto por natureza: digitar os 6 dígitos que o
  // próprio sistema pediu é colaboração, não impaciência.
  const palavras = textoCliente.trim().split(/\s+/).length
  const ehCodigo = /^\d{4,8}$/.test(textoCliente.trim())
  if (palavras <= 3 && historico.length > 1 && !ehCodigo) {
    somar('monossilabico', `Mensagem com ${palavras} palavra(s)`)
  }

  // Sinal 3/4 — escalada de tom. Agressivo tem peso maior que frustrado e,
  // quando presente, substitui o sinal mais leve para não contar duas vezes.
  const agressivo = AGRESSIVO_REGEX.test(textoCliente) || temCaixaAlta(textoCliente)
  if (agressivo) {
    const motivo = temCaixaAlta(textoCliente) && !AGRESSIVO_REGEX.test(textoCliente)
      ? 'Mensagem inteira em caixa alta'
      : 'Vocabulário agressivo ou ameaça de acionamento externo (Procon/Anatel)'
    somar('tom_agressivo', motivo)
  } else if (NEGATIVO_REGEX.test(textoCliente)) {
    somar('sentimento_negativo', 'Vocabulário de insatisfação detectado')
  }

  // Sinal 5 — pedido explícito de humano
  if (HUMANO_REGEX.test(textoCliente)) {
    somar('solicita_humano', 'Cliente pediu atendimento humano explicitamente')
  }

  // Sinal 6 — menção a cancelamento ou concorrência
  if (intencaoAtual === 'cancelamento' || CANCELAMENTO_REGEX.test(textoCliente)) {
    somar('intencao_cancelamento', 'Cliente mencionou cancelar ou migrar para a concorrência')
  }

  // Sinal 7 — já tinha procurado a Claro por outro canal
  if (contextoMemoria?.multicanal && historico.length <= 2) {
    somar('recontato_multicanal', `Contato anterior pelo canal ${contextoMemoria.canalAnterior || 'outro'} sem resolução`)
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let nivel = 'normal'
  if (score >= LIMIARES.transbordo) nivel = 'transbordo'
  else if (score >= LIMIARES.risco) nivel = 'risco'
  else if (score >= LIMIARES.alerta) nivel = 'alerta'

  const churn = calcularRiscoChurn({ score, sinais, intencaoAtual, historico })

  let intervencao = null
  if (nivel === 'transbordo' && sessao.status !== 'transferida') {
    intervencao = {
      tipo: 'transferencia_humano',
      gatilho: `score_atrito=${score} >= ${LIMIARES.transbordo}`,
      acao: 'Transferência automática para fila prioritária com contexto completo',
      justificativa: 'Continuar no autoatendimento a partir daqui aumenta a chance de cancelamento.',
    }
  } else if (nivel === 'risco') {
    intervencao = {
      tipo: 'simplificacao',
      gatilho: `score_atrito=${score} >= ${LIMIARES.risco}`,
      acao: 'Linguagem simplificada e oferta de suporte humano',
      justificativa: 'O cliente está perdendo a paciência; reduzir fricção agora evita a escalada.',
    }
  } else if (nivel === 'alerta') {
    intervencao = {
      tipo: 'antecipacao',
      gatilho: `score_atrito=${score} >= ${LIMIARES.alerta}`,
      acao: 'Antecipar próximos passos para reduzir fricção',
      justificativa: 'Primeiros sinais de atrito — antecipar a próxima dúvida costuma encerrar o assunto.',
    }
  }

  if (sinais.length > 0) {
    try {
      const db = getDb()
      const insertSinal = db.prepare(`INSERT INTO sinais_atrito (id, sessao_id, tipo, valor, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      for (const s of sinais) insertSinal.run(uuidv4(), sessao.id, s.tipo, s.valor)
    } catch (err) {
      console.error('[claroSense] falha ao persistir sinais:', err.message)
    }
  }

  return { score, nivel, sinais, intervencao, churn }
}

/**
 * Risco de churn: traduz o atrito acumulado em probabilidade de cancelamento.
 * O score de atrito é a base; menção explícita a cancelamento e agressividade
 * pesam mais porque, na prática, antecedem o pedido de rescisão.
 */
function calcularRiscoChurn({ score, sinais, intencaoAtual, historico }) {
  let risco = score * 0.7

  const tipos = sinais.map(s => s.tipo)
  if (tipos.includes('intencao_cancelamento') || intencaoAtual === 'cancelamento') risco += 25
  if (tipos.includes('tom_agressivo')) risco += 15
  if (tipos.includes('recontato_multicanal')) risco += 10
  if (tipos.includes('repeticao_intencao')) risco += 8

  // Conversa longa sem resolução é, por si só, fator de risco
  const turnosCliente = historico.filter(m => m.papel === 'cliente').length
  if (turnosCliente >= 6) risco += 8

  risco = Math.max(0, Math.min(100, Math.round(risco)))

  let nivel = 'baixo'
  let acaoRecomendada = 'Seguir no autoatendimento — cliente sem sinais de risco.'
  if (risco >= 80) {
    nivel = 'critico'
    acaoRecomendada = 'Acionar retenção imediatamente com oferta personalizada e atendente humano.'
  } else if (risco >= 60) {
    nivel = 'alto'
    acaoRecomendada = 'Encaminhar para especialista de retenção antes que o cliente peça o cancelamento.'
  } else if (risco >= 30) {
    nivel = 'moderado'
    acaoRecomendada = 'Resolver na primeira tentativa e confirmar entendimento — evitar novo contato.'
  }

  return {
    percentual: risco,
    nivel,
    acao_recomendada: acaoRecomendada,
    fatores: sinais.map(s => ({ tipo: s.tipo, rotulo: s.rotulo, peso: s.valor })),
  }
}

/** Metadados dos sinais — alimenta a documentação viva do painel. */
function catalogoSinais() {
  return Object.entries(SINAIS).map(([tipo, def]) => ({ tipo, ...def }))
}

module.exports = { calcular, calcularRiscoChurn, catalogoSinais, LIMIARES, SINAIS }
