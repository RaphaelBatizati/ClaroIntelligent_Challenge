// Utilidades compartilhadas pelos adaptadores.
// Ficam fora do núcleo de propósito: são detalhes de como os sistemas de
// origem formatam fatura e vencimento, não regra de orquestração.

/** Próximo vencimento (dia 10) em formato brasileiro. */
function proximoVencimento(dia = 10) {
  const venc = new Date()
  venc.setDate(dia)
  if (venc < new Date()) venc.setMonth(venc.getMonth() + 1)
  return venc.toLocaleDateString('pt-BR')
}

/**
 * Linha digitável de boleto com a estrutura do padrão FEBRABAN
 * (banco + moeda + campos + valor). É simulação: os dígitos verificadores
 * não são calculados, só o formato é fiel para a demonstração.
 */
function gerarLinhaDigitavel(valor = 0) {
  const centavos = String(Math.round(Number(valor || 0) * 100)).padStart(10, '0')
  const bloco = () => String(Math.floor(Math.random() * 1e5)).padStart(5, '0')
  return `03399.${bloco()} ${bloco()}.${bloco()}0 ${bloco()}.${bloco()}1 9 ${centavos}`
}

/** Formata MSISDN 5511999998888 → (11) 9 9999-8888 */
function formatarMsisdn(msisdn) {
  if (!msisdn) return null
  const d = String(msisdn).replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return msisdn
}

module.exports = { proximoVencimento, gerarLinhaDigitavel, formatarMsisdn }
