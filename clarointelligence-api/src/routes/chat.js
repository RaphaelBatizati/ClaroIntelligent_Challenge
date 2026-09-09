const { Router } = require('express')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../database')
const { detectIntent } = require('../services/intentDetector')
const { resolver: resolveProduct } = require('../services/productResolver')
const { calcular: calcularAtrito } = require('../services/claroSense')
const { obterPerfil, adaptarTom } = require('../services/personaEngine')
const claroMemory = require('../services/claroMemory')
const llm = require('../services/llm')
const adaptRes = require('../adapters/residencial')
const adaptMov = require('../adapters/movel')
const adaptTv = require('../adapters/tv')

const router = Router()

function obterDadosAdapter(linha, clienteId, intencao, produtoCodigo) {
  if (linha === 'residencial') return adaptRes.obterDados(clienteId, intencao)
  if (linha === 'movel') return adaptMov.obterDados(clienteId, intencao, produtoCodigo)
  if (linha === 'tv') return adaptTv.obterDados(clienteId, intencao)
  return null
}

router.post('/mensagem', (req, res) => {
  try {
    const { cliente_id, canal = 'site', mensagem, sessao_id: sid_existente } = req.body
    if (!cliente_id || !mensagem) return res.status(400).json({ erro: 'cliente_id e mensagem são obrigatórios' })

    const db = getDb()
    const trace_id = uuidv4()

    // 1. Cliente
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente_id)
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' })

    // 2. Sessão
    let sessao = sid_existente ? db.prepare('SELECT * FROM sessoes WHERE id = ?').get(sid_existente) : null
    if (!sessao) {
      const novo_id = uuidv4()
      db.prepare(`INSERT INTO sessoes (id, cliente_id, canal, score_atrito, status, trace_id, created_at, updated_at) VALUES (?, ?, ?, 0, 'ativa', ?, datetime('now'), datetime('now'))`).run(novo_id, cliente_id, canal, trace_id)
      sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(novo_id)
    }

    // 3. Detectar intenção
    let { intencao, confianca } = detectIntent(mensagem)

    // 4. Resolver produto
    const resolucao = resolveProduct(cliente_id, canal, intencao, sessao, mensagem)

    if (resolucao.precisou_perguntar) {
      // Salvar mensagem do cliente + pergunta de desambiguação
      const mid_cli = uuidv4()
      db.prepare(`INSERT INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, confianca_intencao, score_atrito_turno, created_at) VALUES (?, ?, 'cliente', ?, ?, ?, ?, datetime('now'))`).run(mid_cli, sessao.id, mensagem, intencao, confianca, sessao.score_atrito)
      const mid_bot = uuidv4()
      db.prepare(`INSERT INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, score_atrito_turno, created_at) VALUES (?, ?, 'sistema', ?, 'desambiguacao', ?, datetime('now'))`).run(mid_bot, sessao.id, resolucao.resposta_desambiguacao, sessao.score_atrito)

      return res.json({
        sessao_id: sessao.id,
        trace_id,
        resposta: resolucao.resposta_desambiguacao,
        intencao: 'desambiguacao',
        confianca_intencao: 0.95,
        produto_foco: null,
        produto_confirmado: false,
        score_atrito: sessao.score_atrito,
        sinais_atrito: [],
        trechos_memoria: [],
        intervencao: null,
        persona: cliente.perfil_persona,
        aguardando_desambiguacao: true,
      })
    }

    // 5a. Se a intenção atual é 'geral' e havia uma intenção prévia antes da desambiguação, retomá-la
    if (intencao === 'geral') {
      const msgAnterior = db.prepare(`SELECT intencao_codigo FROM mensagens WHERE sessao_id = ? AND papel = 'cliente' AND intencao_codigo != 'geral' AND intencao_codigo IS NOT NULL ORDER BY created_at DESC LIMIT 1`).get(sessao.id)
      if (msgAnterior?.intencao_codigo) {
        intencao = msgAnterior.intencao_codigo
      }
    }

    // 5b. Confirmar produto na sessão
    if (resolucao.produto_foco && !sessao.produto_confirmado) {
      db.prepare(`UPDATE sessoes SET produto_codigo_foco = ?, produto_confirmado = 1, updated_at = datetime('now') WHERE id = ?`).run(resolucao.produto_foco, sessao.id)
      sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(sessao.id)
    }

    // 6. ClaroMemory: recuperar contexto
    const memoria = claroMemory.recuperar(cliente_id, resolucao.produto_foco, intencao)

    // 7. Persona
    const persona = obterPerfil(cliente_id, mensagem)

    // 8. Dados do adapter
    const dados = obterDadosAdapter(resolucao.linha, cliente_id, intencao, resolucao.produto_foco)

    // 9. Gerar resposta LLM simulado
    let resposta = llm.gerar({
      intencao,
      linha: resolucao.linha,
      persona,
      dados,
      nome: cliente.nome,
      portfolio: resolucao.portfolio,
      memoria,
      contexto: memoria.contexto,
    })

    // 10. Adaptar tom baseado em persona
    resposta = adaptarTom(resposta, persona)

    // 11. ClaroSense
    const historico = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(sessao.id)
    const { score, nivel, sinais, intervencao } = calcularAtrito(sessao, mensagem, historico, intencao)

    // Se há intervenção de transbordo, atualizar sessão
    if (intervencao?.tipo === 'transferencia_humano') {
      db.prepare(`UPDATE sessoes SET status = 'transferida', score_atrito = ?, updated_at = datetime('now') WHERE id = ?`).run(score, sessao.id)
      resposta = llm.gerar({ intencao: 'transbordo_humano', linha: resolucao.linha, persona, dados, nome: cliente.nome, portfolio: resolucao.portfolio, memoria, contexto: memoria.contexto })
      // Salvar intervenção
      db.prepare(`INSERT INTO intervencoes (id, sessao_id, tipo, gatilho, acao, resultado, created_at) VALUES (?, ?, ?, ?, ?, 'pendente', datetime('now'))`).run(uuidv4(), sessao.id, intervencao.tipo, intervencao.gatilho, intervencao.acao)
    } else {
      db.prepare(`UPDATE sessoes SET score_atrito = ?, updated_at = datetime('now') WHERE id = ?`).run(score, sessao.id)
    }

    // 12. Salvar mensagens
    const mid_cli = uuidv4()
    db.prepare(`INSERT INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, confianca_intencao, produto_codigo, score_atrito_turno, sinais_atrito, created_at) VALUES (?, ?, 'cliente', ?, ?, ?, ?, ?, ?, datetime('now'))`).run(mid_cli, sessao.id, mensagem, intencao, confianca, resolucao.produto_foco, score, JSON.stringify(sinais))
    const mid_bot = uuidv4()
    db.prepare(`INSERT INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, produto_codigo, score_atrito_turno, memoria_usada, created_at) VALUES (?, ?, 'sistema', ?, ?, ?, ?, ?, datetime('now'))`).run(mid_bot, sessao.id, resposta, intencao, resolucao.produto_foco, score, JSON.stringify(memoria.trechos.map(t => t.id)))

    // 13. Salvar memória (assíncrono)
    setImmediate(() => claroMemory.salvar(cliente_id, sessao.id, canal, resolucao.produto_foco, intencao, mensagem, resposta))

    return res.json({
      sessao_id: sessao.id,
      trace_id,
      resposta,
      intencao,
      confianca_intencao: confianca,
      produto_foco: resolucao.produto_foco,
      produto_confirmado: true,
      linha: resolucao.linha,
      score_atrito: score,
      nivel_atrito: nivel,
      sinais_atrito: sinais,
      trechos_memoria: memoria.trechos,
      intervencao,
      persona,
      aguardando_desambiguacao: false,
    })
  } catch (err) {
    console.error('[chat/mensagem]', err)
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message })
  }
})

// GET mensagens de uma sessão
router.get('/sessoes/:id/mensagens', (req, res) => {
  try {
    const db = getDb()
    const msgs = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(req.params.id)
    res.json(msgs)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

module.exports = router
