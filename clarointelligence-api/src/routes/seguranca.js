// Painel de segurança da IA — auditoria das tentativas de manipulação
// do assistente e das falhas de verificação em duas etapas.

const { Router } = require('express')
const { getDb } = require('../database')
const guardrails = require('../services/guardrails')

const router = Router()

/** Eventos recentes com filtros. ?tipo= &severidade= &limite= */
router.get('/eventos', (req, res) => {
  try {
    const db = getDb()
    const { tipo, severidade } = req.query
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 50, 1), 200)

    const where = []
    const params = []
    if (tipo) { where.push('e.tipo = ?'); params.push(tipo) }
    if (severidade) { where.push('e.severidade = ?'); params.push(severidade) }
    const clausula = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const itens = db.prepare(`
      SELECT e.*, c.nome as cliente_nome
      FROM eventos_seguranca e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      ${clausula}
      ORDER BY e.created_at DESC
      LIMIT ?
    `).all(...params, limite)

    res.json(itens)
  } catch (err) {
    console.error('[seguranca.eventos]', err)
    res.status(500).json({ erro: 'Falha ao carregar eventos de segurança' })
  }
})

/** Resumo para os cartões do painel. */
router.get('/resumo', (_req, res) => {
  try {
    const db = getDb()
    const porTipo = db.prepare(`
      SELECT tipo, COUNT(*) as total FROM eventos_seguranca GROUP BY tipo ORDER BY total DESC
    `).all()
    const porSeveridade = db.prepare(`
      SELECT severidade, COUNT(*) as total FROM eventos_seguranca GROUP BY severidade
    `).all()
    const ultimas24h = db.prepare(`
      SELECT COUNT(*) as n FROM eventos_seguranca WHERE created_at > datetime('now','-24 hours')
    `).get()
    const bloqueados = db.prepare(`
      SELECT COUNT(*) as n FROM eventos_seguranca WHERE acao = 'bloqueado'
    `).get()
    const verificacoes = db.prepare(`
      SELECT status, COUNT(*) as total FROM verificacoes GROUP BY status
    `).all()

    res.json({
      total_eventos: porTipo.reduce((a, t) => a + t.total, 0),
      bloqueados: bloqueados.n,
      ultimas_24h: ultimas24h.n,
      por_tipo: porTipo,
      por_severidade: porSeveridade,
      verificacoes_2fa: verificacoes,
    })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao carregar resumo de segurança' })
  }
})

/** Padrões monitorados — o que a camada de guardrails cobre hoje. */
router.get('/politicas', (_req, res) => {
  res.json({
    padroes_monitorados: guardrails.PADROES.map(p => ({
      nome: p.nome, tipo: p.tipo, severidade: p.severidade,
    })),
    intencoes_permitidas: guardrails.INTENCOES_PERMITIDAS,
    camadas: [
      { ordem: 1, nome: 'Entrada', descricao: 'Classifica a mensagem antes de qualquer processamento. Ataque não chega ao resolver de produto, aos adaptadores nem ao provedor de LLM.' },
      { ordem: 2, nome: 'Escopo', descricao: 'Só as intenções do catálogo são atendidas; o resto é redirecionado em vez de improvisado.' },
      { ordem: 3, nome: 'Saída', descricao: 'Redige CPF, cartão e e-mail de terceiros que porventura apareçam na resposta.' },
    ],
  })
})

module.exports = router
