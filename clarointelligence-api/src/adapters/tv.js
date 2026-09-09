const { getDb } = require('../database')

function obterDados(clienteId, intencao) {
  try {
    const db = getDb()
    const contrato = db.prepare(`
      SELECT c.*, p.nome as produto_nome FROM contratos c
      JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.linha = 'tv' AND c.status = 'ativo'
      LIMIT 1
    `).get(clienteId)
    if (!contrato) return null
    const extra = contrato.dados_extra ? JSON.parse(contrato.dados_extra) : {}
    return {
      produto_nome: contrato.produto_nome,
      plano_nome: contrato.plano_nome,
      login: extra.login || 'cliente@clarotv.com',
      dispositivos: extra.dispositivos || 2,
      valor_mensal: contrato.valor_mensal,
    }
  } catch (_) { return null }
}

module.exports = { obterDados }
