# ClaroIntelligence

MVP acadêmico (FIAP Challenge Claro) de uma **camada de orquestração com IA sobre os canais digitais da Claro** — site, app e WhatsApp param de ter inteligências isoladas e passam a compartilhar contexto, adaptação de tom e detecção de atrito em tempo real, sem que o cliente precise repetir informação a cada troca de canal.

```
├── clarointelligence/        # Frontend  — React 19 + Vite + Tailwind   (porta 5173)
├── clarointelligence-api/    # Backend   — Node.js + Express + SQLite  (porta 3001)
└── docs/                     # Documentação técnica e entregas acadêmicas
```

## Rodar em 2 minutos

Pré-requisito único: **Node.js 22.5+** (recomendado 24.x) — sem Docker, sem banco externo, sem chave de API.

```bash
# Terminal 1 — Backend
cd clarointelligence-api
npm install
npm run seed          # popula o banco com os dados de demonstração
npm run server        # http://localhost:3001

# Terminal 2 — Frontend
cd clarointelligence
npm install
npm run dev            # http://localhost:5173
```

No Windows, dê duplo clique em **`Iniciar ClaroIntelligence.bat`** para fazer tudo isso automaticamente (instala dependências, popula o banco na primeira vez, sobe os dois servidores e abre o navegador). Use `Parar ClaroIntelligence.bat` para encerrar.

Guia completo, solução de problemas e clientes de demonstração: **[docs/COMO_RODAR.md](docs/COMO_RODAR.md)**.

## Os 3 motores

- **ClaroMemory** — memória semântica da jornada: o cliente nunca começa do zero, em nenhum canal.
- **Persona Engine** — adapta tom e vocabulário ao perfil do cliente (Digital / Intermediário / Assistido).
- **ClaroSense** — detecta atrito durante a conversa e age antes do abandono (transferência automática para humano em score ≥ 80).

Além disso, o **Product Context Resolver** desambigua qual produto o cliente quer dizer quando ele tem fibra, linhas móveis e TV ao mesmo tempo — é a resposta ao segundo eixo do desafio da Claro (multiproduto, não só multicanal).

Como cada peça funciona, com diagramas: **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**.

## Documentação

| | |
|---|---|
| [docs/COMO_RODAR.md](docs/COMO_RODAR.md) | Passo a passo de instalação, clientes de demo, troubleshooting |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | As 5 camadas, pipeline de mensagem, Product Resolver, adaptadores |
| [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) | Esquema completo das tabelas SQLite |
| [docs/API.md](docs/API.md) | Todos os endpoints REST e SSE |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | O que está implementado, limitações conhecidas e LGPD |
| [docs/DECISOES.md](docs/DECISOES.md) | Por que cada escolha técnica não óbvia foi tomada |
| [docs/entregas-academicas/](docs/entregas-academicas/) | Documentos Word/PDF entregues à banca (Sprints 1–4) |

## Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS v3, React Router v7, Recharts, Lucide React
- **Backend**: Node.js 24, Express 4, SQLite via `node:sqlite` nativo, UUID
- **Banco**: SQLite local, arquivo único, gerado por seed — sem instalação
- **LLM**: simulado determinístico (sem API key, sem custo, sem latência) — plugável por design, ver [docs/DECISOES.md](docs/DECISOES.md)

## 4 roteiros de demonstração

| Roteiro | Cliente | Canal | Cenário |
|---|---|---|---|
| A | Ana Souza | Site → WhatsApp | Continuidade entre canais com ClaroMemory |
| B | Carlos Mota | App | Desambiguação: fibra + 2 celulares + tv+ |
| C | Fernanda Lima | WhatsApp | ClaroSense detecta atrito → transbordo automático |
| D | João Santos | App | Multiproduto fibra + Max Flex |

## Telas do painel administrativo

Dashboard com KPIs ao vivo · Mapa de Atrito · Monitor de Conversas em tempo real (SSE) · Log ClaroSense · Gestão de Personas · Chat do Cliente (demo dos 3 canais) · Perfis de Usuário (RBAC simulado).
