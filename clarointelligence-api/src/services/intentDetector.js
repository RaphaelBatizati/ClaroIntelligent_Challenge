// Detector de intenção — classificação léxica ponderada.
// Cada intenção tem um peso: quando a mensagem casa com várias, vence a de
// maior peso (pedir cancelamento é mais determinante que dizer "boa tarde").

const INTENTS = [
  { codigo: 'saudacao',           regex: /\b(oi|ol[aá]|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem|e\s*a[ií]|eae|salve)\b/i, peso: 1 },

  { codigo: 'consulta_protocolo', regex: /\b(protocolo|n[uú]mero\s*d[eo]\s*atendimento|chamado\s*(n[uú]mero|aberto)|meu\s*chamado)\b/i, peso: 11 },

  { codigo: 'atendente_humano',   regex: /\b(falar\s*com\s*(um\s*)?(humano|atendente|pessoa|gerente|supervisor)|quero\s*(um\s*)?atendente|atendimento\s*humano|me\s*transfere|chamar?\s*(um\s*)?atendente)\b/i, peso: 11 },

  { codigo: 'cancelamento',       regex: /\b(cancel|rescind|desist|encerrar\s*(o\s*)?(plano|contrato|conta)|n[aã]o\s*quero\s*mais|quero\s*sair|mudar\s*de\s*operadora)\b/i, peso: 10 },

  { codigo: 'pagamento',          regex: /\b(pagar|pagamento|quitar|quero\s*pagar|pagar\s*(a\s*)?(conta|fatura)|pix|d[eé]bito\s*autom[aá]tico|cart[aã]o\s*de\s*cr[eé]dito)\b/i, peso: 9 },

  { codigo: 'suporte_tecnico',    regex: /\b(lenta|lentid[aã]o|caiu|sem\s*sinal|sem\s*internet|n[aã]o\s*funciona|travando|falhou|problema|erro|n[aã]o\s*abre|queda|instabilidade|offline|oscila)\b/i, peso: 9 },

  { codigo: 'troca_titularidade', regex: /\b(titularidade|titular|passar\s*(o\s*plano\s*)?para|transfer[eê]ncia\s*de\s*titularidade)\b/i, peso: 9 },

  { codigo: 'portabilidade',      regex: /\b(portabilidade|portar|trazer\s*(meu\s*)?n[uú]mero|manter\s*(o\s*)?n[uú]mero)\b/i, peso: 9 },

  { codigo: 'segunda_via',        regex: /\b(segunda\s*via|2[aª]\s*via|boleto|c[oó]digo\s*de\s*barras|fatura|conta\s*do\s*m[eê]s|vencimento|valor\s*da\s*conta)\b/i, peso: 8 },

  { codigo: 'upgrade_plano',      regex: /\b(upgrade|melhor\s*plano|mais\s*velocidade|(aumentar|melhorar|subir)\s*(a|o|minha|meu)?\s*(plano|velocidade|franquia|internet|net)|plano\s*(maior|melhor)|(mudar|trocar|migrar)\s*(de\s*)?plano|plano\s*mais\s*(r[aá]pido|caro|completo))\b/i, peso: 8 },

  { codigo: 'recarga',            regex: /\b(recarga|recarregar|saldo|cr[eé]dito|colocar\s*cr[eé]dito)\b/i, peso: 8 },

  { codigo: 'franquia',           regex: /\b(franquia|quanto\s*(de\s*)?(internet|dados|gb)|consumo\s*de\s*dados|gigas?\s*(restantes?|dispon[ií]ve|que\s*sobrou)|acabou\s*(a\s*)?internet\s*do\s*celular)\b/i, peso: 8 },

  { codigo: 'visita_tecnica',     regex: /\b(visita|t[eé]cnico|agendamento|agendar|instala[cç][aã]o|instalar)\b/i, peso: 8 },

  { codigo: 'roaming',            regex: /\b(roaming|internacional|viagem|exterior|fora\s*do\s*pa[ií]s)\b/i, peso: 8 },

  { codigo: 'diagnostico',        regex: /\b(modem|roteador|reset|reiniciar|reiniciei|desligu|configurar|wifi|wi-fi|senha\s*(do\s*)?wifi|luz\s*vermelha|decodificador)\b/i, peso: 7 },

  { codigo: 'streaming',          regex: /\b(claro\s*tv|netflix|hbo|max\b|globoplay|disney|paramount|apple\s*tv|streaming|assistir|canais|programa[cç][aã]o|box)\b/i, peso: 7 },

  { codigo: 'desambiguacao',      regex: /\b(qual\s*(produto|plano|linha|servi[cç]o)|de\s*qual)\b/i, peso: 3 },
]

// Respostas de confirmação — não mudam a intenção, confirmam a proposta
// anterior. Precisa aceitar a forma como as pessoas realmente respondem
// ("sim, pode gerar", "manda o pix", "fechou") e não só o "sim" isolado.
const CONFIRMACAO_REGEX = /^\s*(sim|s|isso|ok|okay|beleza|blz|claro|bora|quero|pode|manda|confirmo|confirmar|aceito|aceitar|positivo|com\s*certeza|vamos|fechado|fechou|certo|perfeito|combinado|t[aá]\s*(bom|certo|ok)?|show|massa|top|autoriz|prossegue?|segue|faz|gera|ativa|by?eleza)\b/i

// Frases afirmativas que aparecem depois do verbo ("pode gerar", "manda o pix")
const CONFIRMACAO_FRASE_REGEX = /\b(pode\s*(gerar|mandar|enviar|fazer|ativar|seguir|prosseguir|sim)|manda\s*(o\s*)?(pix|c[oó]digo|link)|gera\s*(o\s*)?pix|quero\s*sim|isso\s*mesmo|t[aá]\s*(bom|certo)|sim\s*por\s*favor|por\s*favor\s*sim)\b/i

const NEGACAO_REGEX = /^\s*(n[aã]o|nao|n|negativo|deixa|depois|agora\s*n[aã]o|cancela|esquece|melhor\s*n[aã]o)\b/i

/**
 * Confirmação só vale em mensagem curta: "sim" numa frase de 3 palavras é
 * aceite; a mesma palavra dentro de um desabafo longo, não.
 */
function ehConfirmacao(texto) {
  const limpo = String(texto || '').trim()
  if (!limpo) return false
  if (NEGACAO_REGEX.test(limpo)) return false
  if (CONFIRMACAO_FRASE_REGEX.test(limpo)) return true
  return limpo.split(/\s+/).length <= 6 && CONFIRMACAO_REGEX.test(limpo)
}

function ehNegacao(texto) {
  return NEGACAO_REGEX.test(String(texto || '').trim())
}

function detectIntent(texto) {
  const matches = []
  for (const intent of INTENTS) {
    if (intent.regex.test(texto)) {
      matches.push({ codigo: intent.codigo, peso: intent.peso })
    }
  }

  if (matches.length === 0) {
    return { intencao: 'geral', confianca: 0.4, confirmacao: ehConfirmacao(texto), negacao: ehNegacao(texto) }
  }

  matches.sort((a, b) => b.peso - a.peso)
  const principal = matches[0]
  const confianca = Math.min(0.55 + principal.peso * 0.04, 0.99)

  return {
    intencao: principal.codigo,
    confianca: parseFloat(confianca.toFixed(2)),
    confirmacao: ehConfirmacao(texto),
    negacao: ehNegacao(texto),
    candidatas: matches.map(m => m.codigo),
  }
}

module.exports = { detectIntent, ehConfirmacao, ehNegacao, INTENTS }
