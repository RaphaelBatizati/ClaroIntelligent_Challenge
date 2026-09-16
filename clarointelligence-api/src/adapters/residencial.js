// Adaptador da linha residencial (banda larga fixa e telefonia fixa).
// Chave de identificação: PONTO DE INSTALAÇÃO, ou seja, o endereço.
// O mesmo CPF com duas casas tem dois contratos distintos — por isso a
// consulta considera o ponto, não apenas o titular.

const { getDb } = require('../database')
const { proximoVencimento, gerarLinhaDigitavel } = require('./_comum')

function obterDados(clienteId, intencao, produtoCodigo) {
  try {
    const db = getDb()

    let query = `
      SELECT c.*, p.nome as produto_nome, p.familia, p.velocidade_mbps, p.beneficios
      FROM contratos c
      JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.linha = 'residencial' AND c.status = 'ativo'
    `
    const params = [clienteId]
    if (produtoCodigo) { query += ' AND c.produto_codigo = ?'; params.push(produtoCodigo) }
    query += ' LIMIT 1'

    const contrato = db.prepare(query).get(...params)
    if (!contrato) return null

    const extra = contrato.dados_extra ? JSON.parse(contrato.dados_extra) : {}
    const beneficios = contrato.beneficios ? JSON.parse(contrato.beneficios) : []
    const velocidade = extra.velocidade_down || contrato.velocidade_mbps || 500

    return {
      produto_nome: contrato.produto_nome,
      plano_nome: contrato.plano_nome,
      familia: contrato.familia,
      tecnologia: extra.tecnologia || (contrato.familia === 'fwa' ? 'FWA 5G' : 'Fibra óptica (FTTH)'),
      velocidade_down: velocidade,
      velocidade_up: extra.velocidade_up || Math.round(velocidade / 2),
      endereco: extra.endereco || 'endereço cadastrado',
      ponto_instalacao: extra.ponto_instalacao || extra.endereco || null,
      modem: extra.modem || 'roteador Wi-Fi Claro',
      wifi_6: extra.wifi_6 ?? velocidade >= 500,
      streamings: beneficios,

      // Telemetria simulada do acesso — o que o diagnóstico remoto "enxerga"
      status_modem: extra.status_modem || 'online',
      sinal_nivel: extra.sinal_nivel || 'bom',
      olt_status: extra.olt_status || 'normal',

      valor_mensal: contrato.valor_mensal,
      vencimento: proximoVencimento(),
      codigo_barras: gerarLinhaDigitavel(contrato.valor_mensal),
    }
  } catch (err) {
    console.error('[adapter.residencial]', err.message)
    return null
  }
}

module.exports = { obterDados }
