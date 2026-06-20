// Cliente da API de mensagens da Anthropic que funciona em dois ambientes:
//
//  1) App Node deste repositório  → usa o proxy /api/messages (server.js),
//     que injeta a chave e o cabeçalho de versão no servidor.
//  2) Artefato do Claude (claude.ai) → não há proxy; a chamada direta a
//     https://api.anthropic.com/v1/messages é autenticada pelo próprio sandbox.
//
// A função tenta o proxy primeiro e, se ele não existir (resposta 404 / não-JSON
// / falha de rede), cai automaticamente para a chamada direta.

const PROXY_URL = "/api/messages";
const DIRECT_URL = "https://api.anthropic.com/v1/messages";
const SEM_PROXY = "__SEM_PROXY__";

async function viaProxy(body) {
  let r;
  try {
    r = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(SEM_PROXY); // sem servidor → tenta chamada direta
  }
  if (r.status === 404) throw new Error(SEM_PROXY);

  const txt = await r.text();
  let d;
  try {
    d = JSON.parse(txt);
  } catch {
    // resposta não-JSON (ex.: HTML do SPA num artefato) → não há proxy real
    throw new Error(SEM_PROXY);
  }
  if (d && d.error) throw new Error(d.error.message || "Erro na API.");
  if (!r.ok) throw new Error(`Erro HTTP ${r.status}.`);
  return d;
}

async function viaDireto(body) {
  const r = await fetch(DIRECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let d;
  try {
    d = await r.json();
  } catch {
    throw new Error(`Resposta inválida da API (HTTP ${r.status}).`);
  }
  if (d && d.error) throw new Error(d.error.message || "Erro na API.");
  if (!r.ok) throw new Error(`Erro HTTP ${r.status}.`);
  return d;
}

// Envia o corpo (model, max_tokens, system, messages…) e devolve a resposta
// já em JSON. O array d.content é a lista de blocos retornados pelo modelo.
export async function enviarMensagens(body) {
  try {
    return await viaProxy(body);
  } catch (e) {
    if (e && e.message === SEM_PROXY) {
      return await viaDireto(body);
    }
    throw e;
  }
}

// Concatena os blocos de texto da resposta.
export function textoDaResposta(d) {
  if (!d || !Array.isArray(d.content)) throw new Error("Resposta sem conteúdo de texto.");
  return d.content.map(b => b.text || "").join("");
}
