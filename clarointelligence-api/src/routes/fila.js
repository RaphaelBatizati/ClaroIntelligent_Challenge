// Rotas da fila de atendimento humano e do Console do Atendente.
// É o outro lado do transbordo: onde uma pessoa real assume a conversa.

const { Router } = require('express')
const { getDb } = require('../database')
const fila = require('../services/fila')
const protocoloSvc = require('../services/protocolo')

const router = Router()

const STATUS = ['aguardando', 'em_atendimento', 'encerrado']
const GRAVIDADE = ['alta', 'media', 'baixa']
const TIPOS = Object.keys(fila.ROTULO_TIPO_SERVICO)
const CANAIS = ['site', 'app', 'whatsapp', 'callcenter']

/**
 * Fila para o console.
 * Filtros: status, gravidade (alta|media|baixa), tipo_servico, canal, churn_min.
 * Cada valor passa por allowlist antes de chegar na query.
 */
router.get('/', (req, res) => {
  try {
    const { status, gravidade, tipo_servico, canal, churn_min } = req.query

    const filtros = {
      status: STATUS.includes(status) ? status : null,
      gravidade: GRAVIDADE.includes(gravidade) ? gravidade : null,
      tipo_servico: TIPOS.includes(tipo_servico) ? tipo_servico : null,
      canal: CANAIS.includes(canal) ? canal : null,
      churn_min: churn_min ? Number(churn_min) : null,
    }

    res.json({
      metricas: fila.metricas(),
      filtros_aplicados: Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)),
      facetas: fila.facetas(filtros),
      tipos_servico: fila.ROTULO_TIPO_SERVICO,
      itens: fila.listar(filtros),
    })
  } catch (err) {
    console.error('[fila.listar]', err)
    res.status(500).json({ erro: 'Falha ao carregar a fila' })
  }
})

/** Métricas isoladas (cartões do painel). */
router.get('/metricas', (_req, res) => {
  res.json(fila.metricas())
})

/** Entrada manual na fila — usada pelo botão "falar com atendente" do chat. */
router.post('/entrar', (req, res) => {
  const { sessao_id, cliente_id, canal, motivo, score_atrito, risco_churn, intencao, protocolo_numero } = req.body
  if (!sessao_id || !cliente_id) {
    return res.status(400).json({ erro: 'sessao_id e cliente_id são obrigatórios' })
  }

  const entrada = fila.entrar({
    sessaoId: sessao_id,
    clienteId: cliente_id,
    canal: canal || 'site',
    motivo: motivo || 'Cliente solicitou atendimento humano',
    scoreAtrito: Number(score_atrito) || 0,
    riscoChurn: Number(risco_churn) || 0,
    intencao: intencao || null,
    protocoloNumero: protocolo_numero || null,
  })

  if (!entrada) return res.status(500).json({ erro: 'Falha ao entrar na fila' })
  res.json(entrada)
})

/** Conversa completa que o atendente vê ao abrir um item da fila. */
router.get('/:id/conversa', (req, res) => {
  try {
    const db = getDb()
    const entrada = db.prepare('SELECT * FROM fila_atendimento WHERE id = ?').get(req.params.id)
    if (!entrada) return res.status(404).json({ erro: 'Atendimento não encontrado' })

    const cliente = db.prepare('SELECT id, nome, email, telefone, cpf_mascara, perfil_persona FROM clientes WHERE id = ?').get(entrada.cliente_id)
    const mensagens = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(entrada.sessao_id)
    const sinais = db.prepare('SELECT tipo, valor, created_at FROM sinais_atrito WHERE sessao_id = ? ORDER BY created_at').all(entrada.sessao_id)
    const sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(entrada.sessao_id)
    const portfolio = db.prepare(`
      SELECT c.plano_nome, c.valor_mensal, p.nome as produto_nome, p.linha
      FROM contratos c JOIN produtos_catalogo p ON c.produto_codigo = p.codigo
      WHERE c.cliente_id = ? AND c.status = 'ativo'
    `).all(entrada.cliente_id)

    const protocolo = entrada.protocolo_numero ? protocoloSvc.buscar(entrada.protocolo_numero) : null

    res.json({
      entrada: { ...entrada, resumo: entrada.resumo_contexto ? JSON.parse(entrada.resumo_contexto) : null },
      cliente,
      sessao,
      portfolio,
      protocolo,
      sinais_atrito: sinais,
      mensagens,
    })
  } catch (err) {
    console.error('[fila.conversa]', err)
    res.status(500).json({ erro: 'Falha ao carregar a conversa' })
  }
})

/** Atendente assume a conversa. */
router.put('/:id/assumir', (req, res) => {
  const { atendente } = req.body
  const resultado = fila.assumir(req.params.id, atendente || 'Atendente Claro')
  if (!resultado.ok) return res.status(400).json({ erro: resultado.erro })
  res.json(resultado.entrada)
})

/** Atendente humano envia mensagem para o cliente. */
router.post('/:id/mensagem', (req, res) => {
  const { texto, atendente } = req.body
  if (!texto || !String(texto).trim()) return res.status(400).json({ erro: 'texto é obrigatório' })
  if (String(texto).length > 2000) return res.status(400).json({ erro: 'Mensagem excede 2000 caracteres' })

  const resultado = fila.mensagemAtendente(req.params.id, String(texto).trim(), atendente)
  if (!resultado.ok) return res.status(400).json({ erro: resultado.erro })
  res.json(resultado)
})

/** Encerra o atendimento e fecha o protocolo como resolvido por humano. */
router.put('/:id/encerrar', (req, res) => {
  const { observacao, resolvido } = req.body
  const resultado = fila.encerrar(req.params.id, {
    resolvido: resolvido !== false,
    observacao,
  })
  if (!resultado.ok) return res.status(400).json({ erro: resultado.erro })
  res.json({ ok: true })
})

module.exports = router
