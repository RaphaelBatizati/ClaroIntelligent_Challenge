// Adaptador da linha móvel.
// Chave de identificação: MSISDN (o número da linha), sob uma conta de
// faturamento. Um mesmo CPF pode ter várias linhas — titular e dependentes.

const { getDb } = require('../database')
const { proximoVencimento, gerarLinhaDigitavel, formatarMsisdn } = require('./_comum')

function obterDados(clienteId, intencao, produtoCodigo) {
  try {
    const db = getDb()

    let query = `
      SELECT c.*, p.nome as produto_nome, p.familia, p.tipo_chip, p.franquia_gb, p.beneficios
      FROM contratos c
      JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.linha = 'movel' AND c.status = 'ativo'
    `
    const params = [clienteId]
    if (produtoCodigo) { query += ' AND c.produto_codigo = ?'; params.push(produtoCodigo) }
    query += ' ORDER BY c.valor_mensal DESC LIMIT 1'

    const contrato = db.prepare(query).get(...params)
    if (!contrato) return null

    const extra = contrato.dados_extra ? JSON.parse(contrato.dados_extra) : {}
    const beneficios = contrato.beneficios ? JSON.parse(contrato.beneficios) : []

    // Franquia vem do catálogo; o consumo é derivado do id do contrato para
    // ser estável entre chamadas (demo determinística, sem número dançando).
    const gbTotal = contrato.franquia_gb
      || parseInt((contrato.plano_nome || '').match(/(\d+)\s*GB/i)?.[1] || '25', 10)
    const semente = String(contrato.id).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)
    const gbUsado = Math.min(Math.round(gbTotal * (0.35 + (semente % 40) / 100)), gbTotal)

    return {
      produto_nome: contrato.produto_nome,
      plano_nome: contrato.plano_nome,
      familia: contrato.familia,
      modalidade: contrato.familia === 'pre-pago' ? 'pré-pago' : contrato.familia === 'controle' ? 'controle' : 'pós-pago',
      tipo_chip: contrato.tipo_chip || (extra.eSIM ? 'eSIM' : 'chip físico'),
      chip_segmento: extra.chip_segmento || 'pessoal',
      msisdn: extra.msisdn || null,
      msisdn_fmt: formatarMsisdn(extra.msisdn) || '(00) 9 0000-0000',
      eSIM: extra.eSIM || false,
      iccid: extra.iccid || null,

      gb_total: gbTotal,
      gb_usado: gbUsado,
      gb_restante: Math.max(gbTotal - gbUsado, 0),
      apps_ilimitados: beneficios,
      saldo_credito: (extra.saldo ?? (5 + (semente % 20))).toFixed(2),

      titular: extra.titular !== false,
      nome_dependente: extra.nome_dependente || null,

      valor_mensal: contrato.valor_mensal,
      vencimento: proximoVencimento(),
      codigo_barras: gerarLinhaDigitavel(contrato.valor_mensal),
    }
  } catch (err) {
    console.error('[adapter.movel]', err.message)
    return null
  }
}

module.exports = { obterDados }
