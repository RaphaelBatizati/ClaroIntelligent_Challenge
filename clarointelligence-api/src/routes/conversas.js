// Monitor de Conversas — busca e filtros pensados para volume de operação.
//
// Um atendimento real registra milhares de interações por dia, então listar
// "as últimas 30" não resolve: é preciso achar UMA conversa específica. Os
// filtros cobrem as perguntas que a operação realmente faz — de onde veio,
// quando, sobre qual produto, em que estado, e qual o protocolo.

const { Router } = require('express')
const { getDb } = require('../database')
const protocoloSvc = require('../services/protocolo')

const router = Router()

const CANAIS = ['site', 'app', 'whatsapp', 'callcenter']
const STATUS = ['ativa', 'transferida', 'em_atendimento_humano', 'encerrada']

/**
 * GET /api/conversas
 * Filtros: busca, canal, status, linha, persona, protocolo,
 *          data_inicio, data_fim (YYYY-MM-DD),
 *          hora_inicio, hora_fim (HH:MM),
 *          score_min, score_max, risco,
 *          ordenar (recentes|score|duracao), pagina, limite
 */
/**
 * Monta a cláusula WHERE a partir dos filtros da query.
 *
 * `ignorar` permite excluir UMA dimensão do recorte — é o que faz as facetas
 * ficarem honestas: a contagem ao lado de "Call Center" considera todos os
 * outros filtros ativos, mas não o filtro de canal, senão ela só poderia
 * mostrar o canal já selecionado.
 */
function montarFiltros(query, ignorar = null) {
  const {
    busca, canal, status, linha, persona, protocolo,
    data_inicio, data_fim, hora_inicio, hora_fim,
    score_min, score_max, risco,
  } = query

  const where = []
  const params = []
  const usar = (dim) => ignorar !== dim

  if (busca) {
    const digitos = String(busca).replace(/\D/g, '')
    where.push(`(c.nome LIKE ? OR s.id LIKE ? OR s.protocolo_numero LIKE ? OR p.nome LIKE ?)`)
    params.push(`%${busca}%`, `%${busca}%`, `%${digitos || busca}%`, `%${busca}%`)
  }
  if (protocolo) {
    where.push('s.protocolo_numero LIKE ?')
    params.push(`%${String(protocolo).replace(/\D/g, '')}%`)
  }
  if (usar('canal') && canal && CANAIS.includes(canal)) { where.push('s.canal = ?'); params.push(canal) }
  if (usar('status') && status && STATUS.includes(status)) { where.push('s.status = ?'); params.push(status) }
  if (usar('linha') && linha) { where.push('p.linha = ?'); params.push(linha) }
  if (usar('persona') && persona) { where.push('c.perfil_persona = ?'); params.push(persona) }

  // Data: compara só a parte da data, ignorando o horário
  if (data_inicio) { where.push('date(s.created_at) >= date(?)'); params.push(data_inicio) }
  if (data_fim) { where.push('date(s.created_at) <= date(?)'); params.push(data_fim) }

  // Hora: faixa do dia (ex.: só o pico das 18h às 20h), independente da data
  if (hora_inicio) { where.push('time(s.created_at) >= time(?)'); params.push(normalizarHora(hora_inicio)) }
  if (hora_fim) { where.push('time(s.created_at) <= time(?)'); params.push(normalizarHora(hora_fim)) }

  if (usar('risco')) {
    if (score_min) { where.push('s.score_atrito >= ?'); params.push(Number(score_min)) }
    if (score_max) { where.push('s.score_atrito <= ?'); params.push(Number(score_max)) }

    // Atalho de faixa de risco, alinhado aos limiares do ClaroSense
    if (risco === 'normal') where.push('s.score_atrito < 40')
    if (risco === 'alerta') where.push('s.score_atrito >= 40 AND s.score_atrito < 65')
    if (risco === 'risco') where.push('s.score_atrito >= 65 AND s.score_atrito < 80')
    if (risco === 'transbordo') where.push('s.score_atrito >= 80')
  }

  return {
    where,
    params,
    clausula: where.length ? `WHERE ${where.join(' AND ')}` : '',
  }
}

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const {
      busca, canal, status, linha, persona, protocolo,
      data_inicio, data_fim, hora_inicio, hora_fim, risco, ordenar = 'recentes',
    } = req.query

    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1)
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 24, 1), 100)

    const { params, clausula } = montarFiltros(req.query)


    const ordem = {
      recentes: 's.updated_at DESC',
      score: 's.score_atrito DESC, s.updated_at DESC',
      antigas: 's.created_at ASC',
      duracao: "(julianday('now') - julianday(s.created_at)) DESC",
    }[ordenar] || 's.updated_at DESC'

    const baseFrom = `
      FROM sessoes s
      JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN produtos_catalogo p ON s.produto_codigo_foco = p.codigo
      ${clausula}
    `

    const total = db.prepare(`SELECT COUNT(*) as n ${baseFrom}`).get(...params)

    const rows = db.prepare(`
      SELECT s.*, c.nome as cliente_nome, c.perfil_persona,
             p.nome as produto_nome, p.linha as produto_linha
      ${baseFrom}
      ORDER BY ${ordem}
      LIMIT ? OFFSET ?
    `).all(...params, limite, (pagina - 1) * limite)

    const itens = rows.map(s => {
      const ultimaMsg = db.prepare(`
        SELECT conteudo FROM mensagens WHERE sessao_id = ? AND papel = 'cliente' ORDER BY created_at DESC LIMIT 1
      `).get(s.id)
      const totalMsgs = db.prepare('SELECT COUNT(*) as n FROM mensagens WHERE sessao_id = ?').get(s.id)

      return {
        id: s.id,
        cliente: { id: s.cliente_id, nome: s.cliente_nome, persona: s.perfil_persona },
        canal: s.canal,
        produto: { codigo: s.produto_codigo_foco, nome: s.produto_nome, linha: s.produto_linha },
        protocolo: s.protocolo_numero,
        protocolo_formatado: s.protocolo_numero ? protocoloSvc.formatar(s.protocolo_numero) : null,
        score_atrito: s.score_atrito,
        risco_churn: s.risco_churn || 0,
        nivel: nivelDoScore(s.score_atrito),
        status: s.status,
        verificado: s.verificado === 1,
        ultima_mensagem: ultimaMsg?.conteudo?.slice(0, 100) || '',
        total_mensagens: totalMsgs.n,
        tempo_aberto: Math.round((Date.now() - new Date(s.created_at + ' UTC').getTime()) / 60000),
        created_at: s.created_at,
        updated_at: s.updated_at,
      }
    })

    res.json({
      total: total.n,
      pagina,
      limite,
      paginas: Math.ceil(total.n / limite) || 1,
      filtros_aplicados: Object.fromEntries(
        Object.entries({ busca, canal, status, linha, persona, protocolo, data_inicio, data_fim, hora_inicio, hora_fim, risco })
          .filter(([, v]) => v)
      ),
      itens,
    })
  } catch (err) {
    console.error('[conversas.listar]', err)
    res.status(500).json({ erro: 'Falha ao listar conversas' })
  }
})

/**
 * Contagens por dimensão — alimentam os contadores de cada botão de filtro.
 *
 * Cada dimensão é contada com TODOS os outros filtros aplicados, menos o dela
 * própria. Sem isso o painel mente: você filtra WhatsApp e continua vendo
 * "Call Center (81)" num resultado onde nenhuma das 81 aparece.
 */
router.get('/facetas', (req, res) => {
  try {
    const db = getDb()

    const base = (clausula) => `
      FROM sessoes s
      JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN produtos_catalogo p ON s.produto_codigo_foco = p.codigo
      ${clausula}
    `

    const contar = (dimensao, expressao, extraJoin = '') => {
      const { params, clausula } = montarFiltros(req.query, dimensao)
      return db.prepare(`
        SELECT ${expressao} as chave, COUNT(*) as total
        ${base(clausula)} ${extraJoin}
        GROUP BY chave
      `).all(...params)
    }

    const porCanal = contar('canal', 's.canal')
    const porStatus = contar('status', 's.status')
    const porPersona = contar('persona', 'c.perfil_persona')
    const porLinha = contar('linha', 'p.linha').filter(r => r.chave)
    const porRisco = contar('risco', `CASE
      WHEN s.score_atrito >= 80 THEN 'transbordo'
      WHEN s.score_atrito >= 65 THEN 'risco'
      WHEN s.score_atrito >= 40 THEN 'alerta'
      ELSE 'normal' END`)

    // Distribuição por hora do dia — mostra o pico de demanda dentro do recorte
    const { params, clausula } = montarFiltros(req.query)
    const porHora = db.prepare(`
      SELECT strftime('%H', s.created_at) as chave, COUNT(*) as total
      ${base(clausula)} GROUP BY chave ORDER BY chave
    `).all(...params)

    const total = db.prepare(`SELECT COUNT(*) as n ${base(clausula)}`).get(...params)

    res.json({ total: total.n, canal: porCanal, status: porStatus, persona: porPersona, linha: porLinha, risco: porRisco, hora: porHora })
  } catch (err) {
    console.error('[conversas.facetas]', err)
    res.status(500).json({ erro: 'Falha ao calcular facetas' })
  }
})

/** Detalhe completo de uma conversa. */
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const s = db.prepare(`
      SELECT s.*, c.nome as cliente_nome, c.email, c.telefone, c.cpf_mascara, c.perfil_persona,
             p.nome as produto_nome, p.linha as produto_linha
      FROM sessoes s
      JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN produtos_catalogo p ON s.produto_codigo_foco = p.codigo
      WHERE s.id = ?
    `).get(req.params.id)
    if (!s) return res.status(404).json({ erro: 'Sessão não encontrada' })

    const mensagens = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(req.params.id)
    const sinais = db.prepare('SELECT * FROM sinais_atrito WHERE sessao_id = ? ORDER BY created_at').all(req.params.id)
    const intervencoes = db.prepare('SELECT * FROM intervencoes WHERE sessao_id = ?').all(req.params.id)
    const memoria = db.prepare('SELECT * FROM memoria_conversacional WHERE sessao_id = ?').all(req.params.id)
    const protocolo = s.protocolo_numero ? protocoloSvc.buscar(s.protocolo_numero) : null
    const eventosSeguranca = db.prepare('SELECT * FROM eventos_seguranca WHERE sessao_id = ? ORDER BY created_at').all(req.params.id)

    res.json({
      sessao: { ...s, protocolo_formatado: s.protocolo_numero ? protocoloSvc.formatar(s.protocolo_numero) : null },
      mensagens,
      sinais_atrito: sinais,
      intervencoes,
      memoria,
      protocolo,
      eventos_seguranca: eventosSeguranca,
    })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao carregar conversa' })
  }
})

router.put('/:id/transferir', (req, res) => {
  try {
    const db = getDb()
    db.prepare(`UPDATE sessoes SET status = 'transferida', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao transferir' })
  }
})

router.put('/:id/encerrar', (req, res) => {
  try {
    const db = getDb()
    db.prepare(`UPDATE sessoes SET status = 'encerrada', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao encerrar' })
  }
})

// ─── SSE para atualização ao vivo do monitor ────────────────────────────────
const sseClients = new Set()

router.get('/eventos/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write('data: {"tipo":"conectado"}\n\n')
  sseClients.add(res)

  const ping = setInterval(() => {
    try { res.write(': ping\n\n') } catch (_) { clearInterval(ping) }
  }, 30000)

  req.on('close', () => {
    clearInterval(ping)
    sseClients.delete(res)
  })
})

function broadcast(dados) {
  const payload = `data: ${JSON.stringify(dados)}\n\n`
  for (const client of sseClients) {
    try { client.write(payload) } catch (_) { sseClients.delete(client) }
  }
}

function nivelDoScore(score) {
  if (score >= 80) return 'transbordo'
  if (score >= 65) return 'risco'
  if (score >= 40) return 'alerta'
  return 'normal'
}

function normalizarHora(h) {
  const m = String(h).match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return '00:00:00'
  return `${m[1].padStart(2, '0')}:${m[2] || '00'}:00`
}

module.exports = { router, broadcast }
