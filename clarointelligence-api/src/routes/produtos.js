const { Router } = require('express')
const { getDb } = require('../database')
const { getConfig, getConfig: getPersonasConfig } = require('../services/personaEngine')

const router = Router()

router.get('/catalogo', (req, res) => {
  const db = getDb()
  const { linha } = req.query
  let query = 'SELECT * FROM produtos_catalogo WHERE ativo = 1'
  const params = []
  if (linha) { query += ' AND linha = ?'; params.push(linha) }
  res.json(db.prepare(query).all(...params))
})

router.get('/personas/config', (req, res) => {
  res.json(getConfig())
})

router.put('/personas/config', (req, res) => {
  const { limiar_digital, limiar_assistido, sensibilidade, delay_interv } = req.body
  const db = getDb()
  db.prepare(`UPDATE personas_config SET limiar_digital = ?, limiar_assistido = ?, sensibilidade = ?, delay_interv = ?, updated_at = datetime('now') WHERE id = 1`).run(limiar_digital, limiar_assistido, sensibilidade, delay_interv)
  res.json({ ok: true })
})

module.exports = router
