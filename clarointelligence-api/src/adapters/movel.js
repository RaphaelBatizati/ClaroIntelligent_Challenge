const { getDb } = require('../database')

function obterDados(clienteId, intencao, produtoCodigo) {
  try {
    const db = getDb()
    let query = `
      SELECT c.*, p.nome as produto_nome FROM contratos c
      JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.linha = 'movel' AND c.status = 'ativo'
    `
    const params = [clienteId]
    if (produtoCodigo) { query += ' AND c.produto_codigo = ?'; params.push(produtoCodigo) }
    query += ' ORDER BY c.valor_mensal DESC LIMIT 1'

    const contrato = db.prepare(query).get(...params)
    if (!contrato) return null

    const extra = contrato.dados_extra ? JSON.parse(contrato.dados_extra) : {}
    const vencimento = new Date()
    vencimento.setDate(10)
    if (vencimento < new Date()) vencimento.setMonth(vencimento.getMonth() + 1)
    const vencStr = vencimento.toLocaleDateString('pt-BR')

    const gbTotal = parseInt((contrato.plano_nome || '').match(/(\d+)\s*GB/i)?.[1] || '50')
    const gbUsado = Math.floor(gbTotal * (0.3 + Math.random() * 0.5))
    const saldo = (5 + Math.random() * 20).toFixed(2)

    return {
      produto_nome: contrato.produto_nome,
      plano_nome: contrato.plano_nome,
      msisdn: extra.msisdn || '00900000000',
      msisdn_fmt: extra.msisdn ? extra.msisdn.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4') : '(00) 9 0000-0000',
      eSIM: extra.eSIM || false,
      gb_total: gbTotal,
      gb_usado: gbUsado,
      gb_restante: gbTotal - gbUsado,
      saldo_credito: saldo,
      valor_mensal: contrato.valor_mensal,
      vencimento: vencStr,
      codigo_barras: `034${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')} 5${Math.floor(Math.random() * 1e10).toString().padStart(10, '0')} 6${Math.floor(Math.random() * 1e10).toString().padStart(10, '0')} 7 ${Date.now().toString().slice(-14)}`,
      nome_dependente: extra.nome_dependente || null,
      titular: extra.titular !== false,
    }
  } catch (_) {
    return null
  }
}

module.exports = { obterDados }
