// Adaptador da linha TV / streaming (Claro tv+).
// Chave de identificação: assinatura vinculada ao CPF ou ao ponto de instalação.
// Traduz o contrato armazenado para o contrato interno único do núcleo.

const { getDb } = require('../database')
const { proximoVencimento, gerarLinhaDigitavel } = require('./_comum')

function obterDados(clienteId, intencao, produtoCodigo) {
  try {
    const db = getDb()

    let query = `
      SELECT c.*, p.nome as produto_nome, p.beneficios, p.familia
      FROM contratos c
      JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.linha = 'tv' AND c.status = 'ativo'
    `
    const params = [clienteId]
    if (produtoCodigo) { query += ' AND c.produto_codigo = ?'; params.push(produtoCodigo) }
    query += ' LIMIT 1'

    const contrato = db.prepare(query).get(...params)
    if (!contrato) return null

    const extra = contrato.dados_extra ? JSON.parse(contrato.dados_extra) : {}
    const beneficios = contrato.beneficios ? JSON.parse(contrato.beneficios) : []
    const venc = proximoVencimento()

    return {
      produto_nome: contrato.produto_nome,
      plano_nome: contrato.plano_nome,
      familia: contrato.familia,
      login: extra.login || 'cliente@clarotvmais.com.br',
      dispositivos: extra.dispositivos || 2,
      equipamento: extra.equipamento || (contrato.familia === 'box' ? 'Claro Box tv+ 4K' : 'App Claro tv+'),
      streamings: beneficios,
      canais_ao_vivo: extra.canais || 120,
      valor_mensal: contrato.valor_mensal,
      vencimento: venc,
      codigo_barras: gerarLinhaDigitavel(contrato.valor_mensal),
    }
  } catch (err) {
    console.error('[adapter.tv]', err.message)
    return null
  }
}

module.exports = { obterDados }
