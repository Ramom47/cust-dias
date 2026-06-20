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

## Importar processo em PDF (preenchimento automático)

Na etapa **Cabeçalho** há o painel **"Importar processo (PDF) e preencher
automaticamente"**. Ao selecionar o PDF do auto de prisão / BOC / processo:

1. o texto é extraído **no navegador** com `pdfjs` (o arquivo não é enviado a
   lugar nenhum além do passo seguinte);
2. o texto é enviado ao Claude (via o mesmo proxy `/api/messages`), que devolve
   um JSON estruturado com os dados encontrados;
3. apenas campos reconhecidos e válidos são mesclados ao formulário — o que não
   for localizado fica em branco e a IA é instruída a **não inventar** dados.

Campos preenchidos automaticamente quando presentes: número do processo,
auto/mandado, nome, filiação, data de nascimento, endereço, celular, CPF, RG,
naturalidade, crime imputado, drogas/arma apreendidas, antecedentes e um resumo
dos fatos. Sempre revise o resultado antes de gerar o documento.

> Requer `ANTHROPIC_API_KEY` configurada (mesma usada na geração das
> deliberações). PDFs digitalizados (somente imagem, sem texto) não são
> suportados nesta extração.

## Observações

- A geração de deliberações usa o modelo `claude-sonnet-4-6`.
- Sem a `ANTHROPIC_API_KEY` o app funciona normalmente; apenas o botão
  **"Gerar Deliberações com IA"** retornará erro explicativo.
- O documento final usa a fonte **EB Garamond 13pt** e está pronto para
  **Imprimir / Salvar como PDF** com margens A4.
