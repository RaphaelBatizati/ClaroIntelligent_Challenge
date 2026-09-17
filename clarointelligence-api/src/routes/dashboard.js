// Agregações do painel.
//
// Regra da tela: TODO número exibido sai do mesmo conjunto filtrado. Não há
// contador que ignore o filtro vigente — se o usuário filtra por WhatsApp, a
// contagem de jornadas, os sinais e o mapa de calor passam a falar apenas do
// WhatsApp, e as opções de filtro mostram quantos casos existem de fato.
//
// O recorte temporal vem do seletor de período da Topbar e vale para o painel
// inteiro.

const { Router } = require('express')
const { getDb } = require('../database')
const autoatendimento = require('../services/autoatendimento')
const fila = require('../services/fila')
const { SINAIS } = require('../services/claroSense')

const router = Router()

// Períodos aceitos → janela SQLite + rótulo + granularidade da série temporal
const PERIODOS = {
  '1h': { sql: '-1 hours', rotulo: 'Última hora', balde: 'minuto' },
  '1d': { sql: '-1 days', rotulo: 'Último dia', balde: 'hora' },
  '7d': { sql: '-7 days', rotulo: 'Últimos 7 dias', balde: 'dia' },
  '30d': { sql: '-30 days', rotulo: 'Últimos 30 dias', balde: 'dia' },
}
const PERIODO_PADRAO = '7d'

function periodoDe(req) {
  const chave = PERIODOS[req.query.periodo] ? req.query.periodo : PERIODO_PADRAO
  return { chave, ...PERIODOS[chave] }
}

/** Corte temporal em SQL: datetime('now', '-7 days') */
function desde(periodo) {
  return `datetime('now', '${periodo.sql}')`
}

const CANAIS = ['site', 'app', 'whatsapp', 'callcenter']
const PERSONAS = ['digital', 'intermediario', 'assistido', 'informal']
const LINHAS = ['residencial', 'movel', 'tv', 'empresas']

const ROTULO_CANAL = {
  site: 'Site claro.com.br', app: 'App Minha Claro',
  whatsapp: 'WhatsApp', callcenter: 'Call Center',
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mapa de Atrito — base única, filtros em cascata
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Carrega os atendimentos do período como registros simples.
 * A unidade de análise é o protocolo: é ele que representa uma demanda do
 * cliente, tem canal de origem, assunto (jornada) e desfecho.
 */
function carregarBase(periodo) {
  const db = getDb()

  const protocolos = db.prepare(`
    SELECT pr.numero, pr.sessao_id, pr.canal_origem AS canal, pr.assunto AS jornada,
           pr.status, pr.resolvido_por, pr.score_atrito_final AS score, pr.created_at,
           c.perfil_persona AS persona,
           COALESCE(p.linha, 'sem-produto') AS linha
    FROM protocolos pr
    JOIN clientes c ON pr.cliente_id = c.id
    LEFT JOIN produtos_catalogo p ON pr.produto_codigo = p.codigo
    WHERE pr.created_at >= ${desde(periodo)}
  `).all()

  // Sinais do ClaroSense por sessão — anexados ao protocolo da mesma sessão
  const sinais = db.prepare(`
    SELECT sessao_id, tipo, COUNT(*) AS total
    FROM sinais_atrito
    WHERE created_at >= ${desde(periodo)}
    GROUP BY sessao_id, tipo
  `).all()

  const porSessao = new Map()
  for (const s of sinais) {
    if (!porSessao.has(s.sessao_id)) porSessao.set(s.sessao_id, [])
    porSessao.get(s.sessao_id).push({ tipo: s.tipo, total: s.total })
  }

  return protocolos.map(p => ({ ...p, sinais: porSessao.get(p.sessao_id) || [] }))
}

/** Aplica os filtros ativos, opcionalmente ignorando um deles (para as facetas). */
function aplicar(base, filtros, ignorar = null) {
  return base.filter(r =>
    (ignorar === 'canal' || !filtros.canal || r.canal === filtros.canal) &&
    (ignorar === 'jornada' || !filtros.jornada || r.jornada === filtros.jornada) &&
    (ignorar === 'persona' || !filtros.persona || r.persona === filtros.persona) &&
    (ignorar === 'linha' || !filtros.linha || r.linha === filtros.linha)
  )
}

function contar(itens, campo) {
  const mapa = {}
  for (const i of itens) mapa[i[campo]] = (mapa[i[campo]] || 0) + 1
  return mapa
}

function media(nums) {
  if (!nums.length) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

router.get('/mapa-atrito', (req, res) => {
  try {
    const periodo = periodoDe(req)
    const filtros = {
      canal: CANAIS.includes(req.query.canal) ? req.query.canal : null,
      jornada: req.query.jornada || null,
      persona: PERSONAS.includes(req.query.persona) ? req.query.persona : null,
      linha: LINHAS.includes(req.query.linha) ? req.query.linha : null,
    }

    const base = carregarBase(periodo)
    const itens = aplicar(base, filtros)

    // ── Jornadas
    const jornadas = Object.entries(contar(itens, 'jornada'))
      .map(([jornada, total]) => {
        const doGrupo = itens.filter(i => i.jornada === jornada)
        return {
          jornada,
          total,
          indice: media(doGrupo.map(i => i.score || 0)),
          em_risco: doGrupo.filter(i => (i.score || 0) >= 65).length,
          transferidos: doGrupo.filter(i => i.status === 'transferido' || i.resolvido_por === 'atendente_humano').length,
        }
      })
      .sort((a, b) => b.indice - a.indice)

    // ── Sinais de atrito (só das conversas que sobreviveram ao filtro)
    const totalPorSinal = {}
    for (const i of itens) {
      for (const s of i.sinais) totalPorSinal[s.tipo] = (totalPorSinal[s.tipo] || 0) + s.total
    }
    const sinais = Object.entries(totalPorSinal)
      .map(([tipo, total]) => ({
        tipo,
        total,
        rotulo: SINAIS[tipo]?.rotulo || tipo.replace(/_/g, ' '),
        peso: SINAIS[tipo]?.peso || 0,
        explicacao: SINAIS[tipo]?.explicacao || null,
      }))
      .sort((a, b) => b.total - a.total)

    // ── Mapa de calor jornada × canal: só células com atendimento real
    const canaisPresentes = CANAIS.filter(c => itens.some(i => i.canal === c))
    const heatmap = jornadas.map(j => ({
      jornada: j.jornada,
      celulas: canaisPresentes.map(canal => {
        const celula = itens.filter(i => i.jornada === j.jornada && i.canal === canal)
        return {
          canal,
          total: celula.length,
          indice: celula.length ? media(celula.map(i => i.score || 0)) : null,
        }
      }),
    }))

    // ── KPIs — todos derivados do mesmo array
    const pontosAtrito = itens.reduce((acc, i) => acc + i.sinais.reduce((a, s) => a + s.total, 0), 0)
    const encerrados = itens.filter(i => i.status === 'resolvido')
    const semHumano = encerrados.filter(i => i.resolvido_por !== 'atendente_humano')

    res.json({
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo },
      filtros_aplicados: Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)),
      kpis: {
        atendimentos: itens.length,
        pontos_atrito: pontosAtrito,
        indice_medio: media(itens.map(i => i.score || 0)),
        taxa_recuperacao: encerrados.length ? Math.round((semHumano.length / encerrados.length) * 100) : null,
        jornada_critica: jornadas[0] || null,
      },
      por_jornada: jornadas,
      sinais,
      heatmap: { canais: canaisPresentes.map(c => ({ chave: c, rotulo: ROTULO_CANAL[c] })), linhas: heatmap },
      // Facetas: cada contagem ignora o próprio filtro e respeita os demais
      facetas: {
        canal: contar(aplicar(base, filtros, 'canal'), 'canal'),
        jornada: contar(aplicar(base, filtros, 'jornada'), 'jornada'),
        persona: contar(aplicar(base, filtros, 'persona'), 'persona'),
        linha: contar(aplicar(base, filtros, 'linha'), 'linha'),
      },
    })
  } catch (err) {
    console.error('[dashboard.mapa-atrito]', err)
    res.status(500).json({ erro: 'Falha ao montar o mapa de atrito' })
  }
})

/* ────────────────────────────────────────────────────────────────────────────
 * KPIs e séries do Dashboard
 * ──────────────────────────────────────────────────────────────────────────*/

router.get('/kpis', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)
    const janela = desde(periodo)

    const sessoes = db.prepare(`
      SELECT status, score_atrito, risco_churn, canal FROM sessoes WHERE created_at >= ${janela}
    `).all()

    const protocolos = db.prepare(`
      SELECT status, resolvido_por FROM protocolos WHERE created_at >= ${janela}
    `).all()

    const intervencoes = db.prepare(`SELECT COUNT(*) AS n FROM intervencoes WHERE created_at >= ${janela}`).get()
    const memorias = db.prepare(`SELECT COUNT(*) AS n FROM memoria_conversacional WHERE created_at >= ${janela}`).get()

    const encerrados = protocolos.filter(p => p.status === 'resolvido')
    const porHumano = encerrados.filter(p => p.resolvido_por === 'atendente_humano').length
    const transferidas = sessoes.filter(s => s.status === 'transferida' || s.status === 'em_atendimento_humano').length

    const canais = {}
    for (const c of CANAIS) canais[c] = sessoes.filter(s => s.canal === c).length

    res.json({
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo },
      total_sessoes: sessoes.length,
      sessoes_ativas: sessoes.filter(s => s.status === 'ativa').length,
      transferencias: transferidas,
      score_atrito_medio: media(sessoes.map(s => s.score_atrito || 0)),
      risco_churn_medio: media(sessoes.map(s => s.risco_churn || 0)),
      protocolos: protocolos.length,
      // Contenção: resolvidos sem atendente humano sobre o total de resolvidos
      contencao_pct: encerrados.length ? Math.round(((encerrados.length - porHumano) / encerrados.length) * 100) : null,
      transbordo_pct: sessoes.length ? Math.round((transferidas / sessoes.length) * 100) : 0,
      intervencoes: intervencoes.n,
      memorias_recuperadas: memorias.n,
      canais,
    })
  } catch (err) {
    console.error('[dashboard.kpis]', err)
    res.status(500).json({ erro: 'Falha ao calcular KPIs' })
  }
})

/**
 * Série temporal de volume por canal.
 * A granularidade acompanha o período: minuto na última hora, hora no dia,
 * dia nas janelas maiores — senão o gráfico vira uma barra só.
 */
router.get('/volume', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)

    const formato = periodo.balde === 'minuto' ? '%H:%M'
      : periodo.balde === 'hora' ? '%H:00'
        : '%d/%m'
    const agrupador = periodo.balde === 'minuto' ? "strftime('%Y-%m-%dT%H:%M', created_at)"
      : periodo.balde === 'hora' ? "strftime('%Y-%m-%dT%H', created_at)"
        : "date(created_at)"

    const rows = db.prepare(`
      SELECT ${agrupador} AS balde,
             strftime('${formato}', created_at) AS rotulo,
             canal, status, COUNT(*) AS total
      FROM sessoes
      WHERE created_at >= ${desde(periodo)}
      GROUP BY balde, canal, status
      ORDER BY balde
    `).all()

    const mapa = new Map()
    for (const r of rows) {
      if (!mapa.has(r.balde)) {
        mapa.set(r.balde, {
          balde: r.balde, rotulo: r.rotulo,
          site: 0, app: 0, whatsapp: 0, callcenter: 0,
          total: 0, transferidas: 0, resolvidas: 0,
        })
      }
      const item = mapa.get(r.balde)
      if (item[r.canal] !== undefined) item[r.canal] += r.total
      item.total += r.total
      if (r.status === 'transferida' || r.status === 'em_atendimento_humano') item.transferidas += r.total
      if (r.status === 'encerrada') item.resolvidas += r.total
    }

    res.json({
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo, granularidade: periodo.balde },
      serie: [...mapa.values()],
    })
  } catch (err) {
    console.error('[dashboard.volume]', err)
    res.status(500).json({ erro: 'Falha ao calcular volume' })
  }
})

/** Distribuição por canal no período — alimenta a rosca do Dashboard. */
router.get('/canais', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)
    const rows = db.prepare(`
      SELECT canal, COUNT(*) AS total, AVG(score_atrito) AS score_medio
      FROM sessoes WHERE created_at >= ${desde(periodo)}
      GROUP BY canal ORDER BY total DESC
    `).all()

    const total = rows.reduce((a, r) => a + r.total, 0) || 1
    res.json(rows.map(r => ({
      canal: r.canal,
      rotulo: ROTULO_CANAL[r.canal] || r.canal,
      total: r.total,
      pct: Math.round((r.total / total) * 100),
      score_medio: Math.round(r.score_medio || 0),
    })))
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao calcular distribuição por canal' })
  }
})

/**
 * Taxa de contenção — o indicador que importa para o negócio:
 * quantas demandas se resolveram sem custo de atendente humano.
 */
router.get('/contencao', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)
    const metricas = autoatendimento.metricas()

    const porCanal = db.prepare(`
      SELECT canal_origem as canal,
             SUM(CASE WHEN resolvido_por = 'autoatendimento' THEN 1 ELSE 0 END) as autoatendimento,
             SUM(CASE WHEN resolvido_por = 'atendente_humano' THEN 1 ELSE 0 END) as humano,
             COUNT(*) as total
      FROM protocolos WHERE created_at >= ${desde(periodo)} GROUP BY canal_origem
    `).all()

    const protocolos = db.prepare(`
      SELECT status, COUNT(*) as total FROM protocolos
      WHERE created_at >= ${desde(periodo)} GROUP BY status
    `).all()

    res.json({
      ...metricas,
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo },
      por_canal: porCanal,
      protocolos_por_status: protocolos,
      fila: fila.metricas(),
    })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao calcular contenção' })
  }
})

/** Sinais de atrito agregados — alimenta o painel do ClaroSense com dado real. */
router.get('/sinais', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)

    const porTipo = db.prepare(`
      SELECT tipo, COUNT(*) as total, SUM(valor) as peso_total
      FROM sinais_atrito WHERE created_at >= ${desde(periodo)}
      GROUP BY tipo ORDER BY total DESC
    `).all()

    const intervencoes = db.prepare(`
      SELECT tipo, COUNT(*) as total FROM intervencoes
      WHERE created_at >= ${desde(periodo)} GROUP BY tipo ORDER BY total DESC
    `).all()

    const log = db.prepare(`
      SELECT s.tipo, s.valor, s.created_at, ses.canal, c.nome as cliente_nome, ses.protocolo_numero, ses.score_atrito
      FROM sinais_atrito s
      JOIN sessoes ses ON s.sessao_id = ses.id
      JOIN clientes c ON ses.cliente_id = c.id
      WHERE s.created_at >= ${desde(periodo)}
      ORDER BY s.created_at DESC LIMIT 40
    `).all()

    const churn = db.prepare(`
      SELECT c.nome as cliente_nome, s.canal, s.score_atrito, s.risco_churn, s.protocolo_numero, s.status
      FROM sessoes s JOIN clientes c ON s.cliente_id = c.id
      WHERE s.risco_churn >= 30 AND s.created_at >= ${desde(periodo)}
      ORDER BY s.risco_churn DESC LIMIT 10
    `).all()

    res.json({
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo },
      por_tipo: porTipo, intervencoes, log, clientes_em_risco: churn,
    })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao carregar sinais' })
  }
})

/** Série de transbordo: % de sessões que precisaram de humano, por balde. */
router.get('/transbordo', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)
    const agrupador = periodo.balde === 'minuto' ? "strftime('%H:%M', created_at)"
      : periodo.balde === 'hora' ? "strftime('%H:00', created_at)"
        : "strftime('%d/%m', created_at)"

    const rows = db.prepare(`
      SELECT ${agrupador} AS rotulo,
             COUNT(*) AS total,
             SUM(CASE WHEN status IN ('transferida','em_atendimento_humano') THEN 1 ELSE 0 END) AS humanos
      FROM sessoes WHERE created_at >= ${desde(periodo)}
      GROUP BY rotulo ORDER BY MIN(created_at)
    `).all()

    res.json({
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo },
      serie: rows.map(r => ({
        rotulo: r.rotulo,
        total: r.total,
        humanos: r.humanos,
        taxa: r.total ? Math.round((r.humanos / r.total) * 100) : 0,
      })),
    })
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao calcular transbordo' })
  }
})

/** Personas atendidas no período — conta atendimentos, não cadastros. */
router.get('/personas', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)
    const rows = db.prepare(`
      SELECT c.perfil_persona AS persona, COUNT(*) AS total, AVG(s.score_atrito) AS score_medio
      FROM sessoes s JOIN clientes c ON s.cliente_id = c.id
      WHERE s.created_at >= ${desde(periodo)}
      GROUP BY c.perfil_persona
    `).all()

    const CORES = { digital: '#3B82F6', intermediario: '#8B5CF6', assistido: '#F59E0B', informal: '#14B8A6' }
    const ROTULOS = { digital: 'Digital', intermediario: 'Intermediário', assistido: 'Assistido', informal: 'Informal' }

    res.json(PERSONAS.map(p => {
      const linha = rows.find(r => r.persona === p)
      return {
        persona: ROTULOS[p],
        chave: p,
        total: linha?.total || 0,
        score_medio: Math.round(linha?.score_medio || 0),
        cor: CORES[p],
      }
    }))
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao carregar personas' })
  }
})

module.exports = router
