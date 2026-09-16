// Protocolo de atendimento — todo contato gera protocolo rastreável.
// Base regulatória: Anatel, Regulamento Geral de Direitos do Consumidor
// (Res. 765/2023, que revogou a Res. 632/2014): a prestadora deve protocolar
// e permitir a recuperação do histórico de demandas do consumidor.
//
// É o protocolo que costura a jornada entre canais: o cliente que abriu um
// chamado no call center e voltou pelo chat é reconhecido pelo mesmo número.

const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')

// Assunto legível por intenção — é o que aparece na busca do painel
const ASSUNTO_POR_INTENCAO = {
  segunda_via: 'Segunda via de fatura',
  pagamento: 'Pagamento de fatura',
  suporte_tecnico: 'Suporte técnico',
  diagnostico: 'Diagnóstico de equipamento',
  cancelamento: 'Solicitação de cancelamento',
  upgrade_plano: 'Upgrade de plano',
  recarga: 'Recarga e saldo',
  visita_tecnica: 'Agendamento de visita técnica',
  troca_titularidade: 'Troca de titularidade',
  portabilidade: 'Portabilidade numérica',
  roaming: 'Roaming internacional',
  streaming: 'Claro tv+ / streaming',
  atendente_humano: 'Solicitação de atendimento humano',
  franquia: 'Consulta de franquia de dados',
  geral: 'Atendimento geral',
}

// Tipo regulatório da demanda — reclamação tem tratamento distinto de solicitação
const TIPO_POR_INTENCAO = {
  cancelamento: 'cancelamento',
  suporte_tecnico: 'reclamacao',
  segunda_via: 'solicitacao',
  pagamento: 'solicitacao',
  upgrade_plano: 'solicitacao',
  visita_tecnica: 'solicitacao',
  portabilidade: 'solicitacao',
  troca_titularidade: 'solicitacao',
}

/**
 * Gera número de protocolo no formato AAAAMMDD + sequencial de 6 dígitos.
 * Ex.: 20260915000042 — data legível a olho nu + sequência do dia.
 */
function gerarNumero(db) {
  const hoje = new Date()
  const prefixo = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`

  const row = db.prepare(
    `SELECT COUNT(*) as n FROM protocolos WHERE numero LIKE ?`
  ).get(`${prefixo}%`)

  const sequencial = String((row?.n || 0) + 1).padStart(6, '0')
  return `${prefixo}${sequencial}`
}

/** Formata para exibição: 20260915000042 → 2026.0915.000042 */
function formatar(numero) {
  if (!numero || numero.length !== 14) return numero
  return `${numero.slice(0, 4)}.${numero.slice(4, 8)}.${numero.slice(8)}`
}

/**
 * Abre um protocolo para a sessão. Idempotente: se a sessão já tem protocolo,
 * devolve o existente em vez de criar outro (um atendimento, um número).
 */
function abrir({ clienteId, sessaoId, canal, intencao, produtoCodigo }) {
  try {
    const db = getDb()

    const existente = db.prepare('SELECT * FROM protocolos WHERE sessao_id = ?').get(sessaoId)
    if (existente) return existente

    const numero = gerarNumero(db)
    const assunto = ASSUNTO_POR_INTENCAO[intencao] || ASSUNTO_POR_INTENCAO.geral
    const tipo = TIPO_POR_INTENCAO[intencao] || 'atendimento'

    db.prepare(`
      INSERT INTO protocolos (numero, cliente_id, sessao_id, canal_origem, canal_atual, tipo, assunto, produto_codigo, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', datetime('now'), datetime('now'))
    `).run(numero, clienteId, sessaoId, canal, canal, tipo, assunto, produtoCodigo || null)

    db.prepare('UPDATE sessoes SET protocolo_numero = ? WHERE id = ?').run(numero, sessaoId)

    registrarEvento(numero, canal, 'abertura', `Protocolo aberto no canal ${canal}: ${assunto}`)

    return db.prepare('SELECT * FROM protocolos WHERE numero = ?').get(numero)
  } catch (err) {
    console.error('[protocolo.abrir]', err.message)
    return null
  }
}

/** Registra um evento na linha do tempo do protocolo (auditoria da jornada). */
function registrarEvento(numero, canal, tipo, descricao) {
  if (!numero) return
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO protocolo_eventos (id, protocolo_numero, canal, tipo, descricao, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), numero, canal, tipo, descricao)

    db.prepare(`UPDATE protocolos SET updated_at = datetime('now'), canal_atual = ? WHERE numero = ?`).run(canal, numero)
  } catch (err) {
    console.error('[protocolo.registrarEvento]', err.message)
  }
}

/** Atualiza assunto/produto quando a intenção fica clara só depois do 1º turno. */
function atualizarContexto(numero, { assunto, produtoCodigo, intencao }) {
  if (!numero) return
  try {
    const db = getDb()
    const novoAssunto = assunto || (intencao ? ASSUNTO_POR_INTENCAO[intencao] : null)
    if (novoAssunto) {
      db.prepare(`UPDATE protocolos SET assunto = ?, updated_at = datetime('now') WHERE numero = ? AND assunto = 'Atendimento geral'`)
        .run(novoAssunto, numero)
    }
    if (produtoCodigo) {
      db.prepare(`UPDATE protocolos SET produto_codigo = ?, updated_at = datetime('now') WHERE numero = ? AND produto_codigo IS NULL`)
        .run(produtoCodigo, numero)
    }
  } catch (err) {
    console.error('[protocolo.atualizarContexto]', err.message)
  }
}

/** Encerra o protocolo dizendo QUEM resolveu — autoatendimento ou humano. */
function encerrar(numero, { resolvidoPor = 'autoatendimento', scoreAtrito = 0, descricao } = {}) {
  if (!numero) return null
  try {
    const db = getDb()
    db.prepare(`
      UPDATE protocolos
      SET status = 'resolvido', resolvido_por = ?, score_atrito_final = ?,
          encerrado_at = datetime('now'), updated_at = datetime('now')
      WHERE numero = ?
    `).run(resolvidoPor, scoreAtrito, numero)

    const proto = db.prepare('SELECT * FROM protocolos WHERE numero = ?').get(numero)
    registrarEvento(numero, proto?.canal_atual, 'encerramento', descricao || `Demanda resolvida via ${resolvidoPor}`)
    return proto
  } catch (err) {
    console.error('[protocolo.encerrar]', err.message)
    return null
  }
}

/** Marca o protocolo como transferido para atendimento humano. */
function transferir(numero, motivo) {
  if (!numero) return
  try {
    const db = getDb()
    db.prepare(`UPDATE protocolos SET status = 'transferido', updated_at = datetime('now') WHERE numero = ?`).run(numero)
    const proto = db.prepare('SELECT * FROM protocolos WHERE numero = ?').get(numero)
    registrarEvento(numero, proto?.canal_atual, 'transferencia', motivo || 'Encaminhado para atendimento humano')
  } catch (err) {
    console.error('[protocolo.transferir]', err.message)
  }
}

/**
 * Protocolos em aberto do cliente nas últimas 72h, em OUTRO canal.
 * É a base da continuidade: quem abriu chamado no call center e voltou pelo
 * chat não recomeça do zero — o protocolo anterior é retomado.
 */
function protocolosAbertos(clienteId, canalAtual) {
  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT * FROM protocolos
      WHERE cliente_id = ?
        AND status IN ('aberto', 'em_andamento', 'transferido', 'aguardando_cliente')
        AND created_at > datetime('now', '-72 hours')
      ORDER BY created_at DESC
      LIMIT 5
    `).all(clienteId)

    return rows.map(p => ({
      ...p,
      numero_formatado: formatar(p.numero),
      outro_canal: canalAtual ? p.canal_origem !== canalAtual : false,
      horasAtras: Math.round((Date.now() - new Date(p.created_at + ' UTC').getTime()) / 3600000),
      eventos: db.prepare('SELECT * FROM protocolo_eventos WHERE protocolo_numero = ? ORDER BY created_at').all(p.numero),
    }))
  } catch (_) {
    return []
  }
}

/** Busca um protocolo pelo número — aceita com ou sem pontuação. */
function buscar(numero) {
  try {
    const db = getDb()
    const limpo = String(numero).replace(/\D/g, '')
    const proto = db.prepare('SELECT * FROM protocolos WHERE numero = ?').get(limpo)
    if (!proto) return null
    return {
      ...proto,
      numero_formatado: formatar(proto.numero),
      eventos: db.prepare('SELECT * FROM protocolo_eventos WHERE protocolo_numero = ? ORDER BY created_at').all(proto.numero),
    }
  } catch (_) {
    return null
  }
}

/** Extrai um número de protocolo citado pelo cliente no texto livre. */
function extrairDoTexto(texto) {
  if (!texto) return null
  // Aceita 20260915000042, 2026.0915.000042, 2026 0915 000042
  const match = texto.match(/\b(\d{4})[.\s-]?(\d{4})[.\s-]?(\d{6})\b/)
  return match ? `${match[1]}${match[2]}${match[3]}` : null
}

module.exports = {
  abrir,
  encerrar,
  transferir,
  registrarEvento,
  atualizarContexto,
  protocolosAbertos,
  buscar,
  extrairDoTexto,
  formatar,
  ASSUNTO_POR_INTENCAO,
}
