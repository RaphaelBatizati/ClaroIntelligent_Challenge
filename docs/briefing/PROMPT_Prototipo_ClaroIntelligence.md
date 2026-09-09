# Prompt para o Claude Code: evolução do protótipo ClaroIntelligence até o MVP final

> Cole o bloco inteiro abaixo como primeira mensagem no Claude Code, dentro da pasta do projeto.
> Se preferir, salve como `.claude/BRIEFING.md` no repositório e mande apenas: `leia .claude/BRIEFING.md e execute a Fase 0`.

---

Você vai evoluir o protótipo do **ClaroIntelligence** até um MVP funcional de ponta a ponta, back-end e front-end, pronto para ser avaliado por uma banca acadêmica e pela equipe da Claro. Já existe código neste repositório. Não reescreva o que funciona: parta do que existe, complete o que falta e refatore só quando o desenho atual impedir o objetivo.

## 1. Contexto do projeto

O ClaroIntelligence é uma **camada de orquestração com IA sobre os canais digitais já existentes da Claro**, sem substituí-los. Três componentes:

- **ClaroMemory**: memória semântica da jornada. O cliente nunca começa do zero, em nenhum canal.
- **Persona Engine**: adapta tom, vocabulário e nível de detalhe ao perfil comportamental do cliente.
- **ClaroSense**: detecta atrito durante a conversa e age antes do abandono, em vez de medir satisfação depois.

O problema de origem: a Claro opera site, app Minha Claro, três números de WhatsApp, chatbots e call center com inteligências isoladas. O cliente repete informações a cada troca de canal, o transbordo para o humano cresce e os squads refazem integrações equivalentes.

Na banca da Sprint 2 a Claro acrescentou um segundo eixo ao problema: **além dos canais, a solução precisa integrar os diferentes produtos da operadora**. O mesmo titular tem banda larga fixa, linhas móveis, TV, telefonia fixa e, no corporativo, links dedicados e dispositivos conectados. "Minha internet caiu" pode ser a fibra da casa, o FWA 5G, a franquia do celular ou a conexão do Box de TV. Errar o produto é pior que não responder, porque executa a ação certa no contrato errado.

## 2. Fase 0, obrigatória antes de escrever qualquer código

1. Leia o repositório inteiro e produza um inventário: stack, estrutura de pastas, o que já roda, o que está pela metade, o que está morto.
2. Confronte esse inventário com as seções 4 a 9 deste briefing e produza uma **tabela de lacunas**: item, situação atual, o que falta, esforço estimado (P, M, G).
3. Proponha um **plano de execução em ondas**, priorizando o que aparece no vídeo de demonstração (seção 9) e o que sustenta os requisitos (seção 8).
4. **Pare e me mostre o inventário, a tabela de lacunas e o plano antes de implementar.** Só siga depois do meu aceite.

## 3. Como trabalhar

- Trabalhe em ondas pequenas e verificáveis. Ao fim de cada onda: a aplicação sobe, os testes passam, e você me diz em duas linhas o que mudou e como eu vejo isso funcionando na tela.
- Nunca deixe o repositório em estado quebrado entre ondas.
- Commits pequenos, em português, no imperativo. Sem commit direto na branch principal: use `feat/`, `fix/`, `refactor/`.
- Quando uma decisão tiver mais de um caminho razoável e a escolha mudar o resultado, pergunte antes. Nos demais casos, escolha o padrão sensato, registre em `docs/decisoes.md` e siga.
- Se algo do briefing conflitar com o que já existe no código e o código estiver certo, me diga em vez de obedecer cegamente.

## 4. Arquitetura alvo

Cinco camadas, mais governança transversal. Mantenha essa separação visível na estrutura de pastas.

1. **Canais**: no protótipo, uma interface web que simula site, app e WhatsApp, com aparência distinta por canal e sessão independente. É o que permite demonstrar continuidade entre canais.
2. **Borda**: autenticação, validação de contrato e rate limit. No protótipo pode ser simplificada, mas o ponto de entrada deve ser único e explícito.
3. **Núcleo de orquestração**: Session Manager, Unified Customer ID, **Product Context Resolver**, Intent Router, Response Composer.
4. **Motores**: ClaroMemory, Persona Engine, ClaroSense.
5. **Dados e sistemas de origem**: Postgres com extensão de vetor, cache, e **adaptadores por linha de produto** contra simuladores dos BSS da Claro.

Regras de arquitetura que não podem ser violadas:

- **Caminho crítico separado do caminho de aprendizado.** A resposta ao cliente é síncrona. A gravação da memória é assíncrona, disparada por evento, e nunca bloqueia a resposta.
- **Orçamento de latência declarado por chamada.** Recuperação de memória tem limite de 250 ms. Se estourar, o sistema responde sem contexto, marca a resposta como degradada e registra o evento. Isso precisa ser observável na tela, não só no log.
- **Camada anticorrupção diante dos sistemas de origem.** O núcleo nunca conhece o formato de um BSS. Cada linha de produto tem um adaptador que traduz para um contrato interno único.
- **Provedor de LLM plugável.** Troca de provedor por configuração, sem alterar o núcleo.

## 5. Camada de contexto de produto

É a parte mais diferenciada do projeto e responde diretamente ao questionamento da Claro. Implemente o **Product Context Resolver**, executado logo depois do Unified Customer ID, em cinco etapas:

1. **Identidades**: consolida CPF ou CNPJ, MSISDN, id do app, ponto de instalação e número de contrato.
2. **Portfólio**: consulta contratos e assinaturas ativas do titular em cada sistema de origem, com cache de 15 minutos.
3. **Desambiguação**: um produto elegível, segue direto. Vários, infere pelo canal de entrada, histórico recente e última interação. Só pergunta ao cliente se a inferência não for confiável, e em uma frase só.
4. **Capacidades**: verifica na matriz se a intenção detectada é suportada por aquele produto.
5. **Adaptador**: seleciona o adaptador da linha de produto e monta a chamada no contrato daquele sistema.

**Chaves de identificação, que são diferentes por linha de produto:**

| Linha | Chave real |
|---|---|
| Móvel | linha (MSISDN), sob uma conta de faturamento |
| Banda larga fixa e telefonia fixa | ponto de instalação, ou seja, o endereço. O mesmo CPF com duas casas tem dois contratos |
| TV e streaming | assinatura vinculada ao CPF ou ao ponto |
| Corporativo | CNPJ, com múltiplos contratos por site e centro de custo |

**Adaptadores a implementar** (contra simuladores, com contrato realista, latência artificial e falhas ocasionais para provar o comportamento degradado):

- `movel`: Prezão, Controle, Pós, Max, Flex. Capacidades: saldo e recarga, fatura e segunda via, franquia e consumo, troca de plano, eSIM e portabilidade.
- `residencial`: Claro fibra (FTTH), Net Vírtua (HFC legado), FWA 5G. Capacidades: fatura e segunda via, diagnóstico remoto, upgrade de velocidade, visita técnica, mudança de endereço.
- `tv`: Claro tv+ App, Box, Soundbox, cabo, satélite, pré-pago. Capacidades: fatura e segunda via, ponto adicional, add-on de streaming, erro de sinal, troca de pacote.
- `empresas` e `iot`: podem ficar como adaptadores declarados com resposta simulada mínima, desde que o catálogo e o roteamento funcionem. Marque como escopo futuro no README.

**Catálogo de produtos** como fonte única de verdade, carregado por seed e editável pelo painel: `codigo_produto` estável e independente do nome comercial, `linha`, `familia`, `capacidades`, `adaptador`, `sla_consulta_ms`, `ativo`. Produto novo precisa entrar por configuração, nunca por alteração de código no núcleo.

## 6. Modelo de dados

Entidades da jornada conversacional: `cliente`, `identidade_externa`, `consentimento`, `perfil_persona`, `canal`, `sessao`, `mensagem`, `intencao`, `memoria_vetorial`, `contexto_recuperado`, `sinal_atrito`, `intervencao`, `historico_jornada`, `auditoria_acesso`.

Entidades da camada de produto: `conta_faturamento`, `ponto_instalacao`, `contrato`, `assinatura_produto`, `produto_catalogo`, `capacidade_produto`.

Pontos que precisam estar corretos:

- `contrato` carrega `sistema_origem`, que é o campo que decide qual adaptador usar.
- `assinatura_produto` é a menor unidade que o cliente reconhece: uma linha, um ponto de TV, um link. É sobre ela que o cliente fala.
- `sessao` guarda `id_assinatura_foco` e `produto_confirmado`, para não perguntar o produto a cada turno.
- `intencao` carrega `codigo_produto` e `confianca_produto`. Intenção e produto são um par, não dois campos soltos.
- `contexto_recuperado` registra quais trechos foram usados em cada resposta e com que score. É o que torna a decisão do modelo auditável.

## 7. Memória semântica

**Caminho de escrita**, assíncrono, ao fim de cada turno:
remoção de dados pessoais (regex e NER para CPF, cartão, endereço, telefone) → chunking de 400 tokens com sobreposição de 60, quebrando por turno de fala → resumo de até 80 tokens gerado pelo LLM, indicando intenção, o que resolveu e o que ficou pendente → embedding normalizado → gravação em namespace exclusivo do cliente, com metadados de canal, **código de produto**, intenção, resolução e prazo de expiração de 24 meses.

**Caminho de leitura**, a cada mensagem, com orçamento de 250 ms:
embedding da consulta com o mesmo modelo → busca por similaridade de cosseno, 20 candidatos → filtro obrigatório por cliente, opcional por janela de 90 dias, canal e **produto** → reordenação para os 8 mais relevantes → bloco final de até 1.200 tokens, com a data de cada trecho.

O filtro por produto não é detalhe: sem ele, uma conversa antiga sobre a fatura do celular entra como contexto de uma pergunta sobre a fatura da TV.

Regras de governança: isolamento por namespace, só o resumo pseudonimizado é vetorizado (o texto integral fica cifrado no relacional), expiração automática, e descarte de trechos com similaridade abaixo de 0,72.

## 8. Requisitos que o MVP precisa satisfazer

### Funcionais, com critério de aceite verificável

Priorize nesta ordem. Cada um precisa ter teste automatizado e ser demonstrável na interface.

- **RF01** Identificar o cliente de forma única a partir de qualquer canal.
- **RF02** Recuperar contexto semântico antes de gerar a resposta.
- **RF03** Continuar em outro canal uma jornada iniciada, sem repetição.
- **RF04** Classificar a intenção com nível de confiança registrado.
- **RF09** Gravar cada turno como memória semântica pseudonimizada.
- **RF21** Recuperar o portfólio contratado do titular em todas as linhas de produto.
- **RF22** Desambiguar o produto quando houver mais de um elegível.
- **RF23** Verificar a capacidade do produto antes de agir.
- **RF24** Rotear para o adaptador da linha de produto correta.
- **RF25** Registrar o produto em foco na sessão e reaproveitar na memória.
- **RF06** Detectar sinais de atrito e calcular score por turno.
- **RF07** Acionar intervenção proativa acima do limiar.
- **RF08** Transferir para humano preservando histórico e contexto.
- **RF05** Adaptar tom e nível de detalhe ao perfil do cliente.
- **RF18** Dashboard de jornada com volume, FCR, CES e transbordo.
- **RF19** Mapa de atrito por jornada e etapa, com alerta de limiar.
- **RF20** Configurar personas, limiares e regras pelo painel, sem nova liberação de código.
- **RF10 a RF15** Cenários de negócio: fatura e segunda via, plano, chamado técnico, diagnóstico remoto, visita técnica, contestação.

### Não funcionais, com métrica e prova

Cada um precisa ter uma forma de ser medido e mostrado, nem que seja em um painel de diagnóstico interno.

| ID | Requisito | Meta |
|---|---|---|
| RNF01 | Tempo até o primeiro token | p95 de 2,0 s, p99 de 3,5 s |
| RNF03 | Taxa de erro | menos de 0,5% de 5xx, menos de 2% de resposta degradada |
| RNF04 | Carga | teste de carga demonstrando o comportamento sob concorrência |
| RNF06 | Latência da memória | recuperação p95 de 250 ms, gravação em até 1 s |
| RNF07 | Segurança | TLS, segredos fora do código, sem dado pessoal em log |
| RNF09 | Observabilidade | 100% das interações com `trace_id` ponta a ponta |
| RNF12 | Portabilidade de modelo | troca de provedor de LLM por configuração |
| RNF13 | Manutenibilidade | cobertura mínima de 80% no núcleo, contrato OpenAPI versionado |

### Privacidade

Consentimento por finalidade com registro versionado, revogação que desliga o ClaroMemory para aquele cliente, remoção de dados pessoais antes de qualquer chamada ao LLM, e exclusão que apaga o namespace do cliente. Implemente ao menos o fluxo de consentimento, revogação e exclusão, porque é o que a banca vai perguntar.

## 9. Os quatro roteiros que precisam funcionar sem falha

O vídeo tem de 3 a 5 minutos. Estes quatro caminhos precisam ser reprodutíveis, com dados de seed, e sem qualquer passo manual escondido.

**Roteiro A, continuidade entre canais.** Cliente relata queda de internet no site, o diagnóstico remoto começa e ele fecha a janela. Abre o WhatsApp e escreve "minha internet continua ruim". O sistema o reconhece, retoma de onde parou e mostra na interface quais trechos de memória foram usados e com que score.

**Roteiro B, desambiguação multiproduto.** Um titular com fibra, duas linhas móveis e Claro tv+ escreve "quero a segunda via". O resolvedor identifica três produtos elegíveis, faz uma única pergunta de desambiguação, o cliente responde, e a partir daí o produto fica fixado na sessão e não é perguntado de novo. Repita com "minha internet caiu", mostrando a inferência pelo canal e pelo histórico sem precisar perguntar.

**Roteiro C, ClaroSense e transbordo.** Cliente repete a mesma intenção, o sentimento cai, o score cruza 0,70 e o sistema oferece atendimento humano proativamente. No painel, a sessão aparece na fila de críticas em tempo real e um atendente assume a conversa com todo o histórico visível, sem que o cliente repita nada.

**Roteiro D, painel administrativo.** Dashboard de Jornada com os indicadores vivos do próprio protótipo, Mapa de Atrito por jornada e etapa com a célula acima do limiar em destaque e o alerta com ação sugerida, e o Monitor de Conversas com assunção por humano.

Deixe um comando único que popula a base com os dados desses quatro roteiros: `make seed` ou equivalente, documentado no README.

## 10. Front-end

Não é um requisito acessório. A banca vai avaliar a interface do usuário explicitamente.

- **Interface do cliente**: três canais simulados com identidade visual distinta, resposta em streaming token a token, e um painel lateral opcional de transparência que mostra intenção detectada, produto em foco, trechos de memória usados e score de atrito do turno. Esse painel é o que transforma a arquitetura em algo visível.
- **Painel administrativo**: Dashboard de Jornada, Mapa de Atrito e Monitor de Conversas, atualizados em tempo real, mais as telas de configuração de personas, limiares e catálogo de produtos.
- Responsivo a partir de 1366 por 768, contraste adequado, navegação por teclado nos fluxos principais.
- Use a identidade da Claro com sobriedade: vermelho como acento, não como fundo.

## 11. Qualidade de engenharia

- `docker compose up` sobe tudo: aplicação, banco, cache e simuladores. Sem passo manual.
- `.env.example` completo. Nenhum segredo versionado. O sistema precisa subir em modo demonstração mesmo sem chave de LLM, usando um provedor simulado determinístico, para que a apresentação nunca dependa de rede.
- Testes: unitários no núcleo, de integração nos adaptadores e ponta a ponta nos quatro roteiros da seção 9. Os roteiros do vídeo são testes, não só demonstração.
- Contrato OpenAPI gerado e publicado em `/docs`.
- Logs estruturados com `trace_id`, sem dado pessoal.
- README com: o que é o projeto, como subir, como popular, como rodar os testes, arquitetura em uma imagem, e uma seção honesta de **o que está implementado, o que é parcial e o que é conceitual**. Essa seção vale nota: a banca pediu isso explicitamente.
- `docs/decisoes.md` com as decisões técnicas e o porquê de cada uma.

## 12. Critérios pelos quais o resultado será julgado

Tenha isso em mente em cada escolha:

1. **MVP totalmente funcional**, back e front, conforme o escopo do desafio, cobrindo requisitos funcionais e não funcionais.
2. **Tecnologias coerentes e adequadas** à solução proposta, sem excesso de peças e sem improviso.
3. **Maturidade computacional** compatível com formandos em Sistemas de Informação: arquitetura clara, testes, tratamento de erro, observabilidade.
4. **Alinhamento com o tema da challenge da Claro**: a solução resolve a fragmentação de canais e de produtos, não é um chatbot genérico.
5. **Criatividade e inovação**: memória semântica com filtro por produto, detecção de atrito em tempo real e desambiguação de produto são os diferenciais. Deixe-os visíveis na interface.
6. **Dedicação ao projeto**: histórico de commits coerente, documentação viva, nada de código morto.

## 13. O que evitar

- Rotas ou telas que existem mas não funcionam. É melhor ter menos e tudo funcionando.
- Dados de demonstração escondidos no código do front. Tudo vem da API.
- Camada de produto resolvida com `if` por nome de produto. Se você precisar editar o núcleo para adicionar um produto, o desenho está errado.
- Memória semântica sem filtro por cliente. Isso é um vazamento de dado pessoal, não um bug de relevância.
- Chamar o LLM no caminho de gravação da memória de forma síncrona.
- Marcar como pronto algo que só funciona no caminho feliz.

---

**Comece pela Fase 0.** Leia o repositório, monte o inventário, a tabela de lacunas e o plano de ondas, e me apresente antes de escrever código.
