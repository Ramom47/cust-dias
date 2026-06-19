# Sistema de Audiência de Custódia — 3ª Vara Criminal de Campo Verde/MT

Aplicação React para gerar termos de **Audiência de Custódia** (Liberdade
Provisória, Prisão Preventiva e Executivo de Pena/Justificação), com geração
do texto das deliberações por IA (Claude) e exportação para PDF via impressão.

## O que foi corrigido

A versão original era um artefato de página única que chamava
`https://api.anthropic.com/v1/messages` **diretamente do navegador**. Isso nunca
funciona em produção porque:

- a **chave da API** ficaria exposta no front-end;
- faltavam os cabeçalhos obrigatórios `x-api-key` e `anthropic-version`;
- a API da Anthropic bloqueia chamadas diretas do navegador (CORS).

Agora o front-end chama `/api/messages`, e um pequeno servidor **Express**
(`server.js`) encaminha a requisição para a Anthropic adicionando a chave e o
cabeçalho de versão no lado do servidor.

## Pré-requisitos

- Node.js 20.6+ (testado com Node 22)
- Uma chave de API da Anthropic

## Configuração

```bash
npm install
cp .env.example .env      # edite e coloque sua ANTHROPIC_API_KEY
```

## Desenvolvimento

```bash
npm run dev
```

Sobe dois processos:

- **Vite** (front-end) em http://localhost:5173
- **Proxy Express** em http://localhost:8787

Abra http://localhost:5173. As chamadas `/api` são encaminhadas ao proxy
automaticamente.

## Produção

```bash
npm run build      # gera dist/
npm start          # serve dist/ + proxy na mesma porta (8787)
```

Acesse http://localhost:8787.

## Observações

- A geração de deliberações usa o modelo `claude-sonnet-4-6`.
- Sem a `ANTHROPIC_API_KEY` o app funciona normalmente; apenas o botão
  **"Gerar Deliberações com IA"** retornará erro explicativo.
- O documento final usa a fonte **EB Garamond 13pt** e está pronto para
  **Imprimir / Salvar como PDF** com margens A4.
