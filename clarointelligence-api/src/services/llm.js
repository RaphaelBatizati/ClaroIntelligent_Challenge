// Provedor de LLM simulado, determinístico.
// Sem API externa: a resposta é escolhida pela combinação
// (intenção × linha de produto × persona) e preenchida com dados reais vindos
// do adaptador do sistema de origem.
//
// Quatro personas por intenção: digital, intermediario, assistido, informal.
// Trocar por um provedor real (Claude, por exemplo) significa reimplementar
// só este módulo — o núcleo de orquestração não muda.

const protocoloSvc = require('./protocolo')

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

const TEMPLATES = {
  saudacao: {
    digital: (d) => `Olá${d.primeiroNome ? ', ' + d.primeiroNome : ''}. Atendimento Claro.${d.protocolo ? ` Protocolo **${d.protocolo}**.` : ''}${d.portfolio_resumo ? `\n\nPortfólio ativo: ${d.portfolio_resumo}.` : ''}\n\nQual a demanda?`,
    intermediario: (d) => `Olá${d.primeiroNome ? ', ' + d.primeiroNome : ''}! Sou o assistente virtual da Claro 😊${d.protocolo ? `\n\nSeu protocolo de atendimento é **${d.protocolo}** — guarde esse número, ele identifica esse contato em qualquer canal.` : ''}\n\nComo posso te ajudar hoje?`,
    assistido: (d) => `Olá${d.primeiroNome ? ', ' + d.primeiroNome : ''}! Que bom falar com você! 😊 Sou a assistente da Claro e vou te ajudar com calma.${d.protocolo ? `\n\nAnotei seu atendimento com o número **${d.protocolo}**. Se precisar voltar depois, é só me dar esse número que eu lembro de tudo.` : ''}\n\nMe conta o que está acontecendo?`,
    informal: (d) => `E aí${d.primeiroNome ? ', ' + d.primeiroNome : ''}! 👋 Tô aqui pra resolver.${d.protocolo ? `\n\nTeu protocolo é **${d.protocolo}** — anota aí que serve pra qualquer canal.` : ''}\n\nManda o que tá pegando!`,
  },

  segunda_via: {
    digital: (d) => {
      if (!d.dados) return 'Não localizei contratos ativos vinculados ao cadastro.'
      const alvo = d.linha === 'movel' ? `linha ${d.dados.msisdn_fmt}` : d.dados.plano_nome
      return `Fatura — ${alvo}\nValor: **${brl(d.dados.valor_mensal)}** · vencimento ${d.dados.vencimento}\n\nLinha digitável:\n\`${d.dados.codigo_barras}\`\n\nPosso executar o pagamento por PIX aqui mesmo. Confirma?`
    },
    intermediario: (d) => {
      if (!d.dados) return 'Não encontrei sua fatura. Pode confirmar de qual produto você precisa?'
      const alvo = d.linha === 'movel' ? `celular ${d.dados.msisdn_fmt}` : d.dados.plano_nome
      return `Encontrei sua fatura! ✅\n\n📋 **${alvo}**\nValor: **${brl(d.dados.valor_mensal)}**\nVencimento: **${d.dados.vencimento}**\n\nCódigo para pagamento:\n\`${d.dados.codigo_barras}\`\n\nQuer que eu **gere um PIX para pagar agora** aqui pelo chat? É só confirmar. 😊`
    },
    assistido: (d) => {
      if (!d.dados) return 'Não encontrei sua conta. Pode me dizer qual serviço você quer pagar?'
      return `Olá! Achei sua conta 😊\n\nVeja o valor:\n💰 **${brl(d.dados.valor_mensal)}**\n📅 Vence dia **${d.dados.vencimento}**\n\nSe preferir, **eu gero um PIX aqui mesmo** e você paga pelo celular, sem precisar sair de casa. Quer que eu faça isso?`
    },
    informal: (d) => {
      if (!d.dados) return 'Não achei tua fatura aqui. De qual produto é?';
      return `Achei! 👇\n\n**${d.linha === 'movel' ? d.dados.msisdn_fmt : d.dados.plano_nome}**\nValor: **${brl(d.dados.valor_mensal)}** · vence **${d.dados.vencimento}**\n\nQuer que eu já gere o PIX pra tu pagar por aqui? Só falar 👊`
    },
  },

  // ─── Fluxo transacional: proposta de pagamento ────────────────────────────
  pagamento_proposta: {
    digital: (d) => `Fatura em aberto — ${d.acao?.detalhe?.plano || d.acao?.detalhe?.produto}\nValor: **${brl(d.acao?.valor)}** · vencimento ${d.acao?.detalhe?.vencimento}\n\nGero o PIX copia-e-cola para quitação imediata. Confirma?`,
    intermediario: (d) => `Certo! Sua fatura em aberto:\n\n💰 Valor: **${brl(d.acao?.valor)}**\n📅 Vencimento: **${d.acao?.detalhe?.vencimento}**\n📋 ${d.acao?.detalhe?.plano || d.acao?.detalhe?.produto}\n\nPosso gerar um **PIX copia-e-cola** agora para você pagar direto pelo app do banco. Confirma que quer pagar? 😊`,
    assistido: (d) => `Vou te ajudar a pagar! 😊\n\nSua conta é de **${brl(d.acao?.valor)}** e vence dia **${d.acao?.detalhe?.vencimento}**.\n\nEu posso criar um código PIX aqui pra você. Aí é só copiar e colar no aplicativo do seu banco — bem rapidinho.\n\nQuer que eu faça isso pra você?`,
    informal: (d) => `Boa! Tua conta tá assim:\n\n💰 **${brl(d.acao?.valor)}** · vence **${d.acao?.detalhe?.vencimento}**\n\nGero o PIX copia e cola aqui pra tu pagar na hora? Só dar o ok 👊`,
  },

  pagamento_confirmado: {
    digital: (d) => `✅ Pagamento registrado.\n\nValor: **${brl(d.acao?.valor)}**\nAutenticação: \`${d.acao?.comprovante?.autenticacao}\`\n\nPIX copia-e-cola:\n\`${d.acao?.comprovante?.pix_copia_cola}\`\n\nProtocolo **${d.protocolo}** encerrado — resolvido no autoatendimento, sem transferência.`,
    intermediario: (d) => `✅ **Pronto! Pagamento registrado.**\n\n💰 Valor: **${brl(d.acao?.valor)}**\n🧾 Autenticação: \`${d.acao?.comprovante?.autenticacao}\`\n\n**PIX copia-e-cola:**\n\`${d.acao?.comprovante?.pix_copia_cola}\`\n\nÉ só colar no app do seu banco para concluir. A baixa aparece em até 1 hora.\n\n📋 Protocolo **${d.protocolo}** encerrado — **resolvido aqui mesmo, sem precisar de atendente**. Posso ajudar em mais alguma coisa?`,
    assistido: (d) => `✅ **Prontinho! Já preparei tudo pra você** 😊\n\nValor: **${brl(d.acao?.valor)}**\n\nAgora é só copiar esse código e colar no aplicativo do seu banco:\n\`${d.acao?.comprovante?.pix_copia_cola}\`\n\nSe tiver dificuldade, me avisa que eu explico passo a passo!\n\n📋 Seu atendimento **${d.protocolo}** foi concluído. Resolvemos juntos, sem precisar transferir você pra ninguém 💚`,
    informal: (d) => `✅ Tá feito!\n\n💰 **${brl(d.acao?.valor)}** · autenticação \`${d.acao?.comprovante?.autenticacao}\`\n\nCola isso no teu banco:\n\`${d.acao?.comprovante?.pix_copia_cola}\`\n\nProtocolo **${d.protocolo}** fechado, tudo resolvido por aqui mesmo 🤙`,
  },

  // ─── Fluxo transacional: upgrade de plano ─────────────────────────────────
  upgrade_proposta: {
    digital: (d) => `Plano atual: **${d.acao?.detalhe?.velocidade_atual} Mbps** (${brl(d.acao?.detalhe?.valor_atual)}).\nUpgrade disponível: **${d.acao?.detalhe?.velocidade_nova} Mbps** por ${brl(d.acao?.detalhe?.valor_novo)} (+${brl(d.acao?.detalhe?.acrescimo)}).\n\nMigração remota, sem custo de instalação, ativação em até 24h. Confirma?`,
    intermediario: (d) => `Ótima escolha! 🚀\n\nSeu plano hoje: **${d.acao?.detalhe?.velocidade_atual} Mega** por ${brl(d.acao?.detalhe?.valor_atual)}\nPlano novo: **${d.acao?.detalhe?.velocidade_nova} Mega** por ${brl(d.acao?.detalhe?.valor_novo)}\n\nDiferença de apenas **${brl(d.acao?.detalhe?.acrescimo)} por mês**. A troca é feita remotamente, **sem visita técnica**, e começa a valer em até 24h.\n\nPosso ativar agora? 😊`,
    assistido: (d) => `Que bom que quer melhorar sua internet! 😊\n\nHoje você tem **${d.acao?.detalhe?.velocidade_atual} Mega**.\nPosso colocar você em **${d.acao?.detalhe?.velocidade_nova} Mega** — bem mais rápido!\n\nA diferença é de **${brl(d.acao?.detalhe?.acrescimo)} por mês**, e ninguém precisa ir na sua casa: a mudança é feita à distância.\n\nQuer que eu ative pra você?`,
    informal: (d) => `Fechou! 🚀\n\nHoje: **${d.acao?.detalhe?.velocidade_atual} Mega** (${brl(d.acao?.detalhe?.valor_atual)})\nNovo: **${d.acao?.detalhe?.velocidade_nova} Mega** (${brl(d.acao?.detalhe?.valor_novo)})\n\nSó **${brl(d.acao?.detalhe?.acrescimo)}** a mais por mês, sem visita técnica, ativa em 24h. Bora?`,
  },

  upgrade_confirmado: {
    digital: (d) => `✅ Upgrade ativado: **${d.acao?.detalhe?.velocidade_nova} Mbps**.\n\nProtocolo de ativação: \`${d.acao?.comprovante?.protocolo_ativacao}\`\nPrazo: ${d.acao?.comprovante?.prazo_ativacao}\nCobrança: ${d.acao?.comprovante?.vigencia}\n\nProtocolo **${d.protocolo}** encerrado — resolvido no autoatendimento.`,
    intermediario: (d) => `✅ **Upgrade ativado com sucesso!** 🚀\n\nSeu plano agora é **${d.acao?.detalhe?.velocidade_nova} Mega** por ${brl(d.acao?.detalhe?.valor_novo)}/mês.\n\n🧾 Protocolo de ativação: \`${d.acao?.comprovante?.protocolo_ativacao}\`\n⏱️ Ativação: ${d.acao?.comprovante?.prazo_ativacao}\n💳 Novo valor: a partir da ${d.acao?.comprovante?.vigencia}\n\n📋 Protocolo **${d.protocolo}** encerrado — **tudo resolvido aqui no chat, sem atendente e sem visita técnica**. Mais alguma coisa? 😊`,
    assistido: (d) => `✅ **Pronto! Já está ativado** 😊\n\nSua internet agora é **${d.acao?.detalhe?.velocidade_nova} Mega** — bem mais rápida!\n\nVai começar a funcionar em até 24 horas, sozinho, sem precisar mexer em nada.\n\nO novo valor (${brl(d.acao?.detalhe?.valor_novo)}) aparece só na próxima conta.\n\n📋 Seu atendimento **${d.protocolo}** está concluído. Resolvemos tudo por aqui 💚`,
    informal: (d) => `✅ Ativado! Agora tu tá com **${d.acao?.detalhe?.velocidade_nova} Mega** 🚀\n\nAtivação: \`${d.acao?.comprovante?.protocolo_ativacao}\` · roda em até 24h\nNovo valor só na próxima fatura.\n\nProtocolo **${d.protocolo}** fechado. Resolvido sem fila nem técnico 🤙`,
  },

  franquia: {
    digital: (d) => {
      if (!d.dados) return 'Linha não localizada no portfólio ativo.'
      return `Linha ${d.dados.msisdn_fmt} — ${d.dados.plano_nome}\nFranquia: **${d.dados.gb_usado}GB / ${d.dados.gb_total}GB** (restam ${d.dados.gb_restante}GB)\nCiclo: fecha em ${d.dados.vencimento}\n\nApós o limite: redução de velocidade, sem cobrança extra.`
    },
    intermediario: (d) => {
      if (!d.dados) return 'Não localizei sua linha móvel. Pode confirmar qual número?'
      return `Consultei sua linha **${d.dados.msisdn_fmt}** 📱\n\n📊 Consumo: **${d.dados.gb_usado}GB de ${d.dados.gb_total}GB**\n✅ Restam: **${d.dados.gb_restante}GB**\n📅 Renova em: ${d.dados.vencimento}\n\nSe acabar antes, a internet não é cortada — só fica mais lenta, sem cobrança extra. Quer conhecer um plano com mais dados?`
    },
    assistido: (d) => {
      if (!d.dados) return 'Não achei sua linha. Pode me dizer o número do celular?'
      return `Vou ver quanto de internet você já usou 😊\n\n📱 Seu celular: **${d.dados.msisdn_fmt}**\n\nVocê já usou **${d.dados.gb_usado} de ${d.dados.gb_total} gigas**.\nAinda sobram **${d.dados.gb_restante} gigas** até dia ${d.dados.vencimento}.\n\nFica tranquilo: se acabar, a internet não é cortada, só fica mais devagarinho 😊`
    },
    informal: (d) => {
      if (!d.dados) return 'Não achei tua linha aqui. Qual o número?'
      return `Olha aí 👇\n\n📱 **${d.dados.msisdn_fmt}**\nUsou **${d.dados.gb_usado}GB** de **${d.dados.gb_total}GB** — sobrou **${d.dados.gb_restante}GB**\nRenova dia ${d.dados.vencimento}\n\nSe acabar não corta não, só fica lerdo 😅`
    },
  },

  consulta_protocolo: {
    digital: (d) => d.protocoloConsultado
      ? `Protocolo **${d.protocoloConsultado.numero_formatado}**\nAssunto: ${d.protocoloConsultado.assunto}\nAberto em: ${d.protocoloConsultado.canal_origem} · ${d.protocoloConsultado.created_at}\nStatus: **${d.protocoloConsultado.status}**\n\n${d.protocoloConsultado.eventos?.length ? 'Histórico:\n' + d.protocoloConsultado.eventos.map(e => `• ${e.descricao}`).join('\n') : ''}`
      : `Protocolo não localizado. Confirme o número (14 dígitos) ou informe CPF do titular.`,
    intermediario: (d) => d.protocoloConsultado
      ? `Encontrei seu protocolo! 📋\n\n**${d.protocoloConsultado.numero_formatado}**\nAssunto: **${d.protocoloConsultado.assunto}**\nAberto pelo canal: **${d.protocoloConsultado.canal_origem}**\nSituação: **${d.protocoloConsultado.status}**\n\n${d.protocoloConsultado.eventos?.length ? 'O que já aconteceu:\n' + d.protocoloConsultado.eventos.map(e => `• ${e.descricao}`).join('\n') : ''}\n\nQuer que eu continue esse atendimento de onde parou? 😊`
      : `Não encontrei esse protocolo. Pode conferir o número? Ele tem 14 dígitos e aparece no começo de cada atendimento.`,
    assistido: (d) => d.protocoloConsultado
      ? `Achei seu atendimento! 😊\n\nNúmero: **${d.protocoloConsultado.numero_formatado}**\nAssunto: **${d.protocoloConsultado.assunto}**\nSituação: **${d.protocoloConsultado.status}**\n\nPode ficar tranquilo, eu já sei tudo o que foi conversado antes. Não precisa explicar de novo! Vamos continuar?`
      : `Não consegui achar esse número. Sem problema! Me conta o que você precisa que eu te ajudo do mesmo jeito 😊`,
    informal: (d) => d.protocoloConsultado
      ? `Achei 👇\n\n**${d.protocoloConsultado.numero_formatado}** · ${d.protocoloConsultado.assunto}\nStatus: **${d.protocoloConsultado.status}** (aberto no ${d.protocoloConsultado.canal_origem})\n\nJá tô com todo o histórico aqui. Bora continuar de onde parou?`
      : `Não achei esse protocolo não. Confere o número? São 14 dígitos.`,
  },

  suporte_tecnico: {
    digital: (d) => {
      if (d.linha === 'residencial') return `Diagnóstico remoto — ${d.dados?.modem || 'CPE'}: sinal OLT **${d.dados?.olt_status || 'operacional'}**. Downstream ~${Math.floor((d.dados?.velocidade_down || 500) * 0.7)} Mbps de ${d.dados?.velocidade_down || 500} Mbps contratados.\n\nRecomendo: (1) power-cycle do CPE, (2) verificar integridade da ONU.`
      if (d.linha === 'movel') return `Linha ${d.dados?.msisdn_fmt}: RAN operacional, sinal 4G/5G na BTS da região. Tente: (1) toggle de modo avião, (2) verificar APN, (3) conferir bloqueio de dados no perfil.`
      if (d.linha === 'tv') return `Verificando ${d.dados?.plano_nome}: sessão ativa, ${d.dados?.dispositivos || 2} dispositivos autorizados. Erro de sinal costuma ser handshake HDCP — reinicie o Box e troque a porta HDMI.`
      return 'Diagnóstico iniciado. Verifique o status dos equipamentos.'
    },
    intermediario: (d) => {
      if (d.linha === 'residencial') return `Entendi! Vou checar sua conexão agora... 🔍\n\nIdentifiquei sinal instável no seu modem. Vamos tentar:\n\n1️⃣ Desligue o modem da tomada\n2️⃣ Aguarde 30 segundos\n3️⃣ Religue e espere 2 minutos\n\nSe não resolver, agendo uma visita técnica gratuita. Quer tentar primeiro?`
      if (d.linha === 'movel') return `Vou verificar sua linha ${d.dados?.msisdn_fmt}... 📱\n\nTente ativar e desativar o modo avião — isso força o celular a reconectar na rede. Funcionou?`
      if (d.linha === 'tv') return `Vou verificar seu ${d.dados?.plano_nome} 📺\n\nTente desligar o Box da tomada por 30 segundos e religar. Na maioria dos casos o sinal volta. Me avisa se resolveu!`
      return 'Identifiquei o problema e vou abrir um chamado técnico para você.'
    },
    assistido: (d) => {
      if (d.linha === 'residencial') return `Vou te ajudar com sua internet! 😊\n\nVamos começar pelo mais simples: aquele aparelho que fica ligado na tomada (o modem). Consegue vê-lo?\n\n👉 Tire o fio da tomada\n⏱️ Conte até 30\n🔌 Coloque de volta\n\nFaz isso e me conta se melhorou. Estou aqui! 😊`
      if (d.linha === 'movel') return `Vou te ajudar com o celular! 📱\n\nVá nas Configurações e ligue o "Modo Avião", espere 10 segundos e desligue. É como reiniciar a conexão. Conseguiu fazer? 😊`
      return 'Não se preocupe! Me conta com calma o que está acontecendo que eu te ajudo.'
    },
    informal: (d) => {
      if (d.linha === 'residencial') return `Deixa comigo! 🔍\n\nDei uma olhada aqui e teu sinal tá oscilando. Faz o básico primeiro:\n\n1️⃣ Tira o modem da tomada\n2️⃣ Conta até 30\n3️⃣ Liga de novo\n\nSe não resolver eu mando um técnico, de boa. Testa aí e me fala 👊`
      if (d.linha === 'movel') return `Bora resolver! 📱\n\nLiga e desliga o modo avião aí, que ele reconecta na rede. Testa e me fala se voltou 👊`
      return 'Manda mais detalhe do que tá acontecendo que eu resolvo!'
    },
  },

  diagnostico: {
    digital: (d) => `ONU/CPE verificado remotamente — ${d.dados?.modem || 'equipamento'}: sem falha crítica no nível óptico. Para reset: botão traseiro por 10s ou interface web em 192.168.0.1.`,
    intermediario: (d) => `Fiz um diagnóstico remoto do seu ${d.dados?.modem || 'modem'} ✅ Equipamento respondendo normalmente.\n\nPara configurar o Wi-Fi, acesse **192.168.0.1** no navegador. Login e senha padrão estão na etiqueta embaixo do aparelho.`,
    assistido: (d) => `Vou te ajudar a configurar! 😊\n\nO aparelho da internet tem uma etiqueta embaixo, com a senha do Wi-Fi escrita. Consegue ver essa etiqueta? Me fala o que está escrito ali que eu te ajudo passo a passo!`,
    informal: (d) => `Testei teu ${d.dados?.modem || 'modem'} aqui, tá respondendo de boa ✅\n\nPra mexer no Wi-Fi entra em **192.168.0.1** no navegador. Login e senha tão na etiqueta embaixo do aparelho 👊`,
  },

  cancelamento: {
    digital: (d) => `Solicitação de cancelamento registrada no protocolo **${d.protocolo}**.\n\nAntes de processar: seu plano atual é ${d.dados?.plano_nome || 'ativo'} (${brl(d.dados?.valor_mensal)}). Posso apresentar condições de retenção ou encaminhar a um especialista. Prefere qual?`,
    intermediario: (d) => `Entendo, ${d.primeiroNome || 'cliente'}. Registrei sua solicitação no protocolo **${d.protocolo}**.\n\nAntes de seguir, posso oferecer:\n\n🎁 **Desconto de 30% por 3 meses** no plano atual\n📦 **Upgrade sem custo adicional** por 6 meses\n\nQuer conhecer as condições ou prefere falar com um especialista de retenção?`,
    assistido: (d) => `Poxa, fico triste em saber disso 😔 Registrei seu pedido com o número **${d.protocolo}**.\n\nAntes de cancelar, será que posso te ajudar com o que está incomodando? Às vezes conseguimos uma condição especial pra você continuar com a gente. O que acha de conversarmos um pouquinho?`,
    informal: (d) => `Poxa, que pena 😕 Anotei aqui no protocolo **${d.protocolo}**.\n\nAntes de fechar: consigo **30% de desconto por 3 meses** ou um **upgrade sem cobrar a mais por 6 meses**. Topa dar uma olhada ou quer falar com o pessoal de retenção mesmo?`,
  },

  upgrade_plano: {
    digital: (d) => `Plano atual: ${d.dados?.velocidade_down || '—'} Mbps (${brl(d.dados?.valor_mensal)}). Posso apresentar o próximo tier com migração remota e ativação em 24h. Confirma a consulta?`,
    intermediario: (d) => `Posso te mostrar as opções de upgrade! 🚀 Seu plano hoje é ${d.dados?.plano_nome || 'o atual'}. Quer que eu compare com o próximo nível e já deixe ativado se você aprovar?`,
    assistido: (d) => `Que bom que quer melhorar! 😊 Posso te colocar num plano mais rápido por um pouquinho a mais por mês. Quer que eu te mostre as opções?`,
    informal: (d) => `Bora melhorar esse plano! 🚀 Quer que eu já mostre o próximo nível e o quanto fica?`,
  },

  recarga: {
    digital: (d) => `Linha ${d.dados?.msisdn_fmt}: saldo **${brl(d.dados?.saldo_credito)}**.\nRecargas: R$ 15 (5GB/15 dias), R$ 30 (12GB/30 dias), R$ 35 (21GB/30 dias).\nCanais: app Minha Claro, *555, PIX.`,
    intermediario: (d) => `Sua linha **${d.dados?.msisdn_fmt}** tem saldo de **${brl(d.dados?.saldo_credito)}** 📱\n\nOpções Claro Prezão:\n- **R$ 15** → 5GB por 15 dias\n- **R$ 30** → 12GB por 30 dias\n- **R$ 35** → 21GB por 30 dias\n\nPode recarregar pelo app Minha Claro, pelo *555 ou por PIX. Qual valor prefere?`,
    assistido: (d) => `Vou te ajudar a colocar crédito! 😊\n\nSeu número: **${d.dados?.msisdn_fmt}**\nSaldo atual: **${brl(d.dados?.saldo_credito)}**\n\nVocê pode recarregar:\n📱 **No app Minha Claro** — bem simples\n🏪 **Em qualquer lotérica, mercado ou banco**\n\nQual jeito é mais fácil pra você?`,
    informal: (d) => `Teu saldo tá em **${brl(d.dados?.saldo_credito)}** na linha ${d.dados?.msisdn_fmt} 📱\n\nOpções:\n**R$15** → 5GB · **R$30** → 12GB · **R$35** → 21GB\n\nDá pra fazer pelo app, *555 ou PIX. Qual tu quer?`,
  },

  visita_tecnica: {
    digital: (d) => `Agendamento disponível: próximos dias úteis, janelas 8h-12h ou 13h-18h. Sem custo (cobertura contratual). Endereço em cadastro: **${d.dados?.endereco || 'não informado'}**. Confirma?`,
    intermediario: (d) => `Vou agendar uma visita técnica! 🔧\n\nEndereço cadastrado: **${d.dados?.endereco || 'seu endereço'}**\n\nDisponibilidade:\n- 📅 Amanhã: 8h-12h ou 13h-18h\n- 📅 Depois de amanhã: 8h-12h\n\nQual horário prefere? A visita é gratuita no seu plano!`,
    assistido: (d) => `Claro! Posso mandar um técnico te ajudar 😊\n\nEle vai até sua casa verificar tudo, e **é de graça**. O endereço é ${d.dados?.endereco || 'o que está no seu cadastro'}.\n\nPrefere que ele vá amanhã de manhã ou de tarde?`,
    informal: (d) => `Fechou, mando um técnico aí 🔧\n\nEndereço: **${d.dados?.endereco || 'o do cadastro'}**\nTenho amanhã 8h-12h ou 13h-18h, e é de graça no teu plano.\n\nQual horário fica melhor?`,
  },

  troca_titularidade: {
    digital: (d) => `Transferência de titularidade requer: documento do novo titular (RG/CPF), comprovante de endereço e anuência do cedente. Canais: loja autorizada ou app Minha Claro. Prazo: 3-5 dias úteis. Protocolo **${d.protocolo}**.`,
    intermediario: (d) => `Para trocar o titular do plano, preciso de alguns documentos 📋\n\n1. RG e CPF do novo titular\n2. Comprovante de endereço\n3. Autorização de quem está transferindo\n\nDá para fazer pelo app Minha Claro ou numa loja. Registrei no protocolo **${d.protocolo}**. Quer o endereço da loja mais próxima?`,
    assistido: (d) => `Entendi! Você quer passar o plano para outra pessoa 😊\n\nÉ tranquilo! Precisamos dos documentos de quem vai receber (RG, CPF e comprovante de endereço).\n\nAnotei no atendimento **${d.protocolo}**. Quer que eu explique certinho o passo a passo?`,
    informal: (d) => `Suave! Pra passar a titularidade precisa de:\n\n📄 RG e CPF do novo titular\n📄 Comprovante de endereço\n📄 Autorização de quem tá passando\n\nDá pra fazer no app ou na loja. Anotei no protocolo **${d.protocolo}** 👊`,
  },

  portabilidade: {
    digital: (d) => `Portabilidade numérica — regulamentada pela Anatel. Solicitação feita no operador receptor. Prazo: até 1 dia útil, linha ativa durante a janela. Necessário CPF do titular. Protocolo **${d.protocolo}**.`,
    intermediario: (d) => `Trazer seu número para a Claro é simples! 📱\n\nA solicitação é feita aqui mesmo, com o seu CPF. Em até 1 dia útil o número migra, **sem ficar sem linha** durante o processo.\n\nRegistrei no protocolo **${d.protocolo}**. Quer que eu inicie agora?`,
    assistido: (d) => `Que ótimo! Você pode trazer seu número para a Claro e **ele continua o mesmo** 😊\n\nSó muda a operadora. Leva cerca de 1 dia e você não fica sem telefone nesse tempo.\n\nAnotei no atendimento **${d.protocolo}**. Quer que eu comece?`,
    informal: (d) => `Dá sim! Teu número continua o mesmo, só troca a operadora 📱\n\nLeva até 1 dia útil e tu não fica sem linha nesse meio tempo. Só preciso do teu CPF.\n\nProtocolo **${d.protocolo}**. Bora?`,
  },

  roaming: {
    digital: (d) => `Roaming internacional — plano ${d.dados?.plano_nome}. Mercosul incluso sem custo adicional. Demais destinos: pacote diário ou tarifa por MB. Ativação: app Minha Claro > Serviços > Roaming.`,
    intermediario: (d) => `Para usar o celular fora do país temos algumas opções 🌍\n\n✅ **Mercosul**: já incluso no seu plano\n🌎 **Outros destinos**: pacote diário com dados, ligações e SMS\n\nPra qual país você vai e quando viaja? Assim te indico a melhor opção.`,
    assistido: (d) => `Que viagem boa! 😊 Seu celular funciona lá fora, sim!\n\nMe conta pra qual país você vai e quando, que eu te explico certinho o que precisa fazer antes de viajar.`,
    informal: (d) => `Boa viagem! ✈️ Teu celular funciona lá fora sim.\n\n**Mercosul** já vem incluso. Outros países rolam pacote por dia.\n\nPra onde tu vai? Aí te falo o melhor esquema.`,
  },

  streaming: {
    digital: (d) => `${d.dados?.plano_nome || 'Claro tv+'}: ${d.dados?.dispositivos || 2} dispositivos simultâneos, streamings inclusos no pacote. Acesso via app Claro tv+ ou clarotvmais.com.br. Login: ${d.dados?.login || 'e-mail do cadastro'}.`,
    intermediario: (d) => `Seu **${d.dados?.plano_nome || 'Claro tv+'}** está ativo! 🎬\n\nAcesse pelo app **Claro tv+** (celular, Smart TV ou Box) ou no site.\n\nLogin: **${d.dados?.login || 'seu e-mail cadastrado'}**\n\nSe esqueceu a senha, posso enviar a redefinição. Precisa de ajuda para instalar em algum aparelho?`,
    assistido: (d) => `Vou te ajudar a assistir! 📺😊\n\nBaixe o aplicativo **"Claro tv+"** no seu celular ou na sua Smart TV — é gratuito.\n\nDepois entre com seu e-mail e senha. Quer que eu te explique como baixar o aplicativo?`,
    informal: (d) => `Teu **${d.dados?.plano_nome || 'Claro tv+'}** tá ativo 🎬\n\nBaixa o app **Claro tv+** no celular ou na TV e entra com **${d.dados?.login || 'teu e-mail'}**.\n\nEsqueceu a senha? Eu mando o reset 👊`,
  },

  atendente_humano: {
    digital: (d) => `Encaminhando para atendimento humano. Protocolo **${d.protocolo}** com contexto completo da sessão.`,
    intermediario: (d) => `Sem problema! Vou te colocar na fila para falar com um atendente 👤\n\nSeu protocolo **${d.protocolo}** vai junto com todo o histórico — você não vai precisar repetir nada.`,
    assistido: (d) => `Claro! Vou chamar uma pessoa para falar com você 😊\n\nFica tranquilo: o atendente já vai receber tudo o que conversamos aqui, com o número **${d.protocolo}**. Você não precisa explicar de novo.`,
    informal: (d) => `De boa! Já tô te colocando na fila pra falar com um atendente 👤\n\nO protocolo **${d.protocolo}** vai junto com todo o histórico, então não precisa repetir nada 👊`,
  },

  transbordo_humano: {
    digital: (d) => `⚠️ Atrito elevado detectado. Transferência para fila prioritária. Protocolo **${d.protocolo}** com contexto completo. Tempo estimado: 2-4 min.`,
    intermediario: (d) => `Percebi que isso está sendo frustrante — desculpe. Vou te conectar com um especialista humano agora 👤\n\nJá enviei todo o histórico e o protocolo **${d.protocolo}**, então você não vai repetir nada.\n\n⏱️ Tempo estimado: 2 a 4 minutos. Obrigado pela paciência!`,
    assistido: (d) => `Entendo sua frustração, e sinto muito por isso 😔\n\nVou chamar uma pessoa para te atender agora mesmo 👤 Ela já vai saber de tudo — o protocolo **${d.protocolo}** leva todo o histórico junto.\n\nVocê não vai precisar explicar de novo. Só um instantinho!`,
    informal: (d) => `Foi mal, entendi teu ponto 😕 Já tô chamando um atendente de verdade pra ti 👤\n\nO protocolo **${d.protocolo}** leva tudo que a gente conversou. Não vai precisar repetir nada. Uns 2-4 min e te chamam!`,
  },

  geral: {
    digital: () => `Escopo de atendimento: fatura e pagamento, suporte técnico, consumo de franquia, upgrade de plano, recarga, visita técnica, portabilidade e roaming. Qual a demanda?`,
    intermediario: () => `Claro! Posso te ajudar com **fatura e pagamento**, **suporte técnico**, **consumo de dados**, **upgrade de plano**, **recarga** ou **agendamento de visita técnica** 😊\n\nMe conta com mais detalhes o que você precisa!`,
    assistido: () => `Estou aqui pra ajudar! 😊 Pode me contar com calma o que está acontecendo — não tem pressa.\n\nPosso ver sua conta, resolver problema de internet, agendar um técnico ou o que você precisar.`,
    informal: () => `Manda o que tá precisando! 👊\n\nResolvo fatura, problema de internet, consumo de dados, upgrade, recarga, visita técnica... só falar.`,
  },

  continuidade: {
    digital: (d) => `Sessão anterior recuperada (${d.memoria?.canal || 'outro canal'}). ${d.memoria?.resumo || ''} Prosseguindo.`,
    intermediario: (d) => `Olá! Vi que você já falou com a gente ${d.memoria?.minutosAtras ? 'há ' + d.memoria.minutosAtras + ' minutos' : 'recentemente'} pelo ${d.memoria?.canal || 'outro canal'} 😊\n\n${d.memoria?.resumo || ''}\n\nVamos continuar de onde paramos?`,
    assistido: (d) => `Olá de novo! 😊 Eu lembro do seu contato anterior. ${d.memoria?.resumo ? d.memoria.resumo : ''}\n\nNão precisa explicar tudo de novo — vamos resolver juntos!`,
    informal: (d) => `Opa, de volta! 👋 Lembro do teu contato pelo ${d.memoria?.canal || 'outro canal'}. ${d.memoria?.resumo || ''}\n\nBora continuar de onde parou?`,
  },
}

/**
 * Gera a resposta. Recebe o contexto já resolvido pelo núcleo — não faz
 * consulta a banco nem decide roteamento: só redige.
 */
function gerar({
  intencao,
  linha,
  persona = 'intermediario',
  dados,
  nome,
  portfolio,
  memoria,
  contexto,
  protocolo,
  acao,
  protocoloConsultado,
  protocolosAbertos,
}) {
  const grupo = TEMPLATES[intencao] || TEMPLATES.geral
  const fn = grupo[persona] || grupo.intermediario || grupo[Object.keys(grupo)[0]]

  const portfolio_resumo = portfolio?.length > 0 ? portfolio.map(c => c.produto_nome).join(', ') : null

  const resposta = fn({
    dados,
    nome,
    primeiroNome: nome?.split(' ')[0],
    linha,
    portfolio_resumo,
    memoria: memoria?.trechos?.[0] || null,
    protocolo: protocolo ? protocoloSvc.formatar(protocolo) : null,
    acao,
    protocoloConsultado,
  })

  const prefixos = []

  // Retomada por protocolo aberto em OUTRO canal — a continuidade mais forte:
  // não é "lembro de você", é "seu chamado do call center está aqui".
  const abertoOutroCanal = protocolosAbertos?.find(p => p.outro_canal)
  if (abertoOutroCanal && intencao !== 'consulta_protocolo' && intencao !== 'continuidade') {
    const quando = abertoOutroCanal.horasAtras <= 1 ? 'há pouco' : `há ${abertoOutroCanal.horasAtras}h`
    prefixos.push(
      `📋 *Localizei seu protocolo **${abertoOutroCanal.numero_formatado}**, aberto ${quando} no **${rotularCanal(abertoOutroCanal.canal_origem)}** sobre "${abertoOutroCanal.assunto}" e ainda em aberto. Vou continuar deste ponto — você não precisa explicar de novo.*`
    )
  } else if (intencao !== 'continuidade' && contexto?.multicanal && memoria?.trechos?.length > 0) {
    const mem = memoria.trechos[0]
    const mins = mem.minutosAtras
    prefixos.push(
      `💡 *Identifico que você nos contatou via ${rotularCanal(mem.canal)} há ${mins < 60 ? mins + ' min' : Math.round(mins / 60) + 'h'}.*${mem.pendencias?.length > 0 ? ` Pendências: ${mem.pendencias.join(', ')}.` : ''}`
    )
  }

  return prefixos.length > 0 ? prefixos.join('\n\n') + '\n\n' + resposta : resposta
}

function rotularCanal(canal) {
  return {
    site: 'Site claro.com.br',
    app: 'App Minha Claro',
    whatsapp: 'WhatsApp',
    callcenter: 'Call Center (1052)',
  }[canal] || canal?.toUpperCase() || 'outro canal'
}

module.exports = { gerar, rotularCanal, TEMPLATES }
