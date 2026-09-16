const express = require('express')
const cors = require('cors')
const { getDb } = require('./database')

const chatRouter = require('./routes/chat')
const clientesRouter = require('./routes/clientes')
const dashboardRouter = require('./routes/dashboard')
const produtosRouter = require('./routes/produtos')
const filaRouter = require('./routes/fila')
const protocolosRouter = require('./routes/protocolos')
const segurancaRouter = require('./routes/seguranca')
const { router: conversasRouter } = require('./routes/conversas')

const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: CORS_ORIGIN, methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true }))
app.use(express.json({ limit: '128kb' }))

// Rate limit em memória, em dois níveis.
//
// O painel faz polling legítimo e intenso (fila, monitor e estado da sessão),
// então um teto único baixo derrubaria a própria operação. O que precisa de
// limite apertado é o endpoint caro e abusável: o pipeline de chat, que roda
// resolver, adaptadores e geração de resposta a cada chamada.
//
// Em produção isso vive na borda (API gateway), não no processo da aplicação.
const JANELA_MS = 60_000
const LIMITE_GERAL = 600   // leitura de painel: generoso
const LIMITE_CHAT = 60     // pipeline completo: restrito (ninguém digita 60 msg/min)

const janelas = new Map()

function limitar(chave, limite) {
  const agora = Date.now()
  const registro = janelas.get(chave)

  if (!registro || agora - registro.inicio > JANELA_MS) {
    janelas.set(chave, { inicio: agora, contador: 1 })
    return true
  }

  registro.contador += 1
  return registro.contador <= limite
}

app.use('/api', (req, res, next) => {
  const ip = req.ip || 'desconhecido'

  // O pipeline de chat tem contador próprio, mais apertado.
  // Dentro de app.use('/api'), req.path é relativo ao mount — daí '/chat/mensagem'.
  const ehChat = req.method === 'POST' && req.path === '/chat/mensagem'
  if (ehChat && !limitar(`chat:${ip}`, LIMITE_CHAT)) {
    return res.status(429).json({ erro: 'Muitas mensagens em sequência. Aguarde alguns instantes.' })
  }

  if (!limitar(`geral:${ip}`, LIMITE_GERAL)) {
    return res.status(429).json({ erro: 'Muitas requisições. Aguarde alguns instantes.' })
  }

  next()
})

// Limpeza periódica das janelas expiradas
setInterval(() => {
  const agora = Date.now()
  for (const [chave, registro] of janelas) {
    if (agora - registro.inicio > JANELA_MS) janelas.delete(chave)
  }
}, JANELA_MS).unref()

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`)
  next()
})

app.get('/api/health', (_req, res) => {
  const db = getDb()
  const clientes = db.prepare('SELECT COUNT(*) as n FROM clientes').get()
  const sessoes = db.prepare('SELECT COUNT(*) as n FROM sessoes').get()
  const protocolos = db.prepare('SELECT COUNT(*) as n FROM protocolos').get()

  res.json({
    status: 'ok',
    versao: '2.0.0',
    timestamp: new Date().toISOString(),
    db: { clientes: clientes.n, sessoes: sessoes.n, protocolos: protocolos.n },
    modulos: {
      claroSense: 'ativo',
      claroMemory: 'ativo',
      personaEngine: 'ativo (4 personas + dicionário)',
      productResolver: 'ativo',
      protocolo: 'ativo',
      verificacao2fa: 'ativo',
      guardrails: 'ativo',
      filaAtendimento: 'ativo',
      autoatendimento: 'ativo',
      llmProvider: 'simulado-deterministico',
    },
  })
})

app.use('/api/chat', chatRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/produtos', produtosRouter)
app.use('/api/conversas', conversasRouter)
app.use('/api/fila', filaRouter)
app.use('/api/protocolos', protocolosRouter)
app.use('/api/seguranca', segurancaRouter)

app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }))

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err)
  // Detalhe da exceção fica só no log do servidor, nunca na resposta
  res.status(500).json({ erro: 'Erro interno do servidor' })
})

app.listen(PORT, () => {
  console.log(`\n┌──────────────────────────────────────────────────┐`)
  console.log(`│  ClaroIntelligence API  •  porta ${PORT}             │`)
  console.log(`│  LLM: simulado-deterministico                    │`)
  console.log(`│  DB: SQLite (clarointelligence.sqlite)           │`)
  console.log(`│  Guardrails: ativo  •  2FA: ativo                │`)
  console.log(`│  CORS: ${CORS_ORIGIN}              │`)
  console.log(`└──────────────────────────────────────────────────┘\n`)
  console.log(`  GET  http://localhost:${PORT}/api/health`)
  console.log(`  POST http://localhost:${PORT}/api/chat/mensagem`)
  console.log(`  GET  http://localhost:${PORT}/api/fila`)
  console.log(`  GET  http://localhost:${PORT}/api/seguranca/resumo\n`)
})
