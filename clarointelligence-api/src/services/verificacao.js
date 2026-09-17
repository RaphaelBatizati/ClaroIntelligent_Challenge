// Verificação em duas etapas (2FA) — identificação do cliente no WhatsApp.
//
// Motivação: no WhatsApp o canal é o próprio número de telefone. O sistema
// reconhece o cliente pelo MSISDN de origem, mas posse do número não é prova
// de identidade: aparelho clonado, chip roubado ou número recuperado por um
// terceiro herdam a "identidade" da conversa. Por isso, no WhatsApp a sessão
// começa com a identificação: reconhecido o número, um código de 6 dígitos é
// enviado por SMS e a conversa só avança depois de confirmado.
//
// Nos demais canais (site, app, call center) a autenticação é do próprio canal
// — login da conta ou identificação do atendente — então o 2FA não se repete
// aqui: seria fricção sem ganho de segurança.
//
// Segurança da implementação:
//   - o código NUNCA é armazenado em texto puro, só o hash SHA-256 com salt;
//   - expira em 5 minutos e aceita no máximo 3 tentativas;
//   - a comparação é feita em tempo constante (timingSafeEqual).

const crypto = require('crypto')
const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')

const TTL_MINUTOS = 5
const MAX_TENTATIVAS = 3

// Em produção viria de variável de ambiente / cofre de segredos.
const SALT = process.env.VERIFICACAO_SALT || 'clarointelligence-mvp-salt'

// Intenções que tocam dado financeiro ou pessoal. No WhatsApp a identificação
// acontece na entrada, antes de qualquer uma delas; a lista permanece porque é
// ela que nomeia o motivo registrado no desafio e na linha do tempo do protocolo.
const INTENCOES_SENSIVEIS = [
  'segunda_via',
  'pagamento',
  'cancelamento',
  'troca_titularidade',
  'portabilidade',
  'upgrade_plano',
  'recarga',
  'franquia',
]

// Canal onde o segundo fator é obrigatório: só o WhatsApp.
// Site, app e call center têm autenticação própria do canal.
const CANAIS_COM_2FA = ['whatsapp']

/**
 * Decide se este turno exige verificação.
 *
 * No WhatsApp a regra é de ENTRADA, não de intenção: o número identifica o
 * cliente, o código confirma que é ele. Uma vez validada, a sessão inteira
 * segue verificada — não se pede código a cada mensagem.
 */
function exigeVerificacao({ canal, sessao }) {
  if (!CANAIS_COM_2FA.includes(canal)) return false
  if (sessao?.verificado === 1) return false
  return true
}

/**
 * A sessão está identificada o suficiente para receber histórico de
 * atendimentos anteriores (protocolo em aberto de outro canal, pendências)?
 *
 * No WhatsApp isso só vale depois do código confirmado. Nos outros canais a
 * autenticação do canal já cumpre esse papel.
 */
function sessaoIdentificada({ canal, sessao }) {
  if (!CANAIS_COM_2FA.includes(canal)) return true
  return sessao?.verificado === 1
}

function hashCodigo(codigo) {
  return crypto.createHash('sha256').update(`${SALT}:${codigo}`).digest('hex')
}

function mascararTelefone(telefone) {
  if (!telefone) return 'número cadastrado'
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 4) return 'número cadastrado'
  const ddd = digitos.slice(0, 2)
  const finais = digitos.slice(-4)
  return `(${ddd}) *****-${finais}`
}

function mascararEmail(email) {
  if (!email || !email.includes('@')) return 'e-mail cadastrado'
  const [user, dominio] = email.split('@')
  const visivel = user.slice(0, 2)
  return `${visivel}${'*'.repeat(Math.max(user.length - 2, 3))}@${dominio}`
}

/**
 * Cria um desafio de verificação e "envia" o código.
 * O envio real (SMS/e-mail) está fora do escopo do MVP: o código é devolvido
 * em `codigo_simulado` para a interface exibir como SMS simulado. Em produção
 * esse campo desaparece e o código só existe no canal externo.
 */
function iniciar({ sessaoId, clienteId, canal, motivo, metodo = 'sms' }) {
  try {
    const db = getDb()
    const cliente = db.prepare('SELECT nome, telefone, email FROM clientes WHERE id = ?').get(clienteId)
    if (!cliente) return null

    // Invalida desafios anteriores ainda pendentes desta sessão
    db.prepare(`UPDATE verificacoes SET status = 'expirado' WHERE sessao_id = ? AND status = 'pendente'`).run(sessaoId)

    // Código de 6 dígitos com gerador criptograficamente seguro
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const destino = metodo === 'email' ? mascararEmail(cliente.email) : mascararTelefone(cliente.telefone)

    const id = uuidv4()
    db.prepare(`
      INSERT INTO verificacoes (id, sessao_id, cliente_id, canal, codigo_hash, destino_mascarado, metodo, motivo, tentativas, max_tentativas, status, expira_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pendente', datetime('now', '+${TTL_MINUTOS} minutes'), datetime('now'))
    `).run(id, sessaoId, clienteId, canal, hashCodigo(codigo), destino, metodo, motivo || null, MAX_TENTATIVAS)

    return {
      verificacao_id: id,
      destino_mascarado: destino,
      metodo,
      expira_em_minutos: TTL_MINUTOS,
      tentativas_restantes: MAX_TENTATIVAS,
      // APENAS SIMULAÇÃO — em produção o código nunca volta na resposta da API
      codigo_simulado: codigo,
    }
  } catch (err) {
    console.error('[verificacao.iniciar]', err.message)
    return null
  }
}

/**
 * Valida o código informado pelo cliente.
 * Conta tentativas, respeita expiração e bloqueia após o limite.
 */
function validar({ verificacaoId, sessaoId, codigo }) {
  try {
    const db = getDb()

    const desafio = verificacaoId
      ? db.prepare('SELECT * FROM verificacoes WHERE id = ?').get(verificacaoId)
      : db.prepare(`SELECT * FROM verificacoes WHERE sessao_id = ? AND status = 'pendente' ORDER BY created_at DESC LIMIT 1`).get(sessaoId)

    if (!desafio) {
      return { ok: false, motivo: 'nao_encontrada', mensagem: 'Não há verificação pendente. Peça um novo código.' }
    }

    if (desafio.status === 'bloqueado') {
      return { ok: false, motivo: 'bloqueado', mensagem: 'Número de tentativas excedido. Solicite um novo código para continuar.' }
    }

    const expirado = db.prepare(`SELECT datetime('now') > expira_em AS exp FROM verificacoes WHERE id = ?`).get(desafio.id)
    if (desafio.status === 'expirado' || expirado?.exp === 1) {
      db.prepare(`UPDATE verificacoes SET status = 'expirado' WHERE id = ?`).run(desafio.id)
      return { ok: false, motivo: 'expirado', mensagem: `O código expirou (validade de ${TTL_MINUTOS} minutos). Vou enviar um novo.` }
    }

    const informado = String(codigo || '').replace(/\D/g, '')
    const esperado = Buffer.from(desafio.codigo_hash, 'hex')
    const recebido = Buffer.from(hashCodigo(informado), 'hex')
    const confere = esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido)

    if (!confere) {
      const tentativas = desafio.tentativas + 1
      const bloqueou = tentativas >= desafio.max_tentativas

      db.prepare(`UPDATE verificacoes SET tentativas = ?, status = ? WHERE id = ?`)
        .run(tentativas, bloqueou ? 'bloqueado' : 'pendente', desafio.id)

      // Falha de 2FA é evento de segurança: alimenta o painel de auditoria
      if (bloqueou) {
        const guardrails = require('./guardrails')
        guardrails.registrarEvento({
          sessaoId: desafio.sessao_id,
          clienteId: desafio.cliente_id,
          canal: desafio.canal,
          tipo: 'falha_2fa',
          severidade: 'alta',
          padrao: 'tentativas_excedidas',
          trecho: `Verificação bloqueada após ${tentativas} tentativas`,
          acao: 'bloqueado',
        })
      }

      return {
        ok: false,
        motivo: bloqueou ? 'bloqueado' : 'codigo_invalido',
        tentativas_restantes: Math.max(desafio.max_tentativas - tentativas, 0),
        mensagem: bloqueou
          ? 'Número de tentativas excedido. Por segurança, solicite um novo código.'
          : `Código incorreto. Você ainda tem ${desafio.max_tentativas - tentativas} tentativa(s).`,
      }
    }

    db.prepare(`UPDATE verificacoes SET status = 'validado', validado_em = datetime('now') WHERE id = ?`).run(desafio.id)
    db.prepare('UPDATE sessoes SET verificado = 1 WHERE id = ?').run(desafio.sessao_id)

    return {
      ok: true,
      mensagem: 'Identidade confirmada com sucesso.',
      sessao_id: desafio.sessao_id,
      motivo_original: desafio.motivo,
    }
  } catch (err) {
    console.error('[verificacao.validar]', err.message)
    return { ok: false, motivo: 'erro', mensagem: 'Falha ao validar o código. Tente novamente.' }
  }
}

/** Estado atual da verificação de uma sessão (para a interface). */
function statusSessao(sessaoId) {
  try {
    const db = getDb()

    // Desafio vencido deixa de ser pendente aqui, e não só quando alguém tenta
    // um código. Sem isso a conversa ficaria presa: o pipeline esperaria para
    // sempre por um código que já não vale mais.
    db.prepare(`
      UPDATE verificacoes SET status = 'expirado'
      WHERE sessao_id = ? AND status = 'pendente' AND datetime('now') > expira_em
    `).run(sessaoId)

    const sessao = db.prepare('SELECT verificado FROM sessoes WHERE id = ?').get(sessaoId)
    const pendente = db.prepare(`SELECT id, destino_mascarado, metodo, motivo, tentativas, max_tentativas FROM verificacoes WHERE sessao_id = ? AND status = 'pendente' ORDER BY created_at DESC LIMIT 1`).get(sessaoId)
    return {
      verificado: sessao?.verificado === 1,
      desafio_pendente: pendente || null,
    }
  } catch (_) {
    return { verificado: false, desafio_pendente: null }
  }
}

/**
 * Mensagem de identificação, adaptada à persona.
 * O texto deixa explícito o que aconteceu: o número foi reconhecido no cadastro
 * e o código saiu por SMS para o mesmo número — é isso que o cliente vê no
 * WhatsApp real.
 */
function mensagemDesafio({ destino, metodo, persona, nome }) {
  const via = metodo === 'email' ? 'e-mail' : 'SMS'
  const primeiro = nome ? nome.split(' ')[0] : null

  if (persona === 'digital') {
    return `🔐 **Identificação — verificação em duas etapas**\n\nNúmero **${destino}** localizado no cadastro Claro. Código de 6 dígitos enviado por ${via} para o mesmo número.\n\nInforme o código para liberar os dados do contrato. Validade: ${TTL_MINUTOS} minutos.`
  }
  if (persona === 'assistido') {
    return `🔐 Oi${primeiro ? ', ' + primeiro : ''}! Reconheci o seu número aqui no cadastro da Claro 😊\n\nAntes de falar dos seus dados, preciso ter certeza de que é você mesmo. Acabei de mandar um **código de 6 números** por ${via} para o **${destino}**.\n\nPode olhar suas mensagens e digitar esse código aqui pra mim? É rapidinho, e assim seus dados ficam protegidos.`
  }
  if (persona === 'informal') {
    return `🔐 Opa! Achei teu número aqui no cadastro 👍\n\nSó pra confirmar que é você mesmo, mandei um código de 6 números por ${via} no **${destino}**. Cola ele aqui 👇`
  }
  return `🔐 **Verificação em duas etapas**\n\nIdentifiquei seu número **${destino}** no cadastro Claro. Para proteger seus dados, enviei um código de 6 dígitos por ${via} para esse mesmo número.\n\nÉ só digitar o código aqui — ele vale por ${TTL_MINUTOS} minutos. 🔒`
}

/**
 * Troca o motivo registrado no desafio pendente.
 *
 * Enquanto espera o código o cliente continua falando — e o que ele diz depois
 * costuma ser mais específico do que o "oi" que abriu a conversa. Guardar a
 * intenção mais recente é o que faz o pipeline retomar o assunto certo assim
 * que a identidade for confirmada.
 */
function atualizarMotivo({ verificacaoId, motivo }) {
  if (!verificacaoId || !motivo) return
  try {
    const db = getDb()
    db.prepare(`UPDATE verificacoes SET motivo = ? WHERE id = ? AND status = 'pendente'`).run(motivo, verificacaoId)
  } catch (err) {
    console.error('[verificacao.atualizarMotivo]', err.message)
  }
}

const ASSUNTO_POR_MOTIVO = {
  segunda_via: 'ver a sua fatura',
  pagamento: 'pagar a fatura',
  cancelamento: 'tratar o cancelamento',
  troca_titularidade: 'alterar a titularidade',
  portabilidade: 'tratar a portabilidade',
  upgrade_plano: 'alterar o seu plano',
  recarga: 'fazer a recarga',
  franquia: 'ver o consumo da sua franquia',
  suporte_tecnico: 'resolver o problema de conexão',
  diagnostico: 'diagnosticar o equipamento',
  visita_tecnica: 'agendar a visita técnica',
  roaming: 'tratar o roaming',
  streaming: 'resolver o acesso ao Claro tv+',
  atendente_humano: 'te encaminhar para um atendente',
  consulta_protocolo: 'consultar o protocolo',
}

/** O cliente está dizendo que o código não chegou? */
const REENVIO_REGEX = /\b(reenvi\w*|manda\s*(de\s*)?novo|envia\s*(de\s*)?novo|n[aã]o\s*(chegou|recebi|veio)|novo\s*c[oó]digo|outro\s*c[oó]digo|n[aã]o\s*me\s*mandou)\b/i

function pediuReenvio(texto) {
  return REENVIO_REGEX.test(String(texto || ''))
}

/**
 * Resposta para quem escreveu algo que não é o código.
 *
 * Repetir a mesma frase a cada mensagem dá a impressão de que o assistente não
 * leu nada. Duas coisas evitam isso: a demanda é nomeada de volta (o cliente vê
 * que foi entendido) e, a partir da segunda cobrança, o texto muda e oferece o
 * reenvio — porque aí a hipótese mais provável é que o SMS não chegou.
 */
function mensagemAguardando({ destino, motivo, persona, tentativa = 1 }) {
  const assunto = ASSUNTO_POR_MOTIVO[motivo]
  const anotei = assunto
    ? (persona === 'informal' ? `Boa, já anotei que é pra **${assunto}**. ` : `Já anotei: você quer **${assunto}**. `)
    : ''

  if (tentativa >= 2) {
    const saida = `

Se o SMS não chegou, escreva **reenviar** que eu mando outro código.`
    if (persona === 'assistido') {
      return `${anotei ? '😊 ' + anotei : ''}Mas eu ainda não recebi o **código de 6 números** — sem ele não posso mostrar seus dados, tá bom?${saida}`
    }
    if (persona === 'informal') {
      return `${anotei}Só que sem o **código de 6 números** eu não consigo seguir 😅${saida}`
    }
    return `${anotei}A verificação continua pendente: preciso do **código de 6 dígitos** enviado para **${destino}**.${saida}`
  }

  if (persona === 'assistido') {
    return `${anotei ? '😊 ' + anotei : ''}Só falta uma coisinha antes: preciso do **código de 6 números** que enviei por SMS para **${destino}**.

Pode digitar ele aqui pra mim? Assim que confirmar, continuo de onde paramos.`
  }
  if (persona === 'informal') {
    return `${anotei}Só me manda o **código de 6 números** que chegou no SMS do **${destino}** 👇 Aí eu sigo.`
  }
  if (persona === 'digital') {
    return `${anotei}Aguardando o código de 6 dígitos enviado para **${destino}** para liberar os dados do contrato.`
  }
  return `${anotei}Para continuar com segurança, preciso do **código de 6 dígitos** que enviei por SMS para **${destino}**. 🔐`
}

/** Detecta se a mensagem do cliente é (só) um código de verificação. */
function extrairCodigo(texto) {
  if (!texto) return null
  const limpo = String(texto).trim()
  const match = limpo.match(/\b(\d{6})\b/)
  return match ? match[1] : null
}

module.exports = {
  exigeVerificacao,
  sessaoIdentificada,
  iniciar,
  validar,
  statusSessao,
  mensagemDesafio,
  mensagemAguardando,
  atualizarMotivo,
  pediuReenvio,
  extrairCodigo,
  INTENCOES_SENSIVEIS,
  CANAIS_COM_2FA,
  TTL_MINUTOS,
}
