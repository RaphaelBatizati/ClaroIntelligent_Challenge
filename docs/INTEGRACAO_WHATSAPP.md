# Integração real com WhatsApp — análise de viabilidade

Este documento responde a uma pergunta específica feita no projeto: *é possível conectar o
ClaroIntelligence ao WhatsApp real para que a intervenção humana da demonstração aconteça de fato,
com uma pessoa respondendo pelo celular?*

**Resposta curta:** tecnicamente sim, mas não com um número pessoal e não a tempo de uma
apresentação acadêmica. O MVP resolve o mesmo objetivo pedagógico — intervenção humana real, ao
vivo — pelo **Console do Atendente**, sem dependência externa e sem risco de banimento.

## O que existe hoje no MVP

O canal "WhatsApp" na tela de Chat do Cliente é uma **simulação visual fiel** (layout, cores,
comportamento de sessão por número), e o transbordo para humano é **real**: quando o ClaroSense
detecta atrito, o cliente entra numa fila persistida no banco, e uma pessoa assume a conversa pelo
[Console do Atendente](../clarointelligence/src/pages/ConsoleAtendente.jsx) e digita respostas que
aparecem no chat do cliente em tempo real.

Ou seja: **a intervenção humana já é real** — o que é simulado é o transporte (WhatsApp), não o
atendimento. Para a banca, o que importa demonstrar é a orquestração (contexto preservado,
protocolo, score de atrito, handoff sem repetição), e isso acontece de verdade.

## Caminho oficial: WhatsApp Business Platform (Cloud API)

É a única via permitida pela Meta para automação. Requisitos:

| Requisito | Detalhe | Impacto no projeto |
|---|---|---|
| Conta Meta Business verificada | Verificação de empresa com CNPJ e documentação | Inviável para trabalho acadêmico individual |
| **Número dedicado** | O número **não pode** estar em uso no app comum do WhatsApp nem vinculado a outra conta Business. Precisa receber SMS/voz só para a validação inicial | Usar o número pessoal significaria **perder o WhatsApp nesse número** |
| Webhook público HTTPS | URL válida, respondendo `200` em menos de ~2 segundos, com token de verificação | O backend roda em `localhost` — exigiria túnel (ngrok/Cloudflare Tunnel) ou deploy |
| Janela de 24 horas | Resposta livre só dentro de 24h após a última mensagem do cliente | Ok para demo (conversa ativa) |
| Templates aprovados | Mensagem iniciada pela empresa fora da janela exige template aprovado pela Meta (horas a ~2 dias úteis) | Adiciona dependência de prazo externo |

**Custo:** a Meta cobra por conversa/mensagem conforme categoria — irrelevante em volume de demo,
mas exige meio de pagamento cadastrado.

### O que mudaria no código

A arquitetura já está preparada para isso: o canal é um **parâmetro**, não uma rota separada, e todo
o pipeline entra por `POST /api/chat/mensagem`. Uma integração real precisaria apenas de:

1. `POST /api/webhooks/whatsapp` — recebe o payload da Meta, extrai `from` (MSISDN) e `text.body`,
   mapeia o MSISDN para `cliente_id` e chama o mesmo pipeline com `canal: 'whatsapp'`.
2. Um `enviarMensagem()` no serviço de canal que faz `POST` na Graph API com o texto da resposta —
   hoje a resposta volta no corpo HTTP; passaria a ser também empurrada para o WhatsApp.
3. No [`services/fila.js`](../clarointelligence-api/src/services/fila.js), a mensagem do atendente
   seguiria pelo mesmo `enviarMensagem()` em vez de só gravar na tabela `mensagens`.

Nenhum motor (ClaroSense, ClaroMemory, Persona Engine, Product Resolver) precisaria mudar — é
exatamente o que a separação em camadas garante.

## Caminho não oficial: bibliotecas de WhatsApp Web

Bibliotecas como `whatsapp-web.js` e `Baileys` automatizam o WhatsApp Web por engenharia reversa e
funcionam com um número pessoal lendo um QR Code. **Não recomendo, e não implementei**, por três
motivos objetivos:

1. **Viola os Termos de Serviço do WhatsApp.** O risco concreto é o **banimento permanente do
   número** — no caso, o número pessoal de quem apresenta o trabalho.
2. **Fragilidade.** Qualquer atualização do WhatsApp Web quebra a biblioteca, às vezes no meio de
   uma apresentação.
3. **Não representa a arquitetura real.** Uma operadora do porte da Claro nunca usaria isso. Mostrar
   essa solução para a banca enfraqueceria o argumento arquitetural em vez de reforçá-lo.

## Decisão adotada

O MVP entrega a **intervenção humana real pelo Console do Atendente**, e este documento fica no
repositório como a análise de viabilidade do próximo passo. Na apresentação, isso é uma resposta
mais forte do que um número de celular conectado por gambiarra: mostra que a arquitetura já isola o
canal como parâmetro, que o handoff humano funciona de ponta a ponta, e que a integração oficial é
uma questão de credenciais e deploy — não de reescrita.

Se a integração oficial for desejada depois, o caminho mínimo é:

1. Criar app no [Meta for Developers](https://developers.facebook.com) e obter número de teste
   (a Meta fornece um número sandbox gratuito, sem exigir verificação de empresa, limitado a até
   5 destinatários cadastrados — suficiente para uma demonstração).
2. Expor o backend com um túnel HTTPS (`ngrok http 3001`) e cadastrar o webhook.
3. Implementar os dois pontos de integração descritos acima.

O número sandbox da Meta é o caminho recomendado para provar a integração sem arriscar nenhum
número pessoal e sem depender de verificação de empresa.

## Referências

- [WhatsApp Business Platform — Cloud API (Meta for Developers)](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Guia de requisitos da Cloud API (2026)](https://blog.chatsac.com/api-whatsapp-cloud/cloud-api-whatsapp/)
- [WhatsApp Cloud API sem BSP — guia técnico 2026](https://iadobrasil.com/whatsapp-cloud-api-sem-bsp-guia-2026/)
