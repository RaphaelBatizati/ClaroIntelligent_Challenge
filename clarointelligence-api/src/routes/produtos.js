const { Router } = require('express')
const { getDb } = require('../database')
const personaEngine = require('../services/personaEngine')
const claroSense = require('../services/claroSense')

const router = Router()

/** Catálogo de produtos. ?linha= &segmento= */
router.get('/catalogo', (req, res) => {
  try {
    const db = getDb()
    const { linha, segmento } = req.query
    const where = ['ativo = 1']
    const params = []
    if (linha) { where.push('linha = ?'); params.push(linha) }
    if (segmento) { where.push('segmento = ?'); params.push(segmento) }

    const rows = db.prepare(`SELECT * FROM produtos_catalogo WHERE ${where.join(' AND ')} ORDER BY linha, valor_referencia`).all(...params)
    res.json(rows.map(p => ({ ...p, beneficios: p.beneficios ? JSON.parse(p.beneficios) : [] })))
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao carregar catálogo' })
  }
})

// ─── Configuração do Persona Engine ─────────────────────────────────────────

router.get('/personas/config', (_req, res) => {
  res.json(personaEngine.getConfig())
})

router.put('/personas/config', (req, res) => {
  try {
    const { limiar_digital, limiar_assistido, sensibilidade, delay_interv } = req.body

    // Validação de payload: o painel envia sliders, mas a API não confia neles
    const campos = { limiar_digital, limiar_assistido, sensibilidade, delay_interv }
    for (const [nome, valor] of Object.entries(campos)) {
      const n = Number(valor)
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        return res.status(400).json({ erro: `${nome} deve ser um inteiro entre 1 e 10` })
      }
    }

    const db = getDb()
    db.prepare(`
      UPDATE personas_config SET limiar_digital = ?, limiar_assistido = ?, sensibilidade = ?, delay_interv = ?, updated_at = datetime('now') WHERE id = 1
    `).run(Number(limiar_digital), Number(limiar_assistido), Number(sensibilidade), Number(delay_interv))

    res.json({ ok: true, config: personaEngine.getConfig() })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao salvar configuração' })
  }
})

// ─── Dicionário léxico das personas ─────────────────────────────────────────

router.get('/personas/dicionario', (req, res) => {
  const { persona } = req.query
  res.json(personaEngine.listarDicionario(persona || null))
})

router.post('/personas/dicionario', (req, res) => {
  const { persona, termo, categoria, peso } = req.body
  const resultado = personaEngine.adicionarTermo({ persona, termo, categoria, peso })
  if (!resultado.ok) return res.status(400).json({ erro: resultado.erro })
  res.status(201).json(resultado)
})

router.delete('/personas/dicionario/:id', (req, res) => {
  const resultado = personaEngine.removerTermo(req.params.id)
  if (!resultado.ok) return res.status(400).json({ erro: resultado.erro })
  res.json({ ok: true })
})

router.put('/personas/dicionario/:id', (req, res) => {
  const resultado = personaEngine.alternarTermo(req.params.id, req.body.ativo)
  if (!resultado.ok) return res.status(400).json({ erro: resultado.erro })
  res.json({ ok: true })
})

/** Classificador ao vivo — usado pelo simulador do painel. */
router.post('/personas/classificar', (req, res) => {
  const { texto } = req.body
  if (!texto) return res.status(400).json({ erro: 'texto é obrigatório' })
  res.json(personaEngine.classificarDoTexto(String(texto).slice(0, 1000)))
})

/** Catálogo de sinais do ClaroSense — documentação viva do painel. */
router.get('/clarosense/sinais', (_req, res) => {
  res.json({ sinais: claroSense.catalogoSinais(), limiares: claroSense.LIMIARES })
})

module.exports = router
