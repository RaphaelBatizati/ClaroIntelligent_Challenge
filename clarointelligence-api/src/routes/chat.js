const { Router } = require('express')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../database')

const { detectIntent } = require('../services/intentDetector')
const { resolver: resolveProduct } = require('../services/productResolver')
const { calcular: calcularAtrito } = require('../services/claroSense')
const { obterPerfil, adaptarTom } = require('../services/personaEngine')
const claroMemory = require('../services/claroMemory')
const llm = require('../services/llm')
const guardrails = require('../services/guardrails')
const protocoloSvc = require('../services/protocolo')
const verificacao = require('../services/verificacao')
const fila = require('../services/fila')
const autoatendimento = require('../services/autoatendimento')

const adaptRes = require('../adapters/residencial')
const adaptMov = require('../adapters/movel')
const adaptTv = require('../adapters/tv')
const adaptEmp = require('../adapters/empresas')

const router = Router()

function obterDadosAdapter(linha, clienteId, intencao, produtoCodigo) {
  if (linha === 'residencial') return adaptRes.obterDados(clienteId, intencao, produtoCodigo)
  if (linha === 'movel') return adaptMov.obterDados(clienteId, intencao, produtoCodigo)
  if (linha === 'tv') return adaptTv.obterDados(clienteId, intencao, produtoCodigo)
  if (linha === 'empresas') return adaptEmp.obterDados(clienteId, intencao, produtoCodigo)
  return null
}

function salvarMensagem(db, { sessaoId, papel, conteudo, intencao, confianca, produto, score, sinais, memoria, protocolo, bloqueado }) {
  const id = uuidv4()
  db.prepare(`
    INSERT INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, confianca_intencao, produto_codigo,
                           score_atrito_turno, sinais_atrito, memoria_usada, protocolo_numero, bloqueado_guardrail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id, sessaoId, papel, conteudo,
    intencao || null, confianca ?? null, produto || null,
    score ?? null,
    sinais ? JSON.stringify(sinais) : null,
    memoria ? JSON.stringify(memoria) : null,
    protocolo || null,
    bloqueado ? 1 : 0
  )
  return id
}

router.post('/mensagem', (req, res) => {
  try {
    const { cliente_id, canal = 'site', mensagem, sessao_id: sidExistente } = req.body
    if (!cliente_id || !mensagem) {
      return res.status(400).json({ erro: 'cliente_id e mensagem são obrigatórios' })
    }
    if (String(mensagem).length > 2000) {
      return res.status(400).json({ erro: 'Mensagem excede o limite de 2000 caracteres' })
    }

    const db = getDb()
    const traceId = uuidv4()

    // ── 1. Cliente ──────────────────────────────────────────────────────────
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente_id)
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' })

    // ── 2. Sessão ───────────────────────────────────────────────────────────
    let sessao = sidExistente ? db.prepare('SELECT * FROM sessoes WHERE id = ?').get(sidExistente) : null
    if (!sessao) {
      const novoId = uuidv4()
      db.prepare(`
        INSERT INTO sessoes (id, cliente_id, canal, score_atrito, status, trace_id, created_at, updated_at)
        VALUES (?, ?, ?, 0, 'ativa', ?, datetime('now'), datetime('now'))
      `).run(novoId, cliente_id, canal, traceId)
      sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(novoId)
    }

    // ── 3. GUARDRAILS — antes de qualquer processamento ─────────────────────
    // Se a mensagem é um ataque, ela morre aqui: não chega no resolver de
    // produto, não toca em adaptador e não alcança o provedor de LLM.
    const guard = guardrails.analisarEntrada(mensagem, {
      sessaoId: sessao.id, clienteId: cliente_id, canal,
    })

    if (guard.bloqueado) {
      salvarMensagem(db, { sessaoId: sessao.id, papel: 'cliente', conteudo: mensagem, intencao: 'bloqueada', protocolo: sessao.protocolo_numero, bloqueado: true })
      salvarMensagem(db, { sessaoId: sessao.id, papel: 'sistema', conteudo: guard.resposta, intencao: 'guardrail', protocolo: sessao.protocolo_numero })

      return res.json({
        sessao_id: sessao.id,
        trace_id: traceId,
        resposta: guard.resposta,
        intencao: 'bloqueada_guardrail',
        confianca_intencao: 1,
        bloqueado_guardrail: true,
        guardrail: { tipo: guard.tipo, severidade: guard.severidade, padrao: guard.padrao },
        score_atrito: sessao.score_atrito,
        sinais_atrito: [],
        trechos_memoria: [],
        intervencao: null,
        persona: cliente.perfil_persona,
        protocolo: sessao.protocolo_numero ? protocoloSvc.formatar(sessao.protocolo_numero) : null,
      })
    }

    // ── 4. Atendimento humano em curso: a IA sai do caminho ─────────────────
    const statusFila = fila.statusSessao(sessao.id)
    if (statusFila.na_fila || statusFila.em_atendimento) {
      fila.mensagemCliente(sessao.id, mensagem)
      return res.json({
        sessao_id: sessao.id,
        trace_id: traceId,
        modo: 'atendimento_humano',
        resposta: null,
        fila: statusFila,
        protocolo: statusFila.protocolo_formatado,
        persona: cliente.perfil_persona,
        score_atrito: sessao.score_atrito,
        sinais_atrito: [],
        trechos_memoria: [],
        intervencao: null,
      })
    }

    // ── 5. Intenção ─────────────────────────────────────────────────────────
    let { intencao, confianca, confirmacao, negacao } = detectIntent(mensagem)

    // ── 6. Verificação em duas etapas pendente ──────────────────────────────
    const estadoVerif = verificacao.statusSessao(sessao.id)
    if (estadoVerif.desafio_pendente) {
      const codigo = verificacao.extrairCodigo(mensagem)

      if (codigo) {
        const resultado = verificacao.validar({ verificacaoId: estadoVerif.desafio_pendente.id, codigo })
        salvarMensagem(db, { sessaoId: sessao.id, papel: 'cliente', conteudo: '••••••', intencao: 'codigo_verificacao', protocolo: sessao.protocolo_numero })

        if (!resultado.ok) {
          salvarMensagem(db, { sessaoId: sessao.id, papel: 'sistema', conteudo: resultado.mensagem, intencao: 'verificacao_falha', protocolo: sessao.protocolo_numero })
          return res.json({
            sessao_id: sessao.id, trace_id: traceId,
            resposta: `🔐 ${resultado.mensagem}`,
            intencao: 'verificacao_2fa',
            verificacao: { pendente: true, ...resultado },
            score_atrito: sessao.score_atrito, sinais_atrito: [], trechos_memoria: [],
            intervencao: null, persona: cliente.perfil_persona,
            protocolo: sessao.protocolo_numero ? protocoloSvc.formatar(sessao.protocolo_numero) : null,
          })
        }

        // Validado: retoma a intenção que havia disparado a verificação
        sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(sessao.id)
        intencao = resultado.motivo_original || intencao
        confianca = 0.95
        if (sessao.protocolo_numero) {
          protocoloSvc.registrarEvento(sessao.protocolo_numero, canal, 'verificacao', 'Identidade confirmada por verificação em duas etapas')
        }
      } else {
        // Ainda aguardando o código — não seguimos para dado sensível
        const pedido = `🔐 Ainda preciso do código de 6 dígitos enviado para **${estadoVerif.desafio_pendente.destino_mascarado}** para continuar com segurança.`
        salvarMensagem(db, { sessaoId: sessao.id, papel: 'cliente', conteudo: mensagem, intencao, confianca, protocolo: sessao.protocolo_numero })
        salvarMensagem(db, { sessaoId: sessao.id, papel: 'sistema', conteudo: pedido, intencao: 'verificacao_2fa', protocolo: sessao.protocolo_numero })
        return res.json({
          sessao_id: sessao.id, trace_id: traceId, resposta: pedido,
          intencao: 'verificacao_2fa',
          verificacao: { pendente: true, destino_mascarado: estadoVerif.desafio_pendente.destino_mascarado },
          score_atrito: sessao.score_atrito, sinais_atrito: [], trechos_memoria: [],
          intervencao: null, persona: cliente.perfil_persona,
          protocolo: sessao.protocolo_numero ? protocoloSvc.formatar(sessao.protocolo_numero) : null,
        })
      }
    }

    // ── 7. Protocolo de atendimento (todo contato gera um) ──────────────────
    const proto = protocoloSvc.abrir({
      clienteId: cliente_id, sessaoId: sessao.id, canal, intencao,
      produtoCodigo: sessao.produto_codigo_foco,
    })
    const protocoloNumero = proto?.numero || sessao.protocolo_numero
    sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(sessao.id)

    // Protocolos abertos em outros canais — base da continuidade cross-canal
    const protocolosAbertos = protocoloSvc.protocolosAbertos(cliente_id, canal)
      .filter(p => p.numero !== protocoloNumero)

    // ── 8. Identificação no WhatsApp (verificação em duas etapas) ───────────
    // No WhatsApp o número identifica o cliente, mas posse do número não é
    // prova de identidade. A verificação acontece na ENTRADA: nada do contrato
    // — nem o histórico de outros canais — é devolvido antes do código.
    if (verificacao.exigeVerificacao({ canal, sessao })) {
      const { persona } = obterPerfil(cliente_id, mensagem)
      const desafio = verificacao.iniciar({
        sessaoId: sessao.id, clienteId: cliente_id, canal, motivo: intencao,
      })

      if (desafio) {
        const resposta = verificacao.mensagemDesafio({
          destino: desafio.destino_mascarado, metodo: desafio.metodo, persona, nome: cliente.nome,
        })

        salvarMensagem(db, { sessaoId: sessao.id, papel: 'cliente', conteudo: mensagem, intencao, confianca, protocolo: protocoloNumero })
        salvarMensagem(db, { sessaoId: sessao.id, papel: 'sistema', conteudo: resposta, intencao: 'verificacao_2fa', protocolo: protocoloNumero })

        protocoloSvc.registrarEvento(protocoloNumero, canal, 'verificacao', `Identificação por SMS solicitada ao número cadastrado (motivo: ${intencao})`)

        return res.json({
          sessao_id: sessao.id, trace_id: traceId, resposta,
          intencao: 'verificacao_2fa', confianca_intencao: 0.99,
          intencao_pendente: intencao,
          protocolo: protocoloSvc.formatar(protocoloNumero),
          verificacao: {
            pendente: true,
            verificacao_id: desafio.verificacao_id,
            destino_mascarado: desafio.destino_mascarado,
            metodo: desafio.metodo,
            expira_em_minutos: desafio.expira_em_minutos,
            // Somente no protótipo: em produção o código só existe no SMS
            codigo_simulado: desafio.codigo_simulado,
          },
          score_atrito: sessao.score_atrito, sinais_atrito: [], trechos_memoria: [],
          intervencao: null, persona,
        })
      }
    }

    // A sessão está identificada o bastante para receber histórico anterior?
    // (WhatsApp: só depois do código. Demais canais: autenticação do canal.)
    const podeAnunciarContinuidade =
      verificacao.sessaoIdentificada({ canal, sessao }) && sessao.continuidade_anunciada !== 1

    // ── 9. Consulta de protocolo pelo número ────────────────────────────────
    const numeroCitado = protocoloSvc.extrairDoTexto(mensagem)
    if (intencao === 'consulta_protocolo' || numeroCitado) {
      const consultado = numeroCitado ? protocoloSvc.buscar(numeroCitado) : (protocolosAbertos[0] || null)

      // Só devolve protocolo do próprio titular — nunca de terceiro
      const autorizado = consultado && consultado.cliente_id === cliente_id
      const persona = obterPerfil(cliente_id, mensagem).persona
      const resposta = llm.gerar({
        intencao: 'consulta_protocolo', persona, nome: cliente.nome,
        protocolo: protocoloNumero,
        protocoloConsultado: autorizado ? consultado : null,
      })

      if (!autorizado && consultado) {
        guardrails.registrarEvento({
          sessaoId: sessao.id, clienteId: cliente_id, canal,
          tipo: 'extracao_dados', severidade: 'alta',
          padrao: 'protocolo_de_terceiro', trecho: 'Consulta a protocolo de outro titular', acao: 'bloqueado',
        })
      }

      salvarMensagem(db, { sessaoId: sessao.id, papel: 'cliente', conteudo: mensagem, intencao: 'consulta_protocolo', confianca, protocolo: protocoloNumero })
      salvarMensagem(db, { sessaoId: sessao.id, papel: 'sistema', conteudo: resposta, intencao: 'consulta_protocolo', protocolo: protocoloNumero })

      return res.json({
        sessao_id: sessao.id, trace_id: traceId, resposta,
        intencao: 'consulta_protocolo', confianca_intencao: confianca,
        protocolo: protocoloSvc.formatar(protocoloNumero),
        protocolo_consultado: autorizado ? consultado : null,
        score_atrito: sessao.score_atrito, sinais_atrito: [], trechos_memoria: [],
        intervencao: null, persona,
      })
    }

    // ── 9. Confirmação de ação pendente do autoatendimento ──────────────────
    const proposta = autoatendimento.propostaPendente(sessao.id)
    if (proposta && !negacao && (confirmacao || intencao === proposta.tipo)) {
      const { persona } = obterPerfil(cliente_id, mensagem)
      const executada = autoatendimento.executar(proposta.id, { persona, nome: cliente.nome })

      if (executada) {
        const chave = proposta.tipo === 'pagamento' ? 'pagamento_confirmado' : 'upgrade_confirmado'
        let resposta = llm.gerar({
          intencao: chave, persona, nome: cliente.nome,
          protocolo: protocoloNumero,
          acao: { ...executada, detalhe: executada.detalhe, valor: executada.valor, comprovante: executada.comprovante },
        })
        resposta = guardrails.sanitizarSaida(adaptarTom(resposta, persona))

        salvarMensagem(db, { sessaoId: sessao.id, papel: 'cliente', conteudo: mensagem, intencao: proposta.tipo, confianca, protocolo: protocoloNumero })
        salvarMensagem(db, { sessaoId: sessao.id, papel: 'sistema', conteudo: resposta, intencao: chave, protocolo: protocoloNumero })

        db.prepare(`UPDATE sessoes SET status = 'encerrada', updated_at = datetime('now') WHERE id = ?`).run(sessao.id)

        return res.json({
          sessao_id: sessao.id, trace_id: traceId, resposta,
          intencao: chave, confianca_intencao: 0.99,
          protocolo: protocoloSvc.formatar(protocoloNumero),
          protocolo_status: 'resolvido',
          resolvido_por: 'autoatendimento',
          // O produto já estava resolvido quando a proposta foi criada — o painel
          // de transparência precisa continuar mostrando sobre qual contrato a
          // ação foi executada, e não "aguardando desambiguação".
          produto_foco: proposta.produto_codigo,
          produto_confirmado: true,
          acao_executada: { tipo: proposta.tipo, valor: executada.valor, detalhe: executada.detalhe },
          score_atrito: sessao.score_atrito, nivel_atrito: 'normal',
          sinais_atrito: [], trechos_memoria: [], intervencao: null, persona,
        })
      }
    }
    if (proposta && negacao) autoatendimento.descartar(proposta.id)

    // ── 10. Resolução de produto ────────────────────────────────────────────
    const resolucao = resolveProduct(cliente_id, canal, intencao, sessao, mensagem)

    if (resolucao.precisou_perguntar) {
      salvarMensagem(db, { sessaoId: sessao.id, papel: 'cliente', conteudo: mensagem, intencao, confianca, score: sessao.score_atrito, protocolo: protocoloNumero })
      salvarMensagem(db, { sessaoId: sessao.id, papel: 'sistema', conteudo: resolucao.resposta_desambiguacao, intencao: 'desambiguacao', score: sessao.score_atrito, protocolo: protocoloNumero })

      return res.json({
        sessao_id: sessao.id, trace_id: traceId,
        resposta: resolucao.resposta_desambiguacao,
        intencao: 'desambiguacao', confianca_intencao: 0.95,
        produto_foco: null, produto_confirmado: false,
        protocolo: protocoloSvc.formatar(protocoloNumero),
        score_atrito: sessao.score_atrito, sinais_atrito: [], trechos_memoria: [],
        intervencao: null, persona: cliente.perfil_persona,
        aguardando_desambiguacao: true,
        portfolio: resolucao.portfolio,
      })
    }

    // Retoma a intenção anterior quando o turno só respondeu a desambiguação
    if (intencao === 'geral') {
      const anterior = db.prepare(`
        SELECT intencao_codigo FROM mensagens
        WHERE sessao_id = ? AND papel = 'cliente' AND intencao_codigo NOT IN ('geral','desambiguacao','codigo_verificacao') AND intencao_codigo IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `).get(sessao.id)
      if (anterior?.intencao_codigo) intencao = anterior.intencao_codigo
    }

    if (resolucao.produto_foco && !sessao.produto_confirmado) {
      db.prepare(`UPDATE sessoes SET produto_codigo_foco = ?, produto_confirmado = 1, updated_at = datetime('now') WHERE id = ?`)
        .run(resolucao.produto_foco, sessao.id)
      sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(sessao.id)
    }

    protocoloSvc.atualizarContexto(protocoloNumero, { intencao, produtoCodigo: resolucao.produto_foco })

    // ── 12. ClaroMemory + Persona + dados do adaptador ──────────────────────
    const memoria = claroMemory.recuperar(cliente_id, resolucao.produto_foco, intencao)
    const perfil = obterPerfil(cliente_id, mensagem)
    const persona = perfil.persona
    const dados = obterDadosAdapter(resolucao.linha, cliente_id, intencao, resolucao.produto_foco)

    // ── 13. Autoatendimento: propõe a ação transacional ─────────────────────
    let acaoProposta = null
    let intencaoResposta = intencao

    if ((intencao === 'pagamento' || (intencao === 'segunda_via' && confirmacao)) && dados) {
      acaoProposta = autoatendimento.propor({
        tipo: 'pagamento', sessaoId: sessao.id, clienteId: cliente_id,
        produtoCodigo: resolucao.produto_foco, protocoloNumero, dados, contrato: resolucao.contrato,
      })
      if (acaoProposta) intencaoResposta = 'pagamento_proposta'
    } else if (intencao === 'upgrade_plano' && dados && resolucao.linha === 'residencial') {
      acaoProposta = autoatendimento.propor({
        tipo: 'upgrade_plano', sessaoId: sessao.id, clienteId: cliente_id,
        produtoCodigo: resolucao.produto_foco, protocoloNumero, dados, contrato: resolucao.contrato,
      })
      if (acaoProposta) intencaoResposta = 'upgrade_proposta'
    }

    // ── 14. Geração da resposta + sanitização de saída ──────────────────────
    // O aviso de retomada ("localizei seu protocolo de ontem") é calculado
    // aqui para sabermos se ele realmente foi usado — só então a sessão é
    // marcada como já avisada, e o aviso não se repete nos turnos seguintes.
    const prefixoRetomada = podeAnunciarContinuidade
      ? llm.prefixoContinuidade({ intencao, contexto: memoria.contexto, memoria, protocolosAbertos })
      : null

    let resposta = llm.gerar({
      intencao: intencaoResposta,
      linha: resolucao.linha,
      persona,
      dados,
      nome: cliente.nome,
      portfolio: resolucao.portfolio,
      memoria,
      contexto: memoria.contexto,
      protocolo: protocoloNumero,
      acao: acaoProposta,
      protocolosAbertos,
      anunciarContinuidade: !!prefixoRetomada,
    })
    resposta = guardrails.sanitizarSaida(adaptarTom(resposta, persona))

    // ── 15. ClaroSense ──────────────────────────────────────────────────────
    const historico = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(sessao.id)
    const { score, nivel, sinais, intervencao, churn } = calcularAtrito(sessao, mensagem, historico, intencao, memoria.contexto)

    db.prepare(`UPDATE sessoes SET score_atrito = ?, risco_churn = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(score, churn.percentual, sessao.id)

    // ── 16. Transbordo: fila de atendimento humano ──────────────────────────
    let entradaFila = null
    const pediuHumano = intencao === 'atendente_humano'
    const transbordo = intervencao?.tipo === 'transferencia_humano'

    if (pediuHumano || transbordo) {
      const motivo = pediuHumano
        ? 'Cliente solicitou atendimento humano'
        : `ClaroSense: score de atrito ${score}/100 (risco de churn ${churn.percentual}%)`

      entradaFila = fila.entrar({
        sessaoId: sessao.id, clienteId: cliente_id, canal, motivo,
        scoreAtrito: score, riscoChurn: churn.percentual, intencao,
        produtoLinha: resolucao.linha, protocoloNumero,
      })

      resposta = guardrails.sanitizarSaida(llm.gerar({
        intencao: pediuHumano ? 'atendente_humano' : 'transbordo_humano',
        linha: resolucao.linha, persona, dados, nome: cliente.nome,
        portfolio: resolucao.portfolio, memoria, contexto: memoria.contexto,
        protocolo: protocoloNumero,
      }))

      db.prepare(`UPDATE sessoes SET status = 'transferida', updated_at = datetime('now') WHERE id = ?`).run(sessao.id)

      db.prepare(`
        INSERT INTO intervencoes (id, sessao_id, tipo, gatilho, acao, resultado, protocolo_numero, created_at)
        VALUES (?, ?, ?, ?, ?, 'pendente', ?, datetime('now'))
      `).run(
        uuidv4(), sessao.id,
        pediuHumano ? 'solicitacao_humano' : 'transferencia_humano',
        pediuHumano ? 'intencao=atendente_humano' : (intervencao?.gatilho || `score=${score}`),
        motivo, protocoloNumero
      )

      intencaoResposta = pediuHumano ? 'atendente_humano' : 'transbordo_humano'
    }

    // O aviso de retomada só conta como "dado" se foi para a resposta que o
    // cliente realmente recebeu — no transbordo a resposta é outra.
    if (prefixoRetomada && !entradaFila) {
      db.prepare(`UPDATE sessoes SET continuidade_anunciada = 1 WHERE id = ?`).run(sessao.id)
    }

    // ── 17. Persistência ────────────────────────────────────────────────────
    salvarMensagem(db, {
      sessaoId: sessao.id, papel: 'cliente', conteudo: mensagem,
      intencao, confianca, produto: resolucao.produto_foco, score, sinais, protocolo: protocoloNumero,
    })
    salvarMensagem(db, {
      sessaoId: sessao.id, papel: 'sistema', conteudo: resposta,
      intencao: intencaoResposta, produto: resolucao.produto_foco, score,
      memoria: memoria.trechos.map(t => t.id), protocolo: protocoloNumero,
    })

    // ── 18. ClaroMemory grava fora do caminho crítico ───────────────────────
    setImmediate(() => claroMemory.salvar(cliente_id, sessao.id, canal, resolucao.produto_foco, intencao, mensagem, resposta))

    return res.json({
      sessao_id: sessao.id,
      trace_id: traceId,
      resposta,
      intencao: intencaoResposta,
      confianca_intencao: confianca,
      produto_foco: resolucao.produto_foco,
      produto_confirmado: true,
      linha: resolucao.linha,
      contrato: resolucao.contrato ? {
        plano: resolucao.contrato.plano_nome,
        produto: resolucao.contrato.produto_nome,
        valor: resolucao.contrato.valor_mensal,
      } : null,
      dados_produto: dados,
      protocolo: protocoloSvc.formatar(protocoloNumero),
      protocolos_abertos: protocolosAbertos.map(p => ({
        numero: p.numero_formatado, assunto: p.assunto, canal: p.canal_origem, status: p.status, horasAtras: p.horasAtras,
      })),
      score_atrito: score,
      nivel_atrito: nivel,
      sinais_atrito: sinais,
      risco_churn: churn,
      trechos_memoria: memoria.trechos,
      intervencao,
      persona,
      persona_detalhe: { detectada: perfil.detectada, perfil_salvo: perfil.perfil_salvo, termos: perfil.termos, pontuacoes: perfil.pontuacoes },
      acao_proposta: acaoProposta ? { tipo: acaoProposta.tipo, valor: acaoProposta.valor, detalhe: acaoProposta.detalhe } : null,
      fila: entradaFila ? {
        na_fila: true,
        fila_id: entradaFila.id,
        posicao: entradaFila.posicao,
        espera_estimada_min: entradaFila.espera_estimada_min,
        prioridade: entradaFila.prioridade,
      } : null,
      aguardando_desambiguacao: false,
    })
  } catch (err) {
    console.error('[chat/mensagem]', err)
    // Mensagem genérica ao cliente; o detalhe fica só no log do servidor
    res.status(500).json({ erro: 'Não foi possível processar sua mensagem. Tente novamente.' })
  }
})

// Histórico de mensagens de uma sessão (usado pelo chat e pelo console)
router.get('/sessoes/:id/mensagens', (req, res) => {
  try {
    const db = getDb()
    const msgs = db.prepare('SELECT * FROM mensagens WHERE sessao_id = ? ORDER BY created_at').all(req.params.id)
    res.json(msgs)
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao carregar mensagens' })
  }
})

// Estado consolidado da sessão: fila + verificação + protocolo.
// O chat do cliente faz polling aqui enquanto aguarda atendimento humano.
router.get('/sessoes/:id/estado', (req, res) => {
  try {
    const db = getDb()
    const sessao = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(req.params.id)
    if (!sessao) return res.status(404).json({ erro: 'Sessão não encontrada' })

    res.json({
      sessao_id: sessao.id,
      status: sessao.status,
      score_atrito: sessao.score_atrito,
      risco_churn: sessao.risco_churn,
      protocolo: sessao.protocolo_numero ? protocoloSvc.formatar(sessao.protocolo_numero) : null,
      verificacao: verificacao.statusSessao(sessao.id),
      fila: fila.statusSessao(sessao.id),
    })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao consultar estado da sessão' })
  }
})

module.exports = router
