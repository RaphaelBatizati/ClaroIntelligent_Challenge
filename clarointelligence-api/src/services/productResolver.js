// Product Context Resolver — decide a QUAL contrato a conversa se refere.
//
// "Minha internet caiu" pode ser a fibra da casa, o FWA 5G, a franquia do
// celular ou o link dedicado da empresa. Errar o produto é pior que não
// responder, porque executa a ação certa no contrato errado.
//
// Cascata, do sinal mais forte para o mais fraco:
//   1. produto já confirmado na sessão
//   2. portfólio com um único produto
//   3. afinidade intenção → linha  (recarga só existe em móvel)
//   4. menção explícita no texto   ("fibra", "celular", "tv", "empresa")
//   5. afinidade canal → linha     (desempate)
//   6. pergunta ao cliente, em uma frase só

const { getDb } = require('../database')

// Ordem de probabilidade por canal de entrada — usado só como desempate.
const CANAL_LINHA_AFINIDADE = {
  whatsapp: ['movel', 'residencial', 'tv', 'empresas'],
  app: ['movel', 'residencial', 'tv', 'empresas'],
  site: ['residencial', 'movel', 'tv', 'empresas'],
  callcenter: ['residencial', 'movel', 'tv', 'empresas'],
}

// Intenções que só fazem sentido em uma linha de produto.
const INTENT_LINHA_AFINIDADE = {
  recarga: ['movel'],
  portabilidade: ['movel'],
  roaming: ['movel'],
  franquia: ['movel', 'empresas'],
  streaming: ['tv'],
  visita_tecnica: ['residencial', 'empresas'],
  diagnostico: ['residencial', 'tv'],
}

// Termos que o cliente usa para se referir a cada linha.
const TERMOS_LINHA = {
  movel: ['celular', 'telefone', 'linha', 'chip', 'móvel', 'movel', 'mobile', 'whatsapp do celular', 'pré-pago', 'pre pago', 'controle', 'pós', 'pos pago'],
  residencial: ['internet', 'fibra', 'casa', 'wifi', 'wi-fi', 'banda larga', 'roteador', 'modem', 'residencial', 'fixo'],
  tv: ['tv', 'televisão', 'televisao', 'canal', 'canais', 'streaming', 'box', 'claro tv', 'netflix', 'globoplay', 'max', 'assistir'],
  empresas: ['empresa', 'empresarial', 'corporativo', 'cnpj', 'escritório', 'escritorio', 'link dedicado', 'matriz', 'filial', 'equipe', 'colaborador'],
}

const NOMES_LINHA = {
  movel: 'celular / linha móvel',
  residencial: 'internet residencial / fibra',
  tv: 'Claro tv+ / TV',
  empresas: 'plano empresarial (CNPJ)',
}

/**
 * Matriz de capacidades: nem todo produto suporta toda intenção.
 * Um link dedicado não tem franquia de dados; um plano móvel não recebe
 * visita técnica. Filtrar por capacidade evita perguntar ao cliente algo
 * que o portfólio já responde sozinho — e evita executar a ação no
 * contrato errado quando a empresa tem vários contratos na mesma linha.
 */
const CAPACIDADES = {
  recarga: (c) => ['pre-pago', 'controle'].includes(c.familia),
  franquia: (c) => Number(c.franquia_gb) > 0,
  portabilidade: (c) => c.produto_linha === 'movel' || c.familia === 'movel-corporativo',
  roaming: (c) => c.produto_linha === 'movel' || c.familia === 'movel-corporativo',
  streaming: (c) => c.produto_linha === 'tv',
  visita_tecnica: (c) => Number(c.velocidade_mbps) > 0,
  diagnostico: (c) => Number(c.velocidade_mbps) > 0 || c.produto_linha === 'tv',
  upgrade_plano: (c) => Number(c.velocidade_mbps) > 0 || Number(c.franquia_gb) > 0,
}

/** Aplica a matriz; se nenhum contrato suportar, devolve a lista original. */
function filtrarPorCapacidade(contratos, intencao) {
  const suporta = CAPACIDADES[intencao]
  if (!suporta) return contratos
  const aptos = contratos.filter(c => {
    try { return suporta(c) } catch (_) { return false }
  })
  return aptos.length > 0 ? aptos : contratos
}

function getPortfolio(clienteId) {
  const db = getDb()
  return db.prepare(`
    SELECT c.*, p.nome as produto_nome, p.linha as produto_linha, p.familia,
           p.segmento, p.velocidade_mbps, p.franquia_gb, p.tipo_chip
    FROM contratos c
    JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
    WHERE c.cliente_id = ? AND c.status = 'ativo'
    ORDER BY p.linha, c.valor_mensal DESC
  `).all(clienteId)
}

function montarResultado(contrato, portfolio, extras = {}) {
  return {
    produto_foco: contrato?.produto_codigo || null,
    linha: contrato?.produto_linha || null,
    contrato: contrato || null,
    precisou_perguntar: false,
    resposta_desambiguacao: null,
    portfolio,
    ...extras,
  }
}

function resolver(clienteId, canal, intencao, sessao, textoMensagem) {
  try {
    const portfolio = getPortfolio(clienteId)

    // 1. Produto já confirmado nesta sessão — não se pergunta duas vezes
    if (sessao?.produto_confirmado && sessao?.produto_codigo_foco) {
      const contrato = portfolio.find(c => c.produto_codigo === sessao.produto_codigo_foco)
      if (contrato) return montarResultado(contrato, portfolio, { origem: 'sessao_confirmada' })
    }

    if (portfolio.length === 0) {
      return montarResultado(null, portfolio, { origem: 'sem_portfolio' })
    }

    // 2. Portfólio com um único produto ativo
    if (portfolio.length === 1) {
      return montarResultado(portfolio[0], portfolio, { origem: 'produto_unico' })
    }

    const texto = (textoMensagem || '').toLowerCase()

    // 3. Menção explícita do cliente tem precedência sobre inferência
    for (const [linha, termos] of Object.entries(TERMOS_LINHA)) {
      if (termos.some(t => texto.includes(t))) {
        const candidatos = portfolio.filter(c => c.produto_linha === linha)
        if (candidatos.length === 1) {
          return montarResultado(candidatos[0], portfolio, { origem: 'mencao_explicita' })
        }
        // Mesma linha com vários contratos (ex.: 2 celulares): tenta o titular
        if (candidatos.length > 1) {
          const titular = candidatos.find(c => {
            try { return JSON.parse(c.dados_extra || '{}').titular !== false } catch (_) { return true }
          })
          if (titular && intencao !== 'segunda_via') {
            return montarResultado(titular, portfolio, { origem: 'mencao_explicita_titular' })
          }
          return perguntar(portfolio, candidatos, linha)
        }
      }
    }

    // 4. Afinidade intenção → linha
    const linhasAfins = INTENT_LINHA_AFINIDADE[intencao]
    let candidatos = linhasAfins
      ? portfolio.filter(c => linhasAfins.includes(c.produto_linha))
      : portfolio
    if (candidatos.length === 0) candidatos = portfolio
    if (candidatos.length === 1) {
      return montarResultado(candidatos[0], portfolio, { origem: 'afinidade_intencao' })
    }

    // 5. Matriz de capacidades: descarta contratos que não suportam a intenção
    candidatos = filtrarPorCapacidade(candidatos, intencao)
    if (candidatos.length === 1) {
      return montarResultado(candidatos[0], portfolio, { origem: 'matriz_capacidades' })
    }

    // 6. Afinidade canal → linha, como desempate final
    const ordemCanal = CANAL_LINHA_AFINIDADE[canal] || CANAL_LINHA_AFINIDADE.site
    for (const linha of ordemCanal) {
      const daLinha = candidatos.filter(c => c.produto_linha === linha)
      if (daLinha.length === 1) {
        return montarResultado(daLinha[0], portfolio, { origem: 'afinidade_canal' })
      }
      if (daLinha.length > 1) break // ambiguidade real dentro da linha preferida
    }

    // 7. Ambíguo de verdade: pergunta uma vez, em uma frase
    const linhasRestantes = [...new Set(candidatos.map(c => c.produto_linha))]
    return perguntar(portfolio, candidatos, linhasRestantes.length === 1 ? linhasRestantes[0] : null)
  } catch (err) {
    console.error('[productResolver]', err.message)
    return { produto_foco: null, linha: null, contrato: null, precisou_perguntar: false, resposta_desambiguacao: null, portfolio: [] }
  }
}

function perguntar(portfolio, candidatos, linhaFixa) {
  const lista = candidatos.length > 0 ? candidatos : portfolio

  // Quando a ambiguidade é dentro da mesma linha, mostramos o identificador
  // real de cada contrato (número da linha, endereço) — não só o nome do plano.
  if (linhaFixa) {
    const opcoes = lista.map(c => {
      let extra = {}
      try { extra = JSON.parse(c.dados_extra || '{}') } catch (_) { /* contrato sem extras */ }
      const identificador = extra.msisdn
        ? formatarNumero(extra.msisdn)
        : extra.endereco || c.plano_nome
      const dono = extra.titular === false && extra.nome_dependente ? ` — ${extra.nome_dependente}` : ''
      return `• **${c.plano_nome}** (${identificador}${dono})`
    }).join('\n')

    return {
      produto_foco: null, linha: null, contrato: null,
      precisou_perguntar: true,
      resposta_desambiguacao: `Você tem mais de um contrato de ${NOMES_LINHA[linhaFixa] || linhaFixa}. Sobre qual deles é:\n\n${opcoes}`,
      portfolio,
      origem: 'ambiguidade_intra_linha',
    }
  }

  const linhas = [...new Set(lista.map(c => c.produto_linha))]
  const opcoesTxt = linhas.map(l => `**${NOMES_LINHA[l] || l}**`).join(', ')
  const produtos = lista.map(c => c.produto_nome).join(', ')

  return {
    produto_foco: null, linha: null, contrato: null,
    precisou_perguntar: true,
    resposta_desambiguacao: `Identifiquei ${lista.length} produtos ativos no seu CPF: ${produtos}.\n\nPara não executar nada no contrato errado, me confirma: é sobre ${opcoesTxt}?`,
    portfolio,
    origem: 'ambiguidade_entre_linhas',
  }
}

function formatarNumero(msisdn) {
  const d = String(msisdn).replace(/\D/g, '')
  return d.length === 11 ? d.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4') : msisdn
}

module.exports = { resolver, getPortfolio, NOMES_LINHA, TERMOS_LINHA }
