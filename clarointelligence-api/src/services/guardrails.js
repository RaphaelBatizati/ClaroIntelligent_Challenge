// Guardrails da IA — contenção de prompt injection e de tentativas de
// extração de dados. Princípio: a IA é um atendente com escopo fechado,
// não um assistente de propósito geral com acesso ao banco.
//
// Três camadas, nesta ordem:
//   1. ENTRADA  — classifica a mensagem do cliente antes de qualquer
//                 processamento. Se for ataque, a requisição morre aqui:
//                 não chega no resolver de produto, nem nos adaptadores,
//                 nem no provedor de LLM.
//   2. ESCOPO   — só as intenções do catálogo são atendidas. O que está
//                 fora do escopo é redirecionado, não improvisado.
//   3. SAÍDA    — redação de dados sensíveis que porventura apareçam na
//                 resposta (defesa em profundidade).

const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')

// ─── Camada 1: padrões de ataque ────────────────────────────────────────────

const PADROES = [
  // Manipulação de instruções do sistema
  {
    tipo: 'prompt_injection',
    severidade: 'alta',
    nome: 'sobrescrita_de_instrucoes',
    regex: /\b(ignor[ae]|esque[cç]a|desconsidere|apague)\s+(todas?\s+)?(as\s+)?(suas?\s+)?(instru[cç][oõ]es|regras|orienta[cç][oõ]es|diretrizes|prompt)/i,
  },
  {
    tipo: 'prompt_injection',
    severidade: 'alta',
    nome: 'troca_de_papel',
    regex: /\b(voc[eê]\s+(agora\s+)?[eé]|aja\s+como|finja\s+(que\s+)?(ser|voc[eê])|assuma\s+o\s+papel|comporte-se\s+como|a\s+partir\s+de\s+agora\s+voc[eê])\b/i,
  },
  {
    tipo: 'prompt_injection',
    severidade: 'alta',
    nome: 'modo_irrestrito',
    regex: /\b(modo\s+(desenvolvedor|debug|admin|deus|livre|irrestrito)|developer\s+mode|jailbreak|sem\s+(filtros?|restri[cç][oõ]es|censura)|DAN\b)/i,
  },
  {
    tipo: 'prompt_injection',
    severidade: 'media',
    nome: 'revelacao_de_prompt',
    regex: /\b(mostre|revele|imprima|repita|qual\s+[eé])\s+(o\s+)?(seu\s+)?(system\s*prompt|prompt\s+do\s+sistema|instru[cç][oõ]es\s+iniciais|configura[cç][aã]o\s+interna)/i,
  },

  // Extração de dados / acesso indevido
  {
    tipo: 'extracao_dados',
    severidade: 'alta',
    nome: 'sql_injection',
    regex: /(\bSELECT\b[\s\S]{0,40}\bFROM\b|\bDROP\s+TABLE\b|\bUNION\s+SELECT\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bUPDATE\b[\s\S]{0,20}\bSET\b|--\s*$|\bOR\s+1\s*=\s*1\b)/i,
  },
  {
    tipo: 'extracao_dados',
    severidade: 'alta',
    nome: 'acesso_a_banco',
    regex: /\b(banco\s+de\s+dados|base\s+de\s+dados|database|tabela\s+de\s+(clientes|usu[aá]rios)|schema|dump\s+d[eo])\b/i,
  },
  {
    tipo: 'extracao_dados',
    severidade: 'alta',
    nome: 'dados_de_terceiros',
    regex: /\b(dados|informa[cç][oõ]es|fatura|cpf|endere[cç]o|telefone|conta)\s+(d[eo]\s+)?(outro|outra|todos?\s+os?|demais|qualquer)\s+(cliente|usu[aá]rio|pessoa|assinante)/i,
  },
  {
    tipo: 'extracao_dados',
    severidade: 'alta',
    nome: 'listagem_massiva',
    regex: /\b(lista?r?|liste|me\s+d[eê]|mostre)\s+(todos?|todas?)\s+(os\s+|as\s+)?(clientes|usu[aá]rios|assinantes|cpfs?|contratos|faturas|telefones)/i,
  },
  {
    tipo: 'extracao_dados',
    severidade: 'alta',
    nome: 'credenciais',
    regex: /\b(api[\s_-]?key|token\s+de\s+acesso|senha\s+d[oe]\s+(sistema|admin|banco)|vari[aá]veis?\s+de\s+ambiente|\.env\b|credenciais\s+d[oe]\s+(sistema|servidor))/i,
  },

  // Engenharia social contra o próprio atendimento
  {
    tipo: 'engenharia_social',
    severidade: 'media',
    nome: 'falsa_autoridade',
    regex: /\b(sou\s+(do\s+)?(t[eé]cnico|suporte\s+interno|administrador|desenvolvedor|funcion[aá]rio)\s+da\s+claro|autoriza[cç][aã]o\s+especial|libere?\s+(o\s+)?acesso\s+total)/i,
  },
  {
    tipo: 'engenharia_social',
    severidade: 'media',
    nome: 'burlar_verificacao',
    regex: /\b(pul[ae]r?|burl[ae]r?|ignor[ae]r?|sem)\s+(a\s+)?(verifica[cç][aã]o|valida[cç][aã]o|confirma[cç][aã]o\s+de\s+identidade|c[oó]digo\s+de\s+seguran[cç]a|autentica[cç][aã]o)/i,
  },
]

// ─── Camada 2: escopo funcional permitido ───────────────────────────────────
// A IA existe para tirar dúvidas, executar serviços do catálogo e encaminhar
// com protocolo. Tudo fora disso é redirecionado.

const INTENCOES_PERMITIDAS = [
  'saudacao', 'segunda_via', 'pagamento', 'suporte_tecnico', 'diagnostico',
  'cancelamento', 'upgrade_plano', 'recarga', 'visita_tecnica',
  'troca_titularidade', 'portabilidade', 'roaming', 'streaming', 'franquia',
  'atendente_humano', 'consulta_protocolo', 'desambiguacao', 'geral',
  'continuidade', 'transbordo_humano',
]

const FORA_DE_ESCOPO = {
  tipo: 'fora_escopo',
  severidade: 'baixa',
  regex: /\b(escrev[ae]\s+(um\s+)?(c[oó]digo|programa|script|reda[cç][aã]o|poema|piada)|resolva\s+(essa\s+)?(equa[cç][aã]o|conta\s+de\s+matem[aá]tica)|qual\s+sua\s+opini[aã]o\s+sobre\s+(pol[ií]tica|religi[aã]o|elei[cç][oõ]es)|receita\s+de|diagn[oó]stico\s+m[eé]dico|conselho\s+(jur[ií]dico|m[eé]dico|financeiro)|traduz[ai]r?\s+(esse\s+)?texto)\b/i,
}

// ─── Camada 3: redação de dados sensíveis na saída ──────────────────────────

const REDACOES = [
  { nome: 'cpf_completo', regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, substituto: '***.***.***-**' },
  { nome: 'cartao', regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, substituto: '**** **** **** ****' },
  { nome: 'email_terceiro', regex: /\b[\w.%-]+@(?!clarotv\.com|claro\.com\.br)[\w.-]+\.[A-Za-z]{2,}\b/g, substituto: '[e-mail protegido]' },
]

/**
 * Analisa a mensagem do cliente ANTES de qualquer processamento.
 * Retorna { bloqueado, tipo, severidade, padrao, resposta } —
 * quando bloqueado é true, o pipeline não deve continuar.
 */
function analisarEntrada(texto, { sessaoId, clienteId, canal } = {}) {
  if (!texto || typeof texto !== 'string') {
    return { bloqueado: false }
  }

  for (const padrao of PADROES) {
    if (padrao.regex.test(texto)) {
      registrarEvento({
        sessaoId, clienteId, canal,
        tipo: padrao.tipo,
        severidade: padrao.severidade,
        padrao: padrao.nome,
        trecho: texto,
        acao: 'bloqueado',
      })

      return {
        bloqueado: true,
        tipo: padrao.tipo,
        severidade: padrao.severidade,
        padrao: padrao.nome,
        resposta: respostaSegura(padrao.tipo),
      }
    }
  }

  if (FORA_DE_ESCOPO.regex.test(texto)) {
    registrarEvento({
      sessaoId, clienteId, canal,
      tipo: FORA_DE_ESCOPO.tipo,
      severidade: FORA_DE_ESCOPO.severidade,
      padrao: 'assunto_fora_do_catalogo',
      trecho: texto,
      acao: 'redirecionado',
    })

    return {
      bloqueado: true,
      tipo: 'fora_escopo',
      severidade: 'baixa',
      padrao: 'assunto_fora_do_catalogo',
      resposta: respostaSegura('fora_escopo'),
    }
  }

  return { bloqueado: false }
}

/** Verifica se a intenção detectada está no escopo atendido pela IA. */
function intencaoPermitida(intencao) {
  return INTENCOES_PERMITIDAS.includes(intencao)
}

/** Redige dados sensíveis na resposta antes de devolvê-la ao cliente. */
function sanitizarSaida(texto) {
  if (!texto) return texto
  let saida = texto
  for (const r of REDACOES) {
    saida = saida.replace(r.regex, r.substituto)
  }
  return saida
}

/**
 * Respostas de recusa: explicam o limite sem expor como o filtro funciona,
 * e sempre reconduzem o cliente ao que a IA de fato resolve.
 */
function respostaSegura(tipo) {
  const menu = '\n\nPosso ajudar com: **segunda via e pagamento de fatura**, **suporte técnico**, **consumo de franquia**, **upgrade de plano**, **recarga**, **agendamento de visita técnica** ou **falar com um atendente**. O que você precisa?'

  switch (tipo) {
    case 'extracao_dados':
      return 'Não consigo atender esse pedido. Só tenho acesso aos dados dos contratos vinculados ao seu cadastro, e apenas para executar os serviços de atendimento — não consulto registros de outros clientes nem a base de dados da Claro.' + menu
    case 'prompt_injection':
      return 'Sou o assistente de atendimento da Claro e sigo sempre as mesmas regras de atendimento, então não consigo mudar meu funcionamento a pedido.' + menu
    case 'engenharia_social':
      return 'Por segurança da sua conta, não consigo liberar acesso ou pular a verificação de identidade. Todo atendimento com dados do contrato passa pela mesma confirmação.' + menu
    case 'fora_escopo':
    default:
      return 'Esse assunto está fora do meu atendimento — sou especializado nos serviços da Claro.' + menu
  }
}

/** Persiste o evento de segurança para auditoria (trecho truncado, sem PII). */
function registrarEvento({ sessaoId, clienteId, canal, tipo, severidade, padrao, trecho, acao }) {
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO eventos_seguranca (id, sessao_id, cliente_id, canal, tipo, severidade, padrao_detectado, trecho, acao, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuidv4(),
      sessaoId || null,
      clienteId || null,
      canal || null,
      tipo,
      severidade,
      padrao,
      // Só os primeiros 120 caracteres, já redigidos — o log não vira vazamento
      sanitizarSaida(String(trecho || '').slice(0, 120)),
      acao
    )
  } catch (err) {
    console.error('[guardrails.registrarEvento]', err.message)
  }
}

/** Eventos recentes para o painel de segurança. */
function eventosRecentes(limite = 50) {
  try {
    const db = getDb()
    return db.prepare(`
      SELECT e.*, c.nome as cliente_nome
      FROM eventos_seguranca e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      ORDER BY e.created_at DESC
      LIMIT ?
    `).all(limite)
  } catch (_) {
    return []
  }
}

module.exports = {
  analisarEntrada,
  sanitizarSaida,
  intencaoPermitida,
  eventosRecentes,
  registrarEvento,
  INTENCOES_PERMITIDAS,
  PADROES,
}
