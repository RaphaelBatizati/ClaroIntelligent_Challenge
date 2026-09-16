// Autoatendimento transacional — o caminho feliz do ClaroIntelligence.
//
// A maior parte da demonstração mostra o sistema detectando atrito e chamando
// um humano. Mas o ganho real da plataforma está no oposto: a conversa que se
// resolve inteira no chat, sem fila, sem atendente e com o protocolo fechado
// no mesmo turno.
//
// Dois fluxos completos, em duas etapas cada (proposta → confirmação):
//   pagamento     — mostra a fatura, gera PIX, confirma a baixa
//   upgrade_plano — mostra o plano atual, propõe o superior, ativa
//
// A proposta fica persistida com status 'proposta'; o "sim" do cliente no turno
// seguinte a encontra e executa. É isso que permite responder a um simples
// "pode ser" sem perder o que estava sendo tratado.

const { getDb } = require('../database')
const { v4: uuidv4 } = require('uuid')
const protocolo = require('./protocolo')

const TIPOS = ['pagamento', 'upgrade_plano']

/** Próximo degrau de velocidade da fibra, seguindo o portfólio real da Claro. */
const ESCADA_FIBRA = [350, 500, 600, 1000, 5000, 10000]

/** Gera um payload PIX copia-e-cola plausível (apenas simulação). */
function gerarPix(valor) {
  const chave = '02558157000162' // CNPJ Claro S.A. formatado como chave PIX
  const valorFmt = valor.toFixed(2)
  const id = `CLARO${Date.now().toString().slice(-10)}`
  return `00020126580014BR.GOV.BCB.PIX0136${chave}5204000053039865802BR5910CLARO S.A.6009SAO PAULO62070503${id}6304${Math.floor(1000 + Math.random() * 9000)}`
    .slice(0, 140) + `|${valorFmt}`
}

/**
 * Cria a proposta de ação. Não executa nada ainda — só registra o que será
 * feito se o cliente confirmar no próximo turno.
 */
function propor({ tipo, sessaoId, clienteId, produtoCodigo, protocoloNumero, dados, contrato }) {
  if (!TIPOS.includes(tipo)) return null

  try {
    const db = getDb()

    // Uma proposta pendente por sessão: a nova substitui a anterior
    db.prepare(`UPDATE acoes_autoatendimento SET status = 'descartada' WHERE sessao_id = ? AND status = 'proposta'`).run(sessaoId)

    let detalhe = {}
    let valor = 0

    if (tipo === 'pagamento') {
      valor = dados?.valor_mensal || contrato?.valor_mensal || 0
      detalhe = {
        produto: dados?.produto_nome || contrato?.produto_nome,
        plano: dados?.plano_nome || contrato?.plano_nome,
        vencimento: dados?.vencimento,
        valor,
        forma: 'pix',
      }
    }

    if (tipo === 'upgrade_plano') {
      const atual = dados?.velocidade_down || contrato?.velocidade_mbps || 0
      const proximo = ESCADA_FIBRA.find(v => v > atual) || atual
      const valorAtual = dados?.valor_mensal || contrato?.valor_mensal || 0
      // Diferença determinística por degrau — sem aleatoriedade na proposta
      const acrescimo = proximo >= 1000 ? 60 : proximo >= 600 ? 30 : 20
      valor = valorAtual + acrescimo
      detalhe = {
        velocidade_atual: atual,
        velocidade_nova: proximo,
        valor_atual: valorAtual,
        valor_novo: valor,
        acrescimo,
        produto: dados?.produto_nome || contrato?.produto_nome,
      }
    }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO acoes_autoatendimento (id, protocolo_numero, sessao_id, cliente_id, tipo, produto_codigo, detalhe, valor, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposta', datetime('now'))
    `).run(id, protocoloNumero || null, sessaoId, clienteId, tipo, produtoCodigo || null, JSON.stringify(detalhe), valor)

    return { id, tipo, detalhe, valor }
  } catch (err) {
    console.error('[autoatendimento.propor]', err.message)
    return null
  }
}

/** Proposta pendente da sessão, se houver. */
function propostaPendente(sessaoId) {
  try {
    const db = getDb()
    const row = db.prepare(`
      SELECT * FROM acoes_autoatendimento
      WHERE sessao_id = ? AND status = 'proposta'
        AND created_at > datetime('now', '-30 minutes')
      ORDER BY created_at DESC LIMIT 1
    `).get(sessaoId)
    if (!row) return null
    return { ...row, detalhe: JSON.parse(row.detalhe || '{}') }
  } catch (_) {
    return null
  }
}

/**
 * Executa a proposta confirmada pelo cliente e FECHA O PROTOCOLO marcando que
 * a resolução veio do autoatendimento — sem passar por atendente humano.
 */
function executar(acaoId, { persona = 'intermediario', nome } = {}) {
  try {
    const db = getDb()
    const acao = db.prepare('SELECT * FROM acoes_autoatendimento WHERE id = ?').get(acaoId)
    if (!acao || acao.status !== 'proposta') return null

    const detalhe = JSON.parse(acao.detalhe || '{}')
    let comprovante = {}

    if (acao.tipo === 'pagamento') {
      comprovante = {
        pix_copia_cola: gerarPix(acao.valor || 0),
        autenticacao: `CLR${Date.now().toString().slice(-12)}`,
        data: new Date().toLocaleString('pt-BR'),
      }
    }

    if (acao.tipo === 'upgrade_plano') {
      comprovante = {
        protocolo_ativacao: `ATV${Date.now().toString().slice(-10)}`,
        prazo_ativacao: 'até 24 horas, sem visita técnica',
        vigencia: 'próxima fatura',
      }

      // Efetiva a mudança no contrato do cliente — a ação é real no banco
      if (acao.produto_codigo && detalhe.velocidade_nova) {
        db.prepare(`
          UPDATE contratos SET valor_mensal = ?, plano_nome = ?
          WHERE cliente_id = ? AND produto_codigo = ?
        `).run(
          detalhe.valor_novo,
          `Claro Fibra ${detalhe.velocidade_nova >= 1000 ? (detalhe.velocidade_nova / 1000) + ' Giga' : detalhe.velocidade_nova + ' Mega'}`,
          acao.cliente_id,
          acao.produto_codigo
        )
      }
    }

    const detalheFinal = { ...detalhe, comprovante }
    db.prepare(`
      UPDATE acoes_autoatendimento SET status = 'confirmada', detalhe = ? WHERE id = ?
    `).run(JSON.stringify(detalheFinal), acaoId)

    // O protocolo fecha aqui, resolvido sem intervenção humana
    if (acao.protocolo_numero) {
      protocolo.encerrar(acao.protocolo_numero, {
        resolvidoPor: 'autoatendimento',
        descricao: acao.tipo === 'pagamento'
          ? `Pagamento de R$ ${Number(acao.valor).toFixed(2).replace('.', ',')} registrado via PIX no chat`
          : `Upgrade para ${detalhe.velocidade_nova} Mbps ativado pelo próprio cliente`,
      })
    }

    return { ...acao, detalhe: detalheFinal, comprovante }
  } catch (err) {
    console.error('[autoatendimento.executar]', err.message)
    return null
  }
}

/** Cliente recusou a proposta — descarta sem fechar o protocolo. */
function descartar(acaoId) {
  try {
    const db = getDb()
    db.prepare(`UPDATE acoes_autoatendimento SET status = 'descartada' WHERE id = ?`).run(acaoId)
    return true
  } catch (_) {
    return false
  }
}

/** Métricas de resolução sem humano — alimentam o KPI de contenção. */
function metricas() {
  try {
    const db = getDb()
    const confirmadas = db.prepare(`SELECT tipo, COUNT(*) as n, SUM(valor) as total FROM acoes_autoatendimento WHERE status = 'confirmada' GROUP BY tipo`).all()
    const resolvidosIA = db.prepare(`SELECT COUNT(*) as n FROM protocolos WHERE resolvido_por = 'autoatendimento'`).get()
    const resolvidosHumano = db.prepare(`SELECT COUNT(*) as n FROM protocolos WHERE resolvido_por = 'atendente_humano'`).get()

    const total = (resolvidosIA?.n || 0) + (resolvidosHumano?.n || 0)
    return {
      por_tipo: confirmadas,
      resolvidos_autoatendimento: resolvidosIA?.n || 0,
      resolvidos_humano: resolvidosHumano?.n || 0,
      taxa_contencao_pct: total > 0 ? Math.round(((resolvidosIA?.n || 0) / total) * 100) : 0,
    }
  } catch (_) {
    return { por_tipo: [], resolvidos_autoatendimento: 0, resolvidos_humano: 0, taxa_contencao_pct: 0 }
  }
}

module.exports = { propor, propostaPendente, executar, descartar, metricas, TIPOS }
