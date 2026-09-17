# Roteiro de demonstração — Chat do Cliente + Console do Atendente

Roteiro cronometrado de **2min30** cobrindo as duas telas de atendimento. Foi montado para ser
gravado de uma vez só, sem cortes e sem improviso: cada fala do cliente está disponível como botão
no painel lateral do Chat, então não há risco de erro de digitação no meio da gravação.

> **Resumo do argumento:** a primeira conversa mostra o caso que se resolve sozinho (contenção), a
> segunda mostra o caso que o sistema decide entregar a um humano — e o Console mostra que essa
> entrega acontece com contexto, não do zero.

---

## Antes de gravar (2 minutos de preparo)

```bash
# Terminal 1
cd clarointelligence-api
npm run seed        # zera conversas de teste e recria o painel de demonstração
npm run server

# Terminal 2
cd clarointelligence
npm run dev
```

1. Abra **duas abas** do navegador em `http://localhost:5173`:
   - Aba 1 → **Chat do Cliente**
   - Aba 2 → **Console do Atendente**
2. Na aba 1, deixe o painel **IA Transparência** aberto (à direita) — é ele que prova o raciocínio.
3. Feche as notificações do sistema e deixe o zoom em 100%.
4. Rode o `npm run seed` **imediatamente antes** de gravar: o painel fica idêntico toda vez.

---

## Linha do tempo

| Tempo | Tela | Ação | Narração |
|---|---|---|---|
| **0:00 – 0:12** | Chat do Cliente | Mostre a barra lateral: canais e os 9 roteiros. Selecione **Tiago Ramos** (Roteiro H). | "Este é o ClaroIntelligence atendendo no chat da Claro. O Tiago é cliente do Pós 50GB e quer pagar a conta." |
| **0:12 – 0:22** | Chat | Clique na fala **1 — "e aí, quero pagar a conta do meu celular"**. | "Repare no tom: ele escreve de forma informal, e o sistema responde no mesmo registro. Isso é o Persona Engine." |
| **0:22 – 0:40** | Chat | Aguarde a resposta. Aponte no painel direito: **Persona: Informal**, **Produto resolvido: Claro Pós 50GB**, **Protocolo**. | "Sem eu dizer de qual produto se trata, o sistema resolveu o contrato, abriu protocolo e já trouxe valor e vencimento." |
| **0:40 – 0:58** | Chat | Clique na fala **2 — "isso, pode gerar o pix"**. Aponte o selo verde **"Resolvido no autoatendimento — sem atendente humano"**. | "Duas mensagens: PIX gerado, pagamento registrado e protocolo encerrado. Nenhum atendente foi acionado — é daqui que sai a taxa de contenção." |
| **0:58 – 1:05** | Chat | Selecione **Nexo Log Transportes** (Roteiro I). | "Agora o oposto: um cliente empresarial com um problema que a IA não resolve." |
| **1:05 – 1:35** | Chat | Clique as falas **1**, **2** e **3** em sequência, esperando cada resposta. Aponte o **score subindo 0 → 0 → 50** e os sinais listados. | "Ele reporta o mesmo erro três vezes. O ClaroSense soma *repetição de intenção*, mais 22, e *linguagem de frustração*, mais 28. O score é auditável: cada ponto tem um motivo." |
| **1:35 – 1:50** | Chat | Clique a fala **4** (a em caixa alta). Aponte **score 100**, **risco de churn 93%** e o cartão da **fila com posição e tempo**. | "Caixa alta e ameaça de acionar a Anatel: mais 35. O score cruza 80 e o sistema transfere sozinho — ninguém precisou pedir um atendente." |
| **1:50 – 2:00** | **Console do Atendente** | Troque de aba. Aponte o caso da **Nexo Log no topo da fila**, com etiqueta ALTA e churn 93%. | "Do outro lado, o Console. A fila é ordenada por gravidade e, dentro dela, por risco de cancelamento — quem está mais perto de sair é atendido primeiro." |
| **2:00 – 2:12** | Console | Clique no caso. Mostre o painel direito: protocolo, linha do tempo, sinais de atrito e portfólio. | "Antes da primeira palavra, o atendente já tem o protocolo, o histórico completo e o motivo da transferência. O cliente não vai repetir nada." |
| **2:12 – 2:25** | Console → Chat | Clique **Assumir atendimento**, escreva *"Boa tarde, sou o Raphael da retenção. Já estou com o chamado do erro CLR-4032 aberto aqui."* e envie. Volte à aba do Chat. | "Assumo a conversa e respondo. E na tela do cliente a mensagem chega ao vivo, identificada como atendente humano." |
| **2:25 – 2:30** | Chat | Aponte a mensagem azul do atendente no chat do cliente. | "Da IA à pessoa, sem ruptura e com o mesmo protocolo. É isso que o ClaroIntelligence entrega." |

---

## Texto corrido da narração

Para quem prefere decorar em vez de ler a tabela — **376 palavras, ~2min25 em ritmo de pitch**:

> Este é o ClaroIntelligence atendendo no chat da Claro. O Tiago é cliente do Pós 50GB e quer pagar
> a conta. Repare no tom: ele escreve de forma informal, e o sistema responde no mesmo registro —
> isso é o Persona Engine.
>
> Sem eu dizer de qual produto se trata, o sistema resolveu o contrato, abriu protocolo e já trouxe
> valor e vencimento. Duas mensagens: PIX gerado, pagamento registrado e protocolo encerrado.
> Nenhum atendente foi acionado. É daqui que sai a taxa de contenção.
>
> Agora o oposto: um cliente empresarial com um problema que a IA não resolve. Ele reporta o mesmo
> erro três vezes. O ClaroSense soma *repetição de intenção*, mais 22, e *linguagem de frustração*,
> mais 28. O score é auditável: cada ponto tem um motivo visível na tela.
>
> Caixa alta e ameaça de acionar a Anatel: mais 35. O score cruza 80 e o sistema transfere sozinho
> — ninguém precisou pedir um atendente.
>
> Do outro lado, o Console. A fila é ordenada por gravidade e, dentro dela, por risco de
> cancelamento: quem está mais perto de sair é atendido primeiro. Antes da primeira palavra, o
> atendente já tem o protocolo, o histórico completo e o motivo da transferência. O cliente não vai
> repetir nada.
>
> Assumo a conversa e respondo. Na tela do cliente, a mensagem chega ao vivo, identificada como
> atendente humano. Da IA à pessoa, sem ruptura e com o mesmo protocolo. É isso que o
> ClaroIntelligence entrega.

---

## Se o tempo apertar

| Corte | Economia | Impacto |
|---|---|---|
| Pular a fala 2 do Nexo Log (vá da 1 direto para a 3) | ~10s | Nenhum: o score chega ao mesmo lugar |
| Não voltar para a aba do Chat no final | ~8s | Perde a prova de que a resposta chega ao cliente — **evite cortar este** |
| Cortar a narração do painel de transparência em 0:22 | ~12s | Perde o argumento de explicabilidade |

## Se sobrar tempo (versão de 3min)

Acrescente o **Roteiro J — identificação no WhatsApp** entre os dois blocos (+25s):

1. Troque o canal para **WhatsApp** e escolha **Helena Duarte**
2. Digite `minha internet fica caindo`
3. Mostre o cartão de **SMS simulado** e diga: *"No WhatsApp o canal é o próprio número, e posse do
   número não é prova de identidade. Antes de qualquer dado do contrato, o sistema identifica pelo
   cadastro e confirma por SMS. Nos canais com login, isso não se repete."*
4. Clique em **Usar este código** e siga

Ou o **Roteiro E — call center → chat** (+20s): selecione **Roberto Alves**, canal Site, e mande
`e aí, tenho que pagar essa conta?`. O sistema abre com *"Localizei seu protocolo, aberto há 3h no
Call Center"* — e mostra que a jornada atravessa canais.

---

## Erros comuns na hora de gravar

| Sintoma | Causa | Solução |
|---|---|---|
| A fila já aparece com casos antes de eu provocar o transbordo | É intencional — o seed povoa 7 casos para a tela não ficar vazia | Se quiser a fila vazia, use o filtro de **tipo de serviço** para isolar o caso da demo |
| O aviso "Localizei seu protocolo" aparece numa conversa onde não deveria | Sobrou sessão de um ensaio anterior | Rode `npm run seed` de novo |
| O Console não mostra o caso novo | O polling é de 3 segundos | Aguarde um instante; não recarregue a página |
| A resposta demora a aparecer | É o efeito de digitação, não latência | Nada a fazer — ele existe para a leitura acompanhar |
