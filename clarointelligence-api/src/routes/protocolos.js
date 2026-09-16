// Rotas de protocolo de atendimento.
// O protocolo é a chave de busca que o cliente informa em qualquer canal e
// que o painel usa para localizar um atendimento entre milhares.

const { Router } = require('express')
const { getDb } = require('../database')
const protocoloSvc = require('../services/protocolo')

const router = Router()

/**
 * Lista com filtros — pensada para volume real de operação.
 * ?busca= &canal= &status= &tipo= &data_inicio= &data_fim= &pagina= &limite=
 */
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { busca, canal, status, tipo, resolvido_por, data_inicio, data_fim } = req.query
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1)
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 25, 1), 100)

    const where = []
    const params = []

    if (busca) {
      // Busca por número de protocolo (com ou sem pontuação), nome ou assunto
      const limpo = String(busca).replace(/\D/g, '')
      where.push(`(p.numero LIKE ? OR c.nome LIKE ? OR p.assunto LIKE ?)`)
      params.push(`%${limpo || busca}%`, `%${busca}%`, `%${busca}%`)
    }
    if (canal) { where.push('(p.canal_origem = ? OR p.canal_atual = ?)'); params.push(canal, canal) }
    if (status) { where.push('p.status = ?'); params.push(status) }
    if (tipo) { where.push('p.tipo = ?'); params.push(tipo) }
    if (resolvido_por) { where.push('p.resolvido_por = ?'); params.push(resolvido_por) }
    if (data_inicio) { where.push('date(p.created_at) >= date(?)'); params.push(data_inicio) }
    if (data_fim) { where.push('date(p.created_at) <= date(?)'); params.push(data_fim) }

    const clausula = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const total = db.prepare(`
      SELECT COUNT(*) as n FROM protocolos p LEFT JOIN clientes c ON p.cliente_id = c.id ${clausula}
    `).get(...params)

    const rows = db.prepare(`
      SELECT p.*, c.nome as cliente_nome, pr.nome as produto_nome
      FROM protocolos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN produtos_catalogo pr ON p.produto_codigo = pr.codigo
      ${clausula}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limite, (pagina - 1) * limite)

    res.json({
      total: total.n,
      pagina,
      limite,
      paginas: Math.ceil(total.n / limite),
      itens: rows.map(p => ({ ...p, numero_formatado: protocoloSvc.formatar(p.numero) })),
    })
  } catch (err) {
    console.error('[protocolos.listar]', err)
    res.status(500).json({ erro: 'Falha ao listar protocolos' })
  }
})

/** Detalhe do protocolo com a linha do tempo completa da jornada. */
router.get('/:numero', (req, res) => {
  try {
    const proto = protocoloSvc.buscar(req.params.numero)
    if (!proto) return res.status(404).json({ erro: 'Protocolo não encontrado' })

    const db = getDb()
    const cliente = db.prepare('SELECT id, nome, cpf_mascara, perfil_persona FROM clientes WHERE id = ?').get(proto.cliente_id)
    const mensagens = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(proto.sessao_id)

    res.json({ ...proto, cliente, mensagens })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao carregar protocolo' })
  }
})

/** Protocolos em aberto de um cliente — base da continuidade cross-canal. */
router.get('/cliente/:clienteId/abertos', (req, res) => {
  try {
    res.json(protocoloSvc.protocolosAbertos(req.params.clienteId, req.query.canal))
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao consultar protocolos do cliente' })
  }
})

module.exports = router
