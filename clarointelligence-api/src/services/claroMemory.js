const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')

function recuperar(clienteId, produtoCodigo, intencao) {
  try {
    const db = getDb()

    // Busca memórias recentes do cliente (últimas 24h)
    let query = `
      SELECT * FROM memoria_conversacional
      WHERE cliente_id = ?
      AND created_at > datetime('now', '-24 hours')
      ORDER BY created_at DESC
      LIMIT 5
    `
    let rows = db.prepare(query).all(clienteId)

    // Se tem produto específico, prioriza memórias desse produto
    if (produtoCodigo) {
      const produtoRows = rows.filter(r => r.produto_codigo === produtoCodigo)
      if (produtoRows.length > 0) rows = produtoRows
    }

    const trechos = rows.map(r => ({
      id: r.id,
      canal: r.canal,
      intencao: r.intencao,
      resumo: r.resumo,
      resolvido: r.resolvido === 1,
      pendencias: r.pendencias ? JSON.parse(r.pendencias) : [],
      minutosAtras: Math.round((Date.now() - new Date(r.created_at + ' UTC').getTime()) / 60000),
    }))

    // Verifica se há canal anterior diferente (indicador de jornada multicanal)
    const ultimaSessao = db.prepare(`
      SELECT s.canal, s.created_at FROM sessoes s
      WHERE s.cliente_id = ? AND s.status = 'encerrada'
      ORDER BY s.updated_at DESC LIMIT 1
    `).get(clienteId)

    const contexto = {
      temHistorico: trechos.length > 0,
      multicanal: ultimaSessao !== undefined,
      canalAnterior: ultimaSessao?.canal || null,
    }

    return { trechos, contexto }
  } catch (_) {
    return { trechos: [], contexto: { temHistorico: false, multicanal: false, canalAnterior: null } }
  }
}

function salvar(clienteId, sessaoId, canal, produtoCodigo, intencao, textoCliente, respostaBot) {
  try {
    const db = getDb()

    const resumo = gerarResumo(intencao, produtoCodigo, textoCliente, respostaBot)

    db.prepare(`
      INSERT INTO memoria_conversacional (id, cliente_id, sessao_id, canal, produto_codigo, intencao, resumo, resolvido, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(uuidv4(), clienteId, sessaoId, canal, produtoCodigo, intencao, resumo)
  } catch (_) {}
}

function gerarResumo(intencao, produtoCodigo, texto, resposta) {
  const mapaIntencao = {
    segunda_via: 'Solicitou segunda via de fatura',
    suporte_tecnico: 'Relatou problema técnico',
    cancelamento: 'Solicitou cancelamento do serviço',
    upgrade_plano: 'Consultou upgrade de plano',
    visita_tecnica: 'Agendamento de visita técnica discutido',
    diagnostico: 'Realizou diagnóstico de equipamento',
    recarga: 'Realizou recarga ou consultou saldo',
    troca_titularidade: 'Solicitou troca de titularidade',
    portabilidade: 'Consultou portabilidade',
    geral: 'Interação geral com o suporte',
  }
  const descIntencao = mapaIntencao[intencao] || 'Contato com suporte'
  const produto = produtoCodigo ? ` (${produtoCodigo})` : ''
  const primeiras60 = texto.slice(0, 80).replace(/\n/g, ' ')
  return `${descIntencao}${produto}. Mensagem: "${primeiras60}". Atendido via IA.`
}

module.exports = { recuperar, salvar }
