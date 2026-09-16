# Catálogo de produtos

O catálogo do MVP reproduz o **portfólio comercial real da Claro Brasil** — linhas, famílias,
velocidades, franquias, tipos de chip e streamings inclusos. A intenção é que a demonstração não
pareça um sistema genérico de telecom: quando o Product Context Resolver desambigua entre "Claro
Fibra 1 Giga" e "Claro Controle 40GB", ele está lidando com produtos que existem de fato.

> **Sobre os valores:** são as faixas públicas de referência levantadas em setembro de 2026. Preço
> de telecom varia por CEP, promoção, fidelidade e forma de pagamento — aqui servem como **ordem de
> grandeza para a simulação**, não como tabela oficial. As fontes estão no fim do documento.

O catálogo é carregado por [`seed.js`](../clarointelligence-api/src/seed.js) na tabela
`produtos_catalogo` e é **fonte única de verdade**: produto novo entra por dado, nunca por alteração
de código no núcleo.

## Móvel — pessoa física

| Código | Produto | Família | Franquia | Chip | Referência |
|---|---|---|---|---|---|
| `MOV-PRE-05` | Claro Prezão 5GB | pré-pago | 5 GB / 15 dias | físico | R$ 15,00 |
| `MOV-PRE-21` | Claro Prezão 21GB YouTube | pré-pago | 21 GB / 30 dias | físico | R$ 35,00 |
| `MOV-CTR-40` | Claro Controle 40GB | controle | 40 GB | físico | R$ 59,90 |
| `MOV-CTR-35G` | Claro Controle 35GB GeForce NOW | controle | 35 GB | eSIM | R$ 64,90 |
| `MOV-FLEX-35` | Claro Flex 35GB | flex | 35 GB | eSIM | R$ 74,90 |
| `MOV-POS-50` | Claro Pós 50GB | pós-pago | 50 GB | eSIM | R$ 89,90 |
| `MOV-MAX-FLEX` | Claro Max Flex | max | ilimitado | eSIM | R$ 119,90 |

**Chave de identificação:** MSISDN (o número da linha), sob uma conta de faturamento. Um mesmo CPF
pode ter várias linhas — titular e dependentes. É por isso que, quando Carlos Mota pede a segunda
via "do celular", o sistema ainda precisa saber **qual** celular.

## Residencial — banda larga fixa

| Código | Produto | Tecnologia | Velocidade | Referência |
|---|---|---|---|---|
| `RES-FIB-350` | Claro Fibra 350 Mega | FTTH | 350 / 175 Mbps | R$ 79,90 |
| `RES-FIB-500` | Claro Fibra 500 Mega | FTTH | 500 / 250 Mbps | R$ 139,99 |
| `RES-FIB-600` | Claro Fibra 600 Mega | FTTH | 600 / 300 Mbps | R$ 169,90 |
| `RES-FIB-1G` | Claro Fibra 1 Giga | FTTH | 1000 / 500 Mbps | R$ 299,90 |
| `RES-FWA-5G` | Claro Casa 5G (FWA) | FWA 5G | 300 Mbps | R$ 99,90 |

A Claro comercializa também 5 Giga e 10 Giga; ficaram fora do seed por não acrescentarem nada à
demonstração. **Globoplay** vem incluso nos planos de fibra (2 acessos simultâneos), e há
opcionais de Netflix, Max, Disney+, Premiere e F1 TV PRO. O plano de 1 Giga inclui o **Ultra Point**
sem custo adicional.

**Chave de identificação:** o **ponto de instalação** — ou seja, o endereço. O mesmo CPF com duas
casas tem dois contratos distintos. É a diferença mais importante em relação à linha móvel, e o
motivo de os adaptadores serem separados por linha.

## TV e streaming — Claro tv+

| Código | Produto | Formato | Inclusos | Referência |
|---|---|---|---|---|
| `TV-PLUS-APP` | Claro tv+ APP | app, sem equipamento | 100+ canais ao vivo | R$ 65,40 |
| `TV-BOX-PLUS` | Claro Box tv+ | Box 4K (HDMI) | Netflix, Globoplay Premium, Max, Apple TV+, 120 canais | R$ 119,90 |
| `TV-BOX-SOUND` | Claro Box tv+ com Soundbox 4K | Box + Soundbox | Netflix, Globoplay Premium, Max, Apple TV+ | R$ 159,90 |

O Box transforma qualquer TV com entrada HDMI em smart TV e dispensa visita técnica — basta
conexão à internet.

**Chave de identificação:** assinatura vinculada ao CPF ou ao ponto de instalação.

## Claro Empresas — pessoa jurídica

| Código | Produto | Família | Característica | Referência |
|---|---|---|---|---|
| `EMP-MOV-COMP` | Claro Empresas Móvel — Franquia Compartilhada | móvel corporativo | Chips empresariais com franquia **compartilhada entre as linhas**, Gestor Online, ligações 021 ilimitadas, apps que não descontam da franquia | R$ 49,90 por linha |
| `EMP-FIB-500` | Claro Empresas Internet Fibra 500 Mega | fibra corporativa | Suporte 24x7, IP fixo opcional | R$ 249,90 |
| `EMP-LINK-DED` | Claro Empresas Link Dedicado | link dedicado | **Banda 100% garantida**, SLA contratual, IP fixo, consultor dedicado, atendimento 24x7 | R$ 1.890,00 |

**Chave de identificação:** CNPJ, com múltiplos contratos por *site* e centro de custo. Errar o
contrato aqui é mais grave que no varejo: mexe na operação inteira de um cliente corporativo.

Duas diferenças de modelagem que o MVP representa explicitamente:

- **Franquia compartilhada.** Não existe "a franquia do meu chip": existe o *pool* da conta. O
  adaptador [`empresas.js`](../clarointelligence-api/src/adapters/empresas.js) devolve
  `franquia_compartilhada_gb`, `consumo_gb` e `linhas_ativas`, não uma franquia individual.
- **Chip pessoal × chip empresarial.** O campo `tipo_chip` distingue os dois, e o
  `chip_segmento` em `dados_extra` marca se a linha é pessoal ou corporativa — o que muda as
  capacidades disponíveis (Gestor Online, faturamento por centro de custo).

## Matriz de capacidades

Nem todo produto suporta toda intenção — um link dedicado não tem franquia de dados; um plano móvel
não recebe visita técnica. A matriz vive em
[`productResolver.js`](../clarointelligence-api/src/services/productResolver.js) e é o que permite
resolver o produto sem perguntar ao cliente quando o portfólio já responde sozinho:

| Intenção | Produtos elegíveis |
|---|---|
| `recarga` | famílias pré-pago e controle |
| `franquia` | produtos com franquia de dados (`franquia_gb > 0`) |
| `portabilidade`, `roaming` | linha móvel e móvel corporativo |
| `streaming` | linha TV |
| `visita_tecnica` | produtos com acesso fixo (`velocidade_mbps > 0`) |
| `diagnostico` | acesso fixo ou TV |
| `upgrade_plano` | produtos com velocidade ou franquia |

Exemplo prático: a Vega Soluções tem **dois** contratos na linha `empresas` (móvel corporativo e
link dedicado). Quando pergunta "quanto da franquia compartilhada já foi usado?", a matriz descarta
o link dedicado — que não tem franquia — e resolve direto para o plano móvel, **sem perguntar nada
ao cliente**.

## Clientes de demonstração

| Cliente | Tipo | Portfólio | Roteiro |
|---|---|---|---|
| Ana Souza | PF | Claro Fibra 500 Mega | **A** — continuidade entre canais |
| Carlos Mota | PF | Fibra 1 Giga + Pós 50GB + Controle 40GB (dependente) + Box tv+ | **B** — desambiguação multiproduto |
| Fernanda Lima | PF | Claro Fibra 350 Mega | **C** — ClaroSense → fila humana |
| João Santos | PF | Fibra 500 Mega + Claro Max Flex | **D** — autoatendimento completo |
| Roberto Alves | PF | Claro Controle 40GB | **E** — call center → chat via protocolo |
| Vega Soluções | **PJ** | Móvel corporativo (18 linhas, 200GB compartilhados) + Link Dedicado 300 Mbps | **F** — cliente empresarial |
| Mariana Costa | PF | Claro Fibra 1 Giga | extra (volume no monitor) |

## Fontes

Levantamento feito em setembro de 2026:

- [Planos Claro — Controle, Pré e Pós](https://www.minhaconexao.com.br/planos/claro/planos-claro)
- [Top 5 melhores planos da Claro (setembro/2026)](https://melhorplano.net/claro/planos-claro/melhores-planos-claro)
- [Claro — Internet Fibra Residencial](https://www.claro.com.br/internet/banda-larga)
- [Claro — Internet Fibra Ótica](https://www.claro.com.br/internet/banda-larga/fibra-otica)
- [Claro tv+ — planos de TV e streaming](https://www.claro.com.br/claro-tv-mais)
- [Claro tv+ Box](https://www.claro.com.br/claro-tv-mais/box)
- [Claro Empresas — celular empresarial](https://www.claro.com.br/empresas/celular)
- [Claro Empresas — internet e link dedicado](https://www.claro.com.br/empresas/internet)
