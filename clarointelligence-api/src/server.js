const express = require('express')
const cors = require('cors')
const { getDb } = require('./database')
const chatRouter = require('./routes/chat')
const clientesRouter = require('./routes/clientes')
const dashboardRouter = require('./routes/dashboard')
const produtosRouter = require('./routes/produtos')
const { router: conversasRouter } = require('./routes/conversas')

const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: CORS_ORIGIN, methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true }))
app.use(express.json())

// Logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`)
  next()
})

// Routes
app.get('/api/health', (_req, res) => {
  const db = getDb()
  const clientes = db.prepare('SELECT COUNT(*) as n FROM clientes').get()
  const sessoes = db.prepare('SELECT COUNT(*) as n FROM sessoes').get()
  res.json({
    status: 'ok',
    versao: '1.0.0',
    timestamp: new Date().toISOString(),
    db: { clientes: clientes.n, sessoes: sessoes.n },
    modulos: {
      claroSense: 'ativo',
      claroMemory: 'ativo',
      personaEngine: 'ativo',
      productResolver: 'ativo',
      llmProvider: 'simulado-deterministico',
    },
  })
})

app.use('/api/chat', chatRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/produtos', produtosRouter)
app.use('/api/conversas', conversasRouter)

// 404
app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }))

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err)
  res.status(500).json({ erro: 'Erro interno do servidor' })
})

app.listen(PORT, () => {
  console.log(`\n┌─────────────────────────────────────────────┐`)
  console.log(`│  ClaroIntelligence API  •  porta ${PORT}        │`)
  console.log(`│  LLM: simulado-deterministico               │`)
  console.log(`│  DB: SQLite (clarointelligence.sqlite)      │`)
  console.log(`│  CORS: ${CORS_ORIGIN}         │`)
  console.log(`└─────────────────────────────────────────────┘\n`)
  console.log(`  GET  http://localhost:${PORT}/api/health`)
  console.log(`  POST http://localhost:${PORT}/api/chat/mensagem`)
  console.log(`  GET  http://localhost:${PORT}/api/dashboard/kpis\n`)
})
