# Sistema de Audiência de Custódia — 3ª Vara Criminal de Campo Verde/MT

Aplicação React (página única, **100% no navegador**) para gerar termos de
**Audiência de Custódia**:

- **Liberdade Provisória** (4 modelos: padrão, fatos controvertidos, com fiança,
  pequena quantidade/uso compartilhado);
- **Prisão Preventiva** (2 modelos: descumprimento de MPU cronológico, e
  tráfico/complexa com fumus/periculum, celular e incineração);
- **Executivo de Pena / Justificação** (2 modelos: fluido e em tópicos);
- **Cumprimento de Mandado / Prisão Civil** (origem em outra Vara/Comarca).

## Como o texto é gerado

A versão 4.0 substituiu a geração por IA por um **motor de deliberações
determinístico**, montado a partir dos modelos reais da Vara. Isso significa:

- **Sem IA, sem chave de API, sem custo** — o texto é montado instantaneamente
  no navegador a partir dos campos preenchidos;
- **Sem back-end** — não há servidor nem chamadas de rede; pode ser hospedado em
  qualquer serviço de site estático (ex.: Vercel) ou aberto localmente;
- **Previsível** — o mesmo formulário sempre produz o mesmo texto.

## Pré-requisitos

- Node.js 20.6+ (testado com Node 22)

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra http://localhost:5173.

## Produção

```bash
npm run build      # gera dist/
npm run preview    # serve o dist/ localmente para conferência
```

O conteúdo de `dist/` é estático e pode ser publicado diretamente.

## Fluxo de uso

1. **Tipo de Audiência** — escolha o tipo, o sub-modelo de decisão e se é
   plantão judiciário regional (altera fundamentação e assinatura);
2. **Cabeçalho → Informações Processuais** — preencha os dados do BNMP;
3. **Deliberações** — preencha os campos específicos da decisão e clique em
   **"Montar Deliberações"**: o texto completo é gerado na hora (e pode ser
   editado livremente antes de exportar);
4. **Documento Final** — **Copiar com formatação** (cola no Word com tabelas,
   negrito e sublinhado preservados), **Gerar DOCX** ou **Imprimir/Salvar PDF**.

## Formatação do documento

- Fonte **Garamond 13pt**, entrelinha 18pt exata, 12pt após parágrafo,
  justificado;
- Margens A4: Superior **3,95 cm** · Inferior **0,75 cm** · Esquerda **3 cm** ·
  Direita **2 cm**;
- O DOCX é montado por um gerador de ZIP/OOXML puro em JavaScript, sem
  dependências externas.

> **Arquivo único / artefato:** `src/App.jsx` é autossuficiente (importa apenas
> de `react`) e pode ser usado diretamente como artefato do Claude.
