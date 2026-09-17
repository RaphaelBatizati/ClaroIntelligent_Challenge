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
| GET | `/api/fila` | fila ordenada, com métricas e facetas — filtros abaixo |
| GET | `/api/fila/metricas` | aguardando, em atendimento, prioridade alta, churn médio, espera média |
| POST | `/api/fila/entrar` | entrada manual (`sessao_id`, `cliente_id`, `canal`, `motivo`, `score_atrito`) |
| GET | `/api/fila/:id/conversa` | briefing do atendente: cliente, sessão, portfólio, protocolo, sinais e transcrição |
| PUT | `/api/fila/:id/assumir` | atendente assume (`{ "atendente": "Nome" }`) |
| POST | `/api/fila/:id/mensagem` | atendente responde ao cliente (`{ "texto": "..." }`) |
| PUT | `/api/fila/:id/encerrar` | encerra e fecha o protocolo como `atendente_humano` |

### Filtros de `GET /api/fila`

| Filtro | Valores | Para quê |
|---|---|---|
| `status` | `aguardando` \| `em_atendimento` \| `encerrado` | estado do atendimento |
| `gravidade` | `alta` \| `media` \| `baixa` | o quanto o caso está quente |
| `tipo_servico` | `financeiro` \| `tecnico` \| `retencao` \| `comercial` \| `consumo` \| `cadastro` \| `geral` | especialidade de quem atende |
| `canal` | `site` \| `app` \| `whatsapp` \| `callcenter` | canal de origem |
| `churn_min` | número 0–100 | só casos acima de um risco de cancelamento |

Todos passam por allowlist antes de chegar na query. A resposta traz `facetas` (contagem por opção,
já considerando os demais filtros) e `tipos_servico` (mapa chave → rótulo legível).

**Ordenação:** gravidade primeiro, **risco de churn decrescente** em seguida, e só então ordem de
chegada. É a regra que faz quem está mais perto de cancelar não esperar atrás de uma dúvida simples
que chegou um minuto antes. A `prioridade` é derivada na entrada: `alta` se churn ≥ 70, score ≥ 80
ou intenção de cancelamento; `media` se churn ≥ 40 ou score ≥ 50; `baixa` no resto.

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
Contadores por dimensão (canal, status, persona, linha, risco e **distribuição por hora do dia**).

Aceita **os mesmos filtros** de `GET /api/conversas`, e conta cada dimensão aplicando todos eles
**menos o da própria dimensão**. É o que mantém o painel honesto: filtrando por WhatsApp, a
contagem de personas passa a somar exatamente o total filtrado, em vez de repetir o total geral.

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

**Todas as rotas aceitam `?periodo=`**, com os valores do seletor da Topbar:
`1h` (última hora) · `1d` · `7d` (padrão) · `30d`. Valor inválido cai no padrão.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard/kpis` | atendimentos, ativos, contenção, transbordo, atrito e churn médios |
| GET | `/api/dashboard/volume` | série temporal por canal; a granularidade acompanha o período (minuto / hora / dia) |
| GET | `/api/dashboard/canais` | distribuição por canal com percentual e atrito médio |
| GET | `/api/dashboard/mapa-atrito` | **mapa de atrito completo** — ver abaixo |
| GET | `/api/dashboard/transbordo` | série da taxa de transbordo por balde de tempo |
| GET | `/api/dashboard/personas` | atendimentos e atrito médio por persona |
| GET | `/api/dashboard/contencao` | **taxa de contenção**: resolvidos por IA × por humano, por canal |
| GET | `/api/dashboard/sinais` | sinais agregados, log recente e clientes em risco de churn |

Todas essas rotas são **100% dado real do banco** — não há linha de base simulada somada à
contagem. O volume histórico vem do seed (`npm run seed`), que gera ~84 mil atendimentos determinísticos
distribuídos em 30 dias.

### `GET /api/dashboard/mapa-atrito`

A unidade de análise é o **protocolo** — é ele que representa uma demanda do cliente, com canal de
origem, assunto (jornada) e desfecho.

| Filtro | Valores |
|---|---|
| `periodo` | `1h` \| `1d` \| `7d` \| `30d` |
| `canal` | `site` \| `app` \| `whatsapp` \| `callcenter` |
| `jornada` | o assunto do protocolo, ex.: `Suporte técnico` |
| `persona` | `digital` \| `intermediario` \| `assistido` \| `informal` |
| `linha` | `residencial` \| `movel` \| `tv` \| `empresas` |

```json
{ "periodo": { "chave": "30d", "rotulo": "Últimos 30 dias" },
  "filtros_aplicados": { "canal": "whatsapp" },
  "kpis": { "atendimentos": 25128, "pontos_atrito": 28740, "indice_medio": 37,
            "pct_com_atrito": 45, "taxa_recuperacao": 85,
            "jornada_critica": { "jornada": "Solicitação de cancelamento", "pct_atrito": 74 } },
  "por_jornada": [{ "jornada": "...", "total": 4082, "pct_atrito": 72, "indice": 48, "em_risco": 910, "transferidos": 604 }],
  "sinais": [{ "tipo": "repeticao_intencao", "total": 9204, "rotulo": "Repetição de intenção", "peso": 22 }],
  "heatmap": { "limiar": 40,
               "canais": [{ "chave": "whatsapp", "rotulo": "WhatsApp" }],
               "linhas": [{ "jornada": "...", "total": 1234,
                            "celulas": [{ "canal": "whatsapp", "total": 1234, "com_atrito": 889, "pct_atrito": 72, "indice": 48 }] }] },
  "facetas": { "canal": {...}, "jornada": {...}, "persona": {...}, "linha": {...} } }
```

**`pct_atrito` é a leitura principal da tela:** a fatia dos atendimentos daquele cruzamento cujo
score final passou de `heatmap.limiar` (40, o limiar de alerta do ClaroSense). É percentual e não
média porque só assim se comparam canais de volumes muito diferentes — 300 casos com atrito no app
não significam o mesmo que 300 no call center, se um recebe o triplo do volume. O `indice` (média do
score, 0–100) continua disponível em cada célula.

**Garantia de coerência:** uma única consulta traz o período agregado por
`jornada × canal × persona × linha` (menos de mil linhas para dezenas de milhares de atendimentos), e
KPIs, jornadas, mapa de calor e facetas são derivados desse mesmo cubo — cada faceta filtrando por
tudo menos a própria dimensão. Por isso `por_jornada` e `facetas.persona` sempre somam
`kpis.atendimentos`, e o mapa de calor só traz colunas de canais que existem no recorte.

## Clientes

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/clientes` | lista (só `cpf_mascara`, nunca CPF completo) |
| GET | `/api/clientes/:id` | detalhe |
| GET | `/api/clientes/:id/portfolio` | contratos ativos com dados do produto |
| GET | `/api/clientes/:id/sessoes` | últimas 10 sessões |
