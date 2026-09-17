# Banco de dados

O MVP usa **SQLite** através do módulo nativo `node:sqlite` (`DatabaseSync`), embutido no próprio Node.js — sem instalar servidor de banco, sem Docker, sem drivers nativos compilados. Veja o porquê dessa escolha em [DECISOES.md](DECISOES.md).

- Arquivo: `clarointelligence-api/clarointelligence.sqlite` (gerado por `npm run seed`, **não** versionado no git — está no `.gitignore` porque é dado, não código).
- Esquema definido em [`clarointelligence-api/src/database.js`](../clarointelligence-api/src/database.js), criado automaticamente na primeira conexão (`CREATE TABLE IF NOT EXISTS`).
- Dados de demonstração (catálogo de produtos, 6 clientes, contratos) inseridos por [`clarointelligence-api/src/seed.js`](../clarointelligence-api/src/seed.js).

## Diagrama do modelo de dados

![Modelo de dados](assets/diagramas/modelo_dados.png)

## Tabelas

### `clientes`
Cadastro do titular. Note que **o CPF nunca é armazenado em texto puro** — só uma versão já mascarada (`cpf_mascara`, ex: `***.***.456-**`). Isso é uma decisão de minimização de dados desde a origem, não uma máscara aplicada na exibição — ver [SEGURANCA.md](SEGURANCA.md#lgpd-e-dados-pessoais).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT (PK) | ex: `cli-ana-souza` |
| `nome` | TEXT | |
| `email` | TEXT | |
| `telefone` | TEXT | |
| `cpf_mascara` | TEXT | já armazenado mascarado, nunca em texto puro |
| `perfil_persona` | TEXT | `digital` \| `intermediario` \| `assistido` |
| `created_at` | TEXT | |

### `produtos_catalogo`
Fonte única de verdade do que a Claro oferece. Um produto novo entra por dado (seed/painel), nunca por alteração de código no núcleo.

| Coluna | Tipo | Descrição |
|---|---|---|
| `codigo` | TEXT (PK) | estável e independente do nome comercial, ex: `RES-FIB-300` |
| `nome` | TEXT | nome comercial, ex: "Claro Fibra 300 Mega" |
| `linha` | TEXT | `movel` \| `residencial` \| `tv` |
| `familia` | TEXT | ex: `fibra`, `pos-pago`, `combo` |
| `descricao` | TEXT | |
| `ativo` | INTEGER | soft-delete de catálogo |

### `contratos`
Vínculo entre cliente e produto — é aqui que mora o "portfólio" que o Product Context Resolver consulta.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT (PK) | |
| `cliente_id` | TEXT (FK → `clientes.id`) | |
| `produto_codigo` | TEXT (FK → `produtos_catalogo.codigo`) | |
| `linha` | TEXT | redundante com o produto, otimiza filtro por linha nos adaptadores |
| `status` | TEXT | `ativo` é o único status consultado pelo resolver |
| `plano_nome` | TEXT | |
| `valor_mensal` | REAL | |
| `data_inicio` | TEXT | |
| `dados_extra` | TEXT | JSON livre por linha (ex: MSISDN, eSIM) — só o adaptador da linha sabe interpretar |

### `sessoes`
Uma conversa em um canal. Guarda o estado de curto prazo: produto em foco, se já foi confirmado, e o score de atrito acumulado.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT (PK) | |
| `cliente_id` | TEXT (FK) | |
| `canal` | TEXT | `site` \| `app` \| `whatsapp` \| `callcenter` |
| `produto_codigo_foco` | TEXT | produto resolvido para esta sessão |
| `produto_confirmado` | INTEGER | trava a resolução após a 1ª confirmação, evita reperguntar |
| `score_atrito` | REAL | 0–100, acumulado turno a turno |
| `status` | TEXT | `ativa` \| `transferida` \| `em_atendimento_humano` \| `encerrada` |
| `verificado` | INTEGER | 1 após a identificação em duas etapas (só se aplica ao WhatsApp) |
| `continuidade_anunciada` | INTEGER | 1 depois que o cliente já foi avisado de um protocolo anterior — impede o aviso de se repetir a cada turno |
| `trace_id` | TEXT | id de rastreio, devolvido em toda resposta da API |

### `mensagens`
Histórico turno a turno (cliente e sistema), com os metadados de decisão de cada turno — intenção detectada, confiança, produto resolvido, score de atrito e quais memórias foram usadas para gerar a resposta.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT (PK) | |
| `sessao_id` | TEXT (FK) | |
| `papel` | TEXT | `cliente` \| `sistema` |
| `conteudo` | TEXT | |
| `intencao_codigo` | TEXT | |
| `confianca_intencao` | REAL | 0–1 |
| `produto_codigo` | TEXT | |
| `score_atrito_turno` | REAL | |
| `sinais_atrito` | TEXT | JSON dos sinais detectados neste turno |
| `memoria_usada` | TEXT | JSON dos ids de `memoria_conversacional` usados na resposta — dá rastreabilidade de por que o sistema "lembrou" algo |

### `sinais_atrito`
Um registro por sinal individual detectado pelo ClaroSense (não só o score agregado) — é o que alimenta a tela "Log ClaroSense" no painel.

| Coluna | Tipo | Descrição |
|---|---|---|
| `tipo` | TEXT | `repeticao_intencao` \| `monossilabico` \| `sentimento_negativo` \| `solicita_humano` |
| `valor` | REAL | pontos somados ao score |

### `intervencoes`
Ações automáticas tomadas em resposta ao nível de atrito.

| Coluna | Tipo | Descrição |
|---|---|---|
| `tipo` | TEXT | `transferencia_humano` \| `simplificacao` \| `antecipacao` |
| `gatilho` | TEXT | condição que disparou, ex: `score_atrito=82 >= 80` |
| `acao` | TEXT | descrição da ação tomada |
| `resultado` | TEXT | `pendente` até ser fechada pelo atendente humano |

### `memoria_conversacional`
O núcleo do ClaroMemory: um resumo curto por interação, recuperável por até 24h em qualquer canal seguinte.

| Coluna | Tipo | Descrição |
|---|---|---|
| `cliente_id` | TEXT (FK) | chave de recuperação — é por cliente, não por sessão |
| `canal` | TEXT | permite detectar jornada multicanal |
| `produto_codigo` | TEXT | permite priorizar memórias do mesmo produto |
| `resumo` | TEXT | texto curto gerado a partir da intenção + primeiros 80 caracteres da mensagem |
| `resolvido` | INTEGER | reservado para fechar pendências (hoje sempre `0` na gravação) |
| `pendencias` | TEXT | JSON, reservado para próximos passos em aberto |

### `personas_config`
Linha única (`id = 1`) com os limiares editáveis pela tela "Gestão de Personas" do painel — permite calibrar sensibilidade sem alterar código.

---

## Tabelas de protocolo, segurança e atendimento

### `protocolos`
O número que o cliente informa em qualquer canal, exigido pela Anatel (Res. 765/2023). É a âncora
formal da continuidade entre canais e o registro de **quem resolveu** a demanda.

| Coluna | Tipo | Descrição |
|---|---|---|
| `numero` | TEXT (PK) | `AAAAMMDD` + sequencial de 6 dígitos, ex: `20260915000042` |
| `cliente_id` | TEXT (FK) | titular — usado para negar consulta a protocolo de terceiro |
| `sessao_id` | TEXT (FK) | sessão que originou o protocolo |
| `canal_origem` / `canal_atual` | TEXT | a diferença entre os dois é o que revela a jornada multicanal |
| `tipo` | TEXT | `atendimento` \| `reclamacao` \| `solicitacao` \| `cancelamento` — tipificação regulatória |
| `assunto` | TEXT | legível, derivado da intenção ("Cobrança divergente na fatura") |
| `status` | TEXT | `aberto` \| `em_andamento` \| `transferido` \| `resolvido` |
| `resolvido_por` | TEXT | `autoatendimento` \| `atendente_humano` — base da taxa de contenção |
| `score_atrito_final` | REAL | atrito no momento do encerramento |

### `protocolo_eventos`
Linha do tempo auditável do protocolo. Cada passo relevante (abertura, verificação 2FA,
desambiguação, transferência, encerramento) grava um evento com canal e descrição — é o que o
atendente lê no Console antes de falar, e o que o cliente vê ao consultar o protocolo.

| Coluna | Tipo | Descrição |
|---|---|---|
| `protocolo_numero` | TEXT (FK) | |
| `canal` | TEXT | onde o evento aconteceu |
| `tipo` | TEXT | `abertura` \| `verificacao` \| `diagnostico` \| `transferencia` \| `retomada` \| `encerramento` |
| `descricao` | TEXT | texto legível por humano |

### `verificacoes`
Desafios de verificação em duas etapas. **O código nunca é armazenado em texto puro.**

| Coluna | Tipo | Descrição |
|---|---|---|
| `codigo_hash` | TEXT | SHA-256 do código com salt — a comparação usa `timingSafeEqual` |
| `destino_mascarado` | TEXT | `(11) *****-4321` — o número completo não é repetido aqui |
| `motivo` | TEXT | intenção que exigiu o segundo fator; usada para **retomar** o fluxo após validar |
| `tentativas` / `max_tentativas` | INTEGER | bloqueia em 3 tentativas |
| `status` | TEXT | `pendente` \| `validado` \| `expirado` \| `bloqueado` |
| `expira_em` | TEXT | 5 minutos após a criação |

### `fila_atendimento`
Estado do transbordo para humano.

| Coluna | Tipo | Descrição |
|---|---|---|
| `prioridade` | TEXT | `alta` (churn ≥ 70, score ≥ 80 ou cancelamento) \| `media` \| `baixa` |
| `risco_churn` | REAL | 0–100 — **critério de desempate da fila**, dentro da mesma gravidade |
| `tipo_servico` | TEXT | `financeiro` \| `tecnico` \| `retencao` \| `comercial` \| `consumo` \| `cadastro` \| `geral` |
| `produto_linha` | TEXT | linha do produto em foco, para roteamento por especialidade |
| `status` | TEXT | `aguardando` \| `em_atendimento` \| `encerrado` |
| `atendente_nome` | TEXT | quem assumiu |
| `resumo_contexto` | TEXT | JSON com persona, produto, sinais e últimas falas — o briefing que evita o cliente repetir |
| `entrou_em` / `iniciado_em` / `encerrado_em` | TEXT | permitem medir espera e duração |

A **posição na fila não é armazenada**: é calculada na consulta, ordenando por gravidade, depois por
risco de churn decrescente e só então por ordem de chegada. Guardar posição seria denormalizar um
dado que muda a cada entrada e saída — e aqui ele muda também quando o churn de alguém sobe.

### `eventos_seguranca`
Auditoria dos guardrails e das falhas de 2FA.

| Coluna | Tipo | Descrição |
|---|---|---|
| `tipo` | TEXT | `prompt_injection` \| `extracao_dados` \| `engenharia_social` \| `fora_escopo` \| `falha_2fa` |
| `severidade` | TEXT | `baixa` \| `media` \| `alta` |
| `padrao_detectado` | TEXT | qual regra disparou, ex: `sql_injection` |
| `trecho` | TEXT | **truncado em 120 caracteres e já redigido** — o log de segurança não pode virar vazamento |
| `acao` | TEXT | `bloqueado` \| `redirecionado` \| `monitorado` |

### `persona_dicionario`
Léxico editável que alimenta o Persona Engine. Tirar isso do código é o que permite à equipe de
atendimento cadastrar uma gíria nova sem deploy.

| Coluna | Tipo | Descrição |
|---|---|---|
| `persona` | TEXT | `digital` \| `intermediario` \| `assistido` \| `informal` |
| `termo` | TEXT | sempre em minúsculas |
| `categoria` | TEXT | `tecnico` \| `ajuda` \| `giria` \| `formal` \| `personalizado` |
| `peso` | INTEGER | quanto o termo soma para a persona |
| `ativo` | INTEGER | desativar sem apagar — preserva o histórico da calibração |

### `acoes_autoatendimento`
Ações transacionais propostas e executadas no chat.

| Coluna | Tipo | Descrição |
|---|---|---|
| `tipo` | TEXT | `pagamento` \| `upgrade_plano` |
| `detalhe` | TEXT | JSON com o que foi proposto e, após execução, o comprovante |
| `valor` | REAL | |
| `status` | TEXT | `proposta` → `confirmada` \| `descartada` |

O ciclo `proposta` → `confirmada` é o que permite ao cliente responder só "pode ser" no turno
seguinte sem o sistema perder o que estava sendo tratado.

### Colunas acrescentadas às tabelas existentes

| Tabela | Coluna | Para quê |
|---|---|---|
| `sessoes` | `protocolo_numero`, `verificado`, `risco_churn`, `continuidade_anunciada` | vincular protocolo, marcar 2FA validado, guardar o churn calculado e lembrar que o aviso de retomada já foi dado (não se repete a cada turno) |
| `fila_atendimento` | `risco_churn`, `tipo_servico`, `produto_linha` | priorizar por risco de cancelamento e filtrar a fila por especialidade |
| `clientes` | `tipo_pessoa`, `cnpj_mascara`, `segmento` | suportar cliente PJ (Claro Empresas) |
| `produtos_catalogo` | `segmento`, `valor_referencia`, `franquia_gb`, `velocidade_mbps`, `tipo_chip`, `beneficios` | descrever o produto real e alimentar a matriz de capacidades |
| `mensagens` | `protocolo_numero`, `bloqueado_guardrail` | rastrear por protocolo e marcar mensagens bloqueadas |
| `intervencoes` | `protocolo_numero` | ligar a intervenção ao protocolo |

Essas colunas são adicionadas por uma rotina de migração idempotente em
[`database.js`](../clarointelligence-api/src/database.js): `CREATE TABLE IF NOT EXISTS` não altera
tabela existente, então a função `migrate()` checa `PRAGMA table_info` antes de cada `ALTER TABLE`.
É o que permite atualizar um banco já criado sem apagá-lo.

## Convenções do esquema

- **IDs são UUID v4 em texto**, gerados na aplicação (`uuid` npm package), não `AUTOINCREMENT` — facilita gerar dados de seed determinísticos e evita vazar contagem de linhas.
- **Todo acesso ao banco usa consultas parametrizadas** (`db.prepare(...).run(params)` / `.get(params)` / `.all(params)`), nunca concatenação de string com entrada do usuário — isso elimina a classe de vulnerabilidade de SQL injection por construção. Ver [SEGURANCA.md](SEGURANCA.md).
- **Datas em texto ISO** (`datetime('now')`), sem tipo `DATETIME` nativo — padrão do SQLite.
- **Sem transações explícitas multi-statement** (`node:sqlite` não expõe `.transaction()`): operações compostas usam `db.exec('BEGIN...COMMIT')` ou múltiplos `run()` sequenciais quando necessário. Ver [DECISOES.md](DECISOES.md).
