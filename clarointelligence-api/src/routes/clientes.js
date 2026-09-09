const { Router } = require('express')
const { getDb } = require('../database')

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const clientes = db.prepare('SELECT id, nome, email, telefone, cpf_mascara, perfil_persona FROM clientes ORDER BY nome').all()
  res.json(clientes)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id)
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' })
  res.json(cliente)
})

router.get('/:id/portfolio', (req, res) => {
  const db = getDb()
  const contratos = db.prepare(`
    SELECT c.*, p.nome as produto_nome, p.linha as produto_linha, p.familia
    FROM contratos c
    JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
    WHERE c.cliente_id = ? AND c.status = 'ativo'
    ORDER BY p.linha
  `).all(req.params.id)
  res.json(contratos)
})

router.get('/:id/sessoes', (req, res) => {
  const db = getDb()
  const sessoes = db.prepare('SELECT * FROM sessoes WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 10').all(req.params.id)
  res.json(sessoes)
})

module.exports = router
