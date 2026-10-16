import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE =
  "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata";

export async function GET() {
  const url = `${BASE}/ListaDeRelatorio()?$format=json`;

  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: "application/json"
      }
    });

    const texto = await resposta.text();

    if (!resposta.ok) {
      return NextResponse.json({
        conectado: false,
        mensagem: "Consulta ao Banco Central não concluída.",
        detalhe: `HTTP ${resposta.status}: ${texto.slice(0, 300)}`
      }, { status: 502 });
    }

    const dados = JSON.parse(texto);

    if (!Array.isArray(dados.value)) {
      throw new Error("Resposta inesperada do IFData.");
    }

    return NextResponse.json({
      conectado: true,
      fonte: "Banco Central do Brasil - IFData",
      consultadoEm: new Date().toISOString(),
      relatorios: dados.value
    });

  } catch (erro) {
    return NextResponse.json({
      conectado: false,
      mensagem: "Falha ao consultar o Banco Central.",
      detalhe: erro.message
    }, { status: 503 });
  }
}
