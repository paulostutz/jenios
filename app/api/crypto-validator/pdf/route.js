import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { validateCrypto } from "../../../../lib/crypto-validator.mjs";

function safe(value) { return String(value ?? "—").replace(/[^\x20-\x7E\u00C0-\u00FF]/g, " "); }

export async function POST(request) {
  try {
    const report = await validateCrypto(await request.json());
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText("JENIOS Social V7", { x: 48, y: 790, size: 20, font: bold, color: rgb(0.36, 0.13, 0.72) });
    page.drawText("Laudo de consulta on-chain", { x: 48, y: 760, size: 15, font: bold });
    const lines = [
      ["Rede", report.networkLabel], ["Tipo", report.type], ["Identificador", report.identifier],
      ["Status", report.status], ["Encontrado", report.found ? "sim" : "não"],
      ["Provedor", report.provider || "não homologado"], ["Verificado em", report.checkedAt],
      ...Object.entries(report.evidence || {}).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : value]),
    ];
    let y = 720;
    for (const [label, value] of lines) {
      page.drawText(safe(label) + ":", { x: 48, y, size: 10, font: bold });
      const body = safe(value);
      for (let start = 0; start < body.length; start += 78) {
        page.drawText(body.slice(start, start + 78), { x: start ? 64 : 155, y, size: 9, font: regular });
        if (start) y -= 13;
      }
      y -= 22;
    }
    const limitY = Math.max(y - 10, 105);
    page.drawText("Limites do laudo", { x: 48, y: limitY, size: 11, font: bold });
    page.drawText(safe(report.disclaimer || "Consulta não homologada."), { x: 48, y: limitY - 20, size: 8.5, font: regular, maxWidth: 500, lineHeight: 12 });
    const bytes = await pdf.save();
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="jenios-validacao-' + report.network + '.pdf"', "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Não foi possível gerar o PDF." }, { status: 400 });
  }
}
