# HANDOFF — Sistema de Audiência de Custódia (3ª Vara Criminal de Campo Verde/MT)

> Documento de transferência de contexto. Resume o estado atual do projeto,
> decisões de arquitetura, o que mudou na v4.0 e como continuar o trabalho.
> Última atualização: 2026-06-21.

## 1. Visão geral

Aplicação **React + Vite** de página única para gerar **termos de Audiência de
Custódia** da 3ª Vara Criminal de Campo Verde/MT. Roda **100% no navegador**:
sem back-end, sem chamadas de rede, sem chave de API e sem custo por documento.

- Repositório: `Ramom47/cust-dias` (GitHub)
- Branch de desenvolvimento: `claude/busy-einstein-oseyjl`
- Branch principal: `main`
- Deploy: Vercel — site estático (`vite build` → `dist/`)
- Versão atual: **4.0.0**

## 2. Arquitetura atual (v4.0)

```
src/App.jsx        ← arquivo único autossuficiente (importa só de "react")
index.html         ← root do Vite
vite.config.js     ← apenas plugin React + porta 5173 (sem proxy)
tailwind/postcss   ← estilização
```

`src/App.jsx` concentra **tudo**:

1. **Motor de deliberações determinístico** (`montarDeliberacoes` + funções
   `montar*`) — monta o texto da decisão a partir dos campos, usando blocos
   jurídicos literais dos modelos reais da Vara. Zero IA, zero rede.
2. **Gerador DOCX** (`makeDocx` / `buildDocxBlob`) — escreve um ZIP/OOXML puro
   em JavaScript, sem dependências.
3. **Preview + impressão** (`DocPreview`, `injetarCSS`) — render fiel na tela e
   via "Imprimir / Salvar PDF".
4. **Formulário em 8 passos** (componente `App`).

## 3. O que mudou da v3.1 → v4.0

| Antes (v3.1) | Agora (v4.0) |
|---|---|
| Deliberações geradas por IA (Claude API) | Motor determinístico, sem IA |
| Importação de processo por PDF (pdfjs + visão) | **Removida** |
| Proxy Anthropic (`server.js`, `api/messages.js`) | **Removido** (não há rede) |
| Dependências: express, pdfjs-dist | **Removidas** |
| 3 tipos de audiência | 4 tipos (+ **Cumprimento de Mandado/Prisão Civil**) |
| 1 modelo por tipo | **9 modelos** com sub-modelos selecionáveis |

> Os arquivos removidos continuam recuperáveis pelo histórico do git, caso se
> queira reintroduzir IA ou importação de PDF no futuro.

## 4. Modelos de decisão disponíveis

- **Liberdade Provisória**: `padrao`, `controvertida`, `fianca`, `trafico`
- **Prisão Preventiva**: `cronologica` (descumprimento de MPU), `complexa`
  (fumus/periculum, celular, incineração)
- **Executivo de Pena / Justificação**: `fluida`, `topicos`
- **Cumprimento de Mandado / Prisão Civil**: `padrao`

Seleção de tipo/sub-modelo no Passo 0. A flag **plantão judiciário regional**
troca a fundamentação (Provimento 11/2024 ↔ Provimento 12/2017-CM) e o bloco de
assinaturas do termo.

## 5. Formatação do documento — PRESERVADA da versão anterior

A formatação é **idêntica** à que foi definida antes; a v4.0 só mudou a geração
do texto, não a diagramação. Pontos-chave (em `src/App.jsx`):

- Fonte **Garamond** — `G='Garamond'`, `SZ='26'` (13pt)
- Entrelinha exata 18pt — `LINE='360'`; espaço após parágrafo 12pt — `AFT='240'`
- Texto justificado (`w:jc="both"`)
- Margens A4 (em DXA/twips): Superior `PG_TOP=2240` (3,95cm), Inferior
  `PG_BOT=425` (0,75cm), Esquerda `PG_LEFT=1701` (3cm), Direita `PG_RIGHT=1134`
  (2cm)
- CSS de impressão `@page` espelha as mesmas margens
- Estilos do preview: constantes `DS`, `PS`, `TS`, `TH`, `TD1`, `TD2`
- Marcação no texto: `**negrito**` (MAIÚSCULAS viram negrito+sublinhado),
  `***negrito+sublinhado***`, `*itálico*` — convertidos tanto no DOCX
  (`parseRuns`) quanto no preview (`toHtml`)

Saídas no Passo 7 (Documento Final):
- **Copiar com formatação** (cola no Word com tabelas/negrito/sublinhado)
- **Gerar DOCX** (download `.docx`)
- **Imprimir / Salvar PDF** (`window.print()`)

## 6. Fluxo de uso

1. **Tipo de Audiência** — tipo + sub-modelo + plantão regional
2. **Cabeçalho** — processo, nome, data/hora, partes
3. **Dados da Audiência (BNMP)**
4. **Dados da Pessoa**
5. **Social e Saúde / Dependentes**
6. **Informações Processuais** (apreensões, antecedentes)
7. **Deliberações** — campos específicos + botão **"Montar Deliberações"**
   (texto editável após montar)
8. **Documento Final** — copiar / DOCX / PDF

## 7. Desenvolvimento e build

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/
npm run preview   # confere o dist/ localmente
```

## 8. Deploy (Vercel)

- É um **site estático**: basta `vite build` e publicar `dist/`.
- **Não precisa** mais da variável `ANTHROPIC_API_KEY` (pode removê-la das
  Settings do projeto na Vercel — ela era usada pelo proxy, que não existe mais).
- Não há função serverless nem servidor Node em produção.

## 9. Pendências / observações conhecidas

- `npm audit` reporta 2 vulnerabilidades **somente no servidor de dev**
  (esbuild/vite). Não afetam o site publicado; o conserto exige upgrade *major*
  do Vite (breaking) — deixado fora de escopo.
- Não há testes automatizados. Verificação atual = `vite build` + revisão de
  código. Sugestão futura: um teste de fumaça que monte cada um dos 9 modelos e
  valide que o texto não vem vazio.
- O texto jurídico dos modelos é literal dos modelos da Vara; alterações de
  conteúdo devem ser feitas nas funções `montar*` e nos blocos `BLOCO_*` /
  `PARA_*` / `CLAUSULA_*` em `src/App.jsx`.

## 10. Próximos passos sugeridos

- Abrir PR de `claude/busy-einstein-oseyjl` → `main` (ainda não aberto).
- (Opcional) Remover `ANTHROPIC_API_KEY` das Settings da Vercel.
- (Opcional) Adicionar teste de fumaça dos 9 modelos.
