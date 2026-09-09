// Uses node:sqlite — built into Node.js v22.5+ (no native compilation needed)
const { DatabaseSync } = require('node:sqlite')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'clarointelligence.sqlite')

let _db = null

function getDb() {
  if (_db) return _db
  _db = new DatabaseSync(DB_PATH)
  initSchema(_db)
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
  `)
}

module.exports = { getDb }
