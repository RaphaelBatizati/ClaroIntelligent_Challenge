# Como rodar o projeto do zero

Guia para clonar o repositório em uma máquina nova (Windows, mas os comandos de terminal valem para Mac/Linux trocando apenas os scripts `.bat`/`.ps1`, que são exclusivos de Windows) e deixar o MVP rodando.

## Pré-requisitos

- **Node.js 22.5 ou superior** (recomendado: **Node 24.x**). O projeto usa o módulo nativo `node:sqlite`, disponível a partir da 22.5 atrás de flag experimental — **não precisa instalar SQLite separadamente, nem compilar nada nativo, nem Python/Visual Studio Build Tools**.
  Verifique com:
  ```bash
  node --version
  ```
- **npm** (vem junto com o Node.js).
- **Git**, para clonar o repositório.
- Não é necessário Docker, banco de dados externo, nem nenhuma chave de API — o LLM é simulado e o banco é um arquivo local.

## 1. Clonar o repositório

```bash
git clone https://github.com/RaphaelBatizati/ClaroIntelligent_Challenge.git
cd ClaroIntelligent_Challenge
```

## 2. Subir o backend (API)

```bash
cd clarointelligence-api
npm install
npm run seed      # cria o arquivo clarointelligence.sqlite e popula com os dados de demo
npm run server    # inicia em http://localhost:3001
```

Copie `clarointelligence-api/.env.example` para `clarointelligence-api/.env` caso queira mudar porta, caminho do banco ou origem CORS — os valores padrão já funcionam sem esse passo.

Confirme que subiu corretamente:
```bash
curl http://localhost:3001/api/health
```

## 3. Subir o frontend (em outro terminal)

```bash
cd clarointelligence
npm install
npm run dev       # inicia em http://localhost:5173
```

Copie `clarointelligence/.env.example` para `clarointelligence/.env` se a API não estiver em `localhost:3001`.

Acesse **http://localhost:5173** — o dashboard administrativo abre por padrão. A demo de chat do cliente fica em **http://localhost:5173/chat**.

## Atalho no Windows

Os arquivos `Iniciar ClaroIntelligence.bat` e `Parar ClaroIntelligence.bat` na raiz do projeto automatizam os passos 2 e 3 (instalam dependências se faltarem, populam o banco na primeira vez, sobem os dois servidores em janelas separadas e abrem o navegador). Dê duplo clique em `Iniciar ClaroIntelligence.bat` depois do `git clone` — não precisa rodar os comandos manuais acima nesse caso.

## Clientes de demonstração

O `npm run seed` cria 6 clientes com contratos diferentes, pensados para demonstrar cada motor do sistema. Use o campo `cliente_id` ao chamar `POST /api/chat/mensagem` (ver [API.md](API.md)) ou selecione o cliente na tela de chat do painel.

| `cliente_id` | Cliente | Portfólio | Roteiro sugerido |
|---|---|---|---|
| `cli-ana-souza` | Ana Souza | Fibra 300 | **A** — continuidade entre canais: converse no Site, encerre, volte pelo WhatsApp e veja o ClaroMemory recuperar o contexto |
| `cli-carlos-mota` | Carlos Mota | Fibra 500 + 2 linhas móveis + Claro tv+ | **B** — desambiguação multiproduto: peça "minha internet caiu" e veja o Product Resolver perguntar qual produto |
| `cli-fernanda-lima` | Fernanda Lima | Fibra 100 | **C** — ClaroSense: repita a mesma reclamação e use linguagem de frustração para disparar o transbordo automático (score ≥ 80) |
| `cli-joao-santos` | João Santos | Fibra 300 + Max Flex | **D** — multiproduto simples |
| `cli-mariana-costa` | Mariana Costa | — | cliente extra, só preenche o Monitor de Conversas do painel |
| `cli-roberto-alves` | Roberto Alves | — | cliente extra, só preenche o Monitor de Conversas do painel |

## Resetar o banco de dados

```bash
cd clarointelligence-api
rm clarointelligence.sqlite   # (Windows: del clarointelligence.sqlite)
npm run seed
```

## Build de produção do frontend

```bash
cd clarointelligence
npm run build      # gera clarointelligence/dist/
npm run preview    # serve o build localmente para conferência
```

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| `node:sqlite` não encontrado / erro de módulo experimental | Node < 22.5, ou rodando o script sem a flag | confirme `node --version`; os scripts do `package.json` já incluem `--experimental-sqlite`, não rode `node src/server.js` diretamente sem a flag |
| Frontend não conecta na API (erro de rede no chat) | API não está rodando, ou `.env` do frontend aponta para URL errada | confirme `curl http://localhost:3001/api/health`; confira `VITE_API_URL` em `clarointelligence/.env` |
| CORS bloqueado no navegador | `CORS_ORIGIN` da API não bate com a porta real do frontend | ajuste `CORS_ORIGIN` em `clarointelligence-api/.env` |
| Porta 3001 ou 5173 já em uso | outro processo já está rodando | no Windows, use `Parar ClaroIntelligence.bat`, ou mate manualmente o processo na porta (`netstat -ano \| find ":3001"` e `taskkill /PID <pid> /F`) |
| Painel abre mas todas as telas estão vazias | esqueceu de rodar `npm run seed` antes do `npm run server` | pare a API, rode `npm run seed`, suba a API de novo |

## Onde ler mais

- [ARQUITETURA.md](ARQUITETURA.md) — como as camadas e motores funcionam
- [BANCO_DE_DADOS.md](BANCO_DE_DADOS.md) — esquema das tabelas
- [API.md](API.md) — todos os endpoints
- [SEGURANCA.md](SEGURANCA.md) — o que está e o que não está coberto em segurança/LGPD
