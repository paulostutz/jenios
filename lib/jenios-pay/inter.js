import https from "node:https";

const TOKEN_URL =
  "https://cdpj.partners.bancointer.com.br/oauth/v2/token";

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Configuracao ausente: ${name}`);
  }
  if (name === "INTER_CERTIFICATE" || name === "INTER_PRIVATE_KEY") {
    return value.replace(/\\n/g, "\n");
  }
  return value.trim();
}

export async function autenticarBancoInter() {
  const clientId = required("INTER_CLIENT_ID");
  const clientSecret = required("INTER_CLIENT_SECRET");
  const cert = required("INTER_CERTIFICATE");
  const key = required("INTER_PRIVATE_KEY");

  const agent = new https.Agent({
    cert,
    key,
    rejectUnauthorized: true,
  });

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "cob.read",
  }).toString();

  return new Promise((resolve, reject) => {
    const url = new URL(TOKEN_URL);

    const req = https.request(
      url,
      {
        method: "POST",
        agent,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(`Banco Inter retornou HTTP ${res.statusCode}`)
            );
            return;
          }

          try {
            const result = JSON.parse(data);

            if (!result.access_token) {
              throw new Error("Token nao recebido");
            }

            resolve({
              autenticado: true,
              expiresIn: result.expires_in,
            });
          } catch {
            reject(new Error("Resposta de autenticacao invalida"));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Tempo limite de conexao"));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
