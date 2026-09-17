// Complemento do seed: personas de demonstração, fila povoada e volume histórico.
//
// Três blocos, com propósitos distintos:
//
// 1. PERSONAS DE ROTEIRO — três clientes construídos para conversas completas
//    no Chat do Cliente (guiada/residencial, informal/móvel, técnica/empresarial).
//    Cada um tem um desfecho diferente: resolve sozinho, pede humano sem crise,
//    ou escala até o transbordo automático.
//
// 2. FILA POVOADA — seis casos fictícios já aguardando no Console do Atendente,
//    para que a tela não dependa de alguém provocar transbordo antes da demo.
//
// 3. VOLUME HISTÓRICO — 30 dias de atendimentos sintéticos. Sem isso, filtros
//    de período, mapa de calor e Monitor de Conversas ficam vazios e não dá
//    para demonstrar que eles funcionam de verdade.
//
// Tudo é determinístico (PRNG com semente fixa): rodar o seed duas vezes produz
// exatamente o mesmo painel, o que importa quando se está gravando um pitch.

const { v4: uuidv4 } = require('uuid')

/** PRNG determinístico — mesmo seed, mesmo painel, toda vez. */
function rng(semente) {
  let a = semente
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function escolher(rand, itens) {
  return itens[Math.floor(rand() * itens.length)]
}

/** Sorteio ponderado: [[valor, peso], ...] */
function ponderado(rand, pares) {
  const total = pares.reduce((a, [, p]) => a + p, 0)
  let alvo = rand() * total
  for (const [valor, peso] of pares) {
    alvo -= peso
    if (alvo <= 0) return valor
  }
  return pares[pares.length - 1][0]
}

const ts = (date) => date.toISOString().replace('T', ' ').slice(0, 19)

// ─── Jornadas: assunto do protocolo + perfil típico de atrito ───────────────
// O índice base reflete o que a operação observa na prática: cancelamento e
// titularidade são jornadas caras e travadas; recarga e franquia, triviais.
const JORNADAS = [
  { assunto: 'Solicitação de cancelamento', intencao: 'cancelamento', base: 68, peso: 6, tipo: 'retencao' },
  { assunto: 'Troca de titularidade', intencao: 'troca_titularidade', base: 54, peso: 4, tipo: 'cadastro' },
  { assunto: 'Suporte técnico', intencao: 'suporte_tecnico', base: 46, peso: 22, tipo: 'tecnico' },
  { assunto: 'Cobrança divergente na fatura', intencao: 'segunda_via', base: 44, peso: 9, tipo: 'financeiro' },
  { assunto: 'Portabilidade numérica', intencao: 'portabilidade', base: 40, peso: 4, tipo: 'retencao' },
  { assunto: 'Segunda via de fatura', intencao: 'segunda_via', base: 26, peso: 18, tipo: 'financeiro' },
  { assunto: 'Agendamento de visita técnica', intencao: 'visita_tecnica', base: 30, peso: 7, tipo: 'tecnico' },
  { assunto: 'Pagamento de fatura', intencao: 'pagamento', base: 18, peso: 12, tipo: 'financeiro' },
  { assunto: 'Upgrade de plano', intencao: 'upgrade_plano', base: 20, peso: 6, tipo: 'comercial' },
  { assunto: 'Consulta de franquia de dados', intencao: 'franquia', base: 16, peso: 8, tipo: 'consumo' },
  { assunto: 'Recarga e saldo', intencao: 'recarga', base: 14, peso: 5, tipo: 'comercial' },
  { assunto: 'Claro tv+ / streaming', intencao: 'streaming', base: 24, peso: 4, tipo: 'tecnico' },
  { assunto: 'Roaming internacional', intencao: 'roaming', base: 22, peso: 2, tipo: 'consumo' },
]

const FALAS_CLIENTE = {
  'Solicitação de cancelamento': ['quero cancelar meu plano', 'como faço pra cancelar sem multa?', 'recebi proposta melhor da concorrência, quero encerrar'],
  'Troca de titularidade': ['preciso passar o contrato para o nome do meu filho', 'como transfiro a titularidade da linha?'],
  'Suporte técnico': ['minha internet está muito lenta', 'a conexão cai toda hora à noite', 'o wifi não funciona desde ontem', 'sem sinal no celular desde a manhã'],
  'Cobrança divergente na fatura': ['veio um valor que eu não reconheço na conta', 'cobraram um serviço que não contratei'],
  'Portabilidade numérica': ['quero trazer meu número de outra operadora', 'quanto tempo leva a portabilidade?'],
  'Segunda via de fatura': ['preciso da segunda via da fatura', 'perdi o boleto deste mês', 'me manda o código de barras da conta'],
  'Agendamento de visita técnica': ['preciso agendar um técnico', 'quando o técnico pode vir aqui?'],
  'Pagamento de fatura': ['quero pagar minha fatura', 'aceita pix pra pagar a conta?'],
  'Upgrade de plano': ['quero aumentar a velocidade da internet', 'qual o plano mais rápido disponível?'],
  'Consulta de franquia de dados': ['quanto de internet ainda tenho?', 'quantos gigas sobraram no meu plano?'],
  'Recarga e saldo': ['quero fazer uma recarga', 'qual o meu saldo?'],
  'Claro tv+ / streaming': ['a netflix do meu pacote não abre', 'não consigo assistir os canais no app'],
  'Roaming internacional': ['vou viajar, como fica o roaming?', 'meu plano funciona no exterior?'],
}

const NOMES_HISTORICO = [
  ['Beatriz Nogueira', 'F'], ['Rafael Andrade', 'M'], ['Camila Ferraz', 'F'], ['Diego Pontes', 'M'],
  ['Larissa Bastos', 'F'], ['Gustavo Rocha', 'M'], ['Patrícia Lemos', 'F'], ['Eduardo Vilela', 'M'],
  ['Sabrina Teixeira', 'F'], ['Marcelo Queiroz', 'M'], ['Juliana Prado', 'F'], ['Henrique Sales', 'M'],
  ['Renata Moura', 'F'], ['Vinícius Camargo', 'M'], ['Tatiane Ribeiro', 'F'], ['André Fontes', 'M'],
  ['Cristina Barbosa', 'F'], ['Leandro Pires', 'M'], ['Sanches Logística Ltda', 'PJ'], ['Atlas Clínicas Ltda', 'PJ'],
]

/**
 * Popula o banco com os três blocos.
 * Recebe o `db` já aberto e o catálogo de produtos do seed principal.
 */
function popular(db, { produtos, minutosAtras, j, proximoSequencial }) {
  const rand = rng(20260916)

  const insertCli = db.prepare(`
    INSERT OR IGNORE INTO clientes (id, nome, email, telefone, cpf_mascara, cnpj_mascara, tipo_pessoa, segmento, perfil_persona, created_at)
    VALUES (@id, @nome, @email, @telefone, @cpf_mascara, @cnpj_mascara, @tipo_pessoa, @segmento, @perfil_persona, datetime('now'))
  `)
  const insertCtr = db.prepare(`
    INSERT OR IGNORE INTO contratos (id, cliente_id, produto_codigo, linha, plano_nome, valor_mensal, data_inicio, dados_extra, status)
    VALUES (@id, @cliente_id, @produto_codigo, @linha, @plano_nome, @valor_mensal, @data_inicio, @dados_extra, 'ativo')
  `)
  const insertSes = db.prepare(`
    INSERT OR IGNORE INTO sessoes (id, cliente_id, canal, produto_codigo_foco, produto_confirmado, score_atrito, risco_churn, status, verificado, protocolo_numero, trace_id, created_at, updated_at)
    VALUES (@id, @cliente_id, @canal, @produto_codigo_foco, 1, @score_atrito, @risco_churn, @status, @verificado, @protocolo_numero, @trace_id, @created_at, @updated_at)
  `)
  const insertProto = db.prepare(`
    INSERT OR IGNORE INTO protocolos (numero, cliente_id, sessao_id, canal_origem, canal_atual, tipo, assunto, produto_codigo, status, resolvido_por, score_atrito_final, created_at, updated_at, encerrado_at)
    VALUES (@numero, @cliente_id, @sessao_id, @canal, @canal, @tipo, @assunto, @produto_codigo, @status, @resolvido_por, @score, @created_at, @updated_at, @encerrado_at)
  `)
  const insertEv = db.prepare(`
    INSERT OR IGNORE INTO protocolo_eventos (id, protocolo_numero, canal, tipo, descricao, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertMsg = db.prepare(`
    INSERT OR IGNORE INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, produto_codigo, score_atrito_turno, protocolo_numero, created_at)
    VALUES (@id, @sessao_id, @papel, @conteudo, @intencao_codigo, @produto_codigo, @score_atrito_turno, @protocolo_numero, @created_at)
  `)
  const insertSinal = db.prepare(`INSERT OR IGNORE INTO sinais_atrito (id, sessao_id, tipo, valor, created_at) VALUES (?, ?, ?, ?, ?)`)
  const insertFila = db.prepare(`
    INSERT OR IGNORE INTO fila_atendimento (id, protocolo_numero, sessao_id, cliente_id, canal, motivo, prioridade, score_atrito, risco_churn, tipo_servico, produto_linha, status, resumo_contexto, entrou_em)
    VALUES (@id, @protocolo_numero, @sessao_id, @cliente_id, @canal, @motivo, @prioridade, @score_atrito, @risco_churn, @tipo_servico, @produto_linha, 'aguardando', @resumo, @entrou_em)
  `)
  const insertMem = db.prepare(`
    INSERT OR IGNORE INTO memoria_conversacional (id, cliente_id, sessao_id, canal, produto_codigo, intencao, resumo, resolvido, pendencias, created_at)
    VALUES (@id, @cliente_id, @sessao_id, @canal, @produto_codigo, @intencao, @resumo, @resolvido, @pendencias, @created_at)
  `)

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PERSONAS DE ROTEIRO
  // ═══════════════════════════════════════════════════════════════════════════
  const personas = [
    {
      id: 'cli-helena-duarte', nome: 'Helena Duarte', email: 'helena.duarte@email.com',
      telefone: '(11) 97788-1122', cpf_mascara: '***.***.902-**', cnpj_mascara: null,
      tipo_pessoa: 'PF', segmento: 'pessoal', perfil_persona: 'assistido',
      contrato: {
        id: 'ctr-helena-fibra', produto_codigo: 'RES-FIB-350', linha: 'residencial',
        plano_nome: 'Claro Fibra 350 Mega', valor_mensal: 79.90, data_inicio: '2022-09-12',
        dados_extra: j({
          endereco: 'Rua Coronel Bento, 78 — Santana, São Paulo/SP',
          ponto_instalacao: 'PT-SP-780455', tecnologia: 'Fibra óptica (FTTH)',
          modem: 'Askey RTF3505VW', velocidade_down: 350, velocidade_up: 175,
          status_modem: 'oscilando', sinal_nivel: 'degradado',
        }),
      },
    },
    {
      id: 'cli-tiago-ramos', nome: 'Tiago Ramos', email: 'tiago.ramos@email.com',
      telefone: '(31) 98844-5566', cpf_mascara: '***.***.337-**', cnpj_mascara: null,
      tipo_pessoa: 'PF', segmento: 'pessoal', perfil_persona: 'informal',
      contrato: {
        id: 'ctr-tiago-mov', produto_codigo: 'MOV-POS-50', linha: 'movel',
        plano_nome: 'Claro Pós 50GB', valor_mensal: 89.90, data_inicio: '2024-04-08',
        dados_extra: j({ msisdn: '31988445566', eSIM: true, titular: true, chip_segmento: 'pessoal' }),
      },
    },
    {
      id: 'cli-nexo-log', nome: 'Nexo Log Transportes', email: 'ti@nexolog.com.br',
      telefone: '(41) 3322-9090', cpf_mascara: null, cnpj_mascara: '**.***.***/0001-**',
      tipo_pessoa: 'PJ', segmento: 'empresarial', perfil_persona: 'digital',
      contrato: {
        id: 'ctr-nexo-fibra', produto_codigo: 'EMP-FIB-500', linha: 'empresas',
        plano_nome: 'Claro Empresas Internet Fibra 500 Mega — Filial Curitiba', valor_mensal: 249.90,
        data_inicio: '2024-07-01',
        dados_extra: j({
          razao_social: 'Nexo Log Transportes Ltda', cnpj_mascara: '**.***.***/0001-**',
          site: 'Filial Curitiba — Rua XV de Novembro, 1400, Curitiba/PR',
          centro_custo: 'CC-LOG-014', velocidade_mbps: 500, ip_fixo: '187.xxx.xxx.12/30',
          suporte: '24x7', portal: 'Gestor Online Claro Empresas',
        }),
      },
    },
  ]

  for (const p of personas) {
    const { contrato, ...cliente } = p
    insertCli.run(cliente)
    insertCtr.run({ ...contrato, cliente_id: p.id })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. FILA POVOADA — seis casos fictícios aguardando atendente
  // ═══════════════════════════════════════════════════════════════════════════
  const casosFila = [
    {
      id: 'cli-fila-marcos', nome: 'Marcos Aurélio Pinto', persona: 'intermediario', canal: 'whatsapp',
      telefone: '(11) 98123-4455', produto: 'RES-FIB-1G', linha: 'residencial', plano: 'Claro Fibra 1 Giga',
      valor: 299.90, assunto: 'Solicitação de cancelamento', intencao: 'cancelamento', tipo_servico: 'retencao',
      score: 92, churn: 96, minutos: 14,
      motivo: 'ClaroSense: menção explícita a cancelamento com proposta da concorrência',
      falas: ['é a quarta vez que ligo por causa da mesma queda', 'a vivo me ofereceu o dobro pela metade, quero cancelar hoje'],
      sinais: ['repeticao_intencao', 'intencao_cancelamento', 'sentimento_negativo'],
    },
    {
      id: 'cli-fila-vania', nome: 'Vânia Castro', persona: 'assistido', canal: 'callcenter',
      telefone: '(21) 97654-1212', produto: 'RES-FIB-500', linha: 'residencial', plano: 'Claro Fibra 500 Mega',
      valor: 139.99, assunto: 'Cobrança divergente na fatura', intencao: 'segunda_via', tipo_servico: 'financeiro',
      score: 84, churn: 79, minutos: 21,
      motivo: 'ClaroSense: score de atrito 84/100 após três contatos sobre a mesma cobrança',
      falas: ['de novo essa cobrança de R$ 49,90 que ninguém explica', 'já mandei o comprovante duas vezes e continua em aberto'],
      sinais: ['repeticao_intencao', 'sentimento_negativo', 'recontato_multicanal'],
    },
    {
      id: 'cli-fila-brunoq', nome: 'Bruno Quaresma', persona: 'digital', canal: 'app',
      telefone: '(48) 99321-7788', produto: 'MOV-MAX-FLEX', linha: 'movel', plano: 'Claro Max Flex',
      valor: 119.90, assunto: 'Portabilidade numérica', intencao: 'portabilidade', tipo_servico: 'retencao',
      score: 71, churn: 74, minutos: 9,
      motivo: 'Cliente solicitou atendimento humano durante processo de portabilidade de saída',
      falas: ['pedi a portabilidade e o prazo já estourou', 'quero falar com um atendente sobre o cancelamento do meu número'],
      sinais: ['solicita_humano', 'intencao_cancelamento'],
    },
    {
      id: 'cli-fila-delta', nome: 'Delta Serviços Médicos Ltda', persona: 'digital', canal: 'site', tipo_pessoa: 'PJ',
      telefone: '(11) 3777-4000', produto: 'EMP-LINK-DED', linha: 'empresas', plano: 'Link Dedicado 300 Mbps — Unidade Centro',
      valor: 1890.00, assunto: 'Suporte técnico', intencao: 'suporte_tecnico', tipo_servico: 'tecnico',
      score: 66, churn: 58, minutos: 6,
      motivo: 'Cliente corporativo com SLA contratual: 2 interrupções acima da janela permitida',
      falas: ['o link caiu duas vezes hoje e estamos com o agendamento parado', 'preciso de posição formal sobre o SLA'],
      sinais: ['repeticao_intencao', 'recontato_multicanal'],
    },
    {
      id: 'cli-fila-sonia', nome: 'Sônia Bezerra', persona: 'assistido', canal: 'whatsapp',
      telefone: '(85) 98877-6655', produto: 'TV-BOX-PLUS', linha: 'tv', plano: 'Claro Box tv+',
      valor: 119.90, assunto: 'Claro tv+ / streaming', intencao: 'streaming', tipo_servico: 'tecnico',
      score: 48, churn: 41, minutos: 17,
      motivo: 'Cliente solicitou atendimento humano após duas tentativas de configuração',
      falas: ['não estou conseguindo entrar na netflix pelo box', 'prefiro falar com uma pessoa, não entendo esses passos'],
      sinais: ['solicita_humano', 'repeticao_intencao'],
    },
    {
      id: 'cli-fila-jefferson', nome: 'Jefferson Okamoto', persona: 'informal', canal: 'whatsapp',
      telefone: '(11) 96655-3322', produto: 'MOV-CTR-40', linha: 'movel', plano: 'Claro Controle 40GB',
      valor: 59.90, assunto: 'Agendamento de visita técnica', intencao: 'visita_tecnica', tipo_servico: 'tecnico',
      score: 34, churn: 24, minutos: 3,
      motivo: 'Cliente solicitou atendimento humano para remarcar visita já agendada',
      falas: ['cara, o técnico não apareceu na janela de ontem', 'dá pra remarcar com alguém de verdade?'],
      sinais: ['solicita_humano'],
    },
  ]

  const PESO_SINAL = {
    repeticao_intencao: 22, sentimento_negativo: 28, tom_agressivo: 35,
    solicita_humano: 35, intencao_cancelamento: 30, recontato_multicanal: 15, monossilabico: 10,
  }

  for (const c of casosFila) {
    insertCli.run({
      id: c.id, nome: c.nome, email: `${c.id.replace('cli-fila-', '')}@email.com`,
      telefone: c.telefone, cpf_mascara: c.tipo_pessoa === 'PJ' ? null : '***.***.000-**',
      cnpj_mascara: c.tipo_pessoa === 'PJ' ? '**.***.***/0001-**' : null,
      tipo_pessoa: c.tipo_pessoa || 'PF', segmento: c.tipo_pessoa === 'PJ' ? 'empresarial' : 'pessoal',
      perfil_persona: c.persona,
    })
    insertCtr.run({
      id: `ctr-${c.id}`, cliente_id: c.id, produto_codigo: c.produto, linha: c.linha,
      plano_nome: c.plano, valor_mensal: c.valor, data_inicio: '2024-01-15', dados_extra: j({}),
    })

    const sessaoId = `ses-${c.id}`
    const numero = proximoSequencial()
    const entrada = minutosAtras(c.minutos)
    const inicio = minutosAtras(c.minutos + 12)

    insertSes.run({
      id: sessaoId, cliente_id: c.id, canal: c.canal, produto_codigo_foco: c.produto,
      score_atrito: c.score, risco_churn: c.churn, status: 'transferida',
      verificado: c.canal === 'whatsapp' ? 1 : 0, protocolo_numero: numero,
      trace_id: `tr-${c.id}`, created_at: inicio, updated_at: entrada,
    })
    insertProto.run({
      numero, cliente_id: c.id, sessao_id: sessaoId, canal: c.canal,
      tipo: c.intencao === 'cancelamento' ? 'cancelamento' : 'reclamacao',
      assunto: c.assunto, produto_codigo: c.produto, status: 'transferido',
      resolvido_por: null, score: c.score, created_at: inicio, updated_at: entrada, encerrado_at: null,
    })
    insertEv.run(uuidv4(), numero, c.canal, 'abertura', `Protocolo aberto no canal ${c.canal}: ${c.assunto}`, inicio)
    insertEv.run(uuidv4(), numero, c.canal, 'transferencia', c.motivo, entrada)

    c.falas.forEach((fala, i) => {
      insertMsg.run({
        id: uuidv4(), sessao_id: sessaoId, papel: 'cliente', conteudo: fala,
        intencao_codigo: c.intencao, produto_codigo: c.produto,
        score_atrito_turno: Math.round(c.score * (i + 1) / c.falas.length),
        protocolo_numero: numero, created_at: minutosAtras(c.minutos + 10 - i * 4),
      })
    })
    insertMsg.run({
      id: uuidv4(), sessao_id: sessaoId, papel: 'sistema',
      conteudo: `⚠️ Encaminhei você para um especialista. O protocolo **${numero}** leva todo o histórico junto — você não vai precisar repetir nada.`,
      intencao_codigo: 'transbordo_humano', produto_codigo: c.produto,
      score_atrito_turno: c.score, protocolo_numero: numero, created_at: entrada,
    })

    for (const tipo of c.sinais) {
      insertSinal.run(uuidv4(), sessaoId, tipo, PESO_SINAL[tipo] || 20, minutosAtras(c.minutos + 2))
    }

    insertFila.run({
      id: uuidv4(), protocolo_numero: numero, sessao_id: sessaoId, cliente_id: c.id, canal: c.canal,
      motivo: c.motivo,
      prioridade: c.churn >= 70 || c.score >= 80 || c.intencao === 'cancelamento' ? 'alta'
        : c.churn >= 40 || c.score >= 50 ? 'media' : 'baixa',
      score_atrito: c.score, risco_churn: c.churn, tipo_servico: c.tipo_servico, produto_linha: c.linha,
      resumo: j({
        cliente: c.nome, persona: c.persona, canal: c.canal, produto: c.produto,
        intencao: c.intencao, score_atrito: c.score, risco_churn: c.churn,
        sinais: c.sinais.map(s => `${s} (1x)`),
        ultimas_mensagens: c.falas.map(t => ({ papel: 'cliente', texto: t })),
      }),
      entrou_em: entrada,
    })

    insertMem.run({
      id: uuidv4(), cliente_id: c.id, sessao_id: sessaoId, canal: c.canal, produto_codigo: c.produto,
      intencao: c.intencao, resumo: `${c.assunto}. ${c.falas[0]}`, resolvido: 0,
      pendencias: j(['aguardando atendente humano']), created_at: entrada,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. VOLUME HISTÓRICO — 30 dias
  // ═══════════════════════════════════════════════════════════════════════════
  const clientesHistorico = NOMES_HISTORICO.map(([nome, sexo], i) => {
    const pj = sexo === 'PJ'
    const produtosPessoais = produtos.filter(p => p.segmento === 'pessoal')
    const produtosEmpresa = produtos.filter(p => p.segmento === 'empresarial')
    const produto = pj ? escolher(rand, produtosEmpresa) : escolher(rand, produtosPessoais)

    const cliente = {
      id: `cli-hist-${String(i + 1).padStart(2, '0')}`,
      nome,
      email: `${nome.toLowerCase().replace(/[^a-z]+/g, '.')}@email.com`,
      telefone: `(${11 + (i % 80)}) 9${String(80000000 + i * 137).slice(0, 8)}`,
      cpf_mascara: pj ? null : `***.***.${String(100 + i)}-**`,
      cnpj_mascara: pj ? '**.***.***/0001-**' : null,
      tipo_pessoa: pj ? 'PJ' : 'PF',
      segmento: pj ? 'empresarial' : 'pessoal',
      perfil_persona: ponderado(rand, [['intermediario', 40], ['digital', 28], ['assistido', 20], ['informal', 12]]),
    }
    insertCli.run(cliente)
    insertCtr.run({
      id: `ctr-hist-${i + 1}`, cliente_id: cliente.id, produto_codigo: produto.codigo,
      linha: produto.linha, plano_nome: produto.nome, valor_mensal: produto.valor_referencia || 99.90,
      data_inicio: '2024-02-01', dados_extra: j({}),
    })
    return { ...cliente, produto }
  })

  const CANAIS = [['app', 34], ['whatsapp', 30], ['site', 22], ['callcenter', 14]]
  // Sequencial por dia: o número do protocolo carrega a data, como em produção
  const sequenciaPorDia = {}
  const agora = new Date()
  let totalHistorico = 0

  db.exec('BEGIN')
  // -1 representa a "última hora": um punhado de atendimentos nos últimos 55
  // minutos, para que o filtro de período mais curto também tenha o que mostrar.
  for (let diasAtras = 29; diasAtras >= -1; diasAtras--) {
    const ultimaHora = diasAtras === -1
    const dia = new Date(agora.getTime() - Math.max(diasAtras, 0) * 86400000)
    const diaSemana = dia.getDay()
    // Segunda a sexta concentram o volume; domingo é o vale da semana
    const base = diaSemana === 0 ? 9 : diaSemana === 6 ? 12 : 17
    const quantidade = ultimaHora ? 7 : base + Math.floor(rand() * 7)

    for (let k = 0; k < quantidade; k++) {
      const cliente = escolher(rand, clientesHistorico)
      const jornada = ponderado(rand, JORNADAS.map(jo => [jo, jo.peso]))
      const canal = ponderado(rand, CANAIS)

      // Horário: concentra no comercial, com pico no início da noite
      const hora = ponderado(rand, [
        [8, 4], [9, 7], [10, 9], [11, 9], [12, 6], [13, 7], [14, 9],
        [15, 9], [16, 8], [17, 8], [18, 11], [19, 12], [20, 9], [21, 5], [22, 3],
      ])
      const quando = ultimaHora
        ? new Date(agora.getTime() - Math.floor(3 + rand() * 52) * 60000)
        : new Date(dia)
      if (!ultimaHora) quando.setHours(hora, Math.floor(rand() * 60), Math.floor(rand() * 60), 0)
      // O último dia só existe até agora — não se inventa atendimento no futuro
      if (quando > agora) continue

      const score = Math.max(0, Math.min(100, Math.round(jornada.base + (rand() - 0.5) * 52)))
      const churn = Math.max(0, Math.min(100, Math.round(score * 0.7 + (rand() - 0.4) * 20)))
      // Transbordo: automático acima do limiar do ClaroSense, e uma fração dos
      // casos de atrito médio em que o cliente pediu humano por conta própria.
      const transferida = score >= 72 || (score >= 45 && rand() < 0.22)
      const duracaoMin = 3 + Math.floor(rand() * 22)
      const fim = new Date(Math.min(quando.getTime() + duracaoMin * 60000, agora.getTime()))
      const aindaAberto = diasAtras <= 0 && rand() < 0.35

      const diaChave = ts(quando).slice(0, 10).replace(/-/g, '')
      // O sequencial do dia continua de onde os protocolos já gravados pararam
      // — hoje já tem os roteiros e a fila numerados antes deste bloco.
      if (sequenciaPorDia[diaChave] === undefined) {
        const jaExistem = db.prepare(`SELECT COUNT(*) AS n FROM protocolos WHERE numero LIKE ?`).get(`${diaChave}%`)
        sequenciaPorDia[diaChave] = jaExistem?.n || 0
      }
      sequenciaPorDia[diaChave] += 1
      const numero = `${diaChave}${String(sequenciaPorDia[diaChave]).padStart(6, '0')}`
      const sessaoId = uuidv4()

      insertSes.run({
        id: sessaoId, cliente_id: cliente.id, canal, produto_codigo_foco: cliente.produto.codigo,
        score_atrito: score, risco_churn: churn,
        status: aindaAberto ? 'ativa' : transferida ? 'transferida' : 'encerrada',
        verificado: canal === 'whatsapp' ? 1 : 0, protocolo_numero: numero,
        trace_id: uuidv4(), created_at: ts(quando), updated_at: ts(fim),
      })

      insertProto.run({
        numero, cliente_id: cliente.id, sessao_id: sessaoId, canal,
        tipo: jornada.intencao === 'cancelamento' ? 'cancelamento'
          : ['suporte_tecnico', 'segunda_via'].includes(jornada.intencao) ? 'reclamacao' : 'solicitacao',
        assunto: jornada.assunto, produto_codigo: cliente.produto.codigo,
        status: aindaAberto ? 'aberto' : transferida ? 'resolvido' : 'resolvido',
        resolvido_por: aindaAberto ? null : transferida ? 'atendente_humano' : 'autoatendimento',
        score, created_at: ts(quando), updated_at: ts(fim),
        encerrado_at: aindaAberto ? null : ts(fim),
      })

      const fala = escolher(rand, FALAS_CLIENTE[jornada.assunto] || ['preciso de ajuda'])
      insertMsg.run({
        id: uuidv4(), sessao_id: sessaoId, papel: 'cliente', conteudo: fala,
        intencao_codigo: jornada.intencao, produto_codigo: cliente.produto.codigo,
        score_atrito_turno: score, protocolo_numero: numero, created_at: ts(quando),
      })
      insertMsg.run({
        id: uuidv4(), sessao_id: sessaoId, papel: 'sistema',
        conteudo: transferida
          ? `Encaminhei seu caso para um especialista. Protocolo **${numero}** com o histórico completo.`
          : `Localizei seu contrato ${cliente.produto.nome}. Protocolo **${numero}** registrado para este atendimento.`,
        intencao_codigo: transferida ? 'transbordo_humano' : jornada.intencao,
        produto_codigo: cliente.produto.codigo, score_atrito_turno: score,
        protocolo_numero: numero, created_at: ts(new Date(quando.getTime() + 40000)),
      })

      // Sinais coerentes com o score: a escalada é a mesma régua do ClaroSense
      const sinais = []
      if (score >= 35) sinais.push('repeticao_intencao')
      if (score >= 50) sinais.push('sentimento_negativo')
      if (score >= 80) sinais.push('tom_agressivo')
      if (score >= 72 && rand() < 0.6) sinais.push('solicita_humano')
      if (jornada.intencao === 'cancelamento') sinais.push('intencao_cancelamento')
      if (rand() < 0.18) sinais.push('recontato_multicanal')
      for (const tipo of sinais) {
        insertSinal.run(uuidv4(), sessaoId, tipo, PESO_SINAL[tipo], ts(new Date(quando.getTime() + 60000)))
      }

      totalHistorico++
    }
  }
  db.exec('COMMIT')

  return {
    personas: personas.length,
    fila: casosFila.length,
    clientes_historico: clientesHistorico.length,
    atendimentos_historico: totalHistorico,
  }
}

module.exports = { popular }
