// Simulated deterministic LLM provider
// No external API — fully deterministic, suitable for academic demo

const TEMPLATES = {
  saudacao: {
    digital: (d) => `Olá${d.nome ? ', ' + d.nome.split(' ')[0] : ''}! Como posso ajudar? ${d.portfolio_resumo ? `Detecto no portfólio: ${d.portfolio_resumo}.` : ''}`,
    intermediario: (d) => `Olá${d.nome ? ', ' + d.nome.split(' ')[0] : ''}! Sou o assistente virtual da Claro 😊 Tudo certo? Como posso te ajudar hoje?`,
    assistido: (d) => `Olá${d.nome ? ', ' + d.nome.split(' ')[0] : ''}! Que bom falar com você! 😊 Sou a assistente da Claro. Como posso te ajudar?`,
  },

  segunda_via: {
    digital: (d) => {
      if (!d.dados) return 'Não localizei contratos ativos. Verifique seu CPF cadastrado.'
      return `Fatura ${d.linha === 'movel' ? `linha ${d.dados.msisdn_fmt}` : d.dados.plano_nome}: **R$ ${d.dados.valor_mensal?.toFixed(2).replace('.', ',')}** · venc. ${d.dados.vencimento}\n\nCódigo de barras:\n\`${d.dados.codigo_barras}\``
    },
    intermediario: (d) => {
      if (!d.dados) return 'Não encontrei sua fatura. Pode confirmar o produto que deseja?'
      const linha = d.linha === 'movel' ? `celular ${d.dados.msisdn_fmt}` : d.dados.plano_nome
      return `Encontrei sua fatura! ✅\n\n📋 **${linha}**\nValor: **R$ ${d.dados.valor_mensal?.toFixed(2).replace('.', ',')}**\nVencimento: **${d.dados.vencimento}**\n\nCódigo para pagamento:\n\`${d.dados.codigo_barras}\`\n\nCopie e cole no app do banco. Tem mais alguma dúvida?`
    },
    assistido: (d) => {
      if (!d.dados) return 'Não encontrei sua conta. Pode me dizer qual serviço quer pagar?'
      return `Olá! Encontrei sua conta 😊\n\nVeja o valor a pagar:\n💰 **R$ ${d.dados.valor_mensal?.toFixed(2).replace('.', ',')}**\n📅 Vence dia **${d.dados.vencimento}**\n\nPara pagar, leve esse número para qualquer banco ou lotérica:\n\`${d.dados.codigo_barras}\`\n\nPrecisa que eu explique como pagar? 😊`
    },
  },

  suporte_tecnico: {
    digital: (d) => {
      if (d.linha === 'residencial') {
        return `Diagnóstico remoto do seu ${d.dados?.modem || 'modem'}: sinal OLT **${d.dados?.olt_status || 'verificando'}**. Downstream: ~${Math.floor((d.dados?.velocidade_down || 300) * 0.7)} Mbps (contratado: ${d.dados?.velocidade_down || 300} Mbps). Há instabilidade na camada OLT. Recomendo: (1) power-cycle do CPE, (2) verificar integridade da ONU.`
      }
      if (d.linha === 'movel') {
        return `Verificando linha ${d.dados?.msisdn_fmt}: sinal 4G detectado na BTS da sua região. Status da RAN: operacional. Se persistir, tente: (1) ativar/desativar modo avião, (2) verificar bloqueio de dados no perfil.`
      }
      return 'Diagnóstico iniciado. Verifique o status dos seus equipamentos.'
    },
    intermediario: (d) => {
      if (d.linha === 'residencial') {
        return `Entendi! Vou checar sua conexão agora... 🔍\n\nIdentifiquei que seu modem está com sinal instável. Siga esses passos:\n\n1️⃣ Desligue o modem da tomada\n2️⃣ Aguarde 30 segundos\n3️⃣ Religue e espere 2 minutos\n\nSe não resolver, posso agendar uma visita técnica gratuita. Quer tentar primeiro?`
      }
      if (d.linha === 'movel') {
        return `Vou verificar sua linha ${d.dados?.msisdn_fmt}... 📱\n\nTente desligar e ligar o modo avião. Isso força o celular a reconectar na rede. Funcionou?`
      }
      return 'Identifiquei o problema. Vou abrir um chamado técnico para você. Tem mais alguma informação?'
    },
    assistido: (d) => {
      if (d.linha === 'residencial') {
        return `Vou te ajudar com sua internet! 😊\n\nPrimeiro, vamos tentar o mais simples: o aparelho que fica na tomada (modem). Você consegue vê-lo?\n\n👉 Desligue o fio da tomada\n⏱️ Conte até 30\n🔌 Ligue de volta\n\nFaz isso pra mim e me fala se ajudou! Estou aqui 😊`
      }
      if (d.linha === 'movel') {
        return `Vou te ajudar com o celular! 📱\n\nTente isso: vá em Configurações do seu celular e ative e desative o "Modo Avião". Funciona como um reinício da conexão. Conseguiu fazer? Me conta! 😊`
      }
      return 'Não se preocupe! Estou aqui para ajudar. Pode me contar melhor o que está acontecendo?'
    },
  },

  diagnostico: {
    digital: (d) => `ONU/CPE verificado remotamente. Parâmetros do ${d.dados?.modem || 'modem'}: sem falha crítica detectada no nível óptico. Recomendo full factory reset via botão traseiro (10s) ou via interface web 192.168.0.1.`,
    intermediario: (d) => `Vou fazer um diagnóstico remoto do seu modem ${d.dados?.modem || ''}... ✅ Equipamento respondendo. Para configurar o Wi-Fi, acesse **192.168.0.1** no navegador. Login e senha padrão estão na etiqueta embaixo do modem.`,
    assistido: (d) => `Vou te ajudar a configurar! 😊\n\nO aparelho de internet tem uma etiqueta embaixo com a senha do Wi-Fi. Tem um número escrito ali? Me fala que te ajudo a conectar passo a passo!`,
  },

  cancelamento: {
    digital: (d) => `Registrei sua solicitação de cancelamento. Protocolo gerado: **CL-${Date.now().toString().slice(-8)}**. Multa rescisória: verificar contrato. Prazo de processamento: até 2 dias úteis. Quer confirmar ou prefere analisar alternativas?`,
    intermediario: (d) => `Entendo, ${d.nome?.split(' ')[0] || 'cliente'}. Vou registrar sua solicitação. Antes de cancelar, posso oferecer:\n\n🎁 **Desconto de 30% por 3 meses** no plano atual\n📦 **Upgrade gratuito** para o plano superior\n\nQuer conhecer as opções ou prefere seguir com o cancelamento?`,
    assistido: (d) => `Entendo que está pensando em cancelar 😔 Fico triste em ouvir isso. Posso te ajudar de alguma forma antes? Às vezes conseguimos uma condição especial pra você ficar. O que acha de conversarmos?`,
  },

  upgrade_plano: {
    digital: (d) => {
      const atual = d.dados?.velocidade_down || 300
      const proximo = atual < 500 ? 500 : 1000
      return `Plano atual: ${atual} Mbps (R$ ${d.dados?.valor_mensal?.toFixed(2)?.replace('.', ',')}). Próximo tier: ${proximo} Mbps. Delta de valor: ~R$ ${(30 + Math.random() * 20).toFixed(2).replace('.', ',')}/mês. Migração sem custo de instalação, efeito na próxima fatura.`
    },
    intermediario: (d) => {
      const atual = d.dados?.velocidade_down || 300
      const proximo = atual < 500 ? 500 : 1000
      return `Ótima escolha! 🚀 Seu plano atual é ${atual} Mega. O próximo é o **${proximo} Mega** por apenas mais R$ ${(25 + Math.floor(Math.random() * 15)).toFixed(2).replace('.', ',')}/mês.\n\nA migração é feita remotamente, sem visita, e já funciona em até 24h. Quer ativar?`
    },
    assistido: (d) => `Que bom que quer melhorar! 😊 Seu plano atual te dá uma velocidade legal. Posso te colocar em um plano ainda mais rápido por um pouquinho a mais por mês. Quer que eu te explique como funciona?`,
  },

  recarga: {
    digital: (d) => `Linha ${d.dados?.msisdn_fmt}: saldo atual R$ ${d.dados?.saldo_credito || '0,00'}. Recargas disponíveis: R$ 15 (1GB+), R$ 30 (3GB+), R$ 50 (7GB+). Canais: app Minha Claro, site, PIX chave 02558157000162.`,
    intermediario: (d) => `Sua linha ${d.dados?.msisdn_fmt} tem saldo de **R$ ${d.dados?.saldo_credito || '0,00'}** 📱\n\nOpções de recarga:\n- **R$ 15** → 1GB de dados por 7 dias\n- **R$ 30** → 3GB por 15 dias\n- **R$ 50** → 7GB por 30 dias\n\nPode recarregar pelo app Minha Claro ou por PIX. Qual prefere?`,
    assistido: (d) => `Vou te ajudar a recarregar! 😊\n\nSua linha é: ${d.dados?.msisdn_fmt || 'sua linha Claro'}\n\nPode recarregar:\n📱 **No app Minha Claro** — é bem simples!\n🏪 **Em qualquer lotérica ou banco**\n\nQual é mais fácil pra você?`,
  },

  visita_tecnica: {
    digital: (d) => `Agendamento de visita técnica. Disponibilidade: próximos dias úteis, janelas 8h-12h ou 13h-18h. Sem custo adicional (cobertura contratual). Confirma endereço: **${d.dados?.endereco || 'endereço cadastrado'}**?`,
    intermediario: (d) => `Vou agendar uma visita técnica pra você! 🔧\n\nEndereço cadastrado: **${d.dados?.endereco || 'seu endereço'}**\n\nDisponibilidade:\n- 📅 Amanhã: 8h-12h ou 13h-18h\n- 📅 Depois de amanhã: 8h-12h\n\nQual horário prefere? A visita é gratuita no seu plano!`,
    assistido: (d) => `Claro! Posso chamar um técnico pra te ajudar 😊\n\nO técnico vai à sua casa verificar tudo. É de graça! O endereço é ${d.dados?.endereco || 'o que você nos informou'}.\n\nQuer que o técnico vá amanhã de manhã ou de tarde?`,
  },

  troca_titularidade: {
    digital: (d) => `Transferência de titularidade requer: documento do novo titular (RG/CPF), comprovante de endereço, e assinatura do cedente. Processo: enviar via e-mail clarotitularidade@claro.com.br ou presencialmente em loja autorizada. Prazo: 3-5 dias úteis.`,
    intermediario: (d) => `Para trocar o titular do plano, preciso de alguns documentos! 📋\n\n1. RG e CPF do novo titular\n2. Comprovante de endereço\n3. Assinatura de quem transfere\n\nPode enviar por e-mail ou ir a uma loja. Posso te passar o endereço da loja mais próxima?`,
    assistido: (d) => `Entendi! Você quer passar o plano para outra pessoa 😊\n\nÉ simples! Precisamos de alguns documentos da pessoa que vai receber. Posso te explicar direitinho o que precisa. Quer que eu faça isso?`,
  },

  portabilidade: {
    digital: (d) => `Portabilidade numérica: processo regulado pela Anatel (Res. 460/2007). Solicite no canal receptor. Prazo: até 1 dia útil. Documento necessário: CPF do titular. Linha ativa durante a janela de portabilidade.`,
    intermediario: (d) => `Para trazer seu número para a Claro, é muito simples! 📱\n\nBasta solicitar ao operador de destino (a Claro). Em até 24 horas seu número migra sem interrupção. Precisa apenas do seu CPF. Quer que eu inicie o processo agora?`,
    assistido: (d) => `Ótimo! Você pode manter seu número ao vir pra Claro 😊 É muito fácil! Vou te explicar passo a passo. O número fica o mesmo, só muda a operadora. Quer saber mais?`,
  },

  roaming: {
    digital: (d) => `Roaming internacional: plano ${d.dados?.plano_nome} inclui roaming em países do Mercosul sem custo adicional. Europa e EUA: R$ 0,80/MB (dados) ou contrate Day Pass por R$ 25/dia. Ativar: *555 > Serviços > Roaming Internacional.`,
    intermediario: (d) => `Para usar a internet no exterior, temos algumas opções 🌍\n\n✅ **Mercosul**: incluso no seu plano sem custo extra\n🌎 **América do Norte/Europa**: Day Pass por R$ 25/dia (dados, chamadas e SMS)\n\nQuer ativar o roaming para qual país e quando viaja?`,
    assistido: (d) => `Que viagem legal! 😊 Seu celular pode funcionar lá fora, sim! Me conta pra qual país você vai e eu te digo o que precisa fazer pra funcionar direitinho!`,
  },

  streaming: {
    digital: (d) => `Claro tv+ ${d.dados?.plano_nome}: ${d.dados?.dispositivos || 2} devices simultâneos. Catálogo: 40k+ títulos + canais ao vivo. Integração HBO Max, Paramount+, Globoplay (conforme plano). Login: ${d.dados?.login}.`,
    intermediario: (d) => `Seu ${d.dados?.plano_nome} está ativo! 🎬\n\nAcesse em qualquer dispositivo: **clarotv.com** ou baixe o app Claro tv+\n\nLogin: **${d.dados?.login || 'seu e-mail cadastrado'}**\n\nSe esqueceu a senha, posso enviar redefinição por e-mail. Precisa de ajuda para instalar em algum aparelho?`,
    assistido: (d) => `Vou te ajudar a assistir TV! 📺😊\n\nBaixe o app "Claro tv+" no seu celular, tablet ou Smart TV. É gratuito. Entre com e-mail e senha. Precisa de ajuda para instalar?`,
  },

  geral: {
    digital: (d) => `Posso ajudar com: segunda via, suporte técnico, upgrade, portabilidade, roaming ou configuração. Qual é o problema?`,
    intermediario: (d) => `Claro! Posso te ajudar com diversas coisas 😊 Me conta com mais detalhes o que está precisando!`,
    assistido: (d) => `Estou aqui pra ajudar! 😊 Pode me contar o que está acontecendo com calma. Não tem pressa!`,
  },

  continuidade: {
    digital: (d) => `Continuando sessão anterior (${d.memoria?.canal || 'canal anterior'}). ${d.memoria?.resumo ? 'Contexto recuperado: ' + d.memoria.resumo : ''} Como posso prosseguir?`,
    intermediario: (d) => `Olá! Identifico que você já falou conosco ${d.memoria?.minutosAtras ? 'há ' + d.memoria.minutosAtras + ' minutos' : 'antes'} pelo ${d.memoria?.canal || 'outro canal'} 😊 ${d.memoria?.resumo || ''} Vamos continuar de onde paramos?`,
    assistido: (d) => `Olá de novo! 😊 Lembro do seu contato anterior. ${d.memoria?.resumo ? 'Você tinha ' + d.memoria.resumo.toLowerCase() + '.' : ''} Vamos resolver isso juntos!`,
  },

  transbordo_humano: {
    digital: (d) => `Transferindo para atendente humano. Contexto completo da sessão enviado. Fila prioritária. Tempo estimado: 2-4 min.`,
    intermediario: (d) => `Vou te conectar com um especialista humano agora! 👤\n\nJá enviei todo o histórico da nossa conversa para ele, então não vai precisar repetir nada. ⏱️ Tempo estimado: 2 minutos. Obrigado pela paciência!`,
    assistido: (d) => `Vou chamar alguém pra te ajudar pessoalmente! 👤😊\n\nUm atendente já sabe tudo sobre seu caso. Você não vai precisar explicar de novo. Em breve ele(a) entra em contato!`,
  },
}

function gerar({ intencao, linha, persona = 'intermediario', dados, nome, portfolio, memoria, contexto }) {
  const grupo = TEMPLATES[intencao] || TEMPLATES.geral
  const fn = grupo[persona] || grupo['intermediario'] || grupo[Object.keys(grupo)[0]]

  let portfolio_resumo = null
  if (portfolio && portfolio.length > 0) {
    portfolio_resumo = portfolio.map(c => c.produto_nome).join(', ')
  }

  const resposta = fn({ dados, nome, linha, portfolio_resumo, memoria: memoria?.trechos?.[0] || null })

  // Add ClaroMemory prefix when there's cross-channel history
  if (intencao !== 'continuidade' && contexto?.multicanal && memoria?.trechos?.length > 0) {
    const mem = memoria.trechos[0]
    const mins = mem.minutosAtras
    const prefixo = `💡 *Identifico que você nos contatou via ${mem.canal?.toUpperCase() || 'outro canal'} há ${mins < 60 ? mins + ' min' : Math.round(mins / 60) + 'h'}.* ${mem.pendencias?.length > 0 ? 'Havia pendências: ' + mem.pendencias.join(', ') + '.' : ''}\n\n`
    return prefixo + resposta
  }

  return resposta
}

module.exports = { gerar }
