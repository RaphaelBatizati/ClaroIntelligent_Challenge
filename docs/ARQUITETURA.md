# Arquitetura

O ClaroIntelligence é uma **camada de orquestração com IA sobre os canais digitais já existentes da Claro** — ele não substitui site, app ou WhatsApp, ele coordena o que acontece por trás deles. O projeto nasce de um problema concreto: hoje esses canais têm inteligências isoladas, então o cliente repete a mesma informação toda vez que troca de canal, o transbordo para atendente humano cresce, e cada time reconstrói integrações parecidas contra os sistemas de back-office (BSS).

Este documento descreve como o MVP resolve isso, camada por camada.

## Visão geral (antes / depois)

| Antes | Depois |
|---|---|
| ![Arquitetura antes](assets/diagramas/arq_antes.png) | ![Arquitetura depois](assets/diagramas/arq_depois.png) |

Sem uma camada de orquestração, cada canal fala diretamente com os sistemas de origem e não sabe o que aconteceu nos outros canais. Com o ClaroIntelligence no meio, todo canal passa por um núcleo único que resolve *quem é o cliente*, *qual produto ele quer dizer* e *o que já foi dito antes*, antes de qualquer resposta.

## As 5 camadas

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CANAIS         Site · App · WhatsApp (simulados no front) │
├─────────────────────────────────────────────────────────────┤
│ 2. BORDA          CORS, ponto de entrada único (Express)     │
├─────────────────────────────────────────────────────────────┤
│ 3. NÚCLEO         Product Context Resolver · Intent Router   │
├─────────────────────────────────────────────────────────────┤
│ 4. MOTORES        ClaroMemory · Persona Engine · ClaroSense  │
├─────────────────────────────────────────────────────────────┤
│ 5. DADOS/ORIGEM   SQLite · Adaptadores por linha de produto  │
└─────────────────────────────────────────────────────────────┘
```

| Camada | Componente | Onde está no código |
|---|---|---|
| Canais | Simulação de site / app / WhatsApp na mesma interface | [`clarointelligence/src/pages/ChatCliente.jsx`](../clarointelligence/src/pages/ChatCliente.jsx) |
| Borda | CORS, JSON parsing, roteamento único | [`clarointelligence-api/src/server.js`](../clarointelligence-api/src/server.js) |
| Núcleo | Resolução de produto, roteamento de intenção | [`services/productResolver.js`](../clarointelligence-api/src/services/productResolver.js), [`services/intentDetector.js`](../clarointelligence-api/src/services/intentDetector.js) |
| Motores | Memória, persona, atrito | [`services/claroMemory.js`](../clarointelligence-api/src/services/claroMemory.js), [`services/personaEngine.js`](../clarointelligence-api/src/services/personaEngine.js), [`services/claroSense.js`](../clarointelligence-api/src/services/claroSense.js) |
| Dados | Banco + adaptadores por linha de produto | [`database.js`](../clarointelligence-api/src/database.js), [`adapters/`](../clarointelligence-api/src/adapters/) |

### Regras de arquitetura

- **Caminho crítico separado do caminho de aprendizado.** A resposta ao cliente é síncrona; a gravação da memória conversacional é assíncrona (`setImmediate`, veja [`routes/chat.js`](../clarointelligence-api/src/routes/chat.js) passo 13) e nunca atrasa a resposta.
- **Camada anticorrupção diante dos sistemas de origem.** O núcleo nunca conhece o formato de um BSS real. Cada linha de produto (móvel, residencial, TV) tem um adaptador próprio que traduz para um contrato interno único — ver seção "Adaptadores" abaixo.
- **Provedor de LLM plugável.** A geração de resposta passa por um único ponto (`services/llm.js`), hoje implementado como um simulador determinístico (ver [DECISOES.md](DECISOES.md)); trocar por uma API real (Claude, por exemplo) significa reimplementar esse único módulo, sem tocar no núcleo.
- **Ponto de entrada único.** Todo canal — site, app ou WhatsApp — chama o mesmo endpoint `POST /api/chat/mensagem` (ver [API.md](API.md)). A diferenciação de canal é um parâmetro, não uma rota separada.

## Pipeline de uma mensagem

Este é o fluxo real executado a cada chamada de `POST /api/chat/mensagem` ([`routes/chat.js`](../clarointelligence-api/src/routes/chat.js)):

```
Cliente envia mensagem
        │
        ▼
1. Carrega cliente + sessão (cria sessão nova se não existir)
        │
        ▼
2. Intent Detector — regex ponderada por intenção (services/intentDetector.js)
        │
        ▼
3. Product Context Resolver (services/productResolver.js)
   ├─ produto já confirmado na sessão? usa ele
   ├─ 1 produto só no portfólio? resolve direto
   ├─ vários produtos? tenta inferir por intenção → canal → texto
   └─ ainda ambíguo? PARA aqui e pergunta ao cliente (1 frase só)
        │
        ▼
4. ClaroMemory.recuperar() — busca resumos das últimas 24h (services/claroMemory.js)
        │
        ▼
5. Persona Engine — classifica tom: digital / intermediário / assistido (services/personaEngine.js)
        │
        ▼
6. Adapter da linha de produto — busca dados "do BSS" (adapters/movel|residencial|tv.js)
        │
        ▼
7. LLM simulado gera a resposta combinando intenção × linha × persona × dados (services/llm.js)
        │
        ▼
8. ClaroSense recalcula o score de atrito da sessão (services/claroSense.js)
   └─ score ≥ 80? sobrescreve a resposta com transferência para humano
        │
        ▼
9. Persiste mensagens + sinais de atrito no SQLite
        │
        ▼
10. [assíncrono, não bloqueia a resposta] ClaroMemory.salvar() grava o resumo da interação
        │
        ▼
Resposta volta ao canal, junto com score de atrito, persona detectada e trechos de memória usados
```

O diagrama de fluxo de dados completo está em [`assets/diagramas/fluxo_dados.png`](assets/diagramas/fluxo_dados.png).

## Product Context Resolver — a peça mais diferenciada

O mesmo titular pode ter banda larga fixa, linhas móveis e TV ao mesmo tempo. "Minha internet caiu" pode ser a fibra da casa, o FWA 5G ou a franquia do celular — errar o produto é pior que não responder, porque executa a ação certa no contrato errado.

![Modelo multiproduto](assets/diagramas/modelo_multiproduto.png)

A resolução acontece em cascata, do sinal mais forte para o mais fraco (ver [`productResolver.js`](../clarointelligence-api/src/services/productResolver.js)):

1. **Produto já confirmado na sessão** — se o cliente já esclareceu o produto nesta conversa, usa ele para todos os turnos seguintes.
2. **Portfólio com um produto só** — não há ambiguidade, segue direto.
3. **Afinidade intenção → linha** — por exemplo, `recarga` e `portabilidade` só fazem sentido para `movel`; `visita_tecnica` só para `residencial`.
4. **Menção explícita no texto** — palavras como "fibra", "wifi", "celular", "tv" no texto do cliente resolvem a ambiguidade sem perguntar.
5. **Pergunta ao cliente** — só quando as etapas anteriores falham, e em uma frase só, listando os produtos ativos.

**Chaves de identificação por linha de produto** (por que um adaptador por linha é necessário):

| Linha | Chave real |
|---|---|
| Móvel | linha (MSISDN), sob uma conta de faturamento |
| Banda larga fixa | ponto de instalação (endereço) — o mesmo CPF com duas casas tem dois contratos |
| TV / streaming | assinatura vinculada ao CPF ou ao ponto |

## Adaptadores por linha de produto

Cada adaptador (`adapters/movel.js`, `adapters/residencial.js`, `adapters/tv.js`) simula a consulta a um sistema de origem (BSS) diferente e devolve um formato interno único e estável. O núcleo nunca lê `dados_extra` bruto do contrato nem conhece particularidades de cada sistema — só o adaptador da linha sabe interpretar isso.

Exemplo (`movel.js`): calcula franquia usada, saldo de recarga, formata MSISDN e monta linha digitável de boleto, tudo a partir de uma única consulta parametrizada ao contrato ativo do cliente.

`adapters/empresas.js` existe como stub declarado (catálogo e roteamento funcionam, resposta é mínima) — está fora do escopo do MVP e marcado como trabalho futuro.

## Motores

### ClaroMemory — continuidade entre canais
Grava um resumo curto de cada interação (`memoria_conversacional`) e recupera os resumos das últimas 24h no início da próxima conversa, em qualquer canal. Detecta jornada multicanal comparando o canal da sessão atual com o canal da última sessão encerrada do cliente. Ver [BANCO_DE_DADOS.md](BANCO_DE_DADOS.md) para o esquema.

### Persona Engine — adaptação de tom
Classifica o cliente em `digital` / `intermediario` / `assistido` a partir de análise léxica do texto (termos técnicos vs. pedidos de ajuda) combinada com o perfil salvo do cliente, com uma regra de *blending* que evita chavear de perfil a cada mensagem isolada. Isso ajusta o vocabulário e a estrutura da resposta gerada pelo LLM simulado.

### ClaroSense — detecção de atrito em tempo real
Soma um score 0–100 por sessão a partir de 4 sinais: repetição da mesma intenção, mensagem monossilábica, linguagem de frustração (regex de sentimento negativo) e pedido explícito de atendente humano. Três limiares definem o nível (`alerta` 40+, `risco` 65+, `transbordo` 80+) e disparam intervenções automáticas — a mais forte é a transferência automática para fila prioritária com contexto completo, sem que o cliente precise repetir nada. Ver [`assets/diagramas/lgpd.png`](assets/diagramas/lgpd.png) e [`assets/diagramas/memoria_semantica.png`](assets/diagramas/memoria_semantica.png) para os diagramas complementares.

## Camadas do front-end

O front-end único simula os 3 canais (site, app, WhatsApp) trocando apenas o parâmetro `canal` enviado à API e o estilo visual — a lógica de negócio inteira vive no back-end, nunca no cliente. Além do chat de demonstração, há um painel administrativo com 7 telas (Dashboard, Mapa de Atrito, Monitor de Conversas, Log ClaroSense, Gestão de Personas, Chat do Cliente, Perfis de Usuário) — ver rotas em [`App.jsx`](../clarointelligence/src/App.jsx).

## Wireframes (evolução)

| Antes | Depois |
|---|---|
| ![Wireframe antes](assets/diagramas/wireframe_antes.png) | ![Wireframe depois](assets/diagramas/wireframe_depois.png) |

| Fluxograma antes | Fluxograma depois |
|---|---|
| ![Fluxograma antes](assets/diagramas/fluxograma_antes.png) | ![Fluxograma depois](assets/diagramas/fluxograma_depois.png) |

## Fora de escopo do MVP (declarado)

- `adapters/empresas.js` e `iot`: apenas stub, catálogo e roteamento funcionam, resposta simulada mínima.
- Autenticação/autorização real de canais e usuários do painel — ver [SEGURANCA.md](SEGURANCA.md).
- Postgres com extensão vetorial para memória semântica real (o MVP usa SQLite com busca por `cliente_id` + janela de tempo, não busca vetorial) — ver [DECISOES.md](DECISOES.md).
- Provedor de LLM real — hoje é um simulador determinístico sem custo, sem latência e sem API key.

## Para aprofundar

- [BANCO_DE_DADOS.md](BANCO_DE_DADOS.md) — esquema completo das tabelas e relacionamentos
- [API.md](API.md) — todos os endpoints, request/response
- [SEGURANCA.md](SEGURANCA.md) — modelo de ameaças, LGPD, limitações conhecidas
- [DECISOES.md](DECISOES.md) — decisões técnicas e por que foram tomadas
- [entregas-academicas/](entregas-academicas/) — documentos originais da banca (Word/PDF) com os diagramas em alta resolução
