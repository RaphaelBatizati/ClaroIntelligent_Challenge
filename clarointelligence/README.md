# ClaroIntelligence — Frontend

React 19 + Vite + Tailwind CSS. Documentação completa do projeto (arquitetura, API, banco de dados, como rodar) está em [`../docs/`](../docs/README.md) e no [README da raiz](../README.md).

```bash
npm install
cp .env.example .env   # ajuste VITE_API_URL se a API não estiver em localhost:3001
npm run dev             # http://localhost:5173
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | servidor de desenvolvimento com HMR |
| `npm run build` | build de produção em `dist/` |
| `npm run preview` | serve o build localmente |
| `npm run lint` | oxlint |
