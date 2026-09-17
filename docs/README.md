# Documentação — ClaroIntelligence

Índice da documentação técnica do projeto. Para instruções rápidas de instalação, veja o [README](../README.md) na raiz — este índice aprofunda cada parte.

| Documento | Conteúdo |
|---|---|
| [COMO_RODAR.md](COMO_RODAR.md) | Passo a passo para rodar do zero em outra máquina + **os 11 roteiros de demonstração**, com o que digitar em cada um |
| [ROTEIRO_PITCH.md](ROTEIRO_PITCH.md) | Roteiro cronometrado de 2min30 do Chat do Cliente + Console do Atendente, com narração pronta |
| [ARQUITETURA.md](ARQUITETURA.md) | As 5 camadas, o pipeline completo de uma mensagem, protocolo, Product Context Resolver, motores, fila humana e autoatendimento |
| [PRODUTOS.md](PRODUTOS.md) | Catálogo real da Claro (móvel, fibra, tv+, empresas), chaves de identificação por linha e matriz de capacidades |
| [BANCO_DE_DADOS.md](BANCO_DE_DADOS.md) | Esquema de todas as tabelas do SQLite, relacionamentos e convenções |
| [API.md](API.md) | Todos os endpoints REST e SSE, com as 7 formas de resposta do pipeline de chat |
| [SEGURANCA.md](SEGURANCA.md) | Guardrails contra prompt injection, verificação em duas etapas, LGPD e limitações conhecidas |
| [INTEGRACAO_WHATSAPP.md](INTEGRACAO_WHATSAPP.md) | Análise de viabilidade da integração com WhatsApp real — requisitos, riscos e o que mudaria no código |
| [DECISOES.md](DECISOES.md) | Por que cada escolha técnica não óbvia foi tomada |

## Outras pastas

- [`briefing/`](briefing/) — o briefing original que guiou a evolução do protótipo até este MVP.
- [`entregas-academicas/`](entregas-academicas/) — documentos Word/PDF entregues à banca FIAP (Sprint 3 e Sprint 4), com os diagramas de arquitetura em alta resolução, e as entregas das Sprints 1 e 2 em [`entregas-academicas/sprints-anteriores/`](entregas-academicas/sprints-anteriores/).
- [`assets/diagramas/`](assets/diagramas/) — as mesmas imagens de diagrama usadas nos documentos acima, em PNG, referenciadas diretamente pelos arquivos `.md` deste índice.
