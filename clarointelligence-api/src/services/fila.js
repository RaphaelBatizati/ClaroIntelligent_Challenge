// Fila de atendimento humano — o transbordo deixa de ser uma mensagem
// ("vou te transferir") e passa a ser um estado observável: o cliente entra
// numa fila com posição e tempo estimado, e um atendente real assume a
// conversa pelo Console do Atendente.
//
// O contexto vai junto: protocolo, score de atrito, produto em foco, persona e
// o histórico completo da sessão. O cliente não repete nada ao ser atendido —
// que é exatamente a promessa do ClaroIntelligence.

const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')
const protocolo = require('./protocolo')

// Tempo médio de atendimento por posição na fila, em minutos.
const TMA_MINUTOS = 2.5

/**
 * Gravidade do caso. O risco de churn entra junto com o score de atrito porque
 * é ele que responde a pergunta que importa para a retenção: quem está mais
 * perto de cancelar? Um cliente com atrito médio mas churn alto (recontato em
 * vários canais, menção a concorrência) passa na frente de um atrito pontual.
 */
function prioridadeDe({ scoreAtrito = 0, riscoChurn = 0, motivo = '', intencao = '' }) {
  if (riscoChurn >= 70 || scoreAtrito >= 80 || intencao === 'cancelamento' || /cancel/i.test(motivo)) return 'alta'
  if (riscoChurn >= 40 || scoreAtrito >= 50) return 'media'
  return 'baixa'
}

const PESO_PRIORIDADE = { alta: 0, media: 1, baixa: 2 }

// Tipo de serviço: agrupa a intenção em famílias que o atendente reconhece,
// para poder filtrar a fila por especialidade (quem cuida de fatura, quem cuida
// de rede). É o eixo de roteamento que uma operação real usa.
const TIPO_SERVICO = {
  segunda_via: 'financeiro',
  pagamento: 'financeiro',
  cancelamento: 'retencao',
  portabilidade: 'retencao',
  troca_titularidade: 'cadastro',
  suporte_tecnico: 'tecnico',
  diagnostico: 'tecnico',
  visita_tecnica: 'tecnico',
  streaming: 'tecnico',
  upgrade_plano: 'comercial',
  recarga: 'comercial',
  franquia: 'consumo',
  roaming: 'consumo',
}

function tipoServicoDe(intencao) {
  return TIPO_SERVICO[intencao] || 'geral'
}

const ROTULO_TIPO_SERVICO = {
  financeiro: 'Fatura e pagamento',
  tecnico: 'Suporte técnico',
  retencao: 'Retenção e cancelamento',
  comercial: 'Planos e upgrade',
  consumo: 'Consumo e franquia',
  cadastro: 'Cadastro e titularidade',
  geral: 'Atendimento geral',
}

/**
 * Coloca a sessão na fila. Idempotente: se já existe entrada aguardando ou em
 * atendimento para a sessão, devolve a existente em vez de duplicar.
 */
function entrar({ sessaoId, clienteId, canal, motivo, scoreAtrito = 0, riscoChurn = 0, intencao, produtoLinha, protocoloNumero }) {
  try {
    const db = getDb()

    const existente = db.prepare(`
      SELECT * FROM fila_atendimento
      WHERE sessao_id = ? AND status IN ('aguardando', 'em_atendimento')
      ORDER BY entrou_em DESC LIMIT 1
    `).get(sessaoId)
    if (existente) return comPosicao(existente)

    const prioridade = prioridadeDe({ scoreAtrito, riscoChurn, motivo, intencao })
    const resumo = montarResumoContexto({ sessaoId, clienteId, intencao, scoreAtrito })

    const id = uuidv4()
    db.prepare(`
      INSERT INTO fila_atendimento (id, protocolo_numero, sessao_id, cliente_id, canal, motivo, prioridade, score_atrito, risco_churn, tipo_servico, produto_linha, status, resumo_contexto, entrou_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', ?, datetime('now'))
    `).run(
      id, protocoloNumero || null, sessaoId, clienteId, canal,
      motivo || 'Solicitação de atendimento humano',
      prioridade, scoreAtrito, riscoChurn, tipoServicoDe(intencao), produtoLinha || null, resumo
    )

    if (protocoloNumero) {
      protocolo.transferir(protocoloNumero, `Cliente encaminhado à fila humana (prioridade ${prioridade}): ${motivo || 'solicitação'}`)
    }

    const entrada = db.prepare('SELECT * FROM fila_atendimento WHERE id = ?').get(id)
    return comPosicao(entrada)
  } catch (err) {
    console.error('[fila.entrar]', err.message)
    return null
  }
}

/** Resumo que o atendente lê antes de falar — evita que o cliente repita. */
function montarResumoContexto({ sessaoId, clienteId, intencao, scoreAtrito }) {
  try {
    const db = getDb()
    const cliente = db.prepare('SELECT nome, perfil_persona FROM clientes WHERE id = ?').get(clienteId)
    const sessao = db.prepare('SELECT canal, produto_codigo_foco FROM sessoes WHERE id = ?').get(sessaoId)
    const msgs = db.prepare(`
      SELECT papel, conteudo FROM mensagens WHERE sessao_id = ? ORDER BY created_at DESC LIMIT 4
    `).all(sessaoId).reverse()

    const sinais = db.prepare(`
      SELECT tipo, COUNT(*) as n FROM sinais_atrito WHERE sessao_id = ? GROUP BY tipo
    `).all(sessaoId)

    return JSON.stringify({
      cliente: cliente?.nome,
      persona: cliente?.perfil_persona,
      canal: sessao?.canal,
      produto: sessao?.produto_codigo_foco,
      intencao,
      score_atrito: scoreAtrito,
      sinais: sinais.map(s => `${s.tipo} (${s.n}x)`),
      ultimas_mensagens: msgs.map(m => ({ papel: m.papel, texto: m.conteudo.slice(0, 160) })),
    })
  } catch (_) {
    return null
  }
}

/** Calcula posição na fila e espera estimada respeitando a prioridade. */
function comPosicao(entrada) {
  if (!entrada) return null
  try {
    const db = getDb()
    if (entrada.status !== 'aguardando') {
      return { ...entrada, posicao: 0, espera_estimada_min: 0, resumo: parseResumo(entrada) }
    }

    const aguardando = db.prepare(`
      SELECT id, prioridade, risco_churn, entrou_em FROM fila_atendimento WHERE status = 'aguardando'
    `).all()

    // Mesma regra do Console: gravidade primeiro, churn em seguida, e só então
    // ordem de chegada. Quem está mais perto de cancelar não espera atrás de
    // uma dúvida simples que chegou um minuto antes.
    const ordenada = aguardando.sort((a, b) => {
      const p = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]
      if (p !== 0) return p
      const churn = (b.risco_churn || 0) - (a.risco_churn || 0)
      if (churn !== 0) return churn
      return a.entrou_em.localeCompare(b.entrou_em)
    })

    const posicao = ordenada.findIndex(e => e.id === entrada.id) + 1

    return {
      ...entrada,
      posicao: posicao > 0 ? posicao : 1,
      espera_estimada_min: Math.max(1, Math.round((posicao > 0 ? posicao : 1) * TMA_MINUTOS)),
      resumo: parseResumo(entrada),
    }
  } catch (_) {
    return { ...entrada, posicao: 1, espera_estimada_min: 3, resumo: parseResumo(entrada) }
  }
}

function parseResumo(entrada) {
  try {
    return entrada.resumo_contexto ? JSON.parse(entrada.resumo_contexto) : null
  } catch (_) {
    return null
  }
}

/**
 * Fila para o Console do Atendente.
 *
 * Filtros pensados para uma operação com fila grande: por estado, por gravidade
 * (o quanto o caso está quente), por tipo de serviço (a especialidade de quem
 * atende) e por canal de origem. As facetas devolvem a contagem de cada opção
 * *já considerando os outros filtros*, para que nenhum número apareça sem que
 * exista caso correspondente.
 */
function listar({ status, gravidade, tipo_servico, canal, churn_min } = {}) {
  try {
    const db = getDb()

    const where = []
    const params = []

    if (status) { where.push('f.status = ?'); params.push(status) }
    else where.push(`f.status IN ('aguardando', 'em_atendimento')`)

    if (gravidade && PESO_PRIORIDADE[gravidade] !== undefined) { where.push('f.prioridade = ?'); params.push(gravidade) }
    if (tipo_servico) { where.push(`COALESCE(f.tipo_servico, 'geral') = ?`); params.push(tipo_servico) }
    if (canal) { where.push('f.canal = ?'); params.push(canal) }
    if (churn_min) { where.push('COALESCE(f.risco_churn, 0) >= ?'); params.push(Number(churn_min)) }

    const clausula = `WHERE ${where.join(' AND ')}`

    const rows = db.prepare(`
      SELECT f.*, c.nome as cliente_nome, c.perfil_persona, c.telefone,
             p.nome as produto_nome, p.linha as produto_linha_catalogo,
             s.produto_codigo_foco, s.risco_churn as sessao_churn
      FROM fila_atendimento f
      LEFT JOIN clientes c ON f.cliente_id = c.id
      LEFT JOIN sessoes s ON f.sessao_id = s.id
      LEFT JOIN produtos_catalogo p ON s.produto_codigo_foco = p.codigo
      ${clausula}
      ORDER BY
        CASE f.prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
        COALESCE(f.risco_churn, 0) DESC,
        f.entrou_em ASC
    `).all(...params)

    return rows.map((r, i) => ({
      ...r,
      risco_churn: r.risco_churn || r.sessao_churn || 0,
      tipo_servico: r.tipo_servico || 'geral',
      tipo_servico_rotulo: ROTULO_TIPO_SERVICO[r.tipo_servico || 'geral'],
      produto_linha: r.produto_linha || r.produto_linha_catalogo || null,
      posicao: r.status === 'aguardando' ? i + 1 : 0,
      espera_estimada_min: r.status === 'aguardando' ? Math.max(1, Math.round((i + 1) * TMA_MINUTOS)) : 0,
      aguardando_ha_min: Math.round((Date.now() - new Date(r.entrou_em + ' UTC').getTime()) / 60000),
      resumo: parseResumo(r),
      protocolo_formatado: r.protocolo_numero ? protocolo.formatar(r.protocolo_numero) : null,
    }))
  } catch (err) {
    console.error('[fila.listar]', err.message)
    return []
  }
}

/**
 * Contagem por opção de filtro, calculada com os DEMAIS filtros aplicados.
 * Evita o problema clássico do painel: filtrar por WhatsApp e continuar vendo
 * "Call Center (12)" numa lista onde nenhum dos 12 aparece.
 */
function facetas(filtros = {}) {
  const contar = (campo, extra) => {
    const itens = listar({ ...filtros, ...extra })
    return itens.reduce((acc, item) => {
      const chave = item[campo] || 'geral'
      acc[chave] = (acc[chave] || 0) + 1
      return acc
    }, {})
  }

  return {
    gravidade: contar('prioridade', { gravidade: null }),
    tipo_servico: contar('tipo_servico', { tipo_servico: null }),
    canal: contar('canal', { canal: null }),
    total: listar(filtros).length,
  }
}

/** Atendente assume a conversa: a fila vira atendimento ao vivo. */
function assumir(filaId, atendenteNome = 'Atendente Claro') {
  try {
    const db = getDb()
    const entrada = db.prepare('SELECT * FROM fila_atendimento WHERE id = ?').get(filaId)
    if (!entrada) return { ok: false, erro: 'Entrada de fila não encontrada' }
    if (entrada.status === 'em_atendimento') return { ok: false, erro: 'Conversa já está sendo atendida' }
    if (entrada.status === 'encerrado') return { ok: false, erro: 'Atendimento já encerrado' }

    db.prepare(`
      UPDATE fila_atendimento SET status = 'em_atendimento', atendente_nome = ?, iniciado_em = datetime('now') WHERE id = ?
    `).run(atendenteNome, filaId)

    db.prepare(`UPDATE sessoes SET status = 'em_atendimento_humano', updated_at = datetime('now') WHERE id = ?`).run(entrada.sessao_id)

    if (entrada.protocolo_numero) {
      db.prepare(`UPDATE protocolos SET status = 'em_andamento', updated_at = datetime('now') WHERE numero = ?`).run(entrada.protocolo_numero)
      protocolo.registrarEvento(entrada.protocolo_numero, entrada.canal, 'atendimento_humano', `Atendimento assumido por ${atendenteNome}`)
    }

    // Mensagem de sistema no chat do cliente marcando a troca de interlocutor
    inserirMensagem({
      sessaoId: entrada.sessao_id,
      papel: 'sistema',
      conteudo: `👤 **${atendenteNome}** entrou no atendimento e já leu todo o histórico da conversa. Você não precisa repetir nada.`,
      protocoloNumero: entrada.protocolo_numero,
    })

    return { ok: true, entrada: comPosicao(db.prepare('SELECT * FROM fila_atendimento WHERE id = ?').get(filaId)) }
  } catch (err) {
    console.error('[fila.assumir]', err.message)
    return { ok: false, erro: err.message }
  }
}

/** Mensagem escrita pelo atendente humano, entregue no chat do cliente. */
function mensagemAtendente(filaId, texto, atendenteNome) {
  try {
    const db = getDb()
    const entrada = db.prepare('SELECT * FROM fila_atendimento WHERE id = ?').get(filaId)
    if (!entrada) return { ok: false, erro: 'Atendimento não encontrado' }
    if (entrada.status !== 'em_atendimento') return { ok: false, erro: 'Assuma o atendimento antes de responder' }

    const id = inserirMensagem({
      sessaoId: entrada.sessao_id,
      papel: 'atendente',
      conteudo: texto,
      protocoloNumero: entrada.protocolo_numero,
    })

    return { ok: true, mensagem_id: id, sessao_id: entrada.sessao_id }
  } catch (err) {
    console.error('[fila.mensagemAtendente]', err.message)
    return { ok: false, erro: err.message }
  }
}

/** Mensagem do cliente durante atendimento humano — não passa pela IA. */
function mensagemCliente(sessaoId, texto) {
  try {
    const db = getDb()
    const entrada = db.prepare(`
      SELECT * FROM fila_atendimento WHERE sessao_id = ? AND status IN ('aguardando','em_atendimento') ORDER BY entrou_em DESC LIMIT 1
    `).get(sessaoId)

    const id = inserirMensagem({
      sessaoId,
      papel: 'cliente',
      conteudo: texto,
      protocoloNumero: entrada?.protocolo_numero,
    })

    return { ok: true, mensagem_id: id, fila_id: entrada?.id || null }
  } catch (err) {
    return { ok: false, erro: err.message }
  }
}

function inserirMensagem({ sessaoId, papel, conteudo, protocoloNumero }) {
  const db = getDb()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, protocolo_numero, created_at)
    VALUES (?, ?, ?, ?, 'atendimento_humano', ?, datetime('now'))
  `).run(id, sessaoId, papel, conteudo, protocoloNumero || null)
  return id
}

/** Encerra o atendimento humano e fecha o protocolo. */
function encerrar(filaId, { resolvido = true, observacao } = {}) {
  try {
    const db = getDb()
    const entrada = db.prepare('SELECT * FROM fila_atendimento WHERE id = ?').get(filaId)
    if (!entrada) return { ok: false, erro: 'Atendimento não encontrado' }

    db.prepare(`UPDATE fila_atendimento SET status = 'encerrado', encerrado_em = datetime('now') WHERE id = ?`).run(filaId)
    db.prepare(`UPDATE sessoes SET status = 'encerrada', updated_at = datetime('now') WHERE id = ?`).run(entrada.sessao_id)

    if (entrada.protocolo_numero && resolvido) {
      protocolo.encerrar(entrada.protocolo_numero, {
        resolvidoPor: 'atendente_humano',
        scoreAtrito: entrada.score_atrito,
        descricao: observacao || `Atendimento humano concluído por ${entrada.atendente_nome || 'atendente'}`,
      })
    }

    inserirMensagem({
      sessaoId: entrada.sessao_id,
      papel: 'sistema',
      conteudo: `✅ Atendimento encerrado${entrada.protocolo_numero ? ` — protocolo **${protocolo.formatar(entrada.protocolo_numero)}**` : ''}. Obrigado pelo contato!`,
      protocoloNumero: entrada.protocolo_numero,
    })

    return { ok: true }
  } catch (err) {
    console.error('[fila.encerrar]', err.message)
    return { ok: false, erro: err.message }
  }
}

/** Estado da fila para o cliente (posição, espera, atendente). */
function statusSessao(sessaoId) {
  try {
    const db = getDb()
    const entrada = db.prepare(`
      SELECT * FROM fila_atendimento WHERE sessao_id = ? ORDER BY entrou_em DESC LIMIT 1
    `).get(sessaoId)
    if (!entrada) return { na_fila: false }

    const comPos = comPosicao(entrada)
    return {
      na_fila: entrada.status === 'aguardando',
      em_atendimento: entrada.status === 'em_atendimento',
      encerrado: entrada.status === 'encerrado',
      fila_id: entrada.id,
      posicao: comPos.posicao,
      espera_estimada_min: comPos.espera_estimada_min,
      prioridade: entrada.prioridade,
      atendente: entrada.atendente_nome,
      protocolo: entrada.protocolo_numero,
      protocolo_formatado: entrada.protocolo_numero ? protocolo.formatar(entrada.protocolo_numero) : null,
    }
  } catch (_) {
    return { na_fila: false }
  }
}

/** Métricas da fila para o painel. */
function metricas() {
  try {
    const db = getDb()
    const aguardando = db.prepare(`SELECT COUNT(*) as n FROM fila_atendimento WHERE status = 'aguardando'`).get()
    const emAtendimento = db.prepare(`SELECT COUNT(*) as n FROM fila_atendimento WHERE status = 'em_atendimento'`).get()
    const encerrados = db.prepare(`SELECT COUNT(*) as n FROM fila_atendimento WHERE status = 'encerrado' AND encerrado_em > datetime('now','-24 hours')`).get()
    const alta = db.prepare(`SELECT COUNT(*) as n FROM fila_atendimento WHERE status = 'aguardando' AND prioridade = 'alta'`).get()
    const churn = db.prepare(`SELECT AVG(COALESCE(risco_churn,0)) as media, MAX(COALESCE(risco_churn,0)) as maximo FROM fila_atendimento WHERE status = 'aguardando'`).get()

    return {
      aguardando: aguardando.n,
      em_atendimento: emAtendimento.n,
      encerrados_24h: encerrados.n,
      prioridade_alta: alta.n,
      churn_medio: Math.round(churn?.media || 0),
      churn_maximo: Math.round(churn?.maximo || 0),
      espera_media_min: Math.max(1, Math.round(aguardando.n * TMA_MINUTOS)),
    }
  } catch (_) {
    return { aguardando: 0, em_atendimento: 0, encerrados_24h: 0, prioridade_alta: 0, churn_medio: 0, churn_maximo: 0, espera_media_min: 0 }
  }
}

module.exports = {
  entrar,
  listar,
  facetas,
  tipoServicoDe,
  ROTULO_TIPO_SERVICO,
  assumir,
  mensagemAtendente,
  mensagemCliente,
  encerrar,
  statusSessao,
  metricas,
  prioridadeDe,
  TMA_MINUTOS,
}
