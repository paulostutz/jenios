import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { autenticarBancoInter } from "../../../../../lib/jenios-pay/inter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(request) {
  const esperado = process.env.JENIOS_PAY_ADMIN_TOKEN;
  const recebido = request.headers.get("x-jenios-admin-token");

  if (!esperado || !recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET() {
  return NextResponse.json(
    { status: "protected", message: "Use POST autenticado." },
    { status: 405, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request) {
  if (!autorizado(request)) {
    return NextResponse.json(
      { error: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const resultado = await autenticarBancoInter();

    return NextResponse.json(
      {
        service: "JENIOS PAY",
        banco: "Inter",
        autenticado: resultado.autenticado,
        pagamentosHabilitados: false
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        service: "JENIOS PAY",
        autenticado: false,
        message: "Falha na autenticacao bancaria"
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
