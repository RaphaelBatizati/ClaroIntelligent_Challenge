const { getDb } = require('./database')
const { v4: uuidv4 } = require('uuid')

function seed() {
  const db = getDb()

  db.exec(`
    DELETE FROM memoria_conversacional;
    DELETE FROM intervencoes;
    DELETE FROM sinais_atrito;
    DELETE FROM mensagens;
    DELETE FROM sessoes;
    DELETE FROM contratos;
    DELETE FROM clientes;
    DELETE FROM produtos_catalogo;
  `)

  // ─── CATÁLOGO DE PRODUTOS ──────────────────────────────
  const produtos = [
    // Residencial
    { codigo: 'RES-FIB-100', nome: 'Claro Fibra 100 Mega', linha: 'residencial', familia: 'fibra', descricao: 'Internet fibra óptica 100Mbps' },
    { codigo: 'RES-FIB-300', nome: 'Claro Fibra 300 Mega', linha: 'residencial', familia: 'fibra', descricao: 'Internet fibra óptica 300Mbps' },
    { codigo: 'RES-FIB-500', nome: 'Claro Fibra 500 Mega', linha: 'residencial', familia: 'fibra', descricao: 'Internet fibra óptica 500Mbps' },
    { codigo: 'RES-FIB-1G', nome: 'Claro Fibra 1 Giga', linha: 'residencial', familia: 'fibra', descricao: 'Internet fibra óptica 1Gbps' },
    // Móvel
    { codigo: 'MOV-POS-CTRL', nome: 'Claro Controle 25', linha: 'movel', familia: 'controle', descricao: 'Plano Controle 25GB + ligações ilimitadas' },
    { codigo: 'MOV-POS-50', nome: 'Claro Pós 50GB', linha: 'movel', familia: 'pos-pago', descricao: 'Pós-Pago 50GB + roaming nacional' },
    { codigo: 'MOV-POS-100', nome: 'Claro Pós 100GB', linha: 'movel', familia: 'pos-pago', descricao: 'Pós-Pago 100GB + Apps ilimitados' },
    { codigo: 'MOV-MAX-FLEX', nome: 'Claro Max Flex', linha: 'movel', familia: 'max', descricao: 'Dados ilimitados + streaming + roaming' },
    // TV
    { codigo: 'TV-PLUS-START', nome: 'Claro tv+ Start', linha: 'tv', familia: 'streaming', descricao: 'Plataforma de streaming Claro tv+' },
    { codigo: 'TV-PLUS-TOTAL', nome: 'Claro tv+ Total', linha: 'tv', familia: 'streaming', descricao: 'Streaming + canais ao vivo + HBO MAX' },
    { codigo: 'TV-BOX-PLUS', nome: 'Claro Box Conectado', linha: 'tv', familia: 'box', descricao: 'Box 4K com streaming e canais a cabo' },
    // Combos
    { codigo: 'CMB-FIB300-POS50', nome: 'Combo Família', linha: 'residencial', familia: 'combo', descricao: 'Fibra 300 + 2 linhas Pós 50GB + Claro tv+' },
  ]

  const insertProd = db.prepare(`INSERT OR IGNORE INTO produtos_catalogo (codigo, nome, linha, familia, descricao) VALUES (@codigo, @nome, @linha, @familia, @descricao)`)
  for (const p of produtos) insertProd.run(p)

  // ─── CLIENTES DOS 4 ROTEIROS ───────────────────────────
  const clientes = [
    // Roteiro A: Continuidade entre canais
    {
      id: 'cli-ana-souza',
      nome: 'Ana Souza',
      email: 'ana.souza@email.com',
      telefone: '(11) 98765-4321',
      cpf_mascara: '***.***.456-**',
      perfil_persona: 'intermediario',
    },
    // Roteiro B: Desambiguação multiproduto
    {
      id: 'cli-carlos-mota',
      nome: 'Carlos Mota',
      email: 'carlos.mota@email.com',
      telefone: '(21) 99876-5432',
      cpf_mascara: '***.***.789-**',
      perfil_persona: 'digital',
    },
    // Roteiro C: ClaroSense + transbordo
    {
      id: 'cli-fernanda-lima',
      nome: 'Fernanda Lima',
      email: 'fernanda.lima@email.com',
      telefone: '(31) 97654-3210',
      cpf_mascara: '***.***.123-**',
      perfil_persona: 'assistido',
    },
    // Roteiro D / Painel Admin
    {
      id: 'cli-joao-santos',
      nome: 'João Santos',
      email: 'joao.santos@email.com',
      telefone: '(51) 96543-2109',
      cpf_mascara: '***.***.654-**',
      perfil_persona: 'intermediario',
    },
    // Extras para preencher o monitor
    {
      id: 'cli-mariana-costa',
      nome: 'Mariana Costa',
      email: 'mariana@email.com',
      telefone: '(11) 91234-5678',
      cpf_mascara: '***.***.321-**',
      perfil_persona: 'digital',
    },
    {
      id: 'cli-roberto-alves',
      nome: 'Roberto Alves',
      email: 'roberto@email.com',
      telefone: '(21) 98888-7777',
      cpf_mascara: '***.***.555-**',
      perfil_persona: 'assistido',
    },
  ]

  const insertCli = db.prepare(`INSERT OR IGNORE INTO clientes (id, nome, email, telefone, cpf_mascara, perfil_persona) VALUES (@id, @nome, @email, @telefone, @cpf_mascara, @perfil_persona)`)
  for (const c of clientes) insertCli.run(c)

  // ─── CONTRATOS ────────────────────────────────────────
  const contratos = [
    // Ana Souza - fibra 300
    { id: 'ctr-ana-fibra', cliente_id: 'cli-ana-souza', produto_codigo: 'RES-FIB-300', linha: 'residencial', plano_nome: 'Claro Fibra 300 Mega', valor_mensal: 99.90, data_inicio: '2024-03-15', dados_extra: JSON.stringify({ endereco: 'Rua das Flores, 142, São Paulo - SP', modem: 'Intelbras W5-1200GE', mac: 'AA:BB:CC:DD:EE:FF', velocidade_down: 300, velocidade_up: 150 }) },

    // Carlos Mota - fibra + 2 linhas móveis + tv
    { id: 'ctr-carlos-fibra', cliente_id: 'cli-carlos-mota', produto_codigo: 'RES-FIB-500', linha: 'residencial', plano_nome: 'Claro Fibra 500 Mega', valor_mensal: 129.90, data_inicio: '2023-11-01', dados_extra: JSON.stringify({ endereco: 'Av. Brasil, 890, Rio de Janeiro - RJ', modem: 'Asus AX3000', velocidade_down: 500, velocidade_up: 250 }) },
    { id: 'ctr-carlos-mov1', cliente_id: 'cli-carlos-mota', produto_codigo: 'MOV-POS-100', linha: 'movel', plano_nome: 'Claro Pós 100GB', valor_mensal: 89.90, data_inicio: '2022-06-10', dados_extra: JSON.stringify({ msisdn: '21999876543', iccid: '89550173...', eSIM: false }) },
    { id: 'ctr-carlos-mov2', cliente_id: 'cli-carlos-mota', produto_codigo: 'MOV-POS-50', linha: 'movel', plano_nome: 'Claro Pós 50GB (dependente)', valor_mensal: 59.90, data_inicio: '2023-01-20', dados_extra: JSON.stringify({ msisdn: '21988765432', titular: false, nome_dependente: 'Beatriz Mota' }) },
    { id: 'ctr-carlos-tv', cliente_id: 'cli-carlos-mota', produto_codigo: 'TV-PLUS-TOTAL', linha: 'tv', plano_nome: 'Claro tv+ Total', valor_mensal: 49.90, data_inicio: '2024-01-05', dados_extra: JSON.stringify({ login: 'carlos.mota@clarotv.com', dispositivos: 3 }) },

    // Fernanda Lima - fibra 100
    { id: 'ctr-fernanda-fibra', cliente_id: 'cli-fernanda-lima', produto_codigo: 'RES-FIB-100', linha: 'residencial', plano_nome: 'Claro Fibra 100 Mega', valor_mensal: 79.90, data_inicio: '2024-08-01', dados_extra: JSON.stringify({ endereco: 'Rua do Sol, 33, Belo Horizonte - MG', modem: 'Technicolor TC7200', velocidade_down: 100, velocidade_up: 50 }) },

    // João Santos - fibra + móvel
    { id: 'ctr-joao-fibra', cliente_id: 'cli-joao-santos', produto_codigo: 'RES-FIB-300', linha: 'residencial', plano_nome: 'Claro Fibra 300 Mega', valor_mensal: 99.90, data_inicio: '2023-05-20', dados_extra: JSON.stringify({ endereco: 'Av. Ipiranga, 555, Porto Alegre - RS', modem: 'TP-Link AX1800', velocidade_down: 300, velocidade_up: 150 }) },
    { id: 'ctr-joao-mov', cliente_id: 'cli-joao-santos', produto_codigo: 'MOV-MAX-FLEX', linha: 'movel', plano_nome: 'Claro Max Flex', valor_mensal: 119.90, data_inicio: '2024-02-14', dados_extra: JSON.stringify({ msisdn: '51965432109' }) },

    // Extras
    { id: 'ctr-mariana-fibra', cliente_id: 'cli-mariana-costa', produto_codigo: 'RES-FIB-1G', linha: 'residencial', plano_nome: 'Claro Fibra 1 Giga', valor_mensal: 199.90, data_inicio: '2024-06-01', dados_extra: JSON.stringify({ endereco: 'Rua Augusta, 2200, São Paulo - SP', velocidade_down: 1000, velocidade_up: 500 }) },
    { id: 'ctr-roberto-mov', cliente_id: 'cli-roberto-alves', produto_codigo: 'MOV-POS-CTRL', linha: 'movel', plano_nome: 'Claro Controle 25', valor_mensal: 44.90, data_inicio: '2025-01-10', dados_extra: JSON.stringify({ msisdn: '21988887777' }) },
  ]

  const insertCtr = db.prepare(`INSERT OR IGNORE INTO contratos (id, cliente_id, produto_codigo, linha, plano_nome, valor_mensal, data_inicio, dados_extra) VALUES (@id, @cliente_id, @produto_codigo, @linha, @plano_nome, @valor_mensal, @data_inicio, @dados_extra)`)
  for (const c of contratos) insertCtr.run(c)

  // ─── SESSÕES DE DEMO ──────────────────────────────────
  const agora = new Date()
  function minutosAtras(n) {
    return new Date(agora.getTime() - n * 60000).toISOString().replace('T', ' ').slice(0, 19)
  }

  const sessoes = [
    // Roteiro A - Sessão 1: Ana no Site (suporte tecnico - aberta no site)
    { id: 'ses-ana-site', cliente_id: 'cli-ana-souza', canal: 'site', produto_codigo_foco: 'RES-FIB-300', produto_confirmado: 1, score_atrito: 35, status: 'encerrada', trace_id: 'tr-a1', created_at: minutosAtras(65), updated_at: minutosAtras(55) },
    // Roteiro A - Sessão 2: Ana no WhatsApp (continuidade)
    { id: 'ses-ana-whatsapp', cliente_id: 'cli-ana-souza', canal: 'whatsapp', produto_codigo_foco: 'RES-FIB-300', produto_confirmado: 1, score_atrito: 22, status: 'ativa', trace_id: 'tr-a2', created_at: minutosAtras(18), updated_at: minutosAtras(5) },
    // Roteiro B - Carlos no App (multiproduto)
    { id: 'ses-carlos-app', cliente_id: 'cli-carlos-mota', canal: 'app', produto_codigo_foco: 'MOV-POS-100', produto_confirmado: 1, score_atrito: 12, status: 'ativa', trace_id: 'tr-b1', created_at: minutosAtras(22), updated_at: minutosAtras(3) },
    // Roteiro C - Fernanda no WhatsApp (ClaroSense)
    { id: 'ses-fernanda-wpp', cliente_id: 'cli-fernanda-lima', canal: 'whatsapp', produto_codigo_foco: 'RES-FIB-100', produto_confirmado: 1, score_atrito: 78, status: 'transferida', trace_id: 'tr-c1', created_at: minutosAtras(41), updated_at: minutosAtras(8) },
    // João ativo
    { id: 'ses-joao-app', cliente_id: 'cli-joao-santos', canal: 'app', produto_codigo_foco: 'MOV-MAX-FLEX', produto_confirmado: 1, score_atrito: 18, status: 'ativa', trace_id: 'tr-d1', created_at: minutosAtras(14), updated_at: minutosAtras(2) },
    // Mariana no site
    { id: 'ses-mariana-site', cliente_id: 'cli-mariana-costa', canal: 'site', produto_codigo_foco: 'RES-FIB-1G', produto_confirmado: 1, score_atrito: 5, status: 'ativa', trace_id: 'tr-e1', created_at: minutosAtras(8), updated_at: minutosAtras(1) },
    // Roberto com risco
    { id: 'ses-roberto-wpp', cliente_id: 'cli-roberto-alves', canal: 'whatsapp', produto_codigo_foco: 'MOV-POS-CTRL', produto_confirmado: 1, score_atrito: 65, status: 'ativa', trace_id: 'tr-f1', created_at: minutosAtras(55), updated_at: minutosAtras(12) },
  ]

  const insertSes = db.prepare(`INSERT OR IGNORE INTO sessoes (id, cliente_id, canal, produto_codigo_foco, produto_confirmado, score_atrito, status, trace_id, created_at, updated_at) VALUES (@id, @cliente_id, @canal, @produto_codigo_foco, @produto_confirmado, @score_atrito, @status, @trace_id, @created_at, @updated_at)`)
  for (const s of sessoes) insertSes.run(s)

  // ─── MENSAGENS DE DEMO ────────────────────────────────
  const insertMsg = db.prepare(`INSERT OR IGNORE INTO mensagens (id, sessao_id, papel, conteudo, intencao_codigo, produto_codigo, score_atrito_turno, created_at) VALUES (@id, @sessao_id, @papel, @conteudo, @intencao_codigo, @produto_codigo, @score_atrito_turno, @created_at)`)

  const msgs = [
    // Ana Site (sessão 1 encerrada)
    { id: uuidv4(), sessao_id: 'ses-ana-site', papel: 'cliente', conteudo: 'minha internet caiu', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-300', score_atrito_turno: 10, created_at: minutosAtras(63) },
    { id: uuidv4(), sessao_id: 'ses-ana-site', papel: 'sistema', conteudo: 'Olá Ana! Identifiquei sua Claro Fibra 300 Mega. Vou verificar seu sinal agora... Há uma instabilidade registrada na sua área (SP - Zona Sul) nas últimas 2h. Nossa equipe técnica já está atuando. Previsão de resolução: 45 min. Posso te avisar aqui quando normalizar?', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-300', score_atrito_turno: 10, created_at: minutosAtras(62) },
    { id: uuidv4(), sessao_id: 'ses-ana-site', papel: 'cliente', conteudo: 'ainda não voltou', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-300', score_atrito_turno: 35, created_at: minutosAtras(58) },
    { id: uuidv4(), sessao_id: 'ses-ana-site', papel: 'sistema', conteudo: 'Entendo, Ana. A instabilidade na sua região ainda está em tratamento. Enquanto isso, tente reiniciar seu modem: desligue da tomada por 30 segundos e religue. Se preferir, posso agendar um retorno por WhatsApp assim que resolver.', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-300', score_atrito_turno: 35, created_at: minutosAtras(57) },

    // Ana WhatsApp (sessão 2 ativa - continuidade)
    { id: uuidv4(), sessao_id: 'ses-ana-whatsapp', papel: 'sistema', conteudo: '💡 *ClaroMemory*: Olá Ana! Identifico que você falou com a gente pelo Site há cerca de 1 hora sobre instabilidade na internet. A situação da sua região foi resolvida às 20h14. Sua fibra está funcionando agora?', intencao_codigo: 'continuidade', produto_codigo: 'RES-FIB-300', score_atrito_turno: 10, created_at: minutosAtras(17) },
    { id: uuidv4(), sessao_id: 'ses-ana-whatsapp', papel: 'cliente', conteudo: 'sim mas continua lenta', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-300', score_atrito_turno: 22, created_at: minutosAtras(15) },
    { id: uuidv4(), sessao_id: 'ses-ana-whatsapp', papel: 'sistema', conteudo: 'Entendi, Ana. Vejo que seu plano é 300 Mega. Testei remotamente seu sinal: *Downstream 187 Mbps / Upstream 91 Mbps* — abaixo do contratado. Vou iniciar um diagnóstico avançado no seu modem. Pode deixar ligado? Leva cerca de 3 minutos.', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-300', score_atrito_turno: 22, created_at: minutosAtras(14) },

    // Carlos App (multiproduto)
    { id: uuidv4(), sessao_id: 'ses-carlos-app', papel: 'cliente', conteudo: 'quero a segunda via da minha fatura', intencao_codigo: 'segunda_via', produto_codigo: null, score_atrito_turno: 5, created_at: minutosAtras(21) },
    { id: uuidv4(), sessao_id: 'ses-carlos-app', papel: 'sistema', conteudo: 'Olá Carlos! Identifiquei que você tem 3 produtos ativos conosco: Fibra 500 Mega, 2 linhas Pós-Pago e Claro tv+. De qual fatura você precisa da segunda via?', intencao_codigo: 'desambiguacao', produto_codigo: null, score_atrito_turno: 5, created_at: minutosAtras(20) },
    { id: uuidv4(), sessao_id: 'ses-carlos-app', papel: 'cliente', conteudo: 'do celular, da linha principal', intencao_codigo: 'segunda_via', produto_codigo: 'MOV-POS-100', score_atrito_turno: 5, created_at: minutosAtras(18) },
    { id: uuidv4(), sessao_id: 'ses-carlos-app', papel: 'sistema', conteudo: 'Perfeito! Linha *21 9 9876-5432* — Claro Pós 100GB. Sua fatura de agosto: *R$ 89,90* com vencimento em *10/09/2026*.\n\n📋 Código de barras:\n`0190.3370 2600.0000 0100 9.089900 2 10890000008990`\n\nDeseja pagar pelo app agora ou precisa de mais alguma coisa?', intencao_codigo: 'segunda_via', produto_codigo: 'MOV-POS-100', score_atrito_turno: 12, created_at: minutosAtras(17) },

    // Fernanda WhatsApp (ClaroSense + transbordo)
    { id: uuidv4(), sessao_id: 'ses-fernanda-wpp', papel: 'cliente', conteudo: 'minha internet não funciona', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-100', score_atrito_turno: 20, created_at: minutosAtras(40) },
    { id: uuidv4(), sessao_id: 'ses-fernanda-wpp', papel: 'sistema', conteudo: 'Oi Fernanda! Seu plano é a Claro Fibra 100 Mega. Identifico que seu modem está sem conexão há 47 minutos. Tente reiniciar desligando da tomada por 30 segundos e religando. Me avisa quando fizer isso!', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-100', score_atrito_turno: 20, created_at: minutosAtras(39) },
    { id: uuidv4(), sessao_id: 'ses-fernanda-wpp', papel: 'cliente', conteudo: 'já tentei isso várias vezes não adianta', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-100', score_atrito_turno: 45, created_at: minutosAtras(32) },
    { id: uuidv4(), sessao_id: 'ses-fernanda-wpp', papel: 'sistema', conteudo: 'Entendo, Fernanda. Vou tentar um diagnóstico remoto no seu modem... Identifico sinal intermitente na OLT que atende sua rua. Há possibilidade de problema no cabo externo. Posso agendar uma visita técnica para amanhã entre 8h-12h?', intencao_codigo: 'visita_tecnica', produto_codigo: 'RES-FIB-100', score_atrito_turno: 45, created_at: minutosAtras(30) },
    { id: uuidv4(), sessao_id: 'ses-fernanda-wpp', papel: 'cliente', conteudo: 'isso é um absurdo! já é a terceira vez que isso acontece! quero falar com humano!', intencao_codigo: 'suporte_tecnico', produto_codigo: 'RES-FIB-100', score_atrito_turno: 78, created_at: minutosAtras(15) },
    { id: uuidv4(), sessao_id: 'ses-fernanda-wpp', papel: 'sistema', conteudo: '⚠️ *ClaroSense detectou alto nível de insatisfação (score 78/100)*. Transferindo para atendente humano com especialização em fibra residencial. Tempo estimado de espera: 2 minutos. Sua prioridade na fila: ALTA. Todas as informações desta conversa já foram compartilhadas com o atendente.', intencao_codigo: 'transbordo_humano', produto_codigo: 'RES-FIB-100', score_atrito_turno: 78, created_at: minutosAtras(8) },
  ]

  for (const m of msgs) insertMsg.run(m)

  // ─── MEMÓRIA CONVERSACIONAL (Roteiro A) ───────────────
  const insertMem = db.prepare(`INSERT OR IGNORE INTO memoria_conversacional (id, cliente_id, sessao_id, canal, produto_codigo, intencao, resumo, resolvido, pendencias, created_at) VALUES (@id, @cliente_id, @sessao_id, @canal, @produto_codigo, @intencao, @resumo, @resolvido, @pendencias, @created_at)`)
  insertMem.run({
    id: uuidv4(),
    cliente_id: 'cli-ana-souza',
    sessao_id: 'ses-ana-site',
    canal: 'site',
    produto_codigo: 'RES-FIB-300',
    intencao: 'suporte_tecnico',
    resumo: 'Cliente relatou queda de internet. Identificada instabilidade na OLT da região (SP Zona Sul). Equipe técnica acionada. Aguardando normalização.',
    resolvido: 0,
    pendencias: JSON.stringify(['verificar se sinal foi normalizado', 'testar velocidade após retorno']),
    created_at: minutosAtras(60),
  })

  // ─── INTERVENÇÕES DE DEMO ─────────────────────────────
  const insertInt = db.prepare(`INSERT OR IGNORE INTO intervencoes (id, sessao_id, tipo, gatilho, acao, resultado, created_at) VALUES (@id, @sessao_id, @tipo, @gatilho, @acao, @resultado, @created_at)`)
  insertInt.run({ id: uuidv4(), sessao_id: 'ses-fernanda-wpp', tipo: 'transferencia_humano', gatilho: 'score_atrito >= 75', acao: 'Transferência automática para fila prioritária', resultado: 'Cliente transferida para atendente especializado', created_at: minutosAtras(8) })
  insertInt.run({ id: uuidv4(), sessao_id: 'ses-roberto-wpp', tipo: 'oferta_retencao', gatilho: 'score_atrito >= 60 AND intencao=cancelamento', acao: 'Oferta de desconto por 3 meses', resultado: 'pendente', created_at: minutosAtras(20) })

  console.log('✅ Seed concluído: 6 clientes, 10 contratos, 7 sessões, mensagens e memória carregados.')
}

seed()
