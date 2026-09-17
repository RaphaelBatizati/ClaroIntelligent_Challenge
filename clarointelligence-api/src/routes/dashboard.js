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

// Limiares do ClaroSense reaproveitados na leitura do mapa: "com atrito" e o
// atendimento que passou de alerta; "em risco", o que passou de risco.
const LIMIAR_ATRITO = 40
const LIMIAR_RISCO = 65

const CANAIS = ['site', 'app', 'whatsapp', 'callcenter']
const PERSONAS = ['digital', 'intermediario', 'assistido', 'informal']
const LINHAS = ['residencial', 'movel', 'tv', 'empresas']

const ROTULO_CANAL = {
  site: 'Site claro.com.br', app: 'App Minha Claro',
  whatsapp: 'WhatsApp', callcenter: 'Call Center',
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mapa de Atrito — um cubo agregado, todos os números derivados dele
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Traz o período inteiro pré-agregado por jornada × canal × persona × linha.
 *
 * Com dezenas de milhares de atendimentos, refiltrar o conjunto bruto uma vez
 * por jornada, por célula do mapa e por faceta custava meio segundo. O SQLite
 * reduz as ~85 mil linhas a menos de mil combinações em uma varredura; daí para
 * frente tudo é aritmética sobre um punhado de linhas.
 *
 * É também o que garante a coerência da tela: KPIs, jornadas, mapa de calor e
 * contadores de filtro saem todos deste mesmo cubo.
 */
function cuboDoPeriodo(periodo) {
  return getDb().prepare(`
    SELECT pr.assunto AS jornada,
           pr.canal_origem AS canal,
           c.perfil_persona AS persona,
           COALESCE(p.linha, 'sem-produto') AS linha,
           COUNT(*) AS total,
           SUM(pr.score_atrito_final) AS soma_score,
           SUM(CASE WHEN pr.score_atrito_final >= ${LIMIAR_ATRITO} THEN 1 ELSE 0 END) AS com_atrito,
           SUM(CASE WHEN pr.score_atrito_final >= ${LIMIAR_RISCO} THEN 1 ELSE 0 END) AS em_risco,
           SUM(CASE WHEN pr.status = 'transferido' OR pr.resolvido_por = 'atendente_humano' THEN 1 ELSE 0 END) AS transferidos,
           SUM(CASE WHEN pr.status = 'resolvido' THEN 1 ELSE 0 END) AS resolvidos,
           SUM(CASE WHEN pr.status = 'resolvido' AND pr.resolvido_por != 'atendente_humano' THEN 1 ELSE 0 END) AS resolvidos_sem_humano
    FROM protocolos pr
    JOIN clientes c ON pr.cliente_id = c.id
    LEFT JOIN produtos_catalogo p ON pr.produto_codigo = p.codigo
    WHERE pr.created_at >= ${desde(periodo)}
    GROUP BY 1, 2, 3, 4
  `).all()
}

/**
 * Filtra linhas do cubo, opcionalmente ignorando uma dimensão.
 *
 * `ignorar` é o que torna as facetas honestas: o contador ao lado de "Call
 * Center" respeita persona, linha, jornada e período, mas não o filtro de canal
 * — senão só sobraria a opção já escolhida.
 */
function recortar(cubo, filtros, ignorar = null) {
  return cubo.filter(r =>
    (ignorar === 'canal' || !filtros.canal || r.canal === filtros.canal) &&
    (ignorar === 'jornada' || !filtros.jornada || r.jornada === filtros.jornada) &&
    (ignorar === 'persona' || !filtros.persona || r.persona === filtros.persona) &&
    (ignorar === 'linha' || !filtros.linha || r.linha === filtros.linha)
  )
}

/** Soma o total de atendimentos por valor de uma dimensão. */
function somarPor(linhas, dimensao) {
  const mapa = {}
  for (const r of linhas) mapa[r[dimensao]] = (mapa[r[dimensao]] || 0) + r.total
  return mapa
}

router.get('/mapa-atrito', (req, res) => {
  try {
    const db = getDb()
    const periodo = periodoDe(req)
    const filtros = {
      canal: CANAIS.includes(req.query.canal) ? req.query.canal : null,
      jornada: req.query.jornada || null,
      persona: PERSONAS.includes(req.query.persona) ? req.query.persona : null,
      linha: LINHAS.includes(req.query.linha) ? req.query.linha : null,
    }

    const cubo = cuboDoPeriodo(periodo)
    const recorte = recortar(cubo, filtros)

    // ── Acumula jornadas, células do mapa e KPIs numa passagem ─────────────
    const porJornada = new Map()
    const canaisVistos = new Set()
    let atendimentos = 0, somaScore = 0, comAtrito = 0
    let resolvidos = 0, resolvidosSemHumano = 0

    for (const r of recorte) {
      canaisVistos.add(r.canal)
      atendimentos += r.total
      somaScore += r.soma_score
      comAtrito += r.com_atrito
      resolvidos += r.resolvidos
      resolvidosSemHumano += r.resolvidos_sem_humano

      let j = porJornada.get(r.jornada)
      if (!j) {
        j = { jornada: r.jornada, total: 0, soma: 0, em_risco: 0, transferidos: 0, canais: new Map() }
        porJornada.set(r.jornada, j)
      }
      j.total += r.total
      j.soma += r.soma_score
      j.em_risco += r.em_risco
      j.transferidos += r.transferidos

      let cel = j.canais.get(r.canal)
      if (!cel) {
        cel = { total: 0, soma: 0, com_atrito: 0 }
        j.canais.set(r.canal, cel)
      }
      cel.total += r.total
      cel.soma += r.soma_score
      cel.com_atrito += r.com_atrito
    }

    const jornadas = [...porJornada.values()]
      .map(j => ({
        jornada: j.jornada,
        total: j.total,
        indice: j.total ? Math.round(j.soma / j.total) : 0,
        pct_atrito: j.total ? Math.round(([...j.canais.values()].reduce((a, c) => a + c.com_atrito, 0) / j.total) * 100) : 0,
        em_risco: j.em_risco,
        transferidos: j.transferidos,
      }))
      .sort((a, b) => b.pct_atrito - a.pct_atrito || b.indice - a.indice)

    // ── Mapa de calor em percentual ────────────────────────────────────────
    // A célula responde "que fatia dos atendimentos desta jornada, neste canal,
    // passou do limiar de atrito?". Percentual e não média porque é o que
    // permite comparar canais de volumes muito diferentes: 300 casos com atrito
    // no app não significam o mesmo que 300 no call center, se um recebe o
    // triplo do volume do outro.
    const canaisPresentes = CANAIS.filter(c => canaisVistos.has(c))
    const linhasHeat = jornadas.map(j => {
      const grupo = porJornada.get(j.jornada)
      return {
        jornada: j.jornada,
        total: j.total,
        celulas: canaisPresentes.map(canal => {
          const c = grupo.canais.get(canal)
          if (!c || !c.total) return { canal, total: 0, pct_atrito: null, indice: null }
          return {
            canal,
            total: c.total,
            com_atrito: c.com_atrito,
            pct_atrito: Math.round((c.com_atrito / c.total) * 100),
            indice: Math.round(c.soma / c.total),
          }
        }),
      }
    })

    // ── Sinais do ClaroSense das conversas deste recorte ───────────────────
    // Fica fora do cubo porque um atendimento pode disparar vários sinais —
    // somá-los junto inflaria a contagem de atendimentos.
    const where = [`pr.created_at >= ${desde(periodo)}`]
    const params = []
    if (filtros.canal) { where.push('pr.canal_origem = ?'); params.push(filtros.canal) }
    if (filtros.jornada) { where.push('pr.assunto = ?'); params.push(filtros.jornada) }
    if (filtros.persona) { where.push('c.perfil_persona = ?'); params.push(filtros.persona) }
    if (filtros.linha) { where.push(`COALESCE(p.linha, 'sem-produto') = ?`); params.push(filtros.linha) }

    const sinaisRows = db.prepare(`
      SELECT s.tipo, COUNT(*) AS total
      FROM sinais_atrito s
      JOIN protocolos pr ON pr.sessao_id = s.sessao_id
      JOIN clientes c ON pr.cliente_id = c.id
      LEFT JOIN produtos_catalogo p ON pr.produto_codigo = p.codigo
      WHERE ${where.join(' AND ')}
      GROUP BY s.tipo
      ORDER BY total DESC
    `).all(...params)

    res.json({
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo },
      filtros_aplicados: Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)),
      kpis: {
        atendimentos,
        pontos_atrito: sinaisRows.reduce((a, s) => a + s.total, 0),
        indice_medio: atendimentos ? Math.round(somaScore / atendimentos) : 0,
        pct_com_atrito: atendimentos ? Math.round((comAtrito / atendimentos) * 100) : 0,
        taxa_recuperacao: resolvidos ? Math.round((resolvidosSemHumano / resolvidos) * 100) : null,
        jornada_critica: jornadas[0] || null,
      },
      por_jornada: jornadas,
      sinais: sinaisRows.map(s => ({
        tipo: s.tipo,
        total: s.total,
        rotulo: SINAIS[s.tipo]?.rotulo || s.tipo.replace(/_/g, ' '),
        peso: SINAIS[s.tipo]?.peso || 0,
        explicacao: SINAIS[s.tipo]?.explicacao || null,
      })),
      heatmap: {
        limiar: LIMIAR_ATRITO,
        canais: canaisPresentes.map(c => ({ chave: c, rotulo: ROTULO_CANAL[c] })),
        linhas: linhasHeat,
      },
      facetas: {
        canal: somarPor(recortar(cubo, filtros, 'canal'), 'canal'),
        jornada: somarPor(recortar(cubo, filtros, 'jornada'), 'jornada'),
        persona: somarPor(recortar(cubo, filtros, 'persona'), 'persona'),
        linha: somarPor(recortar(cubo, filtros, 'linha'), 'linha'),
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

    // Tudo agregado no banco. Trazer as sessões do período para contar em
    // JavaScript funcionava com centenas de linhas; com dezenas de milhares,
    // vira meio segundo de latência a cada troca de período.
    const s = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'ativa' THEN 1 ELSE 0 END) AS ativas,
             SUM(CASE WHEN status IN ('transferida','em_atendimento_humano') THEN 1 ELSE 0 END) AS transferidas,
             AVG(score_atrito) AS score_medio,
             AVG(risco_churn) AS churn_medio
      FROM sessoes WHERE created_at >= ${janela}
    `).get()

    const p = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END) AS resolvidos,
             SUM(CASE WHEN status = 'resolvido' AND resolvido_por = 'atendente_humano' THEN 1 ELSE 0 END) AS por_humano
      FROM protocolos WHERE created_at >= ${janela}
    `).get()

    const intervencoes = db.prepare(`SELECT COUNT(*) AS n FROM intervencoes WHERE created_at >= ${janela}`).get()
    const memorias = db.prepare(`SELECT COUNT(*) AS n FROM memoria_conversacional WHERE created_at >= ${janela}`).get()

    const porCanal = db.prepare(`
      SELECT canal, COUNT(*) AS n FROM sessoes WHERE created_at >= ${janela} GROUP BY canal
    `).all()
    const canais = Object.fromEntries(CANAIS.map(c => [c, porCanal.find(r => r.canal === c)?.n || 0]))

    res.json({
      periodo: { chave: periodo.chave, rotulo: periodo.rotulo },
      total_sessoes: s.total,
      sessoes_ativas: s.ativas || 0,
      transferencias: s.transferidas || 0,
      score_atrito_medio: Math.round(s.score_medio || 0),
      risco_churn_medio: Math.round(s.churn_medio || 0),
      protocolos: p.total,
      // Contenção: resolvidos sem atendente humano sobre o total de resolvidos
      contencao_pct: p.resolvidos ? Math.round(((p.resolvidos - p.por_humano) / p.resolvidos) * 100) : null,
      transbordo_pct: s.total ? Math.round(((s.transferidas || 0) / s.total) * 100) : 0,
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
