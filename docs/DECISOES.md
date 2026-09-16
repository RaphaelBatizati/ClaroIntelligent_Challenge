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

## Guardrails por padrão léxico, não por classificador semântico

A contenção de prompt injection usa expressões regulares sobre a mensagem de entrada, não um modelo
de classificação. A escolha é deliberada e tem um limite conhecido: um ataque redigido de forma
criativa o bastante passa pelo filtro.

O que sustenta a segurança não é o filtro — é a **arquitetura**. Mesmo que um prompt escape, a IA só
consegue falar sobre o que o Product Resolver entregou naquele turno (os contratos daquele cliente),
porque não existe caminho de código que leia dados de outro titular. O guardrail reduz ruído, dá
visibilidade em auditoria e bloqueia o óbvio; o isolamento é o que garante.

Um classificador semântico seria a evolução natural, mas introduziria uma chamada de modelo no
caminho crítico — latência e custo — para proteger algo que a arquitetura já contém.

## Bloqueio na entrada, antes de qualquer processamento

Os guardrails rodam como **primeiro passo** do pipeline, antes do resolver de produto, dos
adaptadores e do LLM. A alternativa comum (filtrar a saída do modelo) foi descartada: se o ataque
chega ao LLM, a contenção passa a depender do modelo se comportar bem. Bloquear na entrada torna a
proteção independente do provedor — inclusive quando o LLM simulado for trocado por um real.

## Segundo fator obrigatório no WhatsApp e no Site

No WhatsApp, o "login" é a posse do número. Se o aparelho for clonado ou o número recuperado por um
terceiro, a conversa inteira é herdada. Por isso o 2FA é exigido nesses canais antes de qualquer
dado financeiro ou pessoal, mesmo que isso adicione um passo à jornada.

O App Minha Claro é o único canal isento no protótipo, por pressupor sessão autenticada — é a
mesma lógica que uma operadora aplicaria de fato.

Detalhes de implementação com peso de segurança: código gerado com `crypto.randomInt`, armazenado
apenas como hash SHA-256 com salt, comparado com `timingSafeEqual`, expirando em 5 minutos e
bloqueando em 3 tentativas. Nada disso é caro de fazer, e a ausência de qualquer um deles seria
apontável numa banca.

## Protocolo em todo contato, não só em reclamação

A Anatel (Res. 765/2023) exige protocolo para toda demanda do consumidor. Poderíamos gerar protocolo
só quando a conversa escalasse, mas isso quebraria justamente o caso mais interessante: o cliente
que abriu chamado no call center e voltou pelo chat. O protocolo é gerado na **primeira mensagem de
qualquer sessão**, em qualquer canal, e é ele que ancora a continuidade.

O formato `AAAAMMDD` + sequencial foi escolhido por ser legível a olho nu — dá para saber o dia do
atendimento sem consultar o sistema — e por ser o padrão que operadoras usam na prática.

## Fila humana em vez de integração real com WhatsApp

A alternativa seria conectar o protótipo a um número real de WhatsApp. Descartada: a via oficial
(Cloud API da Meta) exige conta empresarial verificada, número dedicado que não pode estar em uso no
app comum e webhook público; a via não oficial (`whatsapp-web.js`, `Baileys`) viola os Termos de
Serviço e arrisca o banimento permanente do número.

O Console do Atendente entrega o mesmo valor demonstrável — intervenção humana real, ao vivo, com
contexto completo — sem dependência externa nem risco. A análise completa está em
[INTEGRACAO_WHATSAPP.md](INTEGRACAO_WHATSAPP.md).

## Persona informal como perfil próprio, não como ruído

As três personas originais mediam **literacia digital**. A informalidade é outro eixo: alguém pode
escrever "blz, vc consegue ver isso pra mim?" e dominar perfeitamente a tecnologia.

Tratar gíria como sinal de baixa literacia produziria dois erros: responder de forma
excessivamente tutelada a quem não precisa, e soar frio e distante com quem só escreve como fala.
Por isso `informal` é um perfil com tom espelhado, e o *blending* garante que quem é `assistido` e
escreve informal **continue** recebendo explicação simples — informalidade não cancela necessidade
de apoio.

## Dicionário de personas em banco, não em código

A classificação saiu da regex fixa para a tabela `persona_dicionario`. Gíria muda rápido e é
regional; quem sabe qual termo entrou em uso é a equipe de atendimento, não quem escreve código.
Tirar isso do código transforma uma alteração de comportamento do sistema em **edição de dado pelo
painel**, sem deploy.

O custo é uma consulta a cada classificação, mitigada por cache de 30 segundos — curto o bastante
para o painel parecer instantâneo ao editar.

## Matriz de capacidades no resolver de produto

Etapa prevista no briefing original e implementada aqui: antes de perguntar ao cliente, o resolver
descarta contratos que **não suportam** a intenção. Um link dedicado não tem franquia de dados; um
plano móvel não recebe visita técnica.

Sem a matriz, a Vega Soluções (dois contratos na linha `empresas`) receberia uma pergunta de
desambiguação sempre. Com ela, "quanto da franquia compartilhada já foi usado?" resolve sozinho.
Cada pergunta evitada é atrito evitado — e o ClaroSense mede exatamente isso.

## Score de atrito acumulativo por sessão, não por mensagem

O score soma ao longo da conversa em vez de ser recalculado a cada turno. Um cliente que repete o
problema três vezes e escala o tom não está tendo três problemas isolados: está numa escalada. Um
score por mensagem perderia exatamente o padrão que antecede o cancelamento.

Os pesos (tom agressivo +35, pedido de humano +35, cancelamento +30, frustração +28, repetição +22)
são fixos e documentados de propósito. Um modelo estatístico daria um número melhor calibrado, mas
ninguém conseguiria explicar à banca — ou ao cliente, sob o art. 20 da LGPD — **por que** aquela
transferência aconteceu.

## Ações transacionais em duas etapas (proposta → confirmação)

O autoatendimento nunca executa pagamento ou upgrade na primeira mensagem. A proposta é persistida
com status `proposta` e só o "sim" do turno seguinte a executa.

Isso resolve dois problemas de uma vez: evita ação financeira por interpretação errada de intenção,
e permite responder a um simples "pode ser" sem perder o que estava em curso — o estado está no
banco, não na interpretação do texto.

## Estrutura de commits e branches sugerida (briefing original)

O briefing do projeto ([`docs/briefing/PROMPT_Prototipo_ClaroIntelligence.md`](briefing/PROMPT_Prototipo_ClaroIntelligence.md)) definiu como convenção de trabalho: ondas pequenas e verificáveis, commits em português no imperativo, sem commit direto na branch principal (`feat/`, `fix/`, `refactor/`), e decisões de mais de um caminho razoável registradas neste arquivo antes de seguir.
