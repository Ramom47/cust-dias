import { useState, useCallback, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// ── Cliente da API (funciona no artefato do Claude E no app Node) ──────────────
// Tenta o proxy /api/messages (app Node); se ele não existir (artefato), cai
// automaticamente para a chamada direta, autenticada pelo sandbox do artefato.
const PROXY_URL = "/api/messages";
const DIRECT_URL = "https://api.anthropic.com/v1/messages";
const SEM_PROXY = "__SEM_PROXY__";

async function viaProxy(body) {
  let r;
  try {
    r = await fetch(PROXY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch { throw new Error(SEM_PROXY); }
  if (r.status === 404) throw new Error(SEM_PROXY);
  const txt = await r.text();
  let d;
  try { d = JSON.parse(txt); } catch { throw new Error(SEM_PROXY); }
  if (d && d.error) throw new Error(d.error.message || "Erro na API.");
  if (!r.ok) throw new Error(`Erro HTTP ${r.status}.`);
  return d;
}
async function viaDireto(body) {
  const r = await fetch(DIRECT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let d;
  try { d = await r.json(); } catch { throw new Error(`Resposta inválida da API (HTTP ${r.status}).`); }
  if (d && d.error) throw new Error(d.error.message || "Erro na API.");
  if (!r.ok) throw new Error(`Erro HTTP ${r.status}.`);
  return d;
}
async function enviarMensagens(body) {
  try { return await viaProxy(body); }
  catch (e) { if (e && e.message === SEM_PROXY) return await viaDireto(body); throw e; }
}
function textoDaResposta(d) {
  if (!d || !Array.isArray(d.content)) throw new Error("Resposta sem conteúdo de texto.");
  return d.content.map(b => b.text || "").join("");
}

// ── Importação de processo em PDF (sem dependências: o PDF vai como documento) ──
const IMPORT_ENUMS = {
  tipo: ["LIBERDADE", "PREVENTIVA", "EXECUTIVO"],
  corRaca: ["Branca", "Parda", "Preta", "Amarela", "Indígena"],
  sexo: ["Masculino", "Feminino", "Outro"],
  drogasApreen: ["Sim", "Não"], armaFogo: ["Sim", "Não"],
  tortura: ["Sim", "Não"], antecedentes: ["Sim", "Não"],
};
const IMPORT_TEXT_KEYS = [
  "numProcesso", "numAutoMandado", "nomeAutuado", "filiacaoPai", "filiacaoMae",
  "dataNasc", "endereco", "celular", "cpf", "rg", "naturalidade", "nacionalidade",
  "idioma", "crimeImputado", "detalhesDrogas", "detalhesArma", "detalhesAntecedentes", "narrativaP",
];
const IMPORT_SYS =
  "Você é um assistente jurídico que extrai dados de autos de prisão em flagrante, boletins de " +
  "ocorrência e processos criminais para preencher o termo de uma audiência de custódia da 3ª Vara " +
  "Criminal de Campo Verde/MT. Responda APENAS com um objeto JSON válido (sem markdown, sem cercas de " +
  "código, sem comentários). Inclua somente os campos que localizar com segurança; OMITA os demais. " +
  "Nunca invente dados. Não preencha datas/horas da audiência (não constam do processo).";
function importInstrucoes() {
  return [
    "Extraia os dados do processo (texto e imagens) e devolva um JSON com as chaves (todas opcionais):",
    "- numProcesso: número CNJ (ex.: 0000000-00.0000.8.11.0000)",
    "- numAutoMandado: número do auto/BOC/APF",
    "- nomeAutuado: nome completo, em MAIÚSCULAS",
    "- filiacaoPai, filiacaoMae: nomes dos pais (representante legal costuma ser a mãe)",
    "- dataNasc: data de nascimento no formato AAAA-MM-DD",
    "- endereco, celular, cpf, rg",
    "- naturalidade: cidade/UF de nascimento; nacionalidade; idioma",
    `- corRaca: um de ${IMPORT_ENUMS.corRaca.join(", ")}`,
    `- sexo: um de ${IMPORT_ENUMS.sexo.join(", ")}`,
    "- crimeImputado: artigo e lei (ex.: \"art. 33 da Lei n.º 11.343/2006\")",
    "- drogasApreen: \"Sim\"/\"Não\"; detalhesDrogas: tipo e quantidade",
    "- armaFogo: \"Sim\"/\"Não\"; detalhesArma: descrição",
    "- antecedentes: \"Sim\"/\"Não\"; detalhesAntecedentes: resumo",
    "- tortura: \"Sim\"/\"Não\" (relato/indício de tortura ou maus-tratos)",
    "- narrativaP: resumo objetivo dos fatos concretos (1 a 3 parágrafos)",
    "- tipo: \"LIBERDADE\", \"PREVENTIVA\" ou \"EXECUTIVO\" — apenas se ficar claro; senão, omita",
  ].join("\n");
}
function importParseJson(txt) {
  let s = String(txt).trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i === -1 || j === -1) throw new Error("A IA não retornou um JSON reconhecível.");
  return JSON.parse(s.slice(i, j + 1));
}
function importSanitizar(obj) {
  const out = {};
  for (const k of IMPORT_TEXT_KEYS) { const v = obj[k]; if (typeof v === "string" && v.trim()) out[k] = v.trim(); }
  for (const [k, vals] of Object.entries(IMPORT_ENUMS)) { const v = obj[k]; if (typeof v === "string" && vals.includes(v.trim())) out[k] = v.trim(); }
  if (out.dataNasc && /^\d{2}\/\d{2}\/\d{4}$/.test(out.dataNasc)) { const [d, m, y] = out.dataNasc.split("/"); out.dataNasc = `${y}-${m}-${d}`; }
  if (out.detalhesDrogas) out.drogasApreen = out.drogasApreen || "Sim";
  if (out.detalhesArma) out.armaFogo = out.armaFogo || "Sim";
  return out;
}
function fileParaBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(",") + 1)); };
    r.onerror = () => rej(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(file);
  });
}
const IMPORT_MAX_CHARS = 90000;
async function extrairTextoPdf(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let texto = "";
  for (let p = 1; p <= doc.numPages && texto.length < IMPORT_MAX_CHARS; p++) {
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
  return texto.slice(0, IMPORT_MAX_CHARS).replace(/[ \t]+/g, " ");
}
async function importarProcessoPdf(file) {
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("Selecione um arquivo PDF.");
  if (file.size > 20 * 1024 * 1024) throw new Error("PDF muito grande (acima de ~20 MB). Reduza às páginas relevantes.");

  // 1) Extrai o texto no navegador → payload pequeno (cabe nos limites da Vercel).
  let texto = "";
  try { texto = await extrairTextoPdf(file); } catch { texto = ""; }
  const temTexto = texto.replace(/[^a-zA-ZÀ-ÿ]/g, "").length >= 50;

  let content;
  if (temTexto) {
    content = importInstrucoes() + "\n\nTEXTO DO PROCESSO:\n" + texto;
  } else {
    // 2) PDF digitalizado (sem texto): manda o arquivo como documento (OCR/visão),
    //    apenas se for pequeno o bastante para o limite de corpo da Vercel (~4,5 MB).
    if (file.size > 3 * 1024 * 1024)
      throw new Error("PDF digitalizado (sem texto selecionável) e grande demais para leitura automática. Use um PDF com texto ou reduza às páginas relevantes.");
    const base64 = await fileParaBase64(file);
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: importInstrucoes() },
    ];
  }

  const d = await enviarMensagens({
    model: "claude-sonnet-4-6", max_tokens: 2000, system: IMPORT_SYS,
    messages: [{ role: "user", content }],
  });
  return importSanitizar(importParseJson(textoDaResposta(d)));
}

const TIPOS = [
  { v:"LIBERDADE", title:"Liberdade Provisória", sub:"Audiência de Custódia", badge:"bg-emerald-100 text-emerald-800", dot:"bg-emerald-500" },
  { v:"PREVENTIVA", title:"Prisão Preventiva", sub:"Audiência de Custódia", badge:"bg-red-100 text-red-800", dot:"bg-red-500" },
  { v:"EXECUTIVO", title:"Executivo de Pena / Justificação", sub:"Audiência de Custódia", badge:"bg-blue-100 text-blue-800", dot:"bg-blue-500" },
];

const STEPS = [
  {id:0,label:"Tipo de Audiência"},{id:1,label:"Cabeçalho"},
  {id:2,label:"Dados da Audiência"},{id:3,label:"Dados da Pessoa"},
  {id:4,label:"Social e Saúde"},{id:5,label:"Info Processuais"},
  {id:6,label:"Deliberações"},{id:7,label:"Documento Final"},
];

const CONDICOES_ABERTO = [
  "Comparecer ao Fórum para cadastro no sistema SAREF para realização da apresentação mensal em juízo através do celular",
  "Não se ausentar da Comarca por mais de 30 (trinta) dias sem expressa autorização deste Juízo",
  "Comprovar trabalho lícito no prazo de 30 (trinta) dias a contar da data de intimação",
];
const MEDIDAS_OPTS = [
  "Comparecer a todos os atos processuais",
  "Manter atualizado o endereço nos autos",
  "Cumprir integralmente a Medida Protetiva de Urgência em seu desfavor",
  "Proibição de se ausentar da Comarca sem autorização judicial",
  "Proibição de manter contato com a vítima, testemunha ou familiar",
  "Proibição de frequentar lugares especificados",
  "Recolhimento domiciliar noturno e nos dias de folga",
  "Monitoração eletrônica",
];

const INIT = {
  tipo:"",
  numProcesso:"",nomeAutuado:"",dataAudiencia:"",horaAudiencia:"17:00",
  magistrado:"Caroline Schneider Guanaes Simões",cargoMagistrado:"Juíza de Direito",
  promotor:"Arivaldo Guimarães da Costa Junior",
  defensor:"Bruno Cury de Moraes",cargoDefensor:"Defensor Público",
  numAutoMandado:"",apos24h:"Não",motivo24h:"Inaplicável",
  presencial:"Sim",motivoPresencial:"Inaplicável",equipeMulti:"Não",transtorno:"Não",
  filiacaoPai:"",filiacaoMae:"",dataNasc:"",
  endereco:"",celular:"",cpf:"",rg:"",naturalidade:"",
  corRaca:"Parda",sexo:"Masculino",identidadeGenero:"Homem cisgênero",
  orientacaoSexual:"Heterossexual",nacionalidade:"Brasileira",
  idioma:"Português",grauPortugues:"Nativo",precisaTradutor:"Não",irmaoGemeo:"Não",
  doencaGrave:"Não",qualDoenca:"",usoDrogas:"Não",
  escolaridade:"Fundamental",estudando:"Não",situacaoEconomica:"Autônomo",situacaoMoradia:"Própria",
  possuiDependentes:"Não",nomesIdadesDepend:"Prejudicado.",
  armaFogo:"Não",detalhesArma:"",drogasApreen:"Não",detalhesDrogas:"",
  tortura:"Não",exameCorpo:"Não",antecedentes:"Não",detalhesAntecedentes:"",
  deliberacoesTexto:"",
  crimeImputado:"",artFlagrante:"art. 302, II, do Código de Processo Penal",
  mpuDeferidas:"Não",numMPU:"",primario:"Sim",residenciaFixa:"Sim",empregoLicito:"Sim",
  medidasCautelares:["Comparecer a todos os atos processuais","Manter atualizado o endereço nos autos"],
  notificarVitima:"Sim",sistemaBNMP:"PJe",
  artFlagranteP:"art. 302, I, do Código de Processo Penal",
  fundamentoP:"garantia da ordem pública",
  admissibilidadeP:"inciso I (crime doloso punido com pena máxima superior a 4 anos)",
  narrativaP:"",pedidoIncineracao:"Não",pedidoCelular:"Não",
  numPEP:"",regimeAtual:"aberto",motivoRegressao:"",
  enderecoDeclarado:"",justificativaAcolhida:"Sim",
  regimeMantido:"ABERTO",condicoesRegime:[...CONDICOES_ABERTO],
  mesInicio:"",comarcaCumprimento:"Campo Verde/MT",observacoes:"",
};

// ── helpers ──────────────────────────────────────────────────
const fmtD = (s) => { if(!s) return ""; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const fmtExt = (s) => {
  const M = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  if(!s) return ""; const [y,m,d] = s.split("-");
  return `${parseInt(d)} de ${M[parseInt(m)-1]} de ${y}`;
};
const calcAge = (s) => {
  if(!s) return "";
  const b = new Date(s), h = new Date();
  let a = h.getFullYear() - b.getFullYear();
  if(h.getMonth() < b.getMonth() || (h.getMonth() === b.getMonth() && h.getDate() < b.getDate())) a--;
  return isNaN(a) ? "" : `${a} anos`;
};

// Converte **texto** em HTML — retorna STRING (não JSX)
function toHtml(text) {
  return String(text)
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><u>$1</u></strong>")
    .replace(/\*\*([^*]+)\*\*/g, (_, p) => {
      const caps = p === p.toUpperCase() && /[A-ZÁÉÍÓÚÃÕÇÊÂÔ]/.test(p);
      return caps ? `<strong><u>${p}</u></strong>` : `<strong>${p}</strong>`;
    })
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// ── AI deliberações ───────────────────────────────────────────
async function gerarDeliberacoes(form) {
  const base = [
    `Autuado/Reeducando: ${form.nomeAutuado}`,
    `Crime imputado: ${form.crimeImputado || "—"}`,
    `Primário: ${form.primario || "—"}`,
    `Residência fixa: ${form.residenciaFixa || "—"}`,
    `Emprego lícito: ${form.empregoLicito || "—"}`,
    `Antecedentes: ${form.antecedentes === "Sim" ? "Sim – " + form.detalhesAntecedentes : "Não"}`,
    `Drogas apreendidas: ${form.drogasApreen === "Sim" ? "Sim – " + form.detalhesDrogas : "Não"}`,
    `Arma apreendida: ${form.armaFogo === "Sim" ? "Sim – " + form.detalhesArma : "Não"}`,
  ].join("\n");

  let sys = "", usr = "";

  if (form.tipo === "LIBERDADE") {
    sys = "Você é assistente jurídico da 3ª Vara Criminal de Campo Verde/MT. Gere APENAS o texto da decisão (DELIBERAÇÕES) de audiência de custódia com LIBERDADE PROVISÓRIA. Inicie com \"Vistos etc.\" Use **MAIÚSCULAS** para nomes e palavras-chave de decisão (HOMOLOGO, CONCEDO, NOTIFIQUE-SE, EXPEÇA-SE, DETERMINO). Use *texto* para artigos legais em itálico.";
    usr = [
      "Gere decisão de LIBERDADE PROVISÓRIA:", base,
      `Crime (art. e lei): ${form.crimeImputado}`,
      `Flagrante: ${form.artFlagrante}`,
      `MPU: ${form.mpuDeferidas === "Sim" ? "Sim – n.º " + form.numMPU : "Não"}`,
      "Medidas cautelares:", ...(form.medidasCautelares || []).map(m => "- " + m),
      `Notificar vítima: ${form.notificarVitima}`,
      `Sistema: ${form.sistemaBNMP}`,
      form.observacoes ? "Obs: " + form.observacoes : "",
      "", "Siga este modelo:",
      "1. Identificação do crime e indiciado.",
      "2. Fundamentos da audiência (Provimento TJMT/CM n.º 11/2024, ADPF 347, Ofício-Circular n.º 7/2025 CGJ-MT, art. 5º CF, CADH art. 7,5, PIDCP art. 9,3).",
      "3. Verificação das formalidades – **HOMOLOGO** o auto.",
      "4. Texto integral dos arts. 310, 312 e 313 do CPP (transcrever completos, em itálico com *texto*).",
      "5. Análise: primário, residência fixa, emprego → ausência dos requisitos do art. 312.",
      "6. **CONCEDO** liberdade provisória com medidas cautelares do art. 319 CPP (listar numeradas).",
      "7. Se MPU: mencionar cumprimento integral.",
      "8. Notificar vítima se aplicável.",
      "9. **EXPEÇA-SE** alvará de soltura.",
      `10. Lançar no ${form.sistemaBNMP}. Partes intimadas.`,
    ].filter(Boolean).join("\n");
  } else if (form.tipo === "PREVENTIVA") {
    sys = "Você é assistente jurídico da 3ª Vara Criminal de Campo Verde/MT. Gere APENAS o texto da decisão (DELIBERAÇÕES) com PRISÃO PREVENTIVA. Inicie com \"Vistos etc.\" Use **MAIÚSCULAS** para palavras-chave.";
    usr = [
      "Gere decisão de PRISÃO PREVENTIVA:", base,
      `Crime: ${form.crimeImputado}`, `Flagrante: ${form.artFlagranteP}`,
      `Fundamento art. 312: ${form.fundamentoP}`, `Admissibilidade art. 313: ${form.admissibilidadeP}`,
      "Fatos concretos:", form.narrativaP,
      `Incineração de drogas: ${form.pedidoIncineracao}`,
      `Acesso a celular: ${form.pedidoCelular}`,
      form.observacoes ? "Obs: " + form.observacoes : "",
      "", "Siga: (1) Crime e indiciado. (2) Fundamentos da audiência. (3) Nada sobre tortura. (4) Fumus commissi delicti e periculum libertatis. (5) Arts. 312 e 313 CPP em itálico. (6) Análise dos fatos concretos fornecidos. (7) Jurisprudência STJ pertinente. (8) **DECRETO A PRISÃO PREVENTIVA** / **CONVERTO**. (9) Se drogas: art. 50 §3º Lei 11.343/06. (10) Se celular: fundamentação constitucional. (11) **EXPEÇA-SE** mandado – BNMP. Transferência à unidade prisional.",
    ].filter(Boolean).join("\n");
  } else {
    sys = "Você é assistente jurídico da 3ª Vara Criminal de Campo Verde/MT. Gere APENAS o texto da decisão (DELIBERAÇÕES) de EXECUTIVO DE PENA/JUSTIFICAÇÃO. Inicie com \"Vistos etc.\" Use **MAIÚSCULAS** para palavras-chave.";
    const conds = (form.condicoesRegime || []).map((c, i) => ["I","II","III","IV","V"][i] + ") " + c).join("\n");
    usr = [
      "Gere decisão de EXECUTIVO DE PENA/JUSTIFICAÇÃO:",
      `Reeducando: ${form.nomeAutuado}`, `PEP: ${form.numPEP}`, `Regime: ${form.regimeAtual}`,
      `Motivo regressão: ${form.motivoRegressao}`,
      `Endereço declarado: ${form.enderecoDeclarado || form.endereco}`,
      `Justificativa acolhida: ${form.justificativaAcolhida}`,
      `Regime mantido: ${form.regimeMantido}`, "Condições:", conds,
      `Mês início: ${form.mesInicio || "imediatamente"}`, `Comarca: ${form.comarcaCumprimento}`,
      form.observacoes ? "Obs: " + form.observacoes : "",
      "", "Siga: (1) Contexto e regressão cautelar. (2) Descumprimento e decisão anterior. (3) Análise da justificativa (art. 118 §2º LEP). (4) **ACOLHO**. **MANTENHO** no regime **" + form.regimeMantido + "** com condições em negrito numeradas I, II, III. (5) Advertência art. 118 LEP. (6) Comunicar mudança de endereço. (7) **EXPEÇA-SE ALVARÁ DE SOLTURA**. (8) Registro BNMP. (9) **JUNTE-SE** cópia no PEP n.º " + (form.numPEP || "—") + ".",
    ].filter(Boolean).join("\n");
  }

  const d = await enviarMensagens({ model: "claude-sonnet-4-6", max_tokens: 3000, system: sys, messages: [{ role: "user", content: usr }] });
  return textoDaResposta(d);
}

// ── ZIP / DOCX builder (pure browser JS – sem dependências) ──────────
function makeDocx(files) {
  function enc(s) { return new TextEncoder().encode(s); }
  function u16(n) { const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,true); return b; }
  function u32(n) { const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,true); return b; }
  function cat(...a) { const t=a.reduce((s,x)=>s+x.length,0),r=new Uint8Array(t); let o=0; a.forEach(x=>{r.set(x,o);o+=x.length;}); return r; }
  const T=new Int32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[i]=c;}
  function crc(d){let c=-1;for(let i=0;i<d.length;i++)c=(c>>>8)^T[(c^d[i])&0xFF];return(c^-1)>>>0;}
  const LH=[],CD=[]; let off=0;
  for(const {name,data} of files){
    const nm=enc(name), dt=typeof data==='string'?enc(data):data, ck=crc(dt), sz=dt.length;
    const lh=cat(new Uint8Array([0x50,0x4B,0x03,0x04]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(ck),u32(sz),u32(sz),u16(nm.length),u16(0),nm,dt);
    CD.push(cat(new Uint8Array([0x50,0x4B,0x01,0x02]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(ck),u32(sz),u32(sz),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(32),u32(off),nm));
    LH.push(lh); off+=lh.length;
  }
  const cd=cat(...CD);
  const eo=cat(new Uint8Array([0x50,0x4B,0x05,0x06]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(off),u16(0));
  return new Blob([...LH,cd,eo],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

function buildDocxBlob(form) {
  const xe=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const G='Garamond',SZ='26',LINE='360',AFT='240';
  // Margens exatas: Superior 3,95cm | Inferior 0,75cm | Esquerda 3cm | Direita 2cm
  // Em DXA (twips): 1cm ≈ 567 DXA
  const PG_TOP=2240, PG_BOT=425, PG_LEFT=1701, PG_RIGHT=1134, PG_HDR=680, PG_FTR=215;
  const CW=PG_LEFT+PG_RIGHT>0?11906-PG_LEFT-PG_RIGHT:9071; // 11906 - 1701 - 1134 = 9071
  const C1=Math.floor(CW*0.45), C2=CW-C1;
  const BORD='<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  const CMAR='<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>';
  const rpr=({bold=false,underline=false,italic=false}={})=>`<w:rPr><w:rFonts w:ascii="${G}" w:hAnsi="${G}" w:cs="${G}"/>${bold?'<w:b/><w:bCs/>':''}${italic?'<w:i/><w:iCs/>':''}${underline?'<w:u w:val="single"/>':''}<w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/></w:rPr>`;
  const ppr=({align='both',before=0,after=AFT,ind=0,fill=''}={})=>`<w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}" w:line="${LINE}" w:lineRule="exact"/>${ind?`<w:ind w:left="${ind}"/>`:''}${fill?`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`:''}${rpr()}</w:pPr>`;
  const tr=(text,opts={})=>text!=null&&String(text).length?`<w:r>${rpr(opts)}<w:t xml:space="preserve">${xe(text)}</w:t></w:r>`:'';
  const para=(runs,opts={})=>`<w:p>${ppr(opts)}${runs}</w:p>`;
  function parseRuns(text){
    let xml='';const rx=/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;let last=0,m;
    while((m=rx.exec(text))!==null){
      if(m.index>last)xml+=tr(text.slice(last,m.index));
      const s=m[0];
      if(s.startsWith('***'))xml+=tr(s.slice(3,-3),{bold:true,underline:true});
      else if(s.startsWith('**')){const i=s.slice(2,-2);const caps=i===i.toUpperCase()&&/[A-ZÁÉÍÓÚÃÕÇ]/.test(i);xml+=tr(i,{bold:true,underline:caps});}
      else xml+=tr(s.slice(1,-1),{italic:true});
      last=m.index+s.length;
    }
    if(last<text.length)xml+=tr(text.slice(last));
    return xml;
  }
  const mkCell=(cnt,w,{fill='',span=1}={})=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:''}` +
    `<w:tcBorders>${BORD}</w:tcBorders>${fill?`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`:''}${CMAR}</w:tcPr>${cnt}</w:tc>`;
  const mkRow=cells=>`<w:tr>${cells}</w:tr>`;
  const mkTable=(rows,cols)=>{const tot=cols.reduce((a,b)=>a+b,0);return`<w:tbl><w:tblPr><w:tblW w:w="${tot}" w:type="dxa"/><w:tblBorders>${BORD}</w:tblBorders></w:tblPr><w:tblGrid>${cols.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;};
  const secTbl=(title,rows)=>mkTable(mkRow(mkCell(para(tr(title,{bold:true}),{align:'center'}),CW,{fill:'E8E8E8',span:2}))+rows.map(([k,v])=>mkRow(mkCell(para(tr(k,{bold:true})),C1)+mkCell(para(tr(String(v),{bold:true})),C2))).join(''),[C1,C2]);
  const pairTbl=rows=>mkTable(rows.map(([k,v])=>mkRow(mkCell(para(tr(k,{bold:true})),C1)+mkCell(para(tr(String(v),{bold:true})),C2))).join(''),[C1,C2]);

  const isEx=form.tipo==='EXECUTIVO';
  const filiacao=[form.filiacaoPai,form.filiacaoMae].filter(Boolean).join(' E ')||'—';
  const idade=calcAge(form.dataNasc);
  const dnStr=form.dataNasc?`${fmtD(form.dataNasc)}${idade?' ('+idade+')':''}`:'—';
  const docStr=[form.cpf?'CPF: '+form.cpf:'',form.rg?'RG: '+form.rg:''].filter(Boolean).join(' ')||'—';
  const auto=form.numAutoMandado||form.numProcesso||'—';
  const termTitle=isEx?'TERMO DE AUDIÊNCIA DE CUSTÓDIA/JUSTIFICAÇÃO':'TERMO DE AUDIÊNCIA DE CUSTÓDIA';
  const gravacao=`Foi informado que a qualificação do Custodiado e as manifestações do Ministério Público e da Defesa seriam documentadas por sistema audiovisual e que o arquivo digital correspondente seria posteriormente lançado ao ${form.sistemaBNMP||'PJe'}.`;
  const aberturas=isEx
    ?[`Aberta a audiência foi constatada a presença do Reeducando ${form.nomeAutuado}, do Promotor de Justiça e do ${form.cargoDefensor}.`,
      `O reeducando afirmou o seu atual endereço: ${form.enderecoDeclarado||form.endereco} e também afirmou que vai dar início ao cumprimento da condenação em execução no PEP n.º ${form.numPEP||'—'}, em trâmite nesta Comarca.`,
      `O Ministério Público manifestou pelo acolhimento da justificativa apresentada, bem como pugna para que o recuperando dê início ao cumprimento da pena, no regime ${(form.regimeMantido||'aberto').toLowerCase()}.`,
      `A Defesa requereu o acolhimento da justificativa apresentada, mantendo-o no regime ${(form.regimeMantido||'aberto').toLowerCase()}.`,
      'A justificativa apresentada foi gravada, sendo disponibilizada em anexo a esta decisão.']
    :[`Aos ${fmtExt(form.dataAudiencia)||'[DATA]'}, às ${form.horaAudiencia}h, na sala de audiências da 3ª Vara Criminal do Fórum da Comarca de Campo Verde, sob a presidência da MM. ${form.cargoMagistrado}, ${form.magistrado}, nos termos do Provimento TJMT/CM n.º 11, de 21 de maio de 2024, da decisão proferida na Medida Cautelar na ADPF n.º 347, do Supremo Tribunal Federal, bem como do Ofício-Circular n.º 7/2025, da Corregedoria-Geral da Justiça do Estado de Mato Grosso, e com fundamento no artigo 5º, incisos XXXV e LXII, da Constituição da República Federativa do Brasil de 1988; no artigo 7º, item 5, da Convenção Americana sobre Direitos Humanos (Pacto de San José da Costa Rica), promulgada por meio do Decreto Presidencial n.º 678, de 06 de novembro de 1992 e art. 9°, 3, do Pacto Internacional sobre Direitos Civis e Políticos de Nova Iorque, a MM ${form.cargoMagistrado} declarou aberta a presente AUDIÊNCIA DE CUSTÓDIA, com a apresentação do(a) Indiciado(a) que teve a prévia oportunidade de entrevista reservada com a Defesa Técnica.`];
  const deliLines=(form.deliberacoesTexto||'[Deliberações não geradas]').split('\n').filter(l=>l.trim());

  let body='';
  body+=pairTbl([['','ESTADO DE MATO GROSSO  |  PODER JUDICIÁRIO  |  Comarca de Campo Verde – 3ª Vara Criminal']]);
  body+=para(tr(termTitle,{bold:true}),{align:'center'});
  body+=para(tr(form.numProcesso||'[NÚMERO]',{bold:true}),{align:'center'});
  body+=pairTbl([['Autuado/Reeducando:',form.nomeAutuado||'—'],['Presentes:',`${form.magistrado}, ${form.cargoMagistrado} | ${form.promotor}, Ministério Público | ${form.defensor}, ${form.cargoDefensor}`]]);
  aberturas.forEach(p=>{body+=para(tr(p));});
  body+=para(tr('Em seguida, passou-se à análise do evento e à qualificação do(a) indiciado(a), conforme os campos previstos no Formulário do Banco Nacional de Medidas Penais e Prisões (BNMP).'));
  body+=secTbl('DADOS DA AUDIÊNCIA',[['Número Auto/Mandado:',auto],['Audiência realizada após o prazo de 24 horas:',form.apos24h],['Motivo:',form.apos24h==='Sim'?form.motivo24h:'Inaplicável'],['Audiência realizada na modalidade presencial:',form.presencial],['Motivo:',form.presencial==='Não'?form.motivoPresencial:'Inaplicável'],['Entrevista prévia por equipe multidisciplinar:',form.equipeMulti],['Há indícios de transtorno mental/deficiência:',form.transtorno]]);
  body+=secTbl('DADOS DA PESSOA',[['Nome:',form.nomeAutuado||'—'],['Filiação:',filiacao],['Data de Nascimento:',dnStr],['Endereço:',form.endereco||'—'],['Celular:',form.celular||'—'],['Documento:',docStr],['Naturalidade:',form.naturalidade||'—'],['Autodeclaração de cor ou raça:',form.corRaca],['Sexo:',form.sexo],['Autodeclaração da Identidade de Gênero:',form.identidadeGenero],['Autodeclaração da Orientação Sexual:',form.orientacaoSexual],['Nacionalidade:',form.nacionalidade],['Idioma falado:',form.idioma],['Grau de conhecimento da Língua Portuguesa:',form.grauPortugues],['Precisa de tradutor:',form.precisaTradutor],['Possui irmão gêmeo:',form.irmaoGemeo]]);
  body+=secTbl('INFORMAÇÕES SOCIAIS E DE SAÚDE',[['Possui doença grave/crônica:',form.doencaGrave==='Sim'?'Sim: '+form.qualDoenca:'Não'],['Uso abusivo de drogas lícitas ou ilícitas:',form.usoDrogas],['Nível de escolaridade:',form.escolaridade],['Está estudando:',form.estudando],['Situação econômica:',form.situacaoEconomica],['Situação de moradia:',form.situacaoMoradia]]);
  body+=secTbl('FILHOS E DEPENDENTES',[['Possui dependentes:',form.possuiDependentes],['Nomes e Idades:',form.possuiDependentes==='Sim'?form.nomesIdadesDepend:'Prejudicado.']]);
  body+=secTbl('INFORMAÇÕES PROCESSUAIS SOBRE O ATENDIMENTO JUDICIÁRIO',[['Houve apreensão de arma de fogo:',form.armaFogo==='Sim'?'Sim: '+form.detalhesArma:'Não'],['Houve apreensão de drogas:',form.drogasApreen==='Sim'?'Sim: '+form.detalhesDrogas:'Não'],['Houve relato/indício de tortura/maus-tratos:',form.tortura],['Exame de corpo de delito posterior:',form.exameCorpo],['Antecedentes:',form.antecedentes==='Sim'?'Sim: '+form.detalhesAntecedentes:'Não']]);
  body+=para(tr(gravacao));
  body+=para(tr('DELIBERAÇÕES',{bold:true,underline:true}),{align:'center'});
  deliLines.forEach(line=>{body+=para(parseRuns(line));});
  body+=para(tr('Nada mais havendo a consignar, foi lavrado o presente termo, cuja presença das partes está atestada pela gravação audiovisual.',{bold:true}));
  if(isEx){body+=para(tr(form.magistrado,{bold:true}),{align:'center'});body+=para(tr('Juíza de Direito'),{align:'center'});}
  body+=para(tr('Praça dos Três Poderes, n. 01 – Jardim Campo Real – CEP 78.840-000 – Campo Verde/MT – Fone: (66) 3419-2233'),{align:'center'});

  const sectPr=`<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${PG_TOP}" w:right="${PG_RIGHT}" w:bottom="${PG_BOT}" w:left="${PG_LEFT}" w:header="${PG_HDR}" w:footer="${PG_FTR}" w:gutter="0"/></w:sectPr>`;
  const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  return makeDocx([
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:'word/_rels/document.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>'},
    {name:'word/settings.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${NS}><w:defaultTabStop w:val="720"/></w:settings>`},
    {name:'word/styles.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${G}" w:hAnsi="${G}" w:cs="${G}"/><w:sz w:val="${SZ}"/><w:szCs w:val="${SZ}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:jc w:val="both"/><w:spacing w:before="0" w:after="${AFT}" w:line="${LINE}" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`},
    {name:'word/document.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sectPr}</w:body></w:document>`},
  ]);
}

// ── Print / PDF ──────────────────────────────────────────────
function injetarCSS() {
  const id = 'custodia-print-css';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @media print {
      .print-hide { display: none !important; }
      .print-doc  { display: block !important; }
      html, body   { background: white !important; margin: 0; padding: 0; }
      @page {
        size: 21cm 29.7cm portrait;
        margin-top: 3.95cm;
        margin-right: 2cm;
        margin-bottom: 0.75cm;
        margin-left: 3cm;
      }
      #doc-print-wrap { padding: 0; margin: 0; }
    }
    @media screen { .print-doc { display: none; } }
  `;
  document.head.appendChild(s);
}

// ── estilos do preview (formatação exata: Garamond 13pt / 18pt / 12pt) ──────
const DS = { fontFamily: "'EB Garamond','Garamond','Times New Roman',serif", fontSize: "13pt", lineHeight: "18pt", color: "#000", backgroundColor: "#fff", padding: "3.95cm 2cm 0.75cm 3cm", maxWidth: "21cm", margin: "0 auto" };
const PS = { margin: "0 0 12pt 0", textAlign: "justify", fontSize: "13pt", lineHeight: "18pt" };
const TS = { width: "100%", borderCollapse: "collapse", border: "1px solid #666", marginBottom: "12pt" };
const TH = { background: "#e8e8e8", padding: "3px 8px", fontWeight: "bold", textAlign: "center", fontSize: "13pt", lineHeight: "18pt", border: "1px solid #666" };
const TD1 = { padding: "3px 8px", fontWeight: "bold", border: "1px solid #666", fontSize: "13pt", lineHeight: "18pt", verticalAlign: "top", width: "45%" };
const TD2 = { padding: "3px 8px", fontWeight: "bold", border: "1px solid #666", fontSize: "13pt", lineHeight: "18pt", verticalAlign: "top" };

// ── Form components ───────────────────────────────────────────
function Sel({ label, val, opts, onChange, required }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select value={val} onChange={e => onChange(e.target.value)}
        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400">
        {opts.map(o => typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
function Inp({ label, val, onChange, placeholder, required, type = "text" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
    </div>
  );
}
function Txt({ label, val, onChange, rows = 4, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <textarea value={val} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y" />
    </div>
  );
}
function Radio({ label, val, onChange, opts = ["Sim", "Não"] }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="flex gap-3">
        {opts.map(o => (
          <label key={o} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={val === o} onChange={() => onChange(o)} className="accent-amber-500" />
            <span className="text-sm text-slate-700">{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
      {title && <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5"><h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{title}</h3></div>}
      <div className="p-4 grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}
function Full({ children }) { return <div className="col-span-2">{children}</div>; }

// ── Document Preview (Garamond 13pt exacto) ───────────────────
function SecTable({ title, rows }) {
  return (
    <table style={TS}>
      <thead><tr><th colSpan={2} style={TH}>{title}</th></tr></thead>
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i}>
            <td style={TD1}>{k}</td>
            <td style={TD2}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DocPreview({ f }) {
  const isEx = f.tipo === "EXECUTIVO";
  const filiacao = [f.filiacaoPai, f.filiacaoMae].filter(Boolean).join(" E ") || "—";
  const idade = calcAge(f.dataNasc);
  const dnStr = f.dataNasc ? `${fmtD(f.dataNasc)}${idade ? " (" + idade + ")" : ""}` : "—";
  const docStr = [f.cpf ? "CPF: " + f.cpf : "", f.rg ? "RG: " + f.rg : ""].filter(Boolean).join(" ") || "—";
  const auto = f.numAutoMandado || f.numProcesso || "—";
  const gravacao = `Foi informado que a qualificação do Custodiado e as manifestações do Ministério Público e da Defesa seriam documentadas por sistema audiovisual e que o arquivo digital correspondente seria posteriormente lançado ao ${f.sistemaBNMP || "PJe"}.`;
  const termTitle = isEx ? "TERMO DE AUDIÊNCIA DE CUSTÓDIA/JUSTIFICAÇÃO" : "TERMO DE AUDIÊNCIA DE CUSTÓDIA";

  const aberturaParas = isEx
    ? [
        `Aberta a audiência foi constatada a presença do Reeducando ${f.nomeAutuado}, do Promotor de Justiça e do ${f.cargoDefensor}.`,
        `O reeducando afirmou o seu atual endereço: ${f.enderecoDeclarado || f.endereco} e também afirmou que vai dar início ao cumprimento da condenação em execução no PEP n.º ${f.numPEP || "—"}, em trâmite nesta Comarca.`,
        `O Ministério Público manifestou pelo acolhimento da justificativa apresentada, bem como pugna para que o recuperando dê início ao cumprimento da pena, no regime ${(f.regimeMantido || "aberto").toLowerCase()}.`,
        `A Defesa requereu o acolhimento da justificativa apresentada.`,
      ]
    : [
        `Aos ${fmtExt(f.dataAudiencia) || "[DATA]"}, às ${f.horaAudiencia}h, na sala de audiências da 3ª Vara Criminal do Fórum da Comarca de Campo Verde, sob a presidência da MM. ${f.cargoMagistrado}, ${f.magistrado}, nos termos do Provimento TJMT/CM n.º 11, de 21 de maio de 2024, da decisão proferida na Medida Cautelar na ADPF n.º 347, do Supremo Tribunal Federal, bem como do Ofício-Circular n.º 7/2025, da Corregedoria-Geral da Justiça do Estado de Mato Grosso, e com fundamento no artigo 5º, incisos XXXV e LXII, da Constituição da República Federativa do Brasil de 1988; no artigo 7º, item 5, da Convenção Americana sobre Direitos Humanos (Pacto de San José da Costa Rica), promulgada por meio do Decreto Presidencial n.º 678, de 06 de novembro de 1992 e art. 9°, 3, do Pacto Internacional sobre Direitos Civis e Políticos de Nova Iorque, a MM ${f.cargoMagistrado} declarou aberta a presente AUDIÊNCIA DE CUSTÓDIA, com a apresentação do(a) Indiciado(a) que teve a prévia oportunidade de entrevista reservada com a Defesa Técnica.`,
      ];

  const deliLines = (f.deliberacoesTexto || "[Deliberações não geradas]").split("\n").filter(l => l.trim());

  return (
    <div id="doc-preview" style={DS}>
      <table style={TS}>
        <tbody>
          <tr>
            <td style={{ ...TD1, width: "60px", textAlign: "center" }}></td>
            <td style={{ ...TD2, textAlign: "center", lineHeight: "20pt" }}>
              <b>ESTADO DE MATO GROSSO<br />PODER JUDICIÁRIO<br />Comarca de Campo Verde – 3ª Vara Criminal</b>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ ...PS, textAlign: "center", fontWeight: "bold", fontSize: "14pt" }}>{termTitle}</p>
      <p style={{ ...PS, textAlign: "center", fontWeight: "bold" }}>{f.numProcesso}</p>

      <table style={TS}>
        <tbody>
          <tr><td style={TD1}>Autuado/Reeducando:</td><td style={{ ...TD2, fontSize: "14pt" }}><b>{f.nomeAutuado}</b></td></tr>
          <tr><td style={TD1}>Presentes:</td><td style={TD2}>{f.magistrado}, {f.cargoMagistrado} | {f.promotor}, Ministério Público | {f.defensor}, {f.cargoDefensor}</td></tr>
        </tbody>
      </table>

      {aberturaParas.map((p, i) => <p key={i} style={PS}>{p}</p>)}
      <p style={PS}>Em seguida, passou-se à análise do evento e à qualificação do(a) indiciado(a), conforme os campos previstos no Formulário do Banco Nacional de Medidas Penais e Prisões (BNMP).</p>

      <SecTable title="DADOS DA AUDIÊNCIA" rows={[
        ["Número Auto/Mandado:", auto],
        ["Audiência realizada após o prazo de 24 horas:", f.apos24h],
        ["Motivo:", f.apos24h === "Sim" ? f.motivo24h : "Inaplicável"],
        ["Audiência realizada na modalidade presencial:", f.presencial],
        ["Motivo:", f.presencial === "Não" ? f.motivoPresencial : "Inaplicável"],
        ["Entrevista prévia por equipe multidisciplinar:", f.equipeMulti],
        ["Há indícios de transtorno mental/deficiência:", f.transtorno],
      ]} />
      <SecTable title="DADOS DA PESSOA" rows={[
        ["Nome:", f.nomeAutuado || "—"], ["Filiação:", filiacao],
        ["Data de Nascimento:", dnStr], ["Endereço:", f.endereco || "—"],
        ["Celular:", f.celular || "—"], ["Documento:", docStr], ["Naturalidade:", f.naturalidade || "—"],
        ["Autodeclaração de cor ou raça:", f.corRaca], ["Sexo:", f.sexo],
        ["Autodeclaração da Identidade de Gênero:", f.identidadeGenero],
        ["Autodeclaração da Orientação Sexual:", f.orientacaoSexual],
        ["Nacionalidade:", f.nacionalidade], ["Idioma falado:", f.idioma],
        ["Grau de conhecimento da Língua Portuguesa:", f.grauPortugues],
        ["Precisa de tradutor:", f.precisaTradutor], ["Possui irmão gêmeo:", f.irmaoGemeo],
      ]} />
      <SecTable title="INFORMAÇÕES SOCIAIS E DE SAÚDE" rows={[
        ["Possui doença grave/crônica:", f.doencaGrave === "Sim" ? "Sim: " + f.qualDoenca : "Não"],
        ["Uso abusivo de drogas lícitas ou ilícitas:", f.usoDrogas],
        ["Nível de escolaridade:", f.escolaridade], ["Está estudando:", f.estudando],
        ["Situação econômica:", f.situacaoEconomica], ["Situação de moradia:", f.situacaoMoradia],
      ]} />
      <SecTable title="FILHOS E DEPENDENTES" rows={[
        ["Possui dependentes:", f.possuiDependentes],
        ["Nomes e Idades:", f.possuiDependentes === "Sim" ? f.nomesIdadesDepend : "Prejudicado."],
      ]} />
      <SecTable title="INFORMAÇÕES PROCESSUAIS SOBRE O ATENDIMENTO JUDICIÁRIO" rows={[
        ["Houve apreensão de arma de fogo:", f.armaFogo === "Sim" ? "Sim: " + f.detalhesArma : "Não"],
        ["Houve apreensão de drogas:", f.drogasApreen === "Sim" ? "Sim: " + f.detalhesDrogas : "Não"],
        ["Houve relato/indício de tortura/maus-tratos:", f.tortura],
        ["Exame de corpo de delito posterior:", f.exameCorpo],
        ["Antecedentes:", f.antecedentes === "Sim" ? "Sim: " + f.detalhesAntecedentes : "Não"],
      ]} />

      <p style={PS}>{gravacao}</p>
      <p style={{ ...PS, textAlign: "center", fontWeight: "bold", textDecoration: "underline", fontSize: "14pt" }}>DELIBERAÇÕES</p>
      <p style={PS}>{isEx ? "A MM. Juíza proferiu a seguinte decisão:" : "A MM. Juíza proferiu o seguinte despacho:"} &#8220;</p>
      <div style={{ paddingLeft: "1cm" }}>
        {deliLines.map((line, i) => (
          <p key={i} style={PS} dangerouslySetInnerHTML={{ __html: toHtml(line) }} />
        ))}
      </div>
      <p style={{ ...PS, fontWeight: "bold" }}>
        Nada mais havendo a consignar, foi lavrado o presente termo, cuja presença das partes está atestada pela gravação audiovisual.
      </p>
      {isEx && (
        <div style={{ marginTop: "24pt" }}>
          <p style={{ ...PS, textAlign: "center", fontWeight: "bold" }}>{f.magistrado}</p>
          <p style={{ ...PS, textAlign: "center" }}>Juíza de Direito</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16pt" }}>
            <div style={{ textAlign: "center", width: "45%" }}>
              <p style={{ ...PS, fontWeight: "bold" }}>{f.promotor}</p>
              <p style={PS}>Promotor de Justiça</p>
            </div>
            <div style={{ textAlign: "center", width: "45%" }}>
              <p style={{ ...PS, fontWeight: "bold" }}>{f.defensor}</p>
              <p style={PS}>{f.cargoDefensor}</p>
            </div>
          </div>
        </div>
      )}
      <p style={{ ...PS, textAlign: "center", borderTop: "1px solid #000", paddingTop: "6pt", marginTop: "16pt", fontSize: "11pt" }}>
        Praça dos Três Poderes, n. 01 – Jardim Campo Real – CEP 78.840-000 – Campo Verde/MT – Fone: (66) 3419-2233
      </p>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(INIT);
  const [loading, setLoading] = useState(false);

  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [docxUrl, setDocxUrl] = useState('');
  const [docxName, setDocxName] = useState('');
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importInfo, setImportInfo] = useState("");
  const fileRef = useRef(null);

  const set = useCallback((k, v) => setF(p => ({ ...p, [k]: v })), []);
  const tipo = TIPOS.find(t => t.v === f.tipo);

  const LABELS_CAMPOS = {
    numProcesso: "Número do processo", numAutoMandado: "Auto/Mandado",
    nomeAutuado: "Nome", filiacaoPai: "Filiação (pai)", filiacaoMae: "Filiação (mãe)",
    dataNasc: "Data de nascimento", endereco: "Endereço", celular: "Celular",
    cpf: "CPF", rg: "RG", naturalidade: "Naturalidade", nacionalidade: "Nacionalidade",
    idioma: "Idioma", corRaca: "Cor/raça", sexo: "Sexo", crimeImputado: "Crime imputado",
    drogasApreen: "Apreensão de drogas", detalhesDrogas: "Detalhes das drogas",
    armaFogo: "Apreensão de arma", detalhesArma: "Detalhes da arma",
    antecedentes: "Antecedentes", detalhesAntecedentes: "Detalhes dos antecedentes",
    tortura: "Tortura/maus-tratos", narrativaP: "Narrativa dos fatos", tipo: "Tipo de audiência",
  };

  const onImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setImportando(true); setErr(""); setImportInfo("");
    try {
      const dados = await importarProcessoPdf(file);
      const chaves = Object.keys(dados);
      if (!chaves.length) {
        setImportInfo("Nenhum dado pôde ser extraído com segurança deste arquivo.");
      } else {
        setF(p => ({ ...p, ...dados }));
        const nomes = chaves.map(k => LABELS_CAMPOS[k] || k);
        setImportInfo(`✓ ${chaves.length} campo(s) preenchidos a partir do processo: ${nomes.join(", ")}.`);
      }
    } catch (e2) {
      setErr("Falha na importação: " + e2.message);
    } finally {
      setImportando(false);
    }
  };

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&display=swap";
    document.head.appendChild(link);
    injetarCSS();
  }, []);

  const goGen = async () => {
    if (!f.tipo) return;
    setLoading(true); setErr("");
    try {
      const t = await gerarDeliberacoes(f);
      set("deliberacoesTexto", t);
      setStep(7);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const imprimir = () => { window.print(); };

  const copiarComFormatacao = async () => {
    const el = document.getElementById("doc-preview");
    if (!el) return;
    const html = '<html><head><meta charset="utf-8"></head><body>' + el.outerHTML + '</body></html>';
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([el.innerText], { type: 'text/plain' }),
        })
      ]);
    } catch {
      // fallback: selecionar e copiar via execCommand
      try {
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
      } catch(e2) { setErr('Não foi possível copiar: ' + e2.message); return; }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const prepararDocx = async () => {
    setLoadingDocx(true); setErr(''); setDocxUrl('');
    try {
      const blob = buildDocxBlob(f);
      // FileReader converte Blob → data URL (base64) sem precisar de URL.createObjectURL
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      setDocxUrl(dataUrl);
      const nome = (f.nomeAutuado || 'audiencia').replace(/\s+/g, '_').substring(0, 40);
      setDocxName('Termo_' + nome + '.docx');
    } catch(e) { setErr('Erro ao gerar DOCX: ' + e.message); }
    finally { setLoadingDocx(false); }
  };

  const stepContent = () => {
    if (step === 0) return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Tipo de Audiência</h2>
        <p className="text-sm text-slate-500 mb-6">Selecione o tipo de audiência para gerar a minuta correta.</p>
        <div className="grid grid-cols-1 gap-4">
          {TIPOS.map(t => (
            <button key={t.v} onClick={() => set("tipo", t.v)}
              className={`p-5 rounded-xl border-2 text-left transition-all ${f.tipo === t.v ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-300"}`}>
              <div className="flex items-start gap-3">
                <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${t.dot}`} />
                <div>
                  <p className="font-semibold text-slate-800 text-base">{t.title}</p>
                  <p className="text-sm text-slate-500">{t.sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );

    if (step === 1) return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Cabeçalho do Termo</h2>

        <div className="mb-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Importar processo (PDF) e preencher automaticamente</h3>
              <p className="text-xs text-amber-700 mt-0.5">Envie o PDF do auto/BOC/processo. A IA lê o documento (texto e imagens) e preenche os campos: nome, filiação, endereço, CPF/RG, crime, fatos etc.</p>
            </div>
            <label htmlFor="pdf-upload-input" style={{opacity: importando ? 0.5 : 1, cursor: importando ? 'not-allowed' : 'pointer'}}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:opacity-50 flex-shrink-0">
              {importando ? "⟳ Lendo o processo..." : "📎 Selecionar PDF"}
            </label>
            <input ref={fileRef} id="pdf-upload-input" type="file" accept=".pdf,.PDF,application/pdf,application/x-pdf,application/octet-stream" onChange={onImportFile} disabled={importando} className="hidden" />
          </div>
          {importInfo && <p className="mt-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">{importInfo}</p>}
        </div>

        <Card title="Processo">
          <Inp label="Número do Processo" val={f.numProcesso} onChange={v => { set("numProcesso", v); if (!f.numAutoMandado) set("numAutoMandado", v); }} required placeholder="0000000-00.0000.8.11.0000" />
          <Inp label="Nome do Autuado / Reeducando" val={f.nomeAutuado} onChange={v => set("nomeAutuado", v)} required placeholder="NOME COMPLETO EM MAIÚSCULAS" />
          <Inp label="Data da Audiência" val={f.dataAudiencia} onChange={v => set("dataAudiencia", v)} type="date" />
          <Inp label="Hora da Audiência" val={f.horaAudiencia} onChange={v => set("horaAudiencia", v)} type="time" />
        </Card>
        <Card title="Partes">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Magistrado(a)</label>
            <select value={f.magistrado} onChange={e => set("magistrado", e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400">
              {["Caroline Schneider Guanaes Simões", "Maria Lúcia Prati"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <Sel label="Cargo do(a) Magistrado(a)" val={f.cargoMagistrado}
            opts={["Juíza de Direito", "Juiz de Direito", "Juíza de Direito em Substituição Legal", "Juiz de Direito em Substituição Legal"]}
            onChange={v => set("cargoMagistrado", v)} />
          <Full><Inp label="Promotor de Justiça" val={f.promotor} onChange={v => set("promotor", v)} /></Full>
          <Inp label="Defensor" val={f.defensor} onChange={v => set("defensor", v)} />
          <Sel label="Cargo do Defensor" val={f.cargoDefensor}
            opts={["Defensor Público", "Advogado Constituído", "Defensor Público Federal"]}
            onChange={v => set("cargoDefensor", v)} />
        </Card>
      </div>
    );

    if (step === 2) return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Dados da Audiência (BNMP)</h2>
        <Card title="Identificação">
          <Full><Inp label="Número do Auto / Mandado" val={f.numAutoMandado} onChange={v => set("numAutoMandado", v)} placeholder="Deixe em branco para usar o número do processo" /></Full>
        </Card>
        <Card title="Condições da Audiência">
          <Radio label="Realizada após o prazo de 24 horas?" val={f.apos24h} onChange={v => set("apos24h", v)} />
          {f.apos24h === "Sim" && <Full><Inp label="Motivo (atraso 24h)" val={f.motivo24h} onChange={v => set("motivo24h", v)} /></Full>}
          <Radio label="Realizada na modalidade presencial?" val={f.presencial} onChange={v => set("presencial", v)} />
          {f.presencial === "Não" && <Full><Inp label="Motivo (não presencial)" val={f.motivoPresencial} onChange={v => set("motivoPresencial", v)} /></Full>}
          <Radio label="Entrevista prévia por equipe multidisciplinar?" val={f.equipeMulti} onChange={v => set("equipeMulti", v)} />
          <Radio label="Há indícios de transtorno mental / deficiência?" val={f.transtorno} onChange={v => set("transtorno", v)} />
        </Card>
      </div>
    );

    if (step === 3) return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Dados da Pessoa</h2>
        <Card title="Identificação">
          <Inp label="CPF" val={f.cpf} onChange={v => set("cpf", v)} placeholder="000.000.000-00" />
          <Inp label="RG" val={f.rg} onChange={v => set("rg", v)} placeholder="Número RG SSP/MT" />
          <Inp label="Naturalidade" val={f.naturalidade} onChange={v => set("naturalidade", v)} placeholder="Cidade/UF" />
          <div />
          <Full><Inp label="Filiação – Nome do Pai" val={f.filiacaoPai} onChange={v => set("filiacaoPai", v)} placeholder="NOME DO PAI" /></Full>
          <Full><Inp label="Filiação – Nome da Mãe" val={f.filiacaoMae} onChange={v => set("filiacaoMae", v)} placeholder="NOME DA MÃE" /></Full>
        </Card>
        <Card title="Nascimento e Contato">
          <Inp label="Data de Nascimento" val={f.dataNasc} onChange={v => set("dataNasc", v)} type="date" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Idade Calculada</label>
            <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">{calcAge(f.dataNasc) || "—"}</div>
          </div>
          <Full><Inp label="Endereço Completo" val={f.endereco} onChange={v => set("endereco", v)} placeholder="Rua, número, bairro – Cidade/UF" /></Full>
          <Inp label="Celular" val={f.celular} onChange={v => set("celular", v)} placeholder="(66) 99999-9999" />
        </Card>
        <Card title="Perfil Declarado (BNMP)">
          <Sel label="Cor ou raça" val={f.corRaca} opts={["Branca", "Parda", "Preta", "Amarela", "Indígena"]} onChange={v => set("corRaca", v)} />
          <Sel label="Sexo" val={f.sexo} opts={["Masculino", "Feminino", "Outro"]} onChange={v => set("sexo", v)} />
          <Sel label="Identidade de Gênero" val={f.identidadeGenero} opts={["Homem cisgênero", "Mulher cisgênera", "Homem transgênero", "Mulher transgênera", "Não-binário", "Outro"]} onChange={v => set("identidadeGenero", v)} />
          <Sel label="Orientação Sexual" val={f.orientacaoSexual} opts={["Heterossexual", "Homossexual", "Bissexual", "Outro"]} onChange={v => set("orientacaoSexual", v)} />
          <Sel label="Grau de conhecimento do Português" val={f.grauPortugues} opts={["Nativo", "Fluente", "Intermediário", "Básico", "Não fala"]} onChange={v => set("grauPortugues", v)} />
          <Sel label="Idioma" val={f.idioma} opts={["Português", "Espanhol", "Inglês", "Outro"]} onChange={v => set("idioma", v)} />
          <Radio label="Precisa de tradutor?" val={f.precisaTradutor} onChange={v => set("precisaTradutor", v)} />
          <Radio label="Possui irmão gêmeo?" val={f.irmaoGemeo} onChange={v => set("irmaoGemeo", v)} />
        </Card>
      </div>
    );

    if (step === 4) return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Informações Sociais, de Saúde e Dependentes</h2>
        <Card title="Saúde">
          <Radio label="Possui doença grave / crônica?" val={f.doencaGrave} onChange={v => set("doencaGrave", v)} />
          {f.doencaGrave === "Sim" && <Full><Inp label="Qual doença?" val={f.qualDoenca} onChange={v => set("qualDoenca", v)} /></Full>}
          <Radio label="Uso abusivo de drogas lícitas ou ilícitas?" val={f.usoDrogas} onChange={v => set("usoDrogas", v)} />
        </Card>
        <Card title="Situação Social">
          <Sel label="Nível de escolaridade" val={f.escolaridade} opts={["Analfabeto", "Fundamental incompleto", "Fundamental", "Médio incompleto", "Médio", "Superior incompleto", "Superior", "Pós-graduação"]} onChange={v => set("escolaridade", v)} />
          <Radio label="Está estudando?" val={f.estudando} onChange={v => set("estudando", v)} />
          <Sel label="Situação econômica" val={f.situacaoEconomica} opts={["Desempregado", "Empregado CLT", "Autônomo", "Aposentado/Pensionista", "Beneficiário social"]} onChange={v => set("situacaoEconomica", v)} />
          <Sel label="Situação de moradia" val={f.situacaoMoradia} opts={["Própria", "Alugada", "Emprestada", "Sem residência fixa"]} onChange={v => set("situacaoMoradia", v)} />
        </Card>
        <Card title="Filhos e Dependentes">
          <Radio label="Possui dependentes?" val={f.possuiDependentes} onChange={v => set("possuiDependentes", v)} />
          {f.possuiDependentes === "Sim" && <Full><Inp label="Nomes e Idades" val={f.nomesIdadesDepend} onChange={v => set("nomesIdadesDepend", v)} placeholder="João, 5 anos; Maria, 8 anos" /></Full>}
        </Card>
      </div>
    );

    if (step === 5) return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Informações Processuais</h2>
        <Card title="Apreensões">
          <Radio label="Houve apreensão de arma de fogo?" val={f.armaFogo} onChange={v => set("armaFogo", v)} />
          {f.armaFogo === "Sim" && <Full><Inp label="Detalhes da arma" val={f.detalhesArma} onChange={v => set("detalhesArma", v)} /></Full>}
          <Radio label="Houve apreensão de drogas?" val={f.drogasApreen} onChange={v => set("drogasApreen", v)} />
          {f.drogasApreen === "Sim" && <Full><Inp label="Detalhes das drogas" val={f.detalhesDrogas} onChange={v => set("detalhesDrogas", v)} placeholder="Ex: 335,60 kg de cocaína (laudo ID 000000)" /></Full>}
        </Card>
        <Card title="Integridade e Antecedentes">
          <Radio label="Houve relato/indício de tortura ou maus-tratos?" val={f.tortura} onChange={v => set("tortura", v)} />
          <Radio label="Exame de corpo de delito posterior?" val={f.exameCorpo} onChange={v => set("exameCorpo", v)} />
          <Radio label="Possui antecedentes criminais?" val={f.antecedentes} onChange={v => set("antecedentes", v)} />
          {f.antecedentes === "Sim" && <Full><Txt label="Descrição dos antecedentes" val={f.detalhesAntecedentes} onChange={v => set("detalhesAntecedentes", v)} rows={3} /></Full>}
        </Card>
      </div>
    );

    if (step === 6) {
      const dk = f.tipo;
      return (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Dados para a Decisão</h2>
          <p className="text-sm text-slate-500 mb-4">Preencha os elementos específicos. A IA gerará o texto completo das deliberações.</p>

          {dk === "LIBERDADE" && (
            <>
              <Card title="Elementos do Crime e Flagrante">
                <Full><Inp label="Crime imputado (artigo e lei)" val={f.crimeImputado} onChange={v => set("crimeImputado", v)} required placeholder="art. 129, §13º do CP, com incidência da Lei n.º 11.340/06" /></Full>
                <Full><Sel label="Fundamentação do flagrante (CPP)" val={f.artFlagrante} opts={["art. 302, I, do Código de Processo Penal", "art. 302, II, do Código de Processo Penal", "art. 302, III, do Código de Processo Penal", "art. 302, IV, do Código de Processo Penal"]} onChange={v => set("artFlagrante", v)} /></Full>
                <Radio label="Acusado é primário?" val={f.primario} onChange={v => set("primario", v)} />
                <Radio label="Possui residência fixa?" val={f.residenciaFixa} onChange={v => set("residenciaFixa", v)} />
                <Radio label="Possui emprego / ocupação lícita?" val={f.empregoLicito} onChange={v => set("empregoLicito", v)} />
              </Card>
              <Card title="Medidas Protetivas de Urgência">
                <Radio label="Vítima possui MPU deferidas?" val={f.mpuDeferidas} onChange={v => set("mpuDeferidas", v)} />
                {f.mpuDeferidas === "Sim" && <Full><Inp label="Número do processo das MPUs" val={f.numMPU} onChange={v => set("numMPU", v)} placeholder="0000000-00.0000.8.11.0000" /></Full>}
              </Card>
              <div className="bg-white rounded-xl border border-slate-200 mb-4">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5"><h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Medidas Cautelares (art. 319 CPP)</h3></div>
                <div className="p-4 flex flex-col gap-2">
                  {MEDIDAS_OPTS.map(m => (
                    <label key={m} className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={(f.medidasCautelares || []).includes(m)} onChange={e => set("medidasCautelares", e.target.checked ? [...(f.medidasCautelares || []), m] : (f.medidasCautelares || []).filter(x => x !== m))} className="mt-0.5 accent-amber-500" />
                      <span className="text-sm text-slate-700">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Card title="Providências Finais">
                <Radio label="Notificar a vítima da decisão?" val={f.notificarVitima} onChange={v => set("notificarVitima", v)} />
                <Sel label="Sistema para lançamento" val={f.sistemaBNMP} opts={["PJe", "BNMP", "PJe e BNMP"]} onChange={v => set("sistemaBNMP", v)} />
                <Full><Txt label="Observações especiais" val={f.observacoes} onChange={v => set("observacoes", v)} rows={2} /></Full>
              </Card>
            </>
          )}

          {dk === "PREVENTIVA" && (
            <>
              <Card title="Elementos do Crime e Flagrante">
                <Full><Inp label="Crime imputado (artigo e lei)" val={f.crimeImputado} onChange={v => set("crimeImputado", v)} required placeholder="art. 33 da Lei n.º 11.343/2006 (tráfico de drogas)" /></Full>
                <Full><Sel label="Fundamentação do flagrante (CPP)" val={f.artFlagranteP} opts={["art. 302, I, do Código de Processo Penal", "art. 302, II, do Código de Processo Penal", "art. 302, III, do Código de Processo Penal", "art. 302, IV, do Código de Processo Penal"]} onChange={v => set("artFlagranteP", v)} /></Full>
                <Sel label="Fundamento do art. 312 CPP" val={f.fundamentoP} opts={["garantia da ordem pública", "garantia da ordem econômica", "conveniência da instrução criminal", "assegurar a aplicação da lei penal"]} onChange={v => set("fundamentoP", v)} />
                <Sel label="Admissibilidade – art. 313 CPP" val={f.admissibilidadeP} opts={["inciso I (crime doloso punido com pena máxima superior a 4 anos)", "inciso II (reincidente em crime doloso)", "inciso III (violência doméstica – garantir MPU)"]} onChange={v => set("admissibilidadeP", v)} />
              </Card>
              <Card title="">
                <Full><Txt label="Narrativa dos fatos concretos que fundamentam a preventiva" val={f.narrativaP} onChange={v => set("narrativaP", v)} rows={8} placeholder="Descreva: modus operandi, fatos de periculosidade, histórico, drogas/armas etc." /></Full>
              </Card>
              <Card title="Pedidos Incidentais">
                <Radio label="Há pedido de incineração / destruição de drogas?" val={f.pedidoIncineracao} onChange={v => set("pedidoIncineracao", v)} />
                <Radio label="Há pedido de acesso a dados de celular apreendido?" val={f.pedidoCelular} onChange={v => set("pedidoCelular", v)} />
                <Full><Txt label="Observações adicionais" val={f.observacoes} onChange={v => set("observacoes", v)} rows={2} /></Full>
              </Card>
            </>
          )}

          {dk === "EXECUTIVO" && (
            <>
              <Card title="Dados do Executivo de Pena">
                <Inp label="Número do PEP" val={f.numPEP} onChange={v => set("numPEP", v)} required placeholder="0000000-00.0000.8.11.0000" />
                <Sel label="Regime em execução" val={f.regimeAtual} opts={["aberto", "semiaberto", "fechado"]} onChange={v => set("regimeAtual", v)} />
                <Full><Txt label="Motivo da regressão cautelar" val={f.motivoRegressao} onChange={v => set("motivoRegressao", v)} rows={3} placeholder="Ex: não comparecimento mensal..." /></Full>
                <Full><Inp label="Endereço declarado pelo reeducando na audiência" val={f.enderecoDeclarado} onChange={v => set("enderecoDeclarado", v)} /></Full>
              </Card>
              <Card title="Decisão">
                <Radio label="Justificativa acolhida?" val={f.justificativaAcolhida} onChange={v => set("justificativaAcolhida", v)} />
                <Sel label="Regime mantido / destinado" val={f.regimeMantido} opts={["ABERTO", "SEMIABERTO", "FECHADO"]} onChange={v => set("regimeMantido", v)} />
                <Inp label="Mês de início das condições" val={f.mesInicio} onChange={v => set("mesInicio", v)} placeholder="Ex: junho/2026" />
                <Inp label="Comarca / Juízo de cumprimento" val={f.comarcaCumprimento} onChange={v => set("comarcaCumprimento", v)} placeholder="Campo Verde/MT" />
              </Card>
              <div className="bg-white rounded-xl border border-slate-200 mb-4">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5"><h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Condições do Regime</h3></div>
                <div className="p-4 flex flex-col gap-2">
                  {CONDICOES_ABERTO.map((c, i) => (
                    <label key={i} className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={(f.condicoesRegime || []).includes(c)} onChange={e => set("condicoesRegime", e.target.checked ? [...(f.condicoesRegime || []), c] : (f.condicoesRegime || []).filter(x => x !== c))} className="mt-0.5 accent-amber-500" />
                      <span className="text-sm text-slate-700">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Card title=""><Full><Txt label="Observações adicionais" val={f.observacoes} onChange={v => set("observacoes", v)} rows={2} /></Full></Card>
            </>
          )}

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">Deliberações – Texto Gerado pela IA</h3>
            {f.deliberacoesTexto
              ? <Txt label="" val={f.deliberacoesTexto} onChange={v => set("deliberacoesTexto", v)} rows={14} />
              : <p className="text-sm text-amber-700">Clique em &#8220;✦ Gerar Deliberações com IA&#8221; para gerar o texto completo da decisão.</p>}
          </div>
          {err && <p className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{err}</p>}
        </div>
      );
    }

    if (step === 7) return (
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-slate-800">Documento Final</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={copiarComFormatacao}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${copied ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {copied ? "✓ Copiado com formatação!" : "⎘ Copiar com formatação"}
            </button>
            {!docxUrl
              ? <button onClick={prepararDocx} disabled={loadingDocx}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:opacity-50">
                  {loadingDocx ? "⟳ Gerando..." : "📄 Gerar DOCX"}
                </button>
              : <a href={docxUrl} download={docxName}
                  onClick={() => setTimeout(() => setDocxUrl(''), 3000)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer no-underline">
                  ⬇ Clique aqui para baixar o .docx
                </a>
            }
            <button onClick={imprimir}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300">
              🖨 PDF
            </button>
          </div>
        </div>
        {err && <p className="mb-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{err}</p>}
        <div className="bg-slate-100 rounded-xl overflow-auto border border-slate-200">
          <DocPreview f={f} />
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>DOCX:</strong> Garamond 13pt · 18pt exato · 12pt após · Justificado · Margens: Superior 3,95cm · Inferior 0,75cm · Esquerda 3cm · Direita 2cm &nbsp;|&nbsp;
            <strong>Copiar com formatação:</strong> cole diretamente no Word (Ctrl+V) — tabelas, negrito e sublinhado são preservados.
          </p>
        </div>
      </div>
    );

    return null;
  };

  return (
    <>
      {/* Versão impressa (oculta na tela, visível ao imprimir) */}
      <div className="print-doc">
        <div id="doc-print-wrap">
          <DocPreview f={f} />
        </div>
      </div>

      {/* Interface principal (oculta ao imprimir) */}
      <div className="print-hide min-h-screen bg-slate-100 flex">
      <div className="w-56 bg-slate-900 flex-shrink-0 flex flex-col py-6">
        <div className="px-4 mb-6">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">3ª Vara Criminal</p>
          <p className="text-slate-200 text-sm font-semibold">Campo Verde/MT</p>
          {tipo && <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${tipo.badge}`}>{tipo.title}</span>}
        </div>
        <nav className="flex-1 px-2">
          {STEPS.map(s => {
            const done = s.id < step, curr = s.id === step;
            return (
              <button key={s.id} onClick={() => s.id <= step ? setStep(s.id) : null}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 text-left transition-all ${curr ? "bg-amber-500 text-slate-900" : done ? "text-slate-300 hover:bg-slate-800" : "text-slate-500"}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-semibold ${curr ? "bg-amber-900 text-amber-300" : done ? "bg-slate-700 text-amber-400" : "bg-slate-800 text-slate-600"}`}>
                  {done ? "✓" : s.id + 1}
                </span>
                <span className="text-xs">{s.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-4 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">Audiência de Custódia</p>
          <p className="text-xs text-slate-600">v3.1 · Garamond 13pt</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">{stepContent()}</div>
        </div>
        <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <button disabled={step === 0} onClick={() => setStep(s => s - 1)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40">
            ← Voltar
          </button>
          <div className="flex gap-3">
            {step === 6 && (
              <button onClick={goGen} disabled={loading || !f.tipo}
                className="px-5 py-2 text-sm font-semibold bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2">
                {loading ? "⟳ Gerando..." : "✦ Gerar Deliberações com IA"}
              </button>
            )}
            {step < 7 && (
              <button onClick={() => step === 6 ? setStep(7) : setStep(s => s + 1)} disabled={step === 0 && !f.tipo}
                className="px-5 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {step === 6 ? "Ver Documento →" : "Próximo →"}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
