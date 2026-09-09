# Segurança e privacidade

Este documento descreve o que o MVP faz hoje em termos de segurança, o que é uma limitação **consciente** de escopo acadêmico, e o que precisaria mudar antes de qualquer uso com dados reais. Ser transparente sobre essa fronteira é parte da avaliação da banca.

## O que já está implementado

### Prevenção de SQL injection por construção
Todo acesso ao SQLite em todo o backend usa `db.prepare(sql).get/all/run(params)` com placeholders `?` — nenhuma rota concatena entrada do usuário diretamente em uma string SQL. Isso vale inclusive para os campos de texto livre (`mensagem` do chat, filtros de rota). Ver exemplos em [`routes/chat.js`](../clarointelligence-api/src/routes/chat.js) e [BANCO_DE_DADOS.md](BANCO_DE_DADOS.md).

### Minimização de dados pessoais (CPF)
O CPF **nunca é armazenado em texto puro** no banco — a coluna `cpf_mascara` já nasce mascarada na carga de dados (`***.***.456-**`, ver [`seed.js`](../clarointelligence-api/src/seed.js)). Isso é deliberado: a aplicação não precisa do CPF completo para nenhuma das suas funções (identificação usa `cliente_id`), então ele simplesmente não é coletado em texto puro em lugar nenhum — minimização pela origem, não por mascaramento na exibição.

![Diagrama LGPD](assets/diagramas/lgpd.png)

### CORS restrito a uma origem configurável
`server.js` só aceita requisições da origem definida em `CORS_ORIGIN` (default `http://localhost:5173`), não `*`.

### Superfície de segredo mínima
Não há chave de API, token ou segredo de terceiro no projeto — o LLM é simulado (sem API key), o banco é um arquivo local, e os únicos `.env` guardam configuração não sensível (porta, URL, caminho de arquivo). Isso está documentado nos `.env.example` de cada pacote; os `.env` reais não são versionados.

## Limitações conhecidas (escopo do MVP acadêmico)

Estas são decisões explícitas para manter o MVP demonstrável sem infraestrutura extra — **não** recomendações de arquitetura para produção.

| Limitação | Onde | Risco se fosse produção | O que resolveria |
|---|---|---|---|
| **Sem autenticação/autorização** | toda a API (`server.js`) | qualquer pessoa com acesso à rede local pode chamar qualquer endpoint como qualquer `cliente_id` | JWT/OAuth na borda, sessão de canal autenticada, RBAC real nas rotas do painel (a tela "Perfis de Usuário" hoje é só uma simulação visual dos 4 papéis, não aplica controle de acesso de fato) |
| **Sem rate limiting** | toda a API | abuso/DoS trivial do endpoint de chat | middleware de rate limit por IP/cliente na camada de borda |
| **Sem validação de payload** | `PUT /api/produtos/personas/config`, corpo do chat | valores inválidos (`NaN`, tipos errados) podem ser gravados sem checagem | schema de validação (ex. zod/joi) antes de tocar o banco |
| **Banco SQLite local sem criptografia em repouso** | `clarointelligence.sqlite` | leitura direta do arquivo expõe tudo (mesmo que CPF já venha mascarado) | Postgres com criptografia em repouso + gestão de chaves, como no desenho arquitetural alvo pós-MVP |
| **Logs em console incluem método e caminho de toda requisição** | `server.js` middleware de log | não loga corpo/PII hoje, mas não há política formal de retenção/expurgo de log | pipeline de observabilidade com redaction e retenção definida |
| **Mensagens de erro genéricas, mas `detalhe` do erro interno vaza na rota de chat** | `routes/chat.js` | mensagem de exceção pode revelar detalhe interno em ambiente exposto | remover `detalhe` da resposta em produção, manter só em log server-side |

## LGPD — como o desenho do MVP se relaciona com a lei

O projeto foi pensado com os princípios da LGPD (Lei 13.709/2018) em mente, mesmo sem uma implementação de conformidade completa (que exigiria, entre outros, um Encarregado de Dados formal e uma base legal documentada por finalidade):

- **Minimização**: CPF não circula em texto puro em nenhuma camada da aplicação (ver acima).
- **Finalidade e necessidade**: os dados de contrato (`dados_extra` por linha de produto) só são lidos pelo adaptador da própria linha — o núcleo de orquestração nunca acessa dados de um produto que não está resolvendo naquele turno.
- **Rastreabilidade**: cada mensagem grava qual `trace_id` a originou e quais memórias (`memoria_usada`) influenciaram a resposta — importante para auditoria de decisão automatizada, um direito do titular sob a LGPD (art. 20).
- **Retenção limitada da memória de curto prazo**: `ClaroMemory.recuperar()` só busca registros das últimas 24h (`WHERE created_at > datetime('now', '-24 hours')`) — não existe hoje, porém, uma rotina de expurgo automático dos registros mais antigos do banco (ficam retidos indefinidamente no arquivo SQLite). Ver [`claroMemory.js`](../clarointelligence-api/src/services/claroMemory.js).
- **Direito de exclusão**: não há endpoint de exclusão/anonimização de dados de um cliente no MVP atual — seria o próximo item de conformidade a implementar.

## Antes de qualquer uso com dados reais

1. Autenticação e autorização reais na borda (não apenas CORS).
2. Trocar SQLite local por um banco com controle de acesso, criptografia em repouso e backup gerenciado.
3. Adicionar rate limiting e validação de schema em toda rota que recebe corpo de requisição.
4. Formalizar rotina de retenção/expurgo de dados pessoais e endpoint de exclusão a pedido do titular.
5. Revisar todo log e resposta de erro para garantir que nenhum dado pessoal ou detalhe de implementação vaza para o cliente final.

Essas ações não foram feitas neste MVP porque o objetivo do Sprint era provar o comportamento funcional dos motores (ClaroMemory, Persona Engine, ClaroSense) e do Product Context Resolver, não endurecer a plataforma para produção — mas o desenho evita ativamente os erros mais graves (SQL injection, CPF em texto puro, segredos no repositório) para que o próximo passo seja endurecimento de borda, não reescrita do núcleo.
