// Serverless function da Vercel: proxy para a API de mensagens da Anthropic.
//
// O front-end (estático) chama POST /api/messages; esta função adiciona a chave
// secreta (variável de ambiente ANTHROPIC_API_KEY, configurada no painel da
// Vercel) e o cabeçalho de versão, e encaminha a requisição. A chave nunca vai
// para o navegador, e isso resolve o erro de CORS ("Failed to fetch") que ocorre
// ao tentar chamar a Anthropic diretamente do site.

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Método não permitido." } });
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({
      error: {
        message:
          "ANTHROPIC_API_KEY não configurada. Em Vercel → Project → Settings → Environment Variables, adicione ANTHROPIC_API_KEY e refaça o deploy.",
      },
    });
    return;
  }

  // A Vercel já entrega req.body parseado para JSON; aceita string por garantia.
  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload || {}),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { message: "Falha ao contatar a API Anthropic: " + e.message } });
  }
}
