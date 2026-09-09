# Decisões técnicas

Registro do porquê de escolhas que não são óbvias só lendo o código.

## `node:sqlite` nativo em vez de `better-sqlite3`

`better-sqlite3` depende de compilação nativa (node-gyp), e isso falhou no ambiente de desenvolvimento Windows sem Visual Studio Build Tools instalado. Em vez de instalar toda a toolchain de compilação C++ só para rodar um MVP acadêmico, a solução foi usar `node:sqlite` (`DatabaseSync`), módulo experimental nativo do Node.js 22.5+ — zero dependência nativa, zero compilação, funciona em qualquer máquina com Node instalado.

Trade-off aceito: `node:sqlite` não expõe `.transaction()` como `better-sqlite3`. Operações que precisariam de transação usam `db.exec('BEGIN...COMMIT')` diretamente ou múltiplos `run()` sequenciais quando a atomicidade não é crítica para a demonstração (ver [`seed.js`](../clarointelligence-api/src/seed.js)).

Consequência prática: os scripts `npm run server`, `npm run seed` e `npm run dev` do backend precisam da flag `--experimental-sqlite` — já embutida no `package.json`, mas relevante se algum dia esses comandos forem chamados de outra forma (ex. um processo gerenciador externo).

## LLM simulado determinístico em vez de API real

O núcleo de orquestração (Product Resolver, Persona Engine, ClaroMemory, ClaroSense) é o que o desafio pede para provar — a geração de texto em si não é o diferencial avaliado. Um LLM simulado com ~60 templates (interseção de intenção × linha de produto × persona), implementado em [`services/llm.js`](../clarointelligence-api/src/services/llm.js), permite demonstrar o pipeline completo:

- sem custo de API,
- sem latência de rede (importante para gravar vídeo de demo sem cortes),
- sem exigir chave de API do avaliador para rodar o projeto,
- com resultado **reprodutível** — a mesma combinação de intenção/produto/persona sempre gera a mesma resposta, o que facilita validar o pipeline.

A arquitetura já isola essa escolha atrás de um único módulo (`services/llm.js`) justamente para que trocar por um provedor real (ex. Claude) não exija tocar no núcleo — é a regra de "provedor de LLM plugável" descrita em [ARQUITETURA.md](ARQUITETURA.md).

## SQLite local em vez de Postgres com extensão vetorial

O desenho arquitetural alvo (documentado nas entregas de [`docs/entregas-academicas/`](entregas-academicas/)) prevê Postgres com extensão de vetor para memória semântica real. No MVP, a recuperação de memória em [`claroMemory.js`](../clarointelligence-api/src/services/claroMemory.js) usa uma consulta relacional simples — filtro por `cliente_id` e janela de tempo (`últimas 24h`), sem busca por similaridade semântica. Isso evita a dependência de um servidor Postgres + extensão `pgvector` só para demonstrar o comportamento de continuidade entre canais, que já é visível com a estratégia mais simples.

## CPF nunca armazenado em texto puro

Decisão de privacidade desde a modelagem do banco: a coluna `clientes.cpf_mascara` já nasce mascarada no seed (`***.***.456-**`), não existe em nenhum lugar do schema uma coluna de CPF completo. Ver [SEGURANCA.md](SEGURANCA.md#lgpd-e-dados-pessoais).

## Todo acesso a dados passa por consulta parametrizada

Nenhuma rota ou service concatena entrada do usuário em SQL — sempre `db.prepare(sql).get/all/run(params)`. Essa disciplina foi mantida mesmo em campos de texto livre vindos do cliente (a mensagem do chat), eliminando a classe de vulnerabilidade de SQL injection por construção, sem precisar de uma camada extra de sanitização.

## Ponto de entrada único para todos os canais

`POST /api/chat/mensagem` atende site, app e WhatsApp simulados — a diferença de canal é o campo `canal` no corpo da requisição, não uma rota por canal. Isso evita triplicar a lógica de pipeline e mantém a regra "borda com ponto de entrada único e explícito" do desenho de arquitetura.

## KPIs do dashboard combinam dado real com linha de base simulada

As rotas em [`routes/dashboard.js`](../clarointelligence-api/src/routes/dashboard.js) somam contagens reais do SQLite a números de base fixos/aleatórios (ex. `total.n + 1847`). Isso é deliberado: um painel administrativo vazio logo após `npm run seed` não demonstra nada para a banca. É uma decisão de **demonstração**, documentada aqui e em [API.md](API.md) para não ser confundida com telemetria real de produção.

## Estrutura de commits e branches sugerida (briefing original)

O briefing do projeto ([`docs/briefing/PROMPT_Prototipo_ClaroIntelligence.md`](briefing/PROMPT_Prototipo_ClaroIntelligence.md)) definiu como convenção de trabalho: ondas pequenas e verificáveis, commits em português no imperativo, sem commit direto na branch principal (`feat/`, `fix/`, `refactor/`), e decisões de mais de um caminho razoável registradas neste arquivo antes de seguir.
