import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE =
  "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata";

async function consultar(periodo) {
  let url =
    `${BASE}/IfDataCadastro(AnoMes=${periodo})` +
    "?$format=json&$top=1000";

  const registros = [];
  const visitados = new Set();
  let paginas = 0;

  while (url && paginas < 10) {
    if (visitados.has(url)) break;
    visitados.add(url);

    const resposta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { Accept: "application/json" }
    });

    if (!resposta.ok) {
      throw new Error(`IFData HTTP ${resposta.status}`);
    }

    const dados = await resposta.json();

    if (!Array.isArray(dados.value)) {
      throw new Error("Formato inválido do cadastro");
    }

    registros.push(...dados.value);
    paginas++;

    const proxima =
      dados["@odata.nextLink"] ||
      dados["odata.nextLink"] ||
      dados["__next"] ||
      null;

    if (proxima) {
      const resolvida = new URL(proxima, BASE + "/");
      if (resolvida.origin !== new URL(BASE).origin) {
        throw new Error("Paginação externa não permitida");
      }
      url = resolvida.toString();
    } else {
      url = null;
    }
  }

  return {
    registros,
    completo: !url,
    paginas
  };
}

export async function GET() {
  try {
    const periodos = [202609, 202606, 202603, 202512];

    for (const periodo of periodos) {
      let resultado;

      try {
        resultado = await consultar(periodo);
      } catch {
        continue;
      }

      if (!resultado.registros.length) continue;

      const mapa = new Map();

      for (const item of resultado.registros) {
        const codigo = String(item.CodInst ?? "");
        const nome = String(item.NomeInstituicao ?? "");

        if (!codigo || !nome) continue;

        mapa.set(codigo, {
          codigo,
          nome,
          conglomerado:
            item.CodConglomeradoPrudencial ?? null,
          situacao: item.Situacao ?? null
        });
      }

      const instituicoes = [...mapa.values()]
        .sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR")
        );

      return NextResponse.json({
        fonte: "Banco Central do Brasil - IFData",
        periodo,
        completo: resultado.completo,
        consultadoEm: new Date().toISOString(),
        total: instituicoes.length,
        instituicoes
      });
    }

    throw new Error(
      "Nenhuma data-base retornou instituições."
    );
  } catch (erro) {
    return NextResponse.json({
      erro: "Consulta indisponível",
      detalhe: erro.message
    }, { status: 503 });
  }
}
