
import https from "node:https";

const TOKEN_URL =
  "https://cdpj.partners.bancointer.com.br/oauth/v2/token";

const TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 64 * 1024;

function required(name) {
  const value = process.env[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Configuracao ausente: ${name}`);
  }

  return value.trim();
}

function pem(name) {
  return required(name).replace(/\\n/g, "\n");
}

export async function autenticarBancoInter() {
  const clientId = required("INTER_CLIENT_ID");
  const clientSecret = required("INTER_CLIENT_SECRET");
  const cert = pem("INTER_CERTIFICATE");
  const key = pem("INTER_PRIVATE_KEY");

  const agent = new https.Agent({
    cert,
    key,
    rejectUnauthorized: true,
    keepAlive: false,
  });

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "cob.read",
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      TOKEN_URL,
      {
        method: "POST",
        agent,
        timeout: TIMEOUT_MS,
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks = [];
        let size = 0;

        res.on("data", (chunk) => {
          size += chunk.length;

          if (size > MAX_RESPONSE_BYTES) {
            res.destroy(
              new Error("Resposta bancaria excedeu o limite")
            );
            return;
          }

          chunks.push(chunk);
        });

        res.on("error", reject);

        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(
                `Autenticacao Banco Inter: HTTP ${res.statusCode}`
              )
            );
            return;
          }

          try {
            const result = JSON.parse(
              Buffer.concat(chunks).toString("utf8")
            );

            if (
              typeof result.access_token !== "string" ||
              !result.access_token
            ) {
              throw new Error("Token OAuth nao recebido");
            }

            resolve({
              autenticado: true,
              expiresIn: result.expires_in ?? null,
            });
          } catch {
            reject(
              new Error("Resposta OAuth invalida")
            );
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(
        new Error("Tempo limite de autenticacao bancaria")
      );
    });

    req.on("error", reject);

    req.end(body);
  });
}
