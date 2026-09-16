# ClaroIntelligence

MVP acadêmico (FIAP Challenge Claro) de uma **camada de orquestração com IA sobre os canais digitais
da Claro** — site, app, WhatsApp e call center param de ter inteligências isoladas e passam a
compartilhar contexto, protocolo, adaptação de tom e detecção de atrito em tempo real, sem que o
cliente precise repetir informação a cada troca de canal.

```
├── clarointelligence/        # Frontend  — React 19 + Vite + Tailwind   (porta 5173)
├── clarointelligence-api/    # Backend   — Node.js + Express + SQLite  (porta 3001)
└── docs/                     # Documentação técnica e entregas acadêmicas
```

## Rodar em 2 minutos

Pré-requisito único: **Node.js 22.5+** (recomendado 24.x) — sem Docker, sem banco externo, sem
chave de API.

```bash
# Terminal 1 — Backend
cd clarointelligence-api
npm install
npm run seed          # popula o banco com o catálogo e os roteiros de demonstração
npm run server        # http://localhost:3001

# Terminal 2 — Frontend
cd clarointelligence
npm install
npm run dev            # http://localhost:5173
```

No Windows, dê duplo clique em **`Iniciar ClaroIntelligence.bat`** para fazer tudo automaticamente.
Use `Parar ClaroIntelligence.bat` para encerrar.

Guia completo, roteiros passo a passo e solução de problemas: **[docs/COMO_RODAR.md](docs/COMO_RODAR.md)**.

## O que o sistema faz

### Os 3 motores
- **ClaroMemory** — memória da jornada: o cliente nunca começa do zero, em nenhum canal.
- **Persona Engine** — adapta tom e vocabulário a **4 perfis** (Digital, Intermediário, Assistido e
  Informal), com dicionário léxico editável pelo painel, sem deploy.
- **ClaroSense** — mede atrito em tempo real com 7 sinais de peso conhecido; repetição e tom
  agressivo elevam o score até o transbordo, e o score vira **risco de cancelamento** explícito.

### Product Context Resolver
Desambigua qual produto o cliente quer dizer quando ele tem fibra, celular, TV e contratos
corporativos ao mesmo tempo — com uma **matriz de capacidades** que evita perguntar quando o
portfólio já responde sozinho. É a resposta ao segundo eixo do desafio da Claro: multiproduto, não
só multicanal.

### Protocolo de atendimento
Todo contato gera protocolo (exigência da Anatel, Res. 765/2023), com linha do tempo auditável. É o
que permite ao cliente **começar no call center e continuar no chat** sem repetir nada — e o que
registra se a demanda foi resolvida pela IA ou por uma pessoa.

### Segurança
- **Guardrails em 3 camadas** contra prompt injection, extração de dados e engenharia social — o
  ataque é bloqueado antes de chegar ao resolver, aos adaptadores e ao LLM.
- **Verificação em duas etapas** antes de qualquer dado financeiro no WhatsApp e no Site, com código
  hasheado, expiração e limite de tentativas.
- Consultas parametrizadas, CPF nunca em texto puro, rate limit e redação de saída.

### Atendimento humano de verdade
Quando o ClaroSense detecta transbordo, o cliente entra numa **fila com posição e tempo estimado**, e
uma pessoa assume a conversa pelo **Console do Atendente** — com protocolo, sinais de atrito e
histórico completo na tela antes da primeira palavra.

### Autoatendimento que fecha o caso
Pagamento via PIX e upgrade de plano executados inteiros no chat, em duas etapas
(proposta → confirmação), encerrando o protocolo **sem passar por atendente**. É daí que sai a taxa
de contenção do painel.

## Documentação

| | |
|---|---|
| [docs/COMO_RODAR.md](docs/COMO_RODAR.md) | Instalação e os 8 roteiros de demonstração |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Camadas, pipeline, protocolo, resolver, motores e fila |
| [docs/PRODUTOS.md](docs/PRODUTOS.md) | Catálogo real da Claro e matriz de capacidades |
| [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) | Esquema completo das tabelas |
| [docs/API.md](docs/API.md) | Todos os endpoints REST e SSE |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Guardrails, 2FA, LGPD e limitações |
| [docs/INTEGRACAO_WHATSAPP.md](docs/INTEGRACAO_WHATSAPP.md) | Viabilidade da integração com WhatsApp real |
| [docs/DECISOES.md](docs/DECISOES.md) | Por que cada escolha técnica foi tomada |
| [docs/entregas-academicas/](docs/entregas-academicas/) | Documentos entregues à banca (Sprints 1–4) |

## Roteiros de demonstração

| # | Cliente | Cenário |
|---|---|---|
| A | Ana Souza | Continuidade Site → WhatsApp com ClaroMemory |
| B | Carlos Mota | Desambiguação entre 4 contratos em 3 linhas |
| C | Fernanda Lima | ClaroSense detecta agressividade → fila → atendente humano real |
| D | João Santos | Pagamento e upgrade resolvidos sozinho no chat |
| E | Roberto Alves | **Call center → chat**, retomada pelo protocolo (persona informal) |
| F | Vega Soluções | Cliente **PJ**: chip empresarial + link dedicado com SLA |
| G | qualquer | Verificação em duas etapas no WhatsApp |
| H | qualquer | Guardrails bloqueando prompt injection |

## Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS v3, React Router v7, Recharts, Lucide React
- **Backend**: Node.js 24, Express 4, SQLite via `node:sqlite` nativo, UUID, `node:crypto`
- **Banco**: SQLite local, arquivo único, gerado por seed — sem instalação
- **LLM**: simulado determinístico (sem API key, sem custo, sem latência) — plugável por design

## Telas

Dashboard · Mapa de Atrito · **Monitor de Conversas** (filtros por canal, status, produto, persona,
faixa de atrito, data, horário e protocolo) · **Log do ClaroSense** (régua de pesos e risco de churn)
· **Gestão de Personas** (4 personas + dicionário editável) · **Chat do Cliente** · **Console do
Atendente** · Perfis de Usuário
