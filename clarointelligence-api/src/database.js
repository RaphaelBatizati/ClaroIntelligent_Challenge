// Uses node:sqlite — built into Node.js v22.5+ (no native compilation needed)
const { DatabaseSync } = require('node:sqlite')
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'clarointelligence.sqlite')

let _db = null

function getDb() {
  if (_db) return _db
  _db = new DatabaseSync(DB_PATH)
  initSchema(_db)
  migrate(_db)
  return _db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      cpf_mascara TEXT,
      perfil_persona TEXT DEFAULT 'intermediario',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS produtos_catalogo (
      codigo TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      linha TEXT NOT NULL,
      familia TEXT,
      descricao TEXT,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS contratos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT REFERENCES clientes(id),
      produto_codigo TEXT REFERENCES produtos_catalogo(codigo),
      linha TEXT NOT NULL,
      status TEXT DEFAULT 'ativo',
      plano_nome TEXT,
      valor_mensal REAL,
      data_inicio TEXT,
      dados_extra TEXT
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      id TEXT PRIMARY KEY,
      cliente_id TEXT REFERENCES clientes(id),
      canal TEXT NOT NULL,
      produto_codigo_foco TEXT,
      produto_confirmado INTEGER DEFAULT 0,
      score_atrito REAL DEFAULT 0,
      status TEXT DEFAULT 'ativa',
      trace_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mensagens (
      id TEXT PRIMARY KEY,
      sessao_id TEXT REFERENCES sessoes(id),
      papel TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      intencao_codigo TEXT,
      confianca_intencao REAL,
      produto_codigo TEXT,
      score_atrito_turno REAL,
      sinais_atrito TEXT,
      memoria_usada TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sinais_atrito (
      id TEXT PRIMARY KEY,
      sessao_id TEXT REFERENCES sessoes(id),
      mensagem_id TEXT,
      tipo TEXT,
      valor REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS intervencoes (
      id TEXT PRIMARY KEY,
      sessao_id TEXT REFERENCES sessoes(id),
      tipo TEXT NOT NULL,
      gatilho TEXT,
      acao TEXT,
      resultado TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memoria_conversacional (
      id TEXT PRIMARY KEY,
      cliente_id TEXT REFERENCES clientes(id),
      sessao_id TEXT REFERENCES sessoes(id),
      canal TEXT,
      produto_codigo TEXT,
      intencao TEXT,
      resumo TEXT,
      resolvido INTEGER DEFAULT 0,
      pendencias TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS personas_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      limiar_digital INTEGER DEFAULT 6,
      limiar_assistido INTEGER DEFAULT 3,
      sensibilidade INTEGER DEFAULT 7,
      delay_interv INTEGER DEFAULT 3,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO personas_config (id) VALUES (1);

    -- ─── Protocolo de atendimento (Anatel Res. 765/2023) ──────────────────
    CREATE TABLE IF NOT EXISTS protocolos (
      numero TEXT PRIMARY KEY,
      cliente_id TEXT REFERENCES clientes(id),
      sessao_id TEXT REFERENCES sessoes(id),
      canal_origem TEXT,
      canal_atual TEXT,
      tipo TEXT DEFAULT 'atendimento',
      assunto TEXT,
      produto_codigo TEXT,
      status TEXT DEFAULT 'aberto',
      resolvido_por TEXT,
      score_atrito_final REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      encerrado_at TEXT
    );

    CREATE TABLE IF NOT EXISTS protocolo_eventos (
      id TEXT PRIMARY KEY,
      protocolo_numero TEXT REFERENCES protocolos(numero),
      canal TEXT,
      tipo TEXT,
      descricao TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── Verificação em duas etapas (2FA) ─────────────────────────────────
    CREATE TABLE IF NOT EXISTS verificacoes (
      id TEXT PRIMARY KEY,
      sessao_id TEXT,
      cliente_id TEXT,
      canal TEXT,
      codigo_hash TEXT NOT NULL,
      destino_mascarado TEXT,
      metodo TEXT DEFAULT 'sms',
      motivo TEXT,
      tentativas INTEGER DEFAULT 0,
      max_tentativas INTEGER DEFAULT 3,
      status TEXT DEFAULT 'pendente',
      expira_em TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      validado_em TEXT
    );

    -- ─── Fila de atendimento humano ───────────────────────────────────────
    CREATE TABLE IF NOT EXISTS fila_atendimento (
      id TEXT PRIMARY KEY,
      protocolo_numero TEXT,
      sessao_id TEXT,
      cliente_id TEXT,
      canal TEXT,
      motivo TEXT,
      prioridade TEXT DEFAULT 'media',
      score_atrito REAL DEFAULT 0,
      status TEXT DEFAULT 'aguardando',
      atendente_nome TEXT,
      resumo_contexto TEXT,
      entrou_em TEXT DEFAULT (datetime('now')),
      iniciado_em TEXT,
      encerrado_em TEXT
    );

    -- ─── Eventos de segurança (guardrails de IA) ──────────────────────────
    CREATE TABLE IF NOT EXISTS eventos_seguranca (
      id TEXT PRIMARY KEY,
      sessao_id TEXT,
      cliente_id TEXT,
      canal TEXT,
      tipo TEXT,
      severidade TEXT DEFAULT 'media',
      padrao_detectado TEXT,
      trecho TEXT,
      acao TEXT DEFAULT 'bloqueado',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── Dicionário léxico de personas (editável pelo painel) ─────────────
    CREATE TABLE IF NOT EXISTS persona_dicionario (
      id TEXT PRIMARY KEY,
      persona TEXT NOT NULL,
      termo TEXT NOT NULL,
      categoria TEXT,
      peso INTEGER DEFAULT 1,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── Ações resolvidas no autoatendimento (sem humano) ─────────────────
    CREATE TABLE IF NOT EXISTS acoes_autoatendimento (
      id TEXT PRIMARY KEY,
      protocolo_numero TEXT,
      sessao_id TEXT,
      cliente_id TEXT,
      tipo TEXT,
      produto_codigo TEXT,
      detalhe TEXT,
      valor REAL,
      status TEXT DEFAULT 'executada',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessoes_created ON sessoes(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessoes_canal ON sessoes(canal);
    CREATE INDEX IF NOT EXISTS idx_mensagens_sessao ON mensagens(sessao_id);
    CREATE INDEX IF NOT EXISTS idx_protocolos_cliente ON protocolos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_protocolos_created ON protocolos(created_at);
    CREATE INDEX IF NOT EXISTS idx_sinais_sessao ON sinais_atrito(sessao_id);
    CREATE INDEX IF NOT EXISTS idx_fila_status ON fila_atendimento(status);
  `)
}

// node:sqlite não tem migrações; adicionamos colunas novas em bancos já existentes
// de forma idempotente, checando o schema atual antes de cada ALTER TABLE.
function migrate(db) {
  const novasColunas = [
    ['sessoes', 'protocolo_numero', 'TEXT'],
    ['sessoes', 'verificado', 'INTEGER DEFAULT 0'],
    ['sessoes', 'risco_churn', 'REAL DEFAULT 0'],
    // Retomada de protocolo anterior é anunciada UMA vez por sessão, depois da
    // identificação — repetir o aviso a cada turno polui a conversa.
    ['sessoes', 'continuidade_anunciada', 'INTEGER DEFAULT 0'],
    // Fila: churn e tipo de serviço viram critério de ordenação e filtro no Console
    ['fila_atendimento', 'risco_churn', 'REAL DEFAULT 0'],
    ['fila_atendimento', 'tipo_servico', 'TEXT'],
    ['fila_atendimento', 'produto_linha', 'TEXT'],
    ['clientes', 'tipo_pessoa', "TEXT DEFAULT 'PF'"],
    ['clientes', 'cnpj_mascara', 'TEXT'],
    ['clientes', 'segmento', "TEXT DEFAULT 'pessoal'"],
    ['produtos_catalogo', 'segmento', "TEXT DEFAULT 'pessoal'"],
    ['produtos_catalogo', 'valor_referencia', 'REAL'],
    ['produtos_catalogo', 'franquia_gb', 'REAL'],
    ['produtos_catalogo', 'velocidade_mbps', 'INTEGER'],
    ['produtos_catalogo', 'tipo_chip', 'TEXT'],
    ['produtos_catalogo', 'beneficios', 'TEXT'],
    ['mensagens', 'protocolo_numero', 'TEXT'],
    ['mensagens', 'bloqueado_guardrail', 'INTEGER DEFAULT 0'],
    ['intervencoes', 'protocolo_numero', 'TEXT'],
  ]

  for (const [tabela, coluna, tipo] of novasColunas) {
    const cols = db.prepare(`PRAGMA table_info(${tabela})`).all()
    if (!cols.some(c => c.name === coluna)) {
      db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`)
    }
  }
}

module.exports = { getDb }
