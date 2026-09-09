const { getDb } = require('../database')

function obterDados(clienteId, intencao) {
  try {
    const db = getDb()
    const contrato = db.prepare(`
      SELECT c.*, p.nome as produto_nome FROM contratos c
      JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.linha = 'residencial' AND c.status = 'ativo'
      LIMIT 1
    `).get(clienteId)

    if (!contrato) return null

    const extra = contrato.dados_extra ? JSON.parse(contrato.dados_extra) : {}
    const vencimento = new Date()
    vencimento.setDate(10)
    if (vencimento < new Date()) vencimento.setMonth(vencimento.getMonth() + 1)
    const vencStr = vencimento.toLocaleDateString('pt-BR')

    return {
      produto_nome: contrato.produto_nome,
      plano_nome: contrato.plano_nome,
      velocidade_down: extra.velocidade_down || 300,
      velocidade_up: extra.velocidade_up || 150,
      endereco: extra.endereco || 'endereço cadastrado',
      modem: extra.modem || 'modem Claro',
      valor_mensal: contrato.valor_mensal,
      vencimento: vencStr,
      codigo_barras: `034${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')} 5${Math.floor(Math.random() * 1e10).toString().padStart(10, '0')} 6${Math.floor(Math.random() * 1e10).toString().padStart(10, '0')} 7 ${Date.now().toString().slice(-14)}`,
      status_modem: 'online',
      sinal_nivel: 'bom',
      olt_status: 'normal',
    }
  } catch (_) {
    return null
  }
}

module.exports = { obterDados }
