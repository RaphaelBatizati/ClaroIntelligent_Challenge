// Adaptador da linha corporativa (Claro Empresas).
//
// Chave de identificação: CNPJ, com múltiplos contratos por site e centro de
// custo — diferente do varejo, onde a chave é CPF/MSISDN/ponto de instalação.
// Uma empresa tem N chips sob uma franquia compartilhada e, muitas vezes, um
// link dedicado com SLA contratual. Errar o contrato aqui é pior ainda que no
// varejo: mexe na operação de um cliente corporativo inteiro.

const { getDb } = require('../database')
const { proximoVencimento, gerarLinhaDigitavel, formatarMsisdn } = require('./_comum')

function obterDados(clienteId, intencao, produtoCodigo) {
  try {
    const db = getDb()

    let query = `
      SELECT c.*, p.nome as produto_nome, p.familia, p.tipo_chip, p.velocidade_mbps, p.franquia_gb
      FROM contratos c
      JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.linha = 'empresas' AND c.status = 'ativo'
    `
    const params = [clienteId]
    if (produtoCodigo) { query += ' AND c.produto_codigo = ?'; params.push(produtoCodigo) }
    query += ' ORDER BY c.valor_mensal DESC LIMIT 1'

    const contrato = db.prepare(query).get(...params)
    if (!contrato) return null

    const extra = contrato.dados_extra ? JSON.parse(contrato.dados_extra) : {}
    const venc = proximoVencimento(5) // corporativo vence dia 5

    // Franquia compartilhada entre as linhas da conta — característica do
    // plano empresarial: não existe "franquia do meu chip", existe a do pool.
    const linhas = extra.linhas_ativas || 1
    const franquiaTotal = extra.franquia_compartilhada_gb || contrato.franquia_gb || 0
    const consumido = extra.consumo_gb ?? Math.round(franquiaTotal * 0.62)

    return {
      produto_nome: contrato.produto_nome,
      plano_nome: contrato.plano_nome,
      familia: contrato.familia,
      razao_social: extra.razao_social || 'Empresa cadastrada',
      cnpj_mascara: extra.cnpj_mascara || '**.***.***/0001-**',
      centro_custo: extra.centro_custo || null,
      site_instalacao: extra.site || extra.endereco || 'endereço do contrato',

      // Móvel corporativo
      tipo_chip: contrato.tipo_chip || extra.tipo_chip || 'empresarial',
      linhas_ativas: linhas,
      msisdn_principal: formatarMsisdn(extra.msisdn),
      franquia_compartilhada_gb: franquiaTotal,
      consumo_gb: consumido,
      franquia_restante_gb: Math.max(franquiaTotal - consumido, 0),
      gestor_online: extra.gestor_online !== false,

      // Link dedicado / internet empresarial
      velocidade_mbps: contrato.velocidade_mbps || extra.velocidade_mbps || null,
      link_dedicado: contrato.familia === 'link-dedicado',
      sla_disponibilidade: extra.sla || (contrato.familia === 'link-dedicado' ? '99,8% com SLA contratual' : null),
      ip_fixo: extra.ip_fixo || null,
      suporte: 'Consultor dedicado · atendimento 24x7',

      valor_mensal: contrato.valor_mensal,
      vencimento: venc,
      codigo_barras: gerarLinhaDigitavel(contrato.valor_mensal),
    }
  } catch (err) {
    console.error('[adapter.empresas]', err.message)
    return null
  }
}

module.exports = { obterDados }
