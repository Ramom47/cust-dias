// Importação de processo em PDF → extração de texto (pdfjs, no navegador) →
// estruturação por IA (Claude, via proxy /api/messages) → objeto pronto para
// preencher o formulário.

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const API = "/api/messages";
const MAX_CHARS = 90000; // limite de texto enviado à IA (controla custo/tokens)

// Campos que a IA pode preencher e respectivos valores aceitos (enums).
// Tudo é opcional: a IA deve OMITIR o que não encontrar e nunca inventar.
const ENUMS = {
  tipo: ["LIBERDADE", "PREVENTIVA", "EXECUTIVO"],
  corRaca: ["Branca", "Parda", "Preta", "Amarela", "Indígena"],
  sexo: ["Masculino", "Feminino", "Outro"],
  apos24h: ["Sim", "Não"],
  drogasApreen: ["Sim", "Não"],
  armaFogo: ["Sim", "Não"],
  tortura: ["Sim", "Não"],
  antecedentes: ["Sim", "Não"],
};

// Chaves de texto livre que aceitamos do retorno da IA.
const TEXT_KEYS = [
  "numProcesso", "numAutoMandado", "nomeAutuado", "filiacaoPai", "filiacaoMae",
  "dataNasc", "endereco", "celular", "cpf", "rg", "naturalidade", "nacionalidade",
  "idioma", "crimeImputado", "detalhesDrogas", "detalhesArma",
  "detalhesAntecedentes", "narrativaP",
];

export async function extrairTextoPdf(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let texto = "";
  for (let p = 1; p <= doc.numPages && texto.length < MAX_CHARS; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let last = null, linha = "";
    const linhas = [];
    for (const it of tc.items) {
      const y = it.transform[5];
      if (last !== null && Math.abs(y - last) > 3) { linhas.push(linha); linha = ""; }
      linha += it.str + (it.hasEOL ? "" : " ");
      last = y;
    }
    if (linha) linhas.push(linha);
    texto += `\n\n===== PÁGINA ${p} =====\n` + linhas.join("\n");
  }
  return { texto: texto.slice(0, MAX_CHARS).replace(/[ \t]+/g, " "), paginas: doc.numPages };
}

const SYS =
  "Você é um assistente jurídico que extrai dados de autos de prisão em flagrante, " +
  "boletins de ocorrência circunstanciados e processos criminais para preencher o termo " +
  "de uma audiência de custódia da 3ª Vara Criminal de Campo Verde/MT. " +
  "Responda APENAS com um objeto JSON válido (sem markdown, sem cercas de código, sem comentários). " +
  "Inclua somente os campos que você localizar com segurança; OMITA os demais. " +
  "Nunca invente dados. Não preencha datas/horas da audiência (elas não constam do processo).";

function instrucoesCampos() {
  return [
    "Extraia os dados do processo e devolva um JSON com as chaves (todas opcionais):",
    "- numProcesso: número CNJ do processo (ex.: 0000000-00.0000.8.11.0000)",
    "- numAutoMandado: número do auto/BOC/APF, se houver",
    "- nomeAutuado: nome completo do autuado/indiciado/adolescente, em MAIÚSCULAS",
    "- filiacaoPai, filiacaoMae: nomes dos pais (representante legal costuma ser a mãe)",
    "- dataNasc: data de nascimento no formato AAAA-MM-DD",
    "- endereco: endereço completo (rua, número, bairro, cidade/UF)",
    "- celular: telefone de contato",
    "- cpf, rg: documentos (apenas os números/identificação)",
    "- naturalidade: cidade/UF de nascimento",
    "- nacionalidade, idioma",
    `- corRaca: um de ${ENUMS.corRaca.join(", ")}`,
    `- sexo: um de ${ENUMS.sexo.join(", ")}`,
    "- crimeImputado: artigo e lei (ex.: \"art. 33 da Lei n.º 11.343/2006\")",
    "- drogasApreen: \"Sim\" ou \"Não\"; detalhesDrogas: tipo e quantidade apreendida",
    "- armaFogo: \"Sim\" ou \"Não\"; detalhesArma: descrição da arma apreendida",
    "- antecedentes: \"Sim\" ou \"Não\"; detalhesAntecedentes: resumo",
    "- tortura: \"Sim\" ou \"Não\" (relato/indício de tortura ou maus-tratos)",
    "- narrativaP: resumo objetivo dos fatos concretos (1 a 3 parágrafos), útil para fundamentar a decisão",
    "- tipo: \"LIBERDADE\", \"PREVENTIVA\" ou \"EXECUTIVO\" — apenas se ficar claro; caso contrário, omita",
  ].join("\n");
}

function parseJson(txt) {
  let s = String(txt).trim();
  // remove cercas de código, se a IA as incluir mesmo assim
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i === -1 || j === -1) throw new Error("A IA não retornou um JSON reconhecível.");
  return JSON.parse(s.slice(i, j + 1));
}

// Mantém apenas chaves conhecidas e valores válidos.
function sanitizar(obj) {
  const out = {};
  for (const k of TEXT_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  for (const [k, vals] of Object.entries(ENUMS)) {
    const v = obj[k];
    if (typeof v === "string" && vals.includes(v.trim())) out[k] = v.trim();
  }
  // normaliza data para AAAA-MM-DD se vier em DD/MM/AAAA
  if (out.dataNasc && /^\d{2}\/\d{2}\/\d{4}$/.test(out.dataNasc)) {
    const [d, m, y] = out.dataNasc.split("/");
    out.dataNasc = `${y}-${m}-${d}`;
  }
  // campos derivados
  if (out.detalhesDrogas) out.drogasApreen = out.drogasApreen || "Sim";
  if (out.detalhesArma) out.armaFogo = out.armaFogo || "Sim";
  return out;
}

const MAX_PAGINAS_VISAO = 100; // limite de páginas por PDF na API (visão)
const MAX_BYTES_VISAO = 20 * 1024 * 1024; // mantém o base64 (~1,37x) sob o teto de 32MB da API

// Codifica um ArrayBuffer em base64 sem estourar a pilha (chunks).
function abParaBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Envia o conteúdo (texto ou bloco de documento) à IA e devolve o JSON sanitizado.
async function chamarIA(userContent) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYS,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  let d;
  try {
    d = await r.json();
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${r.status}). Verifique se o proxy (server.js) está em execução.`);
  }
  if (d.error) throw new Error(d.error.message || "Erro na API.");
  if (!Array.isArray(d.content)) throw new Error("Resposta sem conteúdo.");

  return sanitizar(parseJson(d.content.map(b => b.text || "").join("")));
}

// Caminho 1 (barato): texto extraído pelo pdfjs vai como prompt de texto.
async function importarPorTexto(texto) {
  return chamarIA(instrucoesCampos() + "\n\nTEXTO DO PROCESSO:\n" + texto);
}

// Caminho 2 (fallback OCR/visão): o PDF inteiro vai como bloco "document" e o
// Claude lê as páginas como imagem (faz o OCR internamente).
async function importarPorVisao(file, paginas) {
  if (paginas > MAX_PAGINAS_VISAO) {
    throw new Error(`PDF digitalizado com ${paginas} páginas excede o limite de ${MAX_PAGINAS_VISAO} para leitura por imagem. Reduza o arquivo às páginas relevantes (qualificação e auto/BOC).`);
  }
  if (file.size > MAX_BYTES_VISAO) {
    throw new Error("PDF muito grande para leitura por imagem (acima de ~30 MB). Reduza o arquivo.");
  }
  const base64 = abParaBase64(await file.arrayBuffer());
  return chamarIA([
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
    { type: "text", text: instrucoesCampos() },
  ]);
}

// Função principal: recebe o File e devolve { dados, paginas, metodo }.
// Tenta o caminho de texto; se o PDF não tiver texto (digitalizado), cai
// automaticamente para a leitura por imagem (OCR/visão).
export async function importarProcesso(file, { forcarVisao = false } = {}) {
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Selecione um arquivo PDF.");
  }
  const { texto, paginas } = await extrairTextoPdf(file);
  const temTexto = texto.trim() && texto.replace(/[^a-zA-ZÀ-ÿ]/g, "").length >= 50;

  if (temTexto && !forcarVisao) {
    return { dados: await importarPorTexto(texto), paginas, metodo: "texto" };
  }
  // Sem texto utilizável → leitura por imagem (OCR/visão).
  return { dados: await importarPorVisao(file, paginas), paginas, metodo: "visao" };
}
