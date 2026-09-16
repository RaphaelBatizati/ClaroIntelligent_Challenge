# API

Base URL local: `http://localhost:3001`. Todas as respostas são JSON.

**Rate limit:** dois níveis por IP, com resposta `429` — 600 req/min em `/api` (leitura de painel) e 60 req/min em `POST /api/chat/mensagem` (pipeline completo).
**Autenticação:** não há (ver [SEGURANCA.md](SEGURANCA.md)). O 2FA protege dados sensíveis dentro
da conversa, mas não substitui login.

## Health

### `GET /api/health`
```json
{
  "status": "ok",
  "versao": "2.0.0",
  "db": { "clientes": 7, "sessoes": 8, "protocolos": 6 },
  "modulos": {
    "claroSense": "ativo", "claroMemory": "ativo",
    "personaEngine": "ativo (4 personas + dicionário)",
    "productResolver": "ativo", "protocolo": "ativo",
    "verificacao2fa": "ativo", "guardrails": "ativo",
    "filaAtendimento": "ativo", "autoatendimento": "ativo",
    "llmProvider": "simulado-deterministico"
  }
}
```

## Chat — pipeline principal

### `POST /api/chat/mensagem`
Ponto de entrada único de todos os canais. Executa o pipeline descrito em
[ARQUITETURA.md](ARQUITETURA.md#pipeline-de-uma-mensagem).

**Request**
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
| `cliente_id` | sim | ver clientes de demo em [PRODUTOS.md](PRODUTOS.md#clientes-de-demonstração) |
| `mensagem` | sim | texto livre, máx. 2000 caracteres |
| `canal` | não (default `site`) | `site` \| `app` \| `whatsapp` \| `callcenter` |
| `sessao_id` | não | omita na primeira mensagem; reuse o valor devolvido nas próximas |

O endpoint tem **sete formas de resposta**, distinguidas por campos-chave:

### 1. Resposta normal
```json
{
  "sessao_id": "uuid", "trace_id": "uuid",
  "resposta": "texto gerado",
  "intencao": "suporte_tecnico", "confianca_intencao": 0.87,
  "produto_foco": "RES-FIB-500", "linha": "residencial",
  "contrato": { "plano": "Claro Fibra 500 Mega", "valor": 139.99 },
  "dados_produto": { "velocidade_down": 500, "modem": "...", "vencimento": "10/10/2026" },
  "protocolo": "2026.0915.000007",
  "protocolos_abertos": [{ "numero": "2026.0915.000002", "canal": "callcenter", "horasAtras": 3 }],
  "score_atrito": 22, "nivel_atrito": "normal",
  "sinais_atrito": [{ "tipo": "...", "valor": 22, "rotulo": "...", "explicacao": "..." }],
  "risco_churn": { "percentual": 18, "nivel": "baixo", "acao_recomendada": "..." },
  "trechos_memoria": [], "intervencao": null,
  "persona": "intermediario",
  "persona_detalhe": { "detectada": "informal", "termos": [{ "termo": "vcs", "peso": 2 }] }
}
```

### 2. Bloqueio por guardrail
```json
{ "bloqueado_guardrail": true,
  "intencao": "bloqueada_guardrail",
  "guardrail": { "tipo": "prompt_injection", "severidade": "alta", "padrao": "sobrescrita_de_instrucoes" },
  "resposta": "Sou o assistente de atendimento da Claro e sigo sempre as mesmas regras…" }
```

### 3. Verificação em duas etapas exigida
```json
{ "intencao": "verificacao_2fa",
  "intencao_pendente": "segunda_via",
  "verificacao": {
    "pendente": true, "verificacao_id": "uuid",
    "destino_mascarado": "(11) *****-4321", "metodo": "sms",
    "expira_em_minutos": 5,
    "codigo_simulado": "501715"
  } }
```
> `codigo_simulado` existe **apenas no protótipo** — em produção o código só vive no SMS.
> Para validar, basta enviar o código como mensagem normal na mesma sessão; o pipeline
> **retoma automaticamente** a `intencao_pendente`.

### 4. Desambiguação de produto
```json
{ "aguardando_desambiguacao": true, "intencao": "desambiguacao",
  "resposta": "Identifiquei 4 produtos ativos no seu CPF… é sobre **internet residencial / fibra**, **celular / linha móvel** ou **Claro tv+ / TV**?",
  "portfolio": [ /* contratos ativos */ ] }
```

### 5. Proposta de ação (autoatendimento)
```json
{ "intencao": "pagamento_proposta",
  "acao_proposta": { "tipo": "pagamento", "valor": 139.99,
                     "detalhe": { "plano": "Claro Fibra 500 Mega", "vencimento": "10/10/2026" } } }
```
Confirme com uma mensagem afirmativa ("sim", "pode gerar", "confirmo") na mesma sessão.

### 6. Ação executada — protocolo encerrado sem humano
```json
{ "intencao": "pagamento_confirmado",
  "protocolo": "2026.0915.000011", "protocolo_status": "resolvido",
  "resolvido_por": "autoatendimento",
  "acao_executada": { "tipo": "pagamento", "valor": 139.99 } }
```

### 7. Transbordo — entrada na fila humana
```json
{ "intencao": "transbordo_humano",
  "nivel_atrito": "transbordo", "score_atrito": 98,
  "risco_churn": { "percentual": 84, "nivel": "critico" },
  "intervencao": { "tipo": "transferencia_humano", "gatilho": "score_atrito=98 >= 80" },
  "fila": { "na_fila": true, "fila_id": "uuid", "posicao": 2, "espera_estimada_min": 5, "prioridade": "alta" } }
```

Quando a sessão **já está** na fila ou em atendimento humano, a resposta vem com
`"modo": "atendimento_humano"` e `resposta: null` — a mensagem foi roteada para o atendente e a IA
sai do caminho.

Erros: `400` (campos ausentes ou mensagem longa demais), `404` (cliente inexistente), `429` (rate
limit), `500` (mensagem genérica; o detalhe fica só no log do servidor).

### `GET /api/chat/sessoes/:id/mensagens`
Histórico completo, em ordem cronológica. Inclui mensagens com `papel: "atendente"`.

### `GET /api/chat/sessoes/:id/estado`
Estado consolidado — usado pelo chat para acompanhar a fila em tempo real.
```json
{ "status": "transferida", "score_atrito": 98, "risco_churn": 84,
  "protocolo": "2026.0915.000012",
  "verificacao": { "verificado": true, "desafio_pendente": null },
  "fila": { "na_fila": false, "em_atendimento": true, "atendente": "Raphael (Retenção)" } }
```

## Protocolos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/protocolos` | lista com filtros: `busca`, `canal`, `status`, `tipo`, `resolvido_por`, `data_inicio`, `data_fim`, `pagina`, `limite` |
| GET | `/api/protocolos/:numero` | detalhe com linha do tempo de eventos e transcrição (aceita com ou sem pontuação) |
| GET | `/api/protocolos/cliente/:clienteId/abertos` | protocolos em aberto nas últimas 72h — base da continuidade cross-canal |

## Fila de atendimento humano

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/fila` | fila ordenada por prioridade e chegada, com métricas. `?status=aguardando\|em_atendimento\|encerrado` |
| GET | `/api/fila/metricas` | aguardando, em atendimento, prioridade alta, espera média |
| POST | `/api/fila/entrar` | entrada manual (`sessao_id`, `cliente_id`, `canal`, `motivo`, `score_atrito`) |
| GET | `/api/fila/:id/conversa` | briefing do atendente: cliente, sessão, portfólio, protocolo, sinais e transcrição |
| PUT | `/api/fila/:id/assumir` | atendente assume (`{ "atendente": "Nome" }`) |
| POST | `/api/fila/:id/mensagem` | atendente responde ao cliente (`{ "texto": "..." }`) |
| PUT | `/api/fila/:id/encerrar` | encerra e fecha o protocolo como `atendente_humano` |

## Monitor de conversas

### `GET /api/conversas`
Busca com filtros pensados para volume de operação.

| Filtro | Valores |
|---|---|
| `busca` | nome do cliente, id da sessão, protocolo ou produto |
| `protocolo` | número com ou sem pontuação |
| `canal` | `site` \| `app` \| `whatsapp` \| `callcenter` |
| `status` | `ativa` \| `transferida` \| `em_atendimento_humano` \| `encerrada` |
| `linha` | `residencial` \| `movel` \| `tv` \| `empresas` |
| `persona` | `digital` \| `intermediario` \| `assistido` \| `informal` |
| `risco` | `normal` \| `alerta` \| `risco` \| `transbordo` (faixas do ClaroSense) |
| `data_inicio` / `data_fim` | `AAAA-MM-DD` |
| `hora_inicio` / `hora_fim` | `HH:MM` — faixa do dia independente da data, para achar o pico |
| `score_min` / `score_max` | 0–100 |
| `ordenar` | `recentes` \| `score` \| `duracao` \| `antigas` |
| `pagina` / `limite` | paginação (limite máx. 100) |

```json
{ "total": 23, "pagina": 1, "paginas": 1,
  "filtros_aplicados": { "canal": "whatsapp" },
  "itens": [{ "id": "...", "cliente": { "nome": "...", "persona": "..." },
              "canal": "whatsapp", "produto": { "nome": "...", "linha": "..." },
              "protocolo_formatado": "2026.0915.000003",
              "score_atrito": 85, "risco_churn": 88, "nivel": "transbordo",
              "verificado": true, "tempo_aberto": 41 }] }
```

### `GET /api/conversas/facetas`
Contadores por dimensão (canal, status, persona, linha, risco e **distribuição por hora do dia**),
respeitando o recorte de data. Alimenta os contadores de cada botão de filtro.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversas/:id` | detalhe: transcrição, sinais, intervenções, memória, protocolo e eventos de segurança |
| PUT | `/api/conversas/:id/transferir` | marca como transferida |
| PUT | `/api/conversas/:id/encerrar` | marca como encerrada |
| GET | `/api/conversas/eventos/stream` | Server-Sent Events para atualização ao vivo |

## Personas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos/personas/config` | limiares atuais |
| PUT | `/api/produtos/personas/config` | atualiza (valida inteiro 1–10 por campo) |
| GET | `/api/produtos/personas/dicionario` | léxico completo. `?persona=informal` filtra |
| POST | `/api/produtos/personas/dicionario` | adiciona termo (`persona`, `termo`, `categoria`, `peso`) |
| PUT | `/api/produtos/personas/dicionario/:id` | ativa/desativa (`{ "ativo": false }`) |
| DELETE | `/api/produtos/personas/dicionario/:id` | remove |
| POST | `/api/produtos/personas/classificar` | roda o classificador: devolve persona, pontuações e **os termos que pesaram** |

## Segurança

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/seguranca/eventos` | eventos de guardrail e 2FA. `?tipo=` `?severidade=` `?limite=` |
| GET | `/api/seguranca/resumo` | totais por tipo e severidade, bloqueios, estado dos desafios 2FA |
| GET | `/api/seguranca/politicas` | padrões monitorados, intenções permitidas e as 3 camadas de defesa |

## Produtos e ClaroSense

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos/catalogo` | catálogo ativo. `?linha=` `?segmento=pessoal\|empresarial` |
| GET | `/api/produtos/clarosense/sinais` | catálogo dos 7 sinais com peso e explicação + limiares |

## Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard/kpis` | KPIs gerais |
| GET | `/api/dashboard/volume` | volume diário dos últimos 7 dias |
| GET | `/api/dashboard/atrito` | atrito agregado por jornada |
| GET | `/api/dashboard/transbordo` | intervenções por tipo |
| GET | `/api/dashboard/personas` | distribuição por persona |
| GET | `/api/dashboard/contencao` | **taxa de contenção**: resolvidos por IA × por humano, por canal |
| GET | `/api/dashboard/sinais` | sinais agregados, log recente e clientes em risco de churn |

> As rotas `kpis`, `volume`, `atrito`, `transbordo` e `personas` somam contagem real a uma linha de
> base simulada, para o painel não aparecer vazio numa instalação nova — decisão documentada em
> [DECISOES.md](DECISOES.md). **`contencao` e `sinais` são 100% dado real do banco.**

## Clientes

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/clientes` | lista (só `cpf_mascara`, nunca CPF completo) |
| GET | `/api/clientes/:id` | detalhe |
| GET | `/api/clientes/:id/portfolio` | contratos ativos com dados do produto |
| GET | `/api/clientes/:id/sessoes` | últimas 10 sessões |
