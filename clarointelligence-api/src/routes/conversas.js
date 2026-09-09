const { Router } = require('express')
const { getDb } = require('../database')

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const sessoes = db.prepare(`
    SELECT s.*, c.nome as cliente_nome, c.perfil_persona, p.nome as produto_nome, p.linha as produto_linha
    FROM sessoes s
    JOIN clientes c ON s.cliente_id = c.id
    LEFT JOIN produtos_catalogo p ON s.produto_codigo_foco = p.codigo
    WHERE s.created_at > datetime('now', '-2 hours')
    ORDER BY s.updated_at DESC
    LIMIT 30
  `).all()

  const resultado = sessoes.map(s => {
    const ultimaMsg = db.prepare("SELECT conteudo, papel FROM mensagens WHERE sessao_id = ? AND papel = 'cliente' ORDER BY created_at DESC LIMIT 1").get(s.id)
    const totalMsgs = db.prepare("SELECT COUNT(*) as n FROM mensagens WHERE sessao_id = ?").get(s.id)
    return {
      id: s.id,
      cliente: { id: s.cliente_id, nome: s.cliente_nome, persona: s.perfil_persona },
      canal: s.canal,
      produto: { codigo: s.produto_codigo_foco, nome: s.produto_nome, linha: s.produto_linha },
      score_atrito: s.score_atrito,
      status: s.status,
      ultima_mensagem: ultimaMsg?.conteudo?.slice(0, 80) || '',
      total_mensagens: totalMsgs.n,
      tempo_aberto: Math.round((Date.now() - new Date(s.created_at + ' UTC').getTime()) / 60000),
      updated_at: s.updated_at,
    }
  })

  res.json(resultado)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const s = db.prepare(`
    SELECT s.*, c.nome as cliente_nome, c.email, c.telefone, c.perfil_persona, p.nome as produto_nome, p.linha as produto_linha
    FROM sessoes s
    JOIN clientes c ON s.cliente_id = c.id
    LEFT JOIN produtos_catalogo p ON s.produto_codigo_foco = p.codigo
    WHERE s.id = ?
  `).get(req.params.id)
  if (!s) return res.status(404).json({ erro: 'Sessão não encontrada' })

  const msgs = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(req.params.id)
  const sinais = db.prepare('SELECT * FROM sinais_atrito WHERE sessao_id = ? ORDER BY created_at').all(req.params.id)
  const intervencoes = db.prepare('SELECT * FROM intervencoes WHERE sessao_id = ?').all(req.params.id)
  const memoria = db.prepare('SELECT * FROM memoria_conversacional WHERE sessao_id = ?').all(req.params.id)

  res.json({ sessao: s, mensagens: msgs, sinais_atrito: sinais, intervencoes, memoria })
})

router.put('/:id/transferir', (req, res) => {
  const db = getDb()
  db.prepare(`UPDATE sessoes SET status = 'transferida', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

router.put('/:id/encerrar', (req, res) => {
  const db = getDb()
  db.prepare(`UPDATE sessoes SET status = 'encerrada', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// SSE para atualizações em tempo real do monitor
const sseClients = new Set()

router.get('/eventos/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write('data: {"tipo":"conectado"}\n\n')
  sseClients.add(res)

  req.on('close', () => {
    sseClients.delete(res)
  })
})

function broadcast(dados) {
  const payload = `data: ${JSON.stringify(dados)}\n\n`
  for (const client of sseClients) {
    try { client.write(payload) } catch (_) { sseClients.delete(client) }
  }
}

module.exports = { router, broadcast }
