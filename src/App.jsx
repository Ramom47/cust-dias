import { useState, useCallback, useEffect } from "react";

const TIPOS = [
  { v:"LIBERDADE", title:"Liberdade Provisória", sub:"Audiência de Custódia", badge:"bg-emerald-100 text-emerald-800", dot:"bg-emerald-500" },
  { v:"PREVENTIVA", title:"Prisão Preventiva", sub:"Audiência de Custódia", badge:"bg-red-100 text-red-800", dot:"bg-red-500" },
  { v:"EXECUTIVO", title:"Executivo de Pena / Justificação", sub:"Audiência de Custódia", badge:"bg-blue-100 text-blue-800", dot:"bg-blue-500" },
  { v:"CUMPRIMENTO", title:"Cumprimento de Mandado / Prisão Civil", sub:"Origem em outra Vara/Comarca", badge:"bg-purple-100 text-purple-800", dot:"bg-purple-500" },
];

const SUBMODELOS = {
  LIBERDADE: [
    { v:"padrao", label:"Padrão", hint:"Primário, residência fixa e emprego lícito — sem controvérsia fática." },
    { v:"controvertida", label:"Fatos controvertidos", hint:"Dinâmica disputada entre as partes (ex.: agressão mútua)." },
    { v:"fianca", label:"Com fiança", hint:"Liberdade condicionada ao pagamento de fiança." },
    { v:"trafico", label:"Pequena quantidade / uso compartilhado", hint:"Tecnicamente primário(a), cita HC 154.094/RJ." },
  ],
  PREVENTIVA: [
    { v:"cronologica", label:"Descumprimento de MPU", hint:"Narrativa cronológica numerada dos descumprimentos." },
    { v:"complexa", label:"Tráfico de drogas / complexa", hint:"Doutrina fumus/periculum, narrativa policial, celular e incineração." },
  ],
  EXECUTIVO: [
    { v:"fluida", label:"Padrão (regressão cautelar recente)", hint:"Texto fluido — modelo mais atual." },
    { v:"topicos", label:"Justificação formal (DECIDO em tópicos)", hint:"Formato ACOLHER/MANTER/DETERMINO." },
  ],
  CUMPRIMENTO: [
    { v:"padrao", label:"Padrão", hint:"Mandado oriundo de outra Vara/Comarca." },
  ],
};

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
  tipo:"",subModelo:"",plantaoRegional:"Não",
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
  deliberacoesTexto:"",closingType:"gravacao",
  // LIBERDADE (todos os sub-modelos)
  crimeImputado:"",artFlagrante:"art. 302, II, do Código de Processo Penal",
  mpuDeferidas:"Não",numMPU:"",nomeVitima:"",primario:"Sim",residenciaFixa:"Sim",empregoLicito:"Sim",
  medidasCautelares:["Comparecer a todos os atos processuais","Manter atualizado o endereço nos autos"],
  notificarVitima:"Sim",sistemaBNMP:"PJe",
  narrativaControvertida:"",
  fiancaValor:"",fiancaDescricao:"",
  narrativaTrafico:"",oficiarOutroJuizo:"Não",juizoOficio:"",processoOficio:"",
  // PREVENTIVA
  artFlagranteP:"art. 302, I, do Código de Processo Penal",
  fundamentoP:"garantia da ordem pública",
  admissibilidadeP:"inciso I (crime doloso punido com pena máxima superior a 4 anos)",
  narrativaP:"",pedidoIncineracao:"Não",pedidoCelular:"Não",incineracaoResultado:"Indeferido",
  dataMPU:"",condicoesMPU:"",dataIntimacao:"",narrativaCronologica:"",
  fundamentoFinal:"",narrativaPolicial:"",
  // EXECUTIVO
  numPEP:"",regimeAtual:"aberto",motivoRegressao:"",
  enderecoDeclarado:"",justificativaAcolhida:"Sim",dataDecisaoAnterior:"",
  regimeMantido:"ABERTO",condicoesRegime:[...CONDICOES_ABERTO],
  mesInicio:"",comarcaCumprimento:"Campo Verde/MT",observacoes:"",
  // CUMPRIMENTO
  varaOrigem:"",
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

// ════════════════════════════════════════════════════════════════════
// MOTOR DE DELIBERAÇÕES — 100% determinístico, baseado em modelos reais
// Zero chamadas de IA · Zero custo · Texto literal extraído dos modelos
// ════════════════════════════════════════════════════════════════════

// ── Blocos jurídicos literais reutilizados entre modelos ──────────────

const CLAUSULA_DILIGENCIA_PADRAO = (pron) =>
`Diante do determinado pelo Provimento TJMT/CM n.º 11, de 21 de maio de 2024, da decisão proferida na Medida Cautelar na ADPF n.º 347, do Supremo Tribunal Federal, bem como do Ofício-Circular n.º 7/2025, da Corregedoria-Geral da Justiça do Estado de Mato Grosso, e com fundamento no artigo 5º, incisos XXXV e LXII, da Constituição da República Federativa do Brasil de 1988; no artigo 7º, item 5, da Convenção Americana sobre Direitos Humanos (Pacto de San José da Costa Rica), promulgada por meio do Decreto Presidencial n.º 678, de 06 de novembro de 1992 e art. 9°, 3, do Pacto Internacional sobre Direitos Civis e Políticos de Nova Iorque, o autuado foi entrevistado, advindo às manifestações do Ministério Público e da Defesa, não tendo sido verificada circunstâncias não autorizadoras de sua prisão, ilegalidade ou abuso/tortura sofrida por ${pron}.`;

const CLAUSULA_DILIGENCIA_PLANTAO = (pron) =>
`Diante do determinado pelo Provimento n° 12/2017-CM do Egrégio Tribunal de Justiça do Estado de Mato Grosso, e Resolução nº 213 do CNJ, o autuado foi entrevistado, advindo as manifestações do Ministério Público e da Defesa Técnica, não tendo sido verificada quaisquer circunstâncias não autorizadoras de sua prisão, ilegalidade ou abuso/tortura sofrida por ${pron}.`;

const clausulaDiante = (plantao, pron = "ele") =>
  plantao === "Sim" ? CLAUSULA_DILIGENCIA_PLANTAO(pron) : CLAUSULA_DILIGENCIA_PADRAO(pron);

// art. 310 CPP — transcrição integral (itálico no original)
const BLOCO_ART_310 =
`*“Art. 310. Após receber o auto de prisão em flagrante, no prazo máximo de até 24 (vinte e quatro) horas após a realização da prisão, o juiz deverá promover audiência de custódia com a presença do acusado, seu advogado constituído ou membro da Defensoria Pública e o membro do Ministério Público, e, nessa audiência, o juiz deverá, fundamentadamente:*
*I - relaxar a prisão ilegal; ou*
*II - converter a prisão em flagrante em preventiva, quando presentes os requisitos constantes do art. 312 deste Código, e se revelarem inadequadas ou insuficientes as medidas cautelares diversas da prisão; ou*
*III - conceder liberdade provisória, com ou sem fiança.*
*§ 1º Se o juiz verificar, pelo auto de prisão em flagrante, que o agente praticou o fato em qualquer das condições constantes dos incisos I, II ou III do caput do art. 23 do Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal), poderá, fundamentadamente, conceder ao acusado liberdade provisória, mediante termo de comparecimento obrigatório a todos os atos processuais, sob pena de revogação.*
*§ 2º Se o juiz verificar que o agente é reincidente ou que integra organização criminosa armada ou milícia, ou que porta arma de fogo de uso restrito, deverá denegar a liberdade provisória, com ou sem medidas cautelares.*
*§ 3º A autoridade que deu causa, sem motivação idônea, à não realização da audiência de custódia no prazo estabelecido no caput deste artigo responderá administrativa, civil e penalmente pela omissão. (Incluído pela Lei nº 13.964, de 2019)*
*§ 4º Transcorridas 24 (vinte e quatro) horas após o decurso do prazo estabelecido no caput deste artigo, a não realização de audiência de custódia sem motivação idônea ensejará também a ilegalidade da prisão, a ser relaxada pela autoridade competente, sem prejuízo da possibilidade de imediata decretação de prisão preventiva.”*`;

// arts. 312 e 313 CPP — transcrição integral
const BLOCO_ARTS_312_313 =
`*“Art. 312. A prisão preventiva poderá ser decretada como garantia da ordem pública, da ordem econômica, por conveniência da instrução criminal ou para assegurar a aplicação da lei penal, quando houver prova da existência do crime e indício suficiente de autoria e de perigo gerado pelo estado de liberdade do imputado.*
*§ 1º A prisão preventiva também poderá ser decretada em caso de descumprimento de qualquer das obrigações impostas por força de outras medidas cautelares (art. 282, § 4º).*
*§ 2º A decisão que decretar a prisão preventiva deve ser motivada e fundamentada em receio de perigo e existência concreta de fatos novos ou contemporâneos que justifiquem a aplicação da medida adotada.*
*Art. 313. Nos termos do art. 312 deste Código, será admitida a decretação da prisão preventiva:*
*I - nos crimes dolosos punidos com pena privativa de liberdade máxima superior a 4 (quatro) anos;*
*II - se tiver sido condenado por outro crime doloso, em sentença transitada em julgado, ressalvado o disposto no inciso I do caput do art. 64 do Decreto-Lei no 2.848, de 7 de dezembro de 1940 - Código Penal;*
*III - se o crime envolver violência doméstica e familiar contra a mulher, criança, adolescente, idoso, enfermo ou pessoa com deficiência, para garantir a execução das medidas protetivas de urgência;*
*IV - (revogado).*
*§ 1º Também será admitida a prisão preventiva quando houver dúvida sobre a identidade civil da pessoa ou quando esta não fornecer elementos suficientes para esclarecê-la, devendo o preso ser colocado imediatamente em liberdade após a identificação, salvo se outra hipótese recomendar a manutenção da medida.*
*§ 2º Não será admitida a decretação da prisão preventiva com a finalidade de antecipação de cumprimento de pena ou como decorrência imediata de investigação criminal ou da apresentação ou recebimento de denúncia.”*`;

const PARA_310_312_313_INTRO =
`Quanto à necessidade de manutenção do preso no cárcere, é certo que, com o advento da Lei nº 12.403/2011, a prisão em flagrante deixou de ser modalidade de segregação provisória para ter natureza pré-cautelar, efêmera, só subsistindo até a sua apreciação pela Autoridade Judiciária. Por oportuno, destaco o disposto no art. 310 do Código de Processo Penal:`;

const PARA_310_ANALISE =
`Conforme se verifica, ao receber o auto de prisão em flagrante deve o juiz adotar uma das três providências previstas nos incisos I, II e III do art. 310 do Código de Processo Penal, devendo relaxar a prisão em flagrante ilegal, converter a prisão em flagrante em preventiva quando presentes os fundamentos desta e se revelarem inadequadas ou insuficientes as medidas cautelares diversas da prisão, devendo ainda conceder liberdade provisória, com ou sem fiança, quando não for o caso de se converter a prisão em flagrante em preventiva.`;

const PARA_312_313_TRANSICAO =
`In casu, como o flagrante foi homologado, afastada está a adoção da providência prevista no inciso I do art. 310 do Código de Processo Penal, razão pela qual passo a analisar se é o caso de se converter a prisão em flagrante em preventiva ou de se conceder liberdade provisória. Para tanto, inicialmente deve ser analisado se o caso comporta decretação de prisão preventiva, isso porque a Lei nº 12.403/11 também alterou os artigos 312 e 313 do Código de Processo Penal, passando a se exigir os seguintes requisitos para ser possível a decretação da prisão preventiva:`;

const PARA_312_313_SINTESE =
`Conforme se verifica, interpretando sistematicamente os artigos 312 e 313 do Código de Processo Penal, conclui-se que para a decretação da prisão preventiva deve haver prova da existência do crime e indício suficiente de autoria, além de ao menos uma das situações previstas no art. 312 do CPP em concurso com também alguma das situações do art. 313 do Código de Processo Penal.`;

// Bloco fixo de fundamentos comuns às três (310/312/313) — devolve array de parágrafos
function blocoFundamentos312313() {
  return [PARA_310_312_313_INTRO, BLOCO_ART_310, PARA_310_ANALISE, PARA_312_313_TRANSICAO, BLOCO_ARTS_312_313, PARA_312_313_SINTESE];
}

// ── HOMOLOGAÇÃO do auto de prisão em flagrante (parágrafo de abertura) ─
function paraHomologacao(f, pron, art302inciso, contextoPreso) {
  const v = pron === "ela" ? { detido:"detida", flagrado:"flagrada" } : { detido:"detido", flagrado:"flagrado" };
  const crimeTexto = /^(o crime|os crimes)/i.test((f.crimeImputado || "").trim())
    ? f.crimeImputado.trim()
    : `${(f.crimeImputado || "").includes(" e ") ? "os crimes tipificados nos" : "o crime tipificado no"} ${f.crimeImputado || "—"}`;
  return `Vistos etc. Cuida-se de auto de prisão em flagrante que ${pron === "ela" ? "a Indiciada" : "o Indiciado"} **${f.nomeAutuado}**, foi ${v.detido} em estado de flagrância, por haver cometido, segundo a autoridade policial, ${crimeTexto}. ${clausulaDiante(f.plantaoRegional, pron)} Analisando os autos, verifico que a prisão fo${pron === "ela" ? "ra" : "i"} efetuada legalmente, nos termos do art. 302, ${art302inciso}, do Código de Processo Penal, haja vista que ${v.flagrado === "flagrada" ? "a flagranteada foi presa" : "o flagrado foi preso"}, em tese, ${contextoPreso}. Com relação às formalidades para a lavratura do auto de prisão em flagrante, analisando o presente caderno verifico que a autoridade policial observou as garantias legais e constitucionais d${pron === "ela" ? "a conduzida" : "o conduzido"}. Afinal, foi analisada a existência do crime e o estado de flagrância (art. 301 CPP). Além disso, foram observados os direitos constitucionais d${pron === "ela" ? "a presa" : "o preso"} (art. 5º, incisos LXII, LXIII e LXIV da CF/88), procedeu-se à oitiva das testemunhas e ao interrogatório d${pron === "ela" ? "a conduzida" : "o conduzido"} e, por fim, foi entregue a ${pron} a nota de culpa. Não existem, portanto, vícios formais ou materiais que venham a macular a peça, razão pela qual **HOMOLOGO** o auto de prisão em flagrante.`;
}

// ── MEDIDAS CAUTELARES, em lista markdown (linha "- **texto**") ────────
function listaMedidas(lista) {
  return (lista || []).map(m => `- **${m};**`);
}

// ════════════════════════════════════════════════════════════════════
// LIBERDADE PROVISÓRIA — 4 sub-modelos
// ════════════════════════════════════════════════════════════════════

// --- padrão (modelo PAULO HENRIQUE) ------------------------------------
function montarLiberdadePadrao(f) {
  const pron = f.sexo === "Feminino" ? "ela" : "ele";
  const P = [];
  P.push(paraHomologacao(f, pron, f.artFlagrante, "logo após o cometimento do crime mencionado no caderno informativo"));
  P.push(...blocoFundamentos312313());
  const sujeito = pron === "ela" ? "a acusada" : "o acusado";
  P.push(`No caso em tela, tem-se a acusação da prática de ${f.crimeImputado}, cuja pena, cominada, não supera 04 anos.`);
  if (f.mpuDeferidas === "Sim") {
    P.push(`Por sua vez, a vítima **${f.nomeVitima || "—"}** requereu medidas protetivas de urgência, as quais foram deferidas durante plantão judiciário nos autos n.º ${f.numMPU || "—"}.`);
  }
  P.push(`Em liame, verifica-se que ${sujeito} é **${f.primario === "Sim" ? "primário" : "reincidente"}**, o que nessa fase de cognição primária, não resta evidenciado o risco a ordem pública. Por fim, aliado a isso, ressai do caderno processual em exame que o Indiciado informou possuir **${f.residenciaFixa === "Sim" ? "residência fixa" : "residência não comprovada"}** e **${f.empregoLicito === "Sim" ? "emprego lícito" : "ocupação não comprovada"}**, o que, a princípio, não demostra risco ao deslinde da ação penal ou necessidade de assegurar eventual aplicação da lei penal.`);
  P.push(`Desse modo, não vislumbro a necessidade da manutenção de sua prisão como garantia da ordem pública, da ordem econômica, por conveniência da instrução processual ou para assegurar a aplicação da lei penal, não estando presentes, portanto, as hipóteses que autorizam a prisão preventiva, a teor do disposto no artigo 312 do Código de Processo Penal. A jurisprudência, casos tais, assim tem entendido: *“É possível a concessão de liberdade provisória ao agente primário, com profissão definida e residência fixa, por não estarem presentes os pressupostos ensejadores da manutenção da custódia cautelar”* (RJDTACRIM 40/321). Assim, diante das particularidades do caso em tela, nada há a impedir que se lhe conceda a liberdade provisória, desde que impondo-lhe algumas medidas cautelares.`);
  P.push(`Face ao exposto, **CONCEDO** liberdade provisória ao Autuado **${f.nomeAutuado}**, podendo o requerente responder em liberdade, desde que outras razões não venham a justificar a sua segregação, mediante o cumprimento das seguintes medidas cautelares diversas, nos termos do art. 319 do CPP:`);
  P.push(...listaMedidas(f.medidasCautelares));
  if (f.mpuDeferidas === "Sim") P.push(`Deverá ${pron === "ela" ? "a indiciada" : "o indiciado"} cumprir integralmente a Medida Protetiva de Urgência em seu desfavor, nos autos n.º ${f.numMPU || "—"}.`);
  if (f.notificarVitima === "Sim") P.push(`**NOTIFIQUE-SE** a vítima desta decisão, notadamente quanto à concessão da liberdade provisória ao autuado.`);
  P.push(`**EXPEÇA-SE alvará de soltura, devendo o autuado ser colocado em liberdade, se por outro motivo não estiver preso.**`);
  P.push(fechoBNMP(f));
  return P;
}

// --- controvertida (modelo CASSIEL) ------------------------------------
function montarLiberdadeControvertida(f) {
  const pron = f.sexo === "Feminino" ? "ela" : "ele";
  const P = [];
  P.push(paraHomologacao(f, pron, f.artFlagrante, "em contexto imediatamente relacionado ao fato narrado, após acionamento da Polícia Militar para atendimento de ocorrência de violência doméstica, com constatação de lesão aparente na vítima"));
  P.push(...blocoFundamentos312313());
  P.push(`No caso em tela, tem-se a acusação da prática, em tese, do delito de ${f.crimeImputado}, cuja pena máxima supera 04 anos.`);
  P.push(`Entretanto, embora a natureza do delito autorize, em tese, a análise da prisão preventiva, os elementos concretos colhidos nesta fase não evidenciam, por ora, a imprescindibilidade da custódia extrema. ${f.narrativaControvertida || "A ocorrência apresenta dinâmica ainda controvertida quanto à autoria e à dinâmica dos fatos."}`);
  P.push(`Ressai, ainda, que ${pron === "ela" ? "a autuada informou possuir" : "o autuado informou possuir"} ${[f.residenciaFixa === "Sim" ? "residência fixa" : "", f.empregoLicito === "Sim" ? "trabalho lícito" : ""].filter(Boolean).join(" e ") || "vínculos pessoais estáveis"}, não havendo, nos autos, notícia de descumprimento anterior de medidas protetivas, ameaça posterior à intervenção policial, tentativa de fuga ou outro elemento contemporâneo que indique risco concreto à ordem pública, à instrução criminal ou à aplicação da lei penal.`);
  P.push(`De outro lado, considerando a natureza do delito e a necessidade de resguardar a integridade física e psicológica da ofendida, entendo suficientes e adequadas a imposição de medidas cautelares diversas da prisão e de medidas protetivas de urgência, as quais se mostram proporcionais ao caso concreto e capazes de prevenir novo contato conflituoso entre as partes.`);
  P.push(`Desse modo, não vislumbro a necessidade da manutenção de sua prisão como garantia da ordem pública, da ordem econômica, por conveniência da instrução processual ou para assegurar a aplicação da lei penal, não estando presentes, portanto, as hipóteses que autorizam a prisão preventiva, a teor do disposto no artigo 312 do Código de Processo Penal. Assim, diante das particularidades do caso em tela, nada há a impedir que se lhe conceda a liberdade provisória, desde que impondo-lhe medidas cautelares e protetivas. Face ao exposto, **CONCEDO** liberdade provisória a${pron === "ela" ? "" : "o"} indiciad${pron === "ela" ? "a" : "o"} **${f.nomeAutuado}**, podendo responder em liberdade, desde que outras razões não venham a justificar a sua segregação, mediante o cumprimento das seguintes medidas, nos termos do art. 319 do CPP e art. 22 da Lei nº 11.340/06:`);
  P.push(...listaMedidas(f.medidasCautelares));
  P.push(`**ADVERTA-SE** o autuado de que o descumprimento injustificado de qualquer das medidas poderá ensejar a substituição da cautelar, a cumulação com outras medidas ou a decretação da prisão preventiva, nos termos do art. 282, § 4º, do Código de Processo Penal, sem prejuízo da apuração do crime do art. 24-A da Lei nº 11.340/06.`);
  P.push(`**EXPEÇA-SE** alvará de soltura, devendo o autuado ser colocado imediatamente em liberdade, se por outro motivo não estiver preso. Comunique-se a vítima acerca das medidas ora impostas, bem como a autoridade policial competente, para ciência e fiscalização.`);
  P.push(fechoBNMP(f));
  return P;
}

// --- pequena gravidade (HC 154.094/RJ) — usado em fiança e tráfico ----
const PARA_HC154094 =
`Sobre o assunto, trago a baila seguinte jurisprudência: *“(...) 3. A jurisprudência desta Corte possui firme orientação de ser imprescindível à decretação da prisão preventiva a necessária fundamentação, com a indicação precisa, lastreada em fatos concretos, da existência dos motivos ensejadores da constrição cautelar, sendo, em regra, inaceitável, que a só gravidade do crime imputado à pessoa seja suficiente para justificar a sua segregação provisória; não há que se identificar nos elementos que justificam a ação penal (art. 395 do CPP) os que se exigem para excepcionar cautelarmente o status libertatis da pessoa acusada (art. 312 do CPP). 4. Em tema de prisão preventiva, é preciso distinguir e aprofundar a diferença entre os indícios de autoria que justificam a investigação policial ou até mesmo a Ação Penal, daqueles requisitos elencados no Processo Penal como indispensáveis à privação da liberdade da pessoa. (...)”* (HC 154.094/RJ, Rel. Ministro NAPOLEÃO NUNES MAIA FILHO, QUINTA TURMA, julgado em 04/02/2010, DJe 22/02/2010).`;

// --- tráfico/pequena quantidade (modelo MAIARA) ------------------------
function montarLiberdadeTrafico(f) {
  const pron = f.sexo === "Feminino" ? "ela" : "ele";
  const P = [];
  P.push(paraHomologacao(f, pron, f.artFlagrante, "cometendo o crime narrado"));
  P.push(...blocoFundamentos312313());
  P.push(`No caso em tela, tem-se a acusação das práticas dos delitos de ${f.crimeImputado}, cujas penas máximas, mesmo somadas, não superam 04 anos.`);
  P.push(`Entretanto, na forma do precitado art. 313, II e III, do CPP, só em caso de reincidência e, também, no de violência doméstica, para a garantia do cumprimento de medidas protetivas de urgência, é que tal restrição poderia ser imposta ao Indiciado, o que não é o caso dos autos. Dito isso, ressai que ${pron === "ela" ? "a Autuada é **tecnicamente primária**" : "o Autuado é **tecnicamente primário**"}, não registrando maus antecedentes criminais, o que, nessa fase de cognição primária, não resta evidenciado o risco a ordem pública. Aliado a isso, ressai do caderno processual em exame que ${pron === "ela" ? "a Indiciada" : "o Indiciado"} informou possuir **residência fixa**, o que, a princípio, não demostra risco ao deslinde da ação penal ou necessidade de assegurar eventual aplicação da lei penal. ${f.narrativaTrafico || "Por fim, da análise do caso em concreto, não é possível extrair gravidade extrema, além do normalmente previsto no tipo penal analisado, notadamente diante da apreensão de ínfima quantidade de substância entorpecente."}`);
  P.push(`Tais considerações evidenciam que, neste momento processual, a sua custódia corpórea pode ser substituída por medidas cautelares diversas da prisão, para que o Delegado de Polícia dê continuidade às investigações. ${PARA_HC154094}`);
  P.push(`Desse modo, não vislumbro a necessidade da manutenção de sua prisão como garantia da ordem pública, da ordem econômica, por conveniência da instrução processual ou para assegurar a aplicação da lei penal, não estando presentes, portanto, as hipóteses que autorizam a prisão preventiva, a teor do disposto no artigo 312 do Código de Processo Penal. A jurisprudência, casos tais, assim tem entendido: *“É possível a concessão de liberdade provisória ao agente primário, com profissão definida e residência fixa, por não estarem presentes os pressupostos ensejadores da manutenção da custódia cautelar”* (RJDTACRIM 40/321). Assim, diante das particularidades do caso em tela, nada há a impedir que se lhe conceda a liberdade provisória, desde que impondo-lhe algumas medidas cautelares. Face ao exposto, **CONCEDO** liberdade provisória a${pron === "ela" ? "" : "o"} indiciad${pron === "ela" ? "a" : "o"} **${f.nomeAutuado}**, podendo o requerente responder em liberdade, desde que outras razões não venham a justificar a sua segregação, mediante o cumprimento das seguintes medidas cautelares diversas, nos termos do art. 319 do CPP:`);
  P.push(...listaMedidas(f.medidasCautelares));
  if (f.oficiarOutroJuizo === "Sim") {
    P.push(`Sem prejuízo, **DETERMINO** que seja oficiado ${f.juizoOficio || "o juízo competente"}, encaminhando-se cópia integral deste Auto de Prisão em Flagrante, para informar sobre a quebra das medidas cautelares n${f.processoOficio ? "os autos n.º " + f.processoOficio : "o processo de origem"}.`);
  }
  P.push(`**EXPEÇA-SE alvará de soltura, devendo o autuado ser colocado em liberdade, se por outro motivo não estiver preso.**`);
  P.push(fechoBNMP(f));
  return P;
}

// --- fiança (modelo JOSE ORLEI) -----------------------------------------
function montarLiberdadeFianca(f) {
  const pron = f.sexo === "Feminino" ? "ela" : "ele";
  const P = [];
  P.push(paraHomologacao(f, pron, f.artFlagrante, "logo após o cometimento do crime narrado"));
  P.push(...blocoFundamentos312313());
  P.push(`No caso em tela, tem-se a acusação da prática do delito de ${f.crimeImputado}, cuja pena máxima supera 04 anos.`);
  P.push(`Entretanto, na forma do precitado art. 313, II e III, do CPP, só em caso de reincidência e, também, no de violência doméstica, para a garantia do cumprimento de medidas protetivas de urgência, é que tal restrição poderia ser imposta ao Indiciado, o que não é o caso dos autos. Dito isso, ressai que o Autuado é **${f.primario === "Sim" ? "primário" : "reincidente"}**, não restando evidenciado o risco a ordem pública. Aliado a isso, ressai do caderno processual em exame que o Indiciado informou possuir **${[f.residenciaFixa === "Sim" ? "residência fixa" : "", f.empregoLicito === "Sim" ? "emprego lícito" : ""].filter(Boolean).join(" e ")}**, o que, a princípio, não demostra risco ao deslinde da ação penal ou necessidade de assegurar eventual aplicação da lei penal. Por fim, da análise do caso em concreto, não é possível extrair gravidade extrema, além do normalmente previsto no tipo penal analisado, o bastante para decretar a privação de liberdade do autuado, sendo que, neste momento processual, a sua custódia corpórea pode ser substituída por medidas cautelares diversas da prisão, para que o Delegado de Polícia dê continuidade às investigações.`);
  P.push(PARA_HC154094);
  P.push(`Desse modo, não vislumbro a necessidade da manutenção de sua prisão como garantia da ordem pública, da ordem econômica, por conveniência da instrução processual ou para assegurar a aplicação da lei penal, não estando presentes, portanto, as hipóteses que autorizam a prisão preventiva, a teor do disposto no artigo 312 do Código de Processo Penal. A jurisprudência, casos tais, assim tem entendido: *“É possível a concessão de liberdade provisória ao agente primário, com profissão definida e residência fixa, por não estarem presentes os pressupostos ensejadores da manutenção da custódia cautelar”* (RJDTACRIM 40/321). Assim, diante das particularidades do caso em tela, nada há a impedir que se lhe conceda a liberdade provisória, desde que impondo-lhe algumas medidas cautelares. Face ao exposto, **CONCEDO** liberdade provisória ao indiciado **${f.nomeAutuado}**, podendo o requerente responder em liberdade, desde que outras razões não venham a justificar a sua segregação, mediante o cumprimento das seguintes medidas cautelares diversas, nos termos do art. 319 do CPP:`);
  P.push(`- **Pagamento de fiança, fixada no valor de ${f.fiancaDescricao || "—"} (R$ ${f.fiancaValor || "—"});**`);
  P.push(...listaMedidas(f.medidasCautelares));
  P.push(`**Lavrado o termo competente, o valor arbitrado deverá ser depositado em conta judicial vinculada ao processo, expedindo-se, em seguida, o alvará de soltura em favor do flagrado**, colocando-o imediatamente em liberdade, salvo se por outro motivo não tiver que permanecer preso. Anoto que em caso de impossibilidade de pagamento do valor ora arbitrado, deverá o flagranteado comprovar tal condição através de documentos hábeis.`);
  P.push(fechoBNMP(f));
  return P;
}

function fechoBNMP(f) {
  return `Por fim, **DETERMINO** que o presente Auto de Prisão em Flagrante seja lançado no ${f.sistemaBNMP || "BNMP"} (Banco Nacional de Medidas Penais e Prisões), precisamente no evento “Audiência de Custódia e Análise da Prisão”, caso ainda não tenha sido feito. As partes saem intimadas. Aguarde-se a remessa do inquérito policial, no qual deverá ser juntada a cópia desta decisão, arquivando-se o auto de prisão em flagrante em pasta própria. **Cumpra-se, com urgência**. Às providências.”.`;
}

// ════════════════════════════════════════════════════════════════════
// PRISÃO PREVENTIVA — 2 sub-modelos
// ════════════════════════════════════════════════════════════════════

// --- cronológica / descumprimento de MPU (modelo EDGARD) --------------
function montarPreventivaCronologica(f) {
  const pron = f.sexo === "Feminino" ? "ela" : "ele";
  const P = [];
  P.push(paraHomologacao(f, pron, f.artFlagranteP, "cometendo o crime mencionado no caderno informativo"));
  P.push(...blocoFundamentos312313());
  P.push(`No caso em tela, tem-se a acusação da prática de ${f.crimeImputado}, cuja pena é de reclusão e supera 04 anos. Entretanto, conforme permissão do inciso III, do artigo 313 do CPP, é possível a decretação da prisão preventiva em caso de violência doméstica, para assegurar as medidas concedidas em face da vítima. Assim, ainda que não sendo o indiciado reincidente, visando a garantir o cumprimento de medidas protetivas de urgência, é que a prisão preventiva se impõe.`);
  P.push(`A materialidade e os indícios de autoria estão devidamente comprovados.`);
  P.push(`Ressai dos autos que a vítima, ${f.nomeVitima || "—"}, possuía medidas protetivas deferidas em seu favor desde o dia ${fmtD(f.dataMPU) || "—"}, nos autos n.º ${f.numMPU || "—"}. ${f.condicoesMPU || "Tais medidas determinavam expressamente o afastamento e a proibição de contato com a vítima."} ${f.dataIntimacao ? `O indiciado foi devidamente intimado desta decisão em ${fmtD(f.dataIntimacao)}.` : ""}`);
  P.push(`Entretanto, os descumprimentos da medida protetiva que culminaram na prisão do agressor consistiram em um **padrão contínuo de perseguição** conforme a seguinte ordem cronológica dos fatos ocorridos após a sua intimação:`);
  const fatos = (f.narrativaCronologica || "").split("\n").map(l => l.trim()).filter(Boolean);
  fatos.forEach((linha, i) => P.push(`**${i + 1}. ${linha}**`));
  P.push(`O comportamento contumaz do custodiado evidencia que as medidas cautelares diversas da prisão, aplicadas anteriormente, foram absolutamente ineficazes e insuficientes para conter o seu ímpeto persecutório, caracterizando risco real e iminente à integridade física e psicológica da vítima.`);
  P.push(`Desse modo, vislumbro a necessidade da decretação de sua prisão como garantia da ordem pública, principalmente para a segurança da vítima.`);
  P.push(`Ante o exposto, com fundamento no art. 313, III, do Código de Processo Penal, **DECRETO A PRISÃO PREVENTIVA** do Indiciado **${f.nomeAutuado}**.`);
  P.push(`**EXPEÇA-SE** o competente mandado de prisão, o qual deve ser cadastrado no B.N.M.P.`);
  P.push(`**PROCEDA-SE** ao necessário para a transferência do preso a unidade prisional mais próxima desta Comarca. Os presentes saem intimados. Aguarde-se a remessa do inquérito policial. Cumpra-se. Às providências.”.`);
  return P;
}

// --- complexa / fumus-periculum (modelo ERIC MONTEIRO) -----------------
const PARA_FUMUS_PERICULUM =
`De elementar conhecimento que a antecipação cautelar da prisão representa subsídio de natureza instrumental destinado a atuar em favor da atividade desenvolvida no processo criminal. Desse modo, dita providência reveste-se de caráter extraordinário, uma vez que incide sobre a liberdade individual, a cujo respeito, dada a relevância de seu valor, a Carta Magna expressamente dedicou diversos dispositivos (CF/88, art. 5º, XV - liberdade de locomoção; XXXIX - legalidade; XL - irretroatividade da lei penal; XLV - personalização da pena; XLVI - individualização da pena; LVII - presunção de inocência, dentre outros princípios gerais e informadores do processo penal), os quais se traduzem em vetores informativos do Direito Penal, que vinculam a repressão estatal e balizam as decisões judiciais. Nesse contexto, a legitimação da prisão cautelar ou sua manutenção, depende, cumulativamente, da existência do crime e de indícios da autoria, além da presença de qualquer das situações descritas no art. 312 do CPP (garantia da ordem pública, da ordem econômica, conveniência da instrução criminal, ou para assegurar a aplicação da lei penal), afigurando-se indispensável estar fundada em razões idôneas a justificar a adoção dessa medida excepcional de segregação da liberdade, cuja necessidade deve ser verificada no plano concreto. Desta forma, tratando-se de medida cautelar excepcional, a prisão preventiva somente poderá ser decretada ou mantida diante da presença dos pressupostos legais latu sensu, quais sejam: fumus commissi delicti, periculum libertatis, e as condições de admissibilidade. É cediço que o “fumus commissi delicti” encontra-se representado no artigo 312 do estatuto adjetivo penal, pelos pressupostos da prisão preventiva, que são: prova da existência do crime (prova da materialidade delitiva) e indícios suficientes da autoria. Não menos sabido que o ‘periculum libertatis’, por sua vez, está representado também no artigo 312 do CPP, mas através dos fundamentos desse tipo de prisão cautelar, quais sejam: garantia da ordem pública, da ordem econômica, por conveniência da instrução criminal, e/ou para assegurar a aplicação da lei penal.`;

const PARA_CELULAR_JURISPRUDENCIA =
`A questão acerca da verificação de dados existentes no telefone celular apreendido, como, por exemplo, chamadas, mensagens e registros contidos em aplicativos de comunicação, há muito vem sendo debatida e, não raras vezes, decidida de forma diversa, inclusive nas Cortes Superiores, fato que culminou no reconhecimento do tema como repercussão geral (ARE n. 1042075, STF). O entendimento aplicado pelo Supremo Tribunal Federal e Superior Tribunal de Justiça é no sentido de que a simples verificação de dados constantes no aparelho celular apreendido não ofende o direito fundamental previsto no art. 5º, inc. XII, da Constituição Federal, regulamentado pela Lei n. 9.296/96, porquanto: *“o sigilo a que se refere o aludido preceito constitucional é em relação à interceptação telefônica ou telemática propriamente dita, ou seja, é da comunicação de dados, e não dos dados em si mesmos”* (RHC 75.800/PR, rel. Min. Félix Fischer, 5ª Turma, j. 15-9-2016). No mesmo sentido: *“A consulta a dados armazenados em telefones celulares não se confunde com interceptação telefônica, providência essa que demandaria, de fato, a demonstração da impossibilidade de obtenção de outros meios de prova”* (STJ, HC 100.922/SP). Não se reconhece hipótese de fishing expedition, o qual se configura apenas quando a ordem judicial, sem nenhuma justificativa plausível, determina a quebra de sigilo por tempo inexato, completamente dissociada dos fatos e como fruto de mera especulação (TRF4, HC nº 5001417-21.2018.4.04.0000/PR). Acrescenta-se a relevância das circunstâncias do caso versado, notadamente porque há indícios razoáveis de autoria do crime em apuração, havendo necessidade de produção de prova através da extração de dados para dar continuidade às investigações, já que imprescindível à busca de mais provas para comprovação da autoria criminosa. Por fim, ressalta-se que o interesse coletivo de se manter a ordem, paz e segurança social está acima do interesse individual de proteção da privacidade, este catalogado no art. 5º, XII, da Constituição da República.`;

function montarPreventivaComplexa(f) {
  const pron = f.sexo === "Feminino" ? "ela" : "ele";
  const P = [];
  P.push(`Vistos etc. Trata-se de auto de prisão em flagrante lavrado em desfavor de **${f.nomeAutuado}**, o qual foi detido, em tese, pela prática do crime previsto no ${f.crimeImputado}. A prisão em flagrante foi regularmente homologada e, diante do determinado pelo Provimento n° 12/2017-CM do Egrégio Tribunal de Justiça do Estado de Mato Grosso, designou-se a presente audiência de custódia para entrevista da pessoa detida. Na ocasião, nada foi relatado quanto a ocorrência de tortura ou tratamento cruel (art. 1º, I, do Provimento n° 12/2017-CM). Passa-se, pois, à análise dos requisitos para a decretação da prisão preventiva ou concessão da liberdade provisória. É o relato do essencial.`);
  P.push(`**FUNDAMENTO E DECIDO.**`);
  P.push(`**I – DA DECRETAÇÃO DA PRISÃO PREVENTIVA OU CONCESSÃO DA LIBERDADE PROVISÓRIA.**`);
  P.push(PARA_FUMUS_PERICULUM);
  P.push(BLOCO_ARTS_312_313);
  P.push(`No caso dos autos, dada a pena máxima do crime supostamente praticado pelo indiciado, tem-se pena superior a 04 (quatro) anos. Tal circunstância permite a decretação da preventiva, desde que presente um dos requisitos previstos no art. 312 do CPP.`);
  P.push(`Em relação a ditos requisitos, ${f.fundamentoFinal || "tem-se, na conduta do indiciado, motivo bastante para a decretação da segregação cautelar."}`);
  if (f.narrativaPolicial && f.narrativaPolicial.trim()) {
    P.push(`Ademais, importante registrar que, de acordo com o boletim de ocorrência policial: “${f.narrativaPolicial.trim()}”`);
  }
  P.push(`Ante o exposto, presentes a prova da existência do crime e indícios suficientes de autoria, bem como as condições de admissibilidade da prisão (art. 313, do CPP), e os requisitos do artigo 312 do Código de Processo Penal, **CONVERTO** a prisão em flagrante de **${f.nomeAutuado}** em preventiva, para garantir a ordem pública.`);

  if (f.pedidoCelular === "Sim") {
    P.push(`**II – DA ANÁLISE DA REPRESENTAÇÃO PELA BUSCA EXPLORATÓRIA EM APARELHO CELULAR.**`);
    P.push(PARA_CELULAR_JURISPRUDENCIA);
    P.push(`Diante do exposto, **DEFIRO** a representação policial por quebra de sigilo do(s) aparelho(s) telefônico(s) apreendido(s) com ${pron === "ela" ? "a representada" : "o representado"} **${f.nomeAutuado}**, e, por consequência, **AUTORIZO** a Autoridade Policial e/ou a POLITEC o amplo acesso a todos os dados/informações neles contidos/gravados (imagens, vídeos, registros de ligações, mensagens de texto, acesso a aplicativos de comunicação e suas mensagens de texto e voz, tais como WhatsApp, Telegram, Skype, Facebook Messenger, dentre outros), inclusive os dados armazenados na nuvem dos aparelhos, que sejam ou possam vir a ser de interesse das investigações em andamento.`);
  }

  if (f.pedidoIncineracao === "Sim") {
    P.push(`**${f.pedidoCelular === "Sim" ? "III" : "II"} – DA ANÁLISE DO PEDIDO PELA INCINERAÇÃO DOS ENTORPECENTES APREENDIDOS.**`);
    P.push(`A Autoridade Policial, ao comunicar o flagrante, solicitou a certificação da regularidade formal do laudo de constatação e a determinação da destruição das drogas apreendidas, com a ressalva de que fossem guardadas amostras necessárias à realização do laudo definitivo, conforme o art. 50, § 3º, da Lei 11.343/06.`);
    if (f.incineracaoResultado === "Deferido") {
      P.push(`Analisando os documentos que instruem o presente Auto de Prisão em Flagrante, verifica-se a existência de Laudo de Perícia Criminal de Constatação de Droga regular, com amostra reservada para exame definitivo, nos termos do art. 50, § 3º, da Lei 11.343/06. Desta forma, **DEFIRO** o pedido de incineração das drogas apreendidas, observada a preservação de amostra para o laudo pericial definitivo.`);
    } else {
      P.push(`Embora a Lei nº 11.343/2006 permita a incineração das drogas após a lavratura do auto de prisão em flagrante e a apreensão, garantida a colheita de amostra para a realização do laudo definitivo, é imprescindível que o Juízo se cerque de toda cautela processual. A destruição prematura do material probatório, antes de concluído o procedimento pericial definitivo, poderia fragilizar a prova que embasará a futura Ação Penal. Desta forma, **INDEFIRO** o pedido de incineração neste momento processual. A destruição somente será autorizada após a juntada aos autos e a devida homologação judicial do Laudo Pericial Definitivo, garantindo assim a preservação dos elementos de convicção necessários à instrução criminal plena.`);
    }
  }

  P.push(`**EXPEÇA-SE** o competente mandado de prisão, cadastrando-o no BNMP. **DETERMINO** que a Autoridade Policial acoste aos autos os respectivos laudos de exame de corpo de delito no prazo de 24 (vinte e quatro) horas. Aguarde-se a remessa do inquérito policial, no qual deverá ser juntada a cópia desta decisão, arquivando-se o auto de prisão em flagrante em pasta própria. **CUMPRA-SE** com urgência, inclusive no plantão judicial, caso necessário. Os presentes saem intimados”.`);
  return P;
}

// ════════════════════════════════════════════════════════════════════
// EXECUTIVO DE PENA / JUSTIFICAÇÃO — 2 sub-modelos
// ════════════════════════════════════════════════════════════════════

// --- fluida (modelo JEFERSON BRAZ) --------------------------------------
function montarExecutivoFluida(f) {
  const P = [];
  P.push(`Vistos etc. No caso dos autos o reeducando teve decretada a regressão cautelar, suspendendo o regime de cumprimento da pena no ${(f.regimeAtual || "aberto")}, por não ter sido localizado para dar início ao cumprimento da reprimenda. O apenado informou o seu atual endereço: **${f.enderecoDeclarado || f.endereco}** e se comprometeu em dar cumprimento à pena, atentando-se às condições impostas. Assim, mantenho-o no regime **${(f.regimeMantido || "ABERTO").toUpperCase()}**.`);
  P.push(`O reeducando foi devidamente advertido a dar início ao cumprimento das condições fixadas, no regime **${(f.regimeMantido || "ABERTO").toUpperCase()}**, o que deve ser feito a partir do mês de ${f.mesInicio || "imediatamente"}, observando, rigorosamente, as condições estabelecidas:`);
  const numerais = ["I", "II", "III", "IV", "V", "VI"];
  (f.condicoesRegime || []).forEach((c, i) => P.push(`**${numerais[i] || (i + 1)}) ${c};**`));
  P.push(`As condições acima expostas deverão ser integralmente obedecidas até o cumprimento total da pena em que o apenado foi condenado.`);
  P.push(`Advirto ao recuperando que o descumprimento das condições e requisitos exigidos e impostos para o regime ${(f.regimeMantido || "aberto").toLowerCase()} autorizará a regressão para o regime mais rigoroso, a teor do art. 118 da LEP.`);
  P.push(`Outrossim, em caso de mudança de endereço e/ou dados pessoais (ex.: telefone) existentes no processo deverá ser imediatamente comunicado nos autos, sob pena de serem considerados como válidos aquele anteriormente declarados pelo recuperando.`);
  P.push(`**EXPEÇA-SE ALVARÁ DE SOLTURA em favor do apenado, colocando-o imediatamente em liberdade, salvo se por outro motivo não tiver que permanecer preso.**`);
  P.push(`O alvará de soltura deve ser registrado no BNMP.`);
  P.push(`POR FIM, **JUNTE-SE** CÓPIA DA PRESENTE ATA NO EXECUTIVO DE PENA DE Nº **${f.numPEP || "—"}**.`);
  P.push(`Os presentes saem intimados. Cumpra-se. Às providências.”.`);
  return P;
}

// --- tópicos / legado (modelo JOSÉ SEBASTIÃO) ---------------------------
function montarExecutivoTopicos(f) {
  const P = [];
  P.push(`Vistos etc. Trata-se de processo de execução penal do reeducando **${f.nomeAutuado}**, o qual cumpria pena no regime ${(f.regimeAtual || "aberto")}. ${f.motivoRegressao || "O reeducando deixou de dar cumprimento ao regime, não tendo sido localizado para retomar o cumprimento da pena."}`);
  if (f.dataDecisaoAnterior) {
    P.push(`Em decisão datada de ${fmtD(f.dataDecisaoAnterior)}, este Juízo acolheu o pleito ministerial, determinando a suspensão cautelar do regime e expedindo mandado de prisão, condicionando a análise de regressão definitiva à realização de audiência de justificação posterior à captura.`);
  }
  P.push(`A regressão cautelar se deu em razão de descumprimento das condições estabelecidas para o cumprimento da pena no regime ${(f.regimeAtual || "aberto")}, notadamente o comparecimento em Juízo.`);
  P.push(`Embora o descumprimento seja inequivocamente uma infração das condições expressamente impostas, a regressão definitiva (sanção mais grave) deve ser avaliada com base no princípio da proporcionalidade e na finalidade da execução penal, que busca a reintegração social do condenado.`);
  P.push(`O objetivo da audiência de justificação, conforme o art. 118, § 2º, da LEP, é proporcionar ao apenado o exercício do contraditório e da ampla defesa antes que a regressão seja tornada definitiva, permitindo ao Juízo avaliar as razões do descumprimento.`);
  if (f.justificativaAcolhida === "Sim") {
    P.push(`Como a justificativa apresentada mostra-se plausível, afasta-se a configuração de falta grave, não havendo substrato legal para a regressão definitiva do apenado a regime mais gravoso.`);
    P.push(`Assim, neste momento processual e em nome do princípio da individualização da pena e dos objetivos da execução penal (art. 1º da LEP), **ACOLHO** a justificativa apresentada pela Defesa e entendo que a sanção máxima de regressão definitiva é desproporcional à falta verificada. É imperativo manter o regime ${(f.regimeMantido || "ABERTO").toLowerCase()}.`);
  } else {
    P.push(`Não obstante os argumentos apresentados, a justificativa não se mostra suficiente para afastar a configuração de falta grave, mantendo-se hígidos os fundamentos da regressão cautelar até ulterior deliberação.`);
  }
  P.push(`Pelo exposto, com fundamento no art. 118, I e § 2º da Lei de Execução Penal (LEP), **DECIDO**:`);
  P.push(`- **ACOLHER** a justificativa apresentada pel${f.sexo === "Feminino" ? "a reeducanda" : "o reeducando"}${f.comarcaCumprimento ? ", devendo comparecer em juízo mensalmente na cidade de " + f.comarcaCumprimento + "." : "."}`);
  P.push(`- **MANTER** ${f.sexo === "Feminino" ? "a reeducanda" : "o reeducando"} no **REGIME ${(f.regimeMantido || "ABERTO").toUpperCase()}**, sob os seguintes termos:`);
  const numerais = ["I", "II", "III", "IV", "V", "VI"];
  (f.condicoesRegime || []).forEach((c, i) => P.push(`**${numerais[i] || (i + 1)}). ${c};**`));
  P.push(`-   **DETERMINO** a imediata expedição de **ALVARÁ DE SOLTURA**, **colocando-o em liberdade, se por outro motivo não estiver preso**, (devendo ser entregue cópia ao mesmo).`);
  if (f.comarcaCumprimento) P.push(`**Com a informação do novo endereço na cidade de ${f.comarcaCumprimento}, encaminhe-se o executivo de pena.**`);
  P.push(`O alvará de soltura deve ser registrado no BNMP.`);
  P.push(`Cumpra-se com urgência, expedindo-se o necessário.`);
  P.push(`*Os presentes saem intimados. Cumpra-se. Às providências.”.*`);
  return P;
}

// ════════════════════════════════════════════════════════════════════
// CUMPRIMENTO DE MANDADO DE PRISÃO / PRISÃO CIVIL (modelo THIAGO)
// ════════════════════════════════════════════════════════════════════
function montarCumprimentoMandado(f) {
  const pron = f.sexo === "Feminino" ? "ela" : "ele";
  const P = [];
  P.push(`Vistos etc. Cuida-se de comunicação de cumprimento de mandado de prisão, expedido em face de **${f.nomeAutuado}**, oriundo ${f.varaOrigem || "de outro Juízo"}. ${CLAUSULA_DILIGENCIA_PADRAO(pron)}`);
  P.push(`Dessa forma, **OFICIE-SE** a${f.varaOrigem ? f.varaOrigem.replace(/^d[aeo]\s*/i, " ") : " o Juízo de origem"}, prestando-lhe as devidas informações acerca da prisão, COM URGÊNCIA, encaminhando o presente termo e a mídia da audiência.`);
  P.push(`**DETERMINO** que em relação ao presente Cumprimento de Mandado de Prisão seja lançada a certidão do cumprimento no BNMP.`);
  P.push(`**PROCEDA-SE** ao necessário para a transferência do preso a unidade prisional mais próxima desta Comarca.`);
  P.push(`Nada mais havendo a ser deliberado, **ARQUIVEM-SE** os autos, com as baixas e anotações de estilo. Os presentes saem intimados. Cumpra-se. Às providências.”.`);
  return P;
}

// ════════════════════════════════════════════════════════════════════
// (fmtD já está definido mais acima, no bloco de helpers principal)
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// DISPATCHER — síncrono, zero rede, zero custo
// ════════════════════════════════════════════════════════════════════
function montarDeliberacoes(f) {
  let paras = [];
  if (f.tipo === "LIBERDADE") {
    if (f.subModelo === "controvertida") paras = montarLiberdadeControvertida(f);
    else if (f.subModelo === "fianca") paras = montarLiberdadeFianca(f);
    else if (f.subModelo === "trafico") paras = montarLiberdadeTrafico(f);
    else paras = montarLiberdadePadrao(f);
  } else if (f.tipo === "PREVENTIVA") {
    paras = f.subModelo === "complexa" ? montarPreventivaComplexa(f) : montarPreventivaCronologica(f);
  } else if (f.tipo === "EXECUTIVO") {
    paras = f.subModelo === "topicos" ? montarExecutivoTopicos(f) : montarExecutivoFluida(f);
  } else if (f.tipo === "CUMPRIMENTO") {
    paras = montarCumprimentoMandado(f);
  }
  return paras.filter(Boolean).join("\n");
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
  const closing = form.closingType || 'gravacao';
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
  if(form.plantaoRegional==='Sim'){body+=para(tr('PLANTÃO JUDICIÁRIO REGIONAL',{bold:true}),{align:'center'});}
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
  if(deliLines.length===0){
    const lbl=(isEx?'A MM. Juíza proferiu a seguinte decisão: ':'A MM. Juíza proferiu o seguinte despacho: ')+'\u201C[Deliberações não geradas]\u201D';
    body+=para(tr(lbl));
  } else {
    deliLines.forEach((line,i)=>{
      const isFirst=i===0, isLast=i===deliLines.length-1;
      const prefix=isFirst?(isEx?'A MM. Juíza proferiu a seguinte decisão: ':'A MM. Juíza proferiu o seguinte despacho: ')+'\u201C':'';
      const suffix=isLast?'\u201D':'';
      body+=para(tr(prefix)+parseRuns(line)+tr(suffix));
    });
  }
  const fraseFechamento = closing === 'completo'
    ? 'Nada mais havendo a consignar, foi lavrado o presente termo, que vai assinado pelos presentes.'
    : 'Nada mais havendo a consignar, foi lavrado o presente termo, cuja presença das partes está atestada pela gravação audiovisual.';
  body+=para(tr(fraseFechamento,{bold:true}));
  if(closing!=='gravacao'){
    body+=para(tr(form.magistrado,{bold:true}),{align:'center'});
    body+=para(tr(form.cargoMagistrado),{align:'center'});
    if(closing==='completo'){
      body+=pairTbl([[`${form.promotor}\nPromotor de Justiça`,`${form.defensor}\n${form.cargoDefensor}`]]);
    }
  }
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
  const closing = f.closingType || "gravacao";
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
  const fraseFechamento = closing === "completo"
    ? "Nada mais havendo a consignar, foi lavrado o presente termo, que vai assinado pelos presentes."
    : "Nada mais havendo a consignar, foi lavrado o presente termo, cuja presença das partes está atestada pela gravação audiovisual.";

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
      {f.plantaoRegional === "Sim" && <p style={{ ...PS, textAlign: "center", fontWeight: "bold" }}>PLANTÃO JUDICIÁRIO REGIONAL</p>}
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
      <div style={{ paddingLeft: "1cm" }}>
        {deliLines.length === 0
          ? <p style={PS}>{(isEx ? "A MM. Juíza proferiu a seguinte decisão: " : "A MM. Juíza proferiu o seguinte despacho: ")}&#8220;[Deliberações não geradas — volte ao passo anterior e clique em "Montar Deliberações"]&#8221;</p>
          : deliLines.map((line, i) => {
              const isFirst = i === 0, isLast = i === deliLines.length - 1;
              const prefix = isFirst ? (isEx ? "A MM. Juíza proferiu a seguinte decisão: " : "A MM. Juíza proferiu o seguinte despacho: ") + "\u201C" : "";
              const suffix = isLast ? "\u201D" : "";
              return <p key={i} style={PS} dangerouslySetInnerHTML={{ __html: toHtml(prefix + line + suffix) }} />;
            })}
      </div>
      <p style={{ ...PS, fontWeight: "bold" }}>{fraseFechamento}</p>
      {closing !== "gravacao" && (
        <div style={{ marginTop: "24pt" }}>
          <p style={{ ...PS, textAlign: "center", fontWeight: "bold" }}>{f.magistrado}</p>
          <p style={{ ...PS, textAlign: "center" }}>{f.cargoMagistrado}</p>
          {closing === "completo" && (
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
          )}
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

  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [docxUrl, setDocxUrl] = useState('');
  const [docxName, setDocxName] = useState('');
  const [loadingDocx, setLoadingDocx] = useState(false);

  const set = useCallback((k, v) => setF(p => ({ ...p, [k]: v })), []);
  const tipo = TIPOS.find(t => t.v === f.tipo);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&display=swap";
    document.head.appendChild(link);
    injetarCSS();
  }, []);

  const montar = () => {
    if (!f.tipo) return;
    setErr("");
    try {
      const t = montarDeliberacoes(f);
      if (!t || !t.trim()) throw new Error("Não foi possível montar o texto. Confira os campos preenchidos no passo anterior.");
      const isPlantaoFamily = (f.tipo === "LIBERDADE" || f.tipo === "PREVENTIVA") && f.plantaoRegional === "Sim";
      const isSubstituicao = (f.cargoMagistrado || "").toLowerCase().includes("substituição legal");
      let closingType = "gravacao";
      if (f.tipo === "CUMPRIMENTO") closingType = "juiza_apenas";
      else if (isSubstituicao) closingType = "completo";
      else if (isPlantaoFamily) closingType = "juiza_apenas";
      else if (f.tipo === "EXECUTIVO") closingType = "gravacao";
      set("closingType", closingType);
      set("deliberacoesTexto", t);
      setStep(7);
    } catch (e) { setErr(e.message); }
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
            <button key={t.v} onClick={() => { set("tipo", t.v); set("subModelo", (SUBMODELOS[t.v] || [])[0]?.v || ""); }}
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

        {f.tipo && (SUBMODELOS[f.tipo] || []).length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Modelo de Decisão</h3>
            <div className="grid grid-cols-1 gap-2">
              {SUBMODELOS[f.tipo].map(sm => (
                <button key={sm.v} onClick={() => set("subModelo", sm.v)}
                  className={`p-3 rounded-lg border text-left transition-all ${f.subModelo === sm.v ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-300"}`}>
                  <p className="text-sm font-medium text-slate-800">{sm.label}</p>
                  <p className="text-xs text-slate-500">{sm.hint}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {f.tipo && (f.tipo === "LIBERDADE" || f.tipo === "PREVENTIVA" || f.tipo === "CUMPRIMENTO") && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
            <Radio label="Audiência realizada em plantão judiciário regional?" val={f.plantaoRegional} onChange={v => set("plantaoRegional", v)} />
            <p className="text-xs text-slate-400 mt-1">Altera a fundamentação (Provimento 11/2024 x Provimento 12/2017-CM) e a assinatura final do termo.</p>
          </div>
        )}
      </div>
    );

    if (step === 1) return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Cabeçalho do Termo</h2>
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
      const sm = f.subModelo;
      return (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Dados para a Decisão</h2>
          <p className="text-sm text-slate-500 mb-4">Preencha os elementos específicos. O texto é montado instantaneamente a partir dos modelos da Vara — sem IA, sem custo.</p>

          {dk === "LIBERDADE" && (
            <>
              <Card title="Elementos do Crime e Flagrante">
                <Full><Inp label="Crime imputado (artigo e lei)" val={f.crimeImputado} onChange={v => set("crimeImputado", v)} required placeholder="artigo 129, §13º do Código Penal, com incidência da Lei n.º 11.340/06" /></Full>
                <Full><Sel label="Fundamentação do flagrante (CPP)" val={f.artFlagrante} opts={["I", "II", "III", "IV"].map(r => `art. 302, ${r}, do Código de Processo Penal`)} onChange={v => set("artFlagrante", v)} /></Full>
                <Radio label="Réu(é) primário(a)?" val={f.primario} onChange={v => set("primario", v)} />
                <Radio label="Possui residência fixa?" val={f.residenciaFixa} onChange={v => set("residenciaFixa", v)} />
                <Radio label="Possui emprego / ocupação lícita?" val={f.empregoLicito} onChange={v => set("empregoLicito", v)} />
              </Card>

              {sm === "padrao" && (
                <Card title="Medidas Protetivas de Urgência">
                  <Radio label="Vítima possui MPU deferidas?" val={f.mpuDeferidas} onChange={v => set("mpuDeferidas", v)} />
                  {f.mpuDeferidas === "Sim" && <>
                    <Inp label="Nome da vítima" val={f.nomeVitima} onChange={v => set("nomeVitima", v)} />
                    <Inp label="Número do processo das MPUs" val={f.numMPU} onChange={v => set("numMPU", v)} placeholder="0000000-00.0000.8.11.0000" />
                  </>}
                  <Radio label="Notificar a vítima da decisão?" val={f.notificarVitima} onChange={v => set("notificarVitima", v)} />
                </Card>
              )}

              {sm === "controvertida" && (
                <Card title="Dinâmica dos Fatos">
                  <Full><Txt label="Narrativa dos fatos controvertidos" val={f.narrativaControvertida} onChange={v => set("narrativaControvertida", v)} rows={6} placeholder="Ex: a guarnição constatou lesão na vítima, mas também registrou que esta agrediu o autuado; versões conflitantes; vítima não ouvida formalmente..." /></Full>
                </Card>
              )}

              {sm === "fianca" && (
                <Card title="Fiança">
                  <Inp label="Valor da fiança (R$)" val={f.fiancaValor} onChange={v => set("fiancaValor", v)} placeholder="8.105,00" />
                  <Inp label="Descrição (em salários mínimos)" val={f.fiancaDescricao} onChange={v => set("fiancaDescricao", v)} placeholder="cinco salários mínimos" />
                </Card>
              )}

              {sm === "trafico" && (
                <Card title="Elementos da Pequena Gravidade">
                  <Full><Txt label="Observações sobre a pequena quantidade / contexto" val={f.narrativaTrafico} onChange={v => set("narrativaTrafico", v)} rows={4} placeholder="Ex: apreendida ínfima quantidade de substância entorpecente..." /></Full>
                  <Radio label="Oficiar outro Juízo sobre quebra de cautelares?" val={f.oficiarOutroJuizo} onChange={v => set("oficiarOutroJuizo", v)} />
                  {f.oficiarOutroJuizo === "Sim" && <>
                    <Inp label="Juízo/Órgão a ser oficiado" val={f.juizoOficio} onChange={v => set("juizoOficio", v)} placeholder="NÚCLEO DE JUSTIÇA 4.0 DO JUIZ DAS GARANTIAS - POLO RONDONÓPOLIS" />
                    <Inp label="Número do processo de origem" val={f.processoOficio} onChange={v => set("processoOficio", v)} />
                  </>}
                </Card>
              )}

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
                <Sel label="Sistema para lançamento" val={f.sistemaBNMP} opts={["PJe", "BNMP", "PJe e BNMP"]} onChange={v => set("sistemaBNMP", v)} />
              </Card>
            </>
          )}

          {dk === "PREVENTIVA" && sm === "cronologica" && (
            <>
              <Card title="Elementos do Crime e Flagrante">
                <Full><Inp label="Crime imputado (artigo e lei)" val={f.crimeImputado} onChange={v => set("crimeImputado", v)} required placeholder="artigo 24-A da Lei n.º 11.340/06" /></Full>
                <Full><Sel label="Fundamentação do flagrante (CPP)" val={f.artFlagranteP} opts={["I", "II", "III", "IV"].map(r => `art. 302, ${r}, do Código de Processo Penal`)} onChange={v => set("artFlagranteP", v)} /></Full>
              </Card>
              <Card title="Medida Protetiva Descumprida">
                <Inp label="Nome da vítima" val={f.nomeVitima} onChange={v => set("nomeVitima", v)} />
                <Inp label="Data de deferimento da MPU" val={f.dataMPU} onChange={v => set("dataMPU", v)} type="date" />
                <Inp label="Número do processo das MPUs" val={f.numMPU} onChange={v => set("numMPU", v)} placeholder="0000000-00.0000.8.11.0000" />
                <Inp label="Data da intimação do indiciado" val={f.dataIntimacao} onChange={v => set("dataIntimacao", v)} type="date" />
                <Full><Txt label="Condições da MPU (resumo)" val={f.condicoesMPU} onChange={v => set("condicoesMPU", v)} rows={2} placeholder="Tais medidas determinavam expressamente que o requerido mantivesse distância mínima da ofendida..." /></Full>
              </Card>
              <Card title="">
                <Full><Txt label="Fatos do descumprimento — um por linha (serão numerados automaticamente)" val={f.narrativaCronologica} onChange={v => set("narrativaCronologica", v)} rows={8} placeholder={"Contato indevido via redes sociais (após intimação)...\nFrequência a local proibido...\nAproximação da residência..."} /></Full>
              </Card>
            </>
          )}

          {dk === "PREVENTIVA" && sm === "complexa" && (
            <>
              <Card title="Elementos do Crime">
                <Full><Inp label="Crime imputado (artigo e lei)" val={f.crimeImputado} onChange={v => set("crimeImputado", v)} required placeholder="art. 33 da Lei nº 11.343/2006" /></Full>
                <Full><Txt label="Fundamento concreto (motivo da segregação)" val={f.fundamentoFinal} onChange={v => set("fundamentoFinal", v)} rows={2} placeholder="foram encontrados sob sua posse 66 porções de substância análoga a maconha, além de um aparelho celular..." /></Full>
              </Card>
              <Card title="">
                <Full><Txt label="Narrativa da ocorrência policial (cole o relato do boletim, se houver)" val={f.narrativaPolicial} onChange={v => set("narrativaPolicial", v)} rows={10} placeholder="Em continuidade à operação..., a guarnição avistou os suspeitos transportando caixas..." /></Full>
              </Card>
              <Card title="Pedidos Incidentais">
                <Radio label="Há pedido de acesso a dados de celular apreendido?" val={f.pedidoCelular} onChange={v => set("pedidoCelular", v)} />
                <Radio label="Há pedido de incineração / destruição de drogas?" val={f.pedidoIncineracao} onChange={v => set("pedidoIncineracao", v)} />
                {f.pedidoIncineracao === "Sim" && <Sel label="Resultado" val={f.incineracaoResultado} opts={["Deferido", "Indeferido"]} onChange={v => set("incineracaoResultado", v)} />}
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
                {sm === "topicos" && <Inp label="Data da decisão de regressão cautelar anterior" val={f.dataDecisaoAnterior} onChange={v => set("dataDecisaoAnterior", v)} type="date" />}
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
            </>
          )}

          {dk === "CUMPRIMENTO" && (
            <Card title="Origem do Mandado">
              <Full><Inp label="Vara/Comarca de origem (frase completa)" val={f.varaOrigem} onChange={v => set("varaOrigem", v)} required placeholder="da 1ª Vara Cível de Primavera do Leste/MT" /></Full>
            </Card>
          )}

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">Deliberações — Texto Montado</h3>
            {f.deliberacoesTexto
              ? <Txt label="" val={f.deliberacoesTexto} onChange={v => set("deliberacoesTexto", v)} rows={14} />
              : <p className="text-sm text-amber-700">Clique em &#8220;✦ Montar Deliberações&#8221; para gerar o texto completo da decisão a partir dos modelos da Vara.</p>}
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
          <p className="text-xs text-slate-600">v4.0 · 9 modelos · sem IA</p>
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
              <button onClick={montar} disabled={!f.tipo}
                className="px-5 py-2 text-sm font-semibold bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2">
                ✦ Montar Deliberações
              </button>
            )}
            {step < 7 && (
              <button
                onClick={() => step === 6 ? setStep(7) : setStep(s => s + 1)}
                disabled={(step === 0 && !f.tipo) || (step === 6 && !f.deliberacoesTexto)}
                title={step === 6 && !f.deliberacoesTexto ? 'Clique em "Montar Deliberações" antes de ver o documento' : undefined}
                className="px-5 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
