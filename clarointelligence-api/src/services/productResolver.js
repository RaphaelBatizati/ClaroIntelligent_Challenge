const { getDb } = require('../database')

const CANAL_LINHA_AFINIDADE = {
  whatsapp: ['movel', 'residencial', 'tv'],
  app: ['movel', 'residencial', 'tv'],
  site: ['residencial', 'movel', 'tv'],
  callcenter: ['residencial', 'movel', 'tv'],
}

const INTENT_LINHA_AFINIDADE = {
  recarga: ['movel'],
  portabilidade: ['movel'],
  roaming: ['movel'],
  streaming: ['tv'],
  visita_tecnica: ['residencial'],
}

function getPortfolio(clienteId) {
  const db = getDb()
  return db.prepare(`
    SELECT c.*, p.nome as produto_nome, p.linha as produto_linha, p.familia
    FROM contratos c
    JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
    WHERE c.cliente_id = ? AND c.status = 'ativo'
  `).all(clienteId)
}

function resolver(clienteId, canal, intencao, sessao, textoMensagem) {
  try {
    const db = getDb()

    // Se sessão já tem produto confirmado, usa ele
    if (sessao.produto_confirmado && sessao.produto_codigo_foco) {
      const portfolio = getPortfolio(clienteId)
      const contrato = portfolio.find(c => c.produto_codigo === sessao.produto_codigo_foco)
      return {
        produto_foco: sessao.produto_codigo_foco,
        linha: contrato?.produto_linha || null,
        contrato,
        precisou_perguntar: false,
        resposta_desambiguacao: null,
        portfolio,
      }
    }

    const portfolio = getPortfolio(clienteId)

    if (portfolio.length === 0) {
      return { produto_foco: null, linha: null, contrato: null, precisou_perguntar: false, resposta_desambiguacao: null, portfolio }
    }

    if (portfolio.length === 1) {
      return { produto_foco: portfolio[0].produto_codigo, linha: portfolio[0].produto_linha, contrato: portfolio[0], precisou_perguntar: false, resposta_desambiguacao: null, portfolio }
    }

    // Múltiplos produtos: tentar inferir
    // 1. Por afinidade de intenção
    if (INTENT_LINHA_AFINIDADE[intencao]) {
      const linhasAfins = INTENT_LINHA_AFINIDADE[intencao]
      const candidatos = portfolio.filter(c => linhasAfins.includes(c.produto_linha))
      if (candidatos.length === 1) {
        return { produto_foco: candidatos[0].produto_codigo, linha: candidatos[0].produto_linha, contrato: candidatos[0], precisou_perguntar: false, resposta_desambiguacao: null, portfolio }
      }
    }

    // 2. Por menção explícita no texto
    const textoLower = textoMensagem.toLowerCase()
    for (const c of portfolio) {
      const nomeLower = c.produto_nome.toLowerCase()
      const linha = c.produto_linha
      if (
        (linha === 'movel' && (textoLower.includes('celular') || textoLower.includes('mobile') || textoLower.includes('linha') || textoLower.includes('chip') || textoLower.includes('telefone'))) ||
        (linha === 'residencial' && (textoLower.includes('internet') || textoLower.includes('fibra') || textoLower.includes('casa') || textoLower.includes('wifi'))) ||
        (linha === 'tv' && (textoLower.includes('tv') || textoLower.includes('televisão') || textoLower.includes('canal') || textoLower.includes('streaming')))
      ) {
        return { produto_foco: c.produto_codigo, linha: c.produto_linha, contrato: c, precisou_perguntar: false, resposta_desambiguacao: null, portfolio }
      }
    }

    // 3. Perguntar ao cliente
    const nomesLinhas = { movel: 'celular/linha móvel', residencial: 'internet residencial/fibra', tv: 'Claro tv+/TV' }
    const linhasDistintas = [...new Set(portfolio.map(c => c.produto_linha))]
    const opcoesTxt = linhasDistintas.map(l => `*${nomesLinhas[l] || l}*`).join(', ')

    const resposta_desambiguacao = `Identifiquei que você tem ${portfolio.length} produtos ativos conosco: ${portfolio.map(c => c.produto_nome).join(', ')}.\n\nPode me dizer a qual você se refere: ${opcoesTxt}?`

    return { produto_foco: null, linha: null, contrato: null, precisou_perguntar: true, resposta_desambiguacao, portfolio }
  } catch (err) {
    return { produto_foco: null, linha: null, contrato: null, precisou_perguntar: false, resposta_desambiguacao: null, portfolio: [] }
  }
}

module.exports = { resolver, getPortfolio }
