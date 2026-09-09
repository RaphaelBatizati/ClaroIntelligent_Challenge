# API

Base URL local: `http://localhost:3001`. Todas as respostas são JSON. Não há autenticação (ver [SEGURANCA.md](SEGURANCA.md)).

## Health

### `GET /api/health`
Status da plataforma e dos módulos ativos.

```json
{
  "status": "ok",
  "versao": "1.0.0",
  "timestamp": "2026-09-08T20:00:00.000Z",
  "db": { "clientes": 6, "sessoes": 12 },
  "modulos": {
    "claroSense": "ativo",
    "claroMemory": "ativo",
    "personaEngine": "ativo",
    "productResolver": "ativo",
    "llmProvider": "simulado-deterministico"
  }
}
```

## Chat — pipeline principal

### `POST /api/chat/mensagem`
Ponto de entrada único de todos os canais. Executa o pipeline completo descrito em [ARQUITETURA.md](ARQUITETURA.md#pipeline-de-uma-mensagem): detecção de intenção → resolução de produto → memória → persona → adaptador → LLM simulado → ClaroSense → persistência.

**Request body**
```json
{
  "cliente_id": "cli-ana-souza",
  "canal": "site",
  "mensagem": "minha internet está lenta",
  "sessao_id": null
}
```
| Campo | Obrigatório | Descrição |
|---|---|---|
| `cliente_id` | sim | id do cliente (ver clientes de demo em [COMO_RODAR.md](COMO_RODAR.md)) |
| `mensagem` | sim | texto livre do cliente |
| `canal` | não (default `site`) | `site` \| `app` \| `whatsapp` \| `callcenter` |
| `sessao_id` | não | omita na primeira mensagem; a API cria e devolve um novo `sessao_id` para reusar nas próximas |

**Response (caso normal)**
```json
{
  "sessao_id": "uuid",
  "trace_id": "uuid",
  "resposta": "texto gerado pelo LLM simulado",
  "intencao": "suporte_tecnico",
  "confianca_intencao": 0.87,
  "produto_foco": "RES-FIB-300",
  "produto_confirmado": true,
  "linha": "residencial",
  "score_atrito": 22,
  "nivel_atrito": "normal",
  "sinais_atrito": [],
  "trechos_memoria": [],
  "intervencao": null,
  "persona": "intermediario",
  "aguardando_desambiguacao": false
}
```

**Response (produto ambíguo — cliente tem mais de um produto elegível)**
```json
{
  "sessao_id": "uuid",
  "resposta": "Identifiquei que você tem 3 produtos ativos conosco: ... Pode me dizer a qual você se refere: *internet residencial/fibra*, *celular/linha móvel*, *Claro tv+/TV*?",
  "intencao": "desambiguacao",
  "aguardando_desambiguacao": true
}
```
Nesse caso, envie a próxima mensagem do cliente com o mesmo `sessao_id` — a resposta esclarece o produto e o pipeline segue normalmente.

**Response (score de atrito ≥ 80 — transbordo automático)**
O campo `intervencao` vem preenchido e a `resposta` já é a mensagem de transferência para atendimento humano:
```json
{
  "score_atrito": 85,
  "nivel_atrito": "transbordo",
  "intervencao": {
    "tipo": "transferencia_humano",
    "gatilho": "score_atrito=85 >= 80",
    "acao": "Transferência automática para fila prioritária com contexto completo"
  }
}
```

Erros: `400` se faltar `cliente_id` ou `mensagem`; `404` se `cliente_id` não existir; `500` com `{ "erro": "...", "detalhe": "..." }` em falha inesperada.

### `GET /api/chat/sessoes/:id/mensagens`
Histórico completo de mensagens de uma sessão, em ordem cronológica.

## Clientes

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/clientes` | lista todos (sem CPF completo — só `cpf_mascara`) |
| GET | `/api/clientes/:id` | detalhe de um cliente |
| GET | `/api/clientes/:id/portfolio` | contratos ativos do cliente, com nome/linha/família do produto |
| GET | `/api/clientes/:id/sessoes` | últimas 10 sessões do cliente |

## Produtos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos/catalogo?linha=movel` | catálogo ativo, `linha` é filtro opcional |
| GET | `/api/produtos/personas/config` | limiares atuais da Persona Engine |
| PUT | `/api/produtos/personas/config` | atualiza limiares (`limiar_digital`, `limiar_assistido`, `sensibilidade`, `delay_interv`) — sem validação de payload, uso interno do painel |

## Dashboard

Todos somam contagem real do SQLite a uma linha de base simulada, para o painel nunca aparecer vazio em uma instalação nova — os números não são 100% "ao vivo", são uma composição didática para demonstração. Ver [ARQUITETURA.md](ARQUITETURA.md).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard/kpis` | total de sessões, ativas, transferências, score médio, FCR, CES, canais |
| GET | `/api/dashboard/volume` | volume diário dos últimos 7 dias |
| GET | `/api/dashboard/atrito` | score de atrito agregado por jornada (cancelamento, suporte técnico, etc.) |
| GET | `/api/dashboard/transbordo` | intervenções por tipo e taxa de resolução |
| GET | `/api/dashboard/personas` | distribuição de clientes por persona |

## Conversas (Monitor em tempo real)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversas` | até 30 sessões das últimas 2h, com última mensagem e tempo aberto |
| GET | `/api/conversas/:id` | sessão completa: mensagens, sinais de atrito, intervenções e memórias associadas |
| PUT | `/api/conversas/:id/transferir` | marca a sessão como `transferida` |
| PUT | `/api/conversas/:id/encerrar` | marca a sessão como `encerrada` |
| GET | `/api/conversas/eventos/stream` | **Server-Sent Events** — stream `text/event-stream` para atualização ao vivo do Monitor de Conversas no painel |

## Convenção de erro

Toda rota que falha responde `{ "erro": "mensagem legível" }` com o status HTTP apropriado (`400`, `404` ou `500`). Não há um formato de erro padronizado entre rotas (ex.: só `chat.js` inclui `detalhe` com a mensagem de exceção) — ponto de melhoria conhecido, ver [DECISOES.md](DECISOES.md).
