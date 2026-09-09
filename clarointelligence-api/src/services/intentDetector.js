const INTENTS = [
  { codigo: 'saudacao',           regex: /\b(oi|ol[aá]|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem|boa|ei)\b/i, peso: 1 },
  { codigo: 'cancelamento',       regex: /\b(cancel|rescind|desist|encerrar|fechar\s*(conta|plano)|sair|n[aã]o\s*quero\s*mais)\b/i, peso: 10 },
  { codigo: 'segunda_via',        regex: /\b(segunda\s*via|boleto|c[oó]digo\s*de\s*barras|pagar|pagamento|fatura|conta|vencimento|2[aª]\s*via)\b/i, peso: 8 },
  { codigo: 'suporte_tecnico',    regex: /\b(lenta|caiu|sem\s*sinal|sem\s*internet|n[aã]o\s*funciona|travando|lentic[aã]o|falhou|problema|erro|n[aã]o\s*abre|queda|instabilidade|offline)\b/i, peso: 9 },
  { codigo: 'diagnostico',        regex: /\b(modem|roteador|reset|reiniciar|reiniciei|desligu|configurar|wifi|senha\s*wifi|luz\s*vermelha)\b/i, peso: 7 },
  { codigo: 'upgrade_plano',      regex: /\b(upgrade|melhor\s*plano|mais\s*velocidade|aumentar|plano\s*(maior|melhor)|mudar\s*plano|trocar\s*plano|upgrade)\b/i, peso: 8 },
  { codigo: 'recarga',            regex: /\b(recarga|recarregar|saldo|cr[eé]dito|recarg)\b/i, peso: 8 },
  { codigo: 'visita_tecnica',     regex: /\b(visita|t[eé]cnico|agendamento|agendar|instala[cç][aã]o|instalar)\b/i, peso: 8 },
  { codigo: 'troca_titularidade', regex: /\b(titularidade|titular|nome\s*de|passar\s*para|transfer[eê]ncia\s*de\s*titularidade)\b/i, peso: 9 },
  { codigo: 'portabilidade',      regex: /\b(portabilidade|portar|trazer\s*n[uú]mero|manter\s*n[uú]mero)\b/i, peso: 9 },
  { codigo: 'roaming',            regex: /\b(roaming|internacione?al|viagem|exterior|fora\s*do\s*pa[ií]s)\b/i, peso: 8 },
  { codigo: 'streaming',          regex: /\b(claro\s*tv|netflix|hbo|streaming|assistir|canais|programa[cç][aã]o)\b/i, peso: 7 },
  { codigo: 'desambiguacao',      regex: /\b(qual\s*(produto|plano|linha|servi[cç]o)|de\s*qual)\b/i, peso: 3 },
]

function detectIntent(texto) {
  const matches = []
  for (const intent of INTENTS) {
    if (intent.regex.test(texto)) {
      matches.push({ codigo: intent.codigo, peso: intent.peso })
    }
  }

  if (matches.length === 0) {
    return { intencao: 'geral', confianca: 0.4 }
  }

  matches.sort((a, b) => b.peso - a.peso)
  const principal = matches[0]
  const confianca = Math.min(0.55 + principal.peso * 0.04, 0.99)

  return { intencao: principal.codigo, confianca: parseFloat(confianca.toFixed(2)) }
}

module.exports = { detectIntent }
