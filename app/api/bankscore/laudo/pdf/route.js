import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { avaliarIndicador, periodoValido } from '../../../../../lib/bankscore/laudo-core.mjs';
import { montarLaudo } from '../../../../../lib/bankscore/report-core.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABLE = 'jenios_bankscore_homologacao';
const FIELDS = 'codigo_instituicao,nome_instituicao,periodo,tipo_instituicao,codigo_indicador,indice_basileia_bruto,indice_basileia_percentual_provisorio,status';
const CODE_PATTERN = /^(?:\d{1,12}|C\d{1,12})$/;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('CONFIG');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function institution(row) {
  const { percentual, revisao } = avaliarIndicador(row);
  return {
    codigo: row.codigo_instituicao,
    nome: row.nome_instituicao,
    periodo: row.periodo,
    tipo: row.tipo_instituicao,
    percentual,
    status: row.status,
    revisao
  };
}

function printable(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '>')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function splitLine(text, font, size, maxWidth) {
  const words = printable(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (line) { lines.push(line); line = ''; }
      for (const char of word) { if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) { lines.push(line); line = ''; } line += char; }
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createReportPdf(report) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89];
  const margin = 54;
  const bodyWidth = pageSize[0] - margin * 2;
  let page;
  let y;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
    page.drawText('JENIOS BANKSCORE', { x: margin, y, size: 10, font: bold, color: rgb(0.08, 0.23, 0.39) });
    page.drawText('Laudo tecnico - ambiente de homologacao', { x: margin, y: y - 15, size: 8, font: regular, color: rgb(0.38, 0.46, 0.55) });
    y -= 40;
  };

  const ensure = (height) => { if (y - height < margin) newPage(); };
  const paragraph = (text, { size = 10.5, font = regular, color = rgb(0.08, 0.12, 0.18), gap = 9 } = {}) => {
    const lines = splitLine(text, font, size, bodyWidth);
    for (const line of lines) {
      ensure(size + 4);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + 4;
    }
    y -= gap;
  };
  const heading = (text) => { ensure(70); paragraph(text, { size: 14, font: bold, color: rgb(0.08, 0.23, 0.39), gap: 8 }); };

  newPage();
  paragraph('LAUDO DE ANALISE PRUDENCIAL', { size: 19, font: bold, color: rgb(0.08, 0.23, 0.39), gap: 14 });
  paragraph(report.instituicao.nome, { size: 16, font: bold, gap: 5 });
  paragraph(`Codigo: ${report.instituicao.codigo} | Periodo: ${report.instituicao.periodo} | Tipo: ${report.instituicao.tipo ?? 'Nao informado'}`, { size: 9, color: rgb(0.38, 0.46, 0.55), gap: 14 });
  const pct = report.instituicao.percentual == null ? 'Nao disponivel' : `${Number(report.instituicao.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  paragraph(`Indice de Basileia provisorio: ${pct}`, { size: 15, font: bold, color: rgb(0.08, 0.23, 0.39), gap: 5 });
  paragraph(`Classificacao explicativa: ${report.classificacao}`, { size: 11, font: bold, gap: 14 });

  heading('Resumo em linguagem simples');
  paragraph('O Indice de Basileia procura mostrar quanto capital uma instituicao possui em relacao aos riscos assumidos. Ele representa apenas uma parte da analise da saude financeira.');
  paragraph(report.interpretacao);

  heading('Parecer tecnico fundamentado');
  paragraph(report.criterio);
  for (const item of report.fundamentos) paragraph(`- ${item}`, { gap: 4 });
  paragraph(`Conclusao: ${report.conclusao}`, { font: bold });
  paragraph(`Metodologia: ${report.metodologia}`);

  heading('Verificacoes necessarias');
  for (const item of report.pendencias) paragraph(`- ${item}`, { gap: 4 });

  heading('Limitacoes e fonte');
  paragraph('Este documento descreve sinais de capitalizacao, nao preve liquidacao, nao certifica solvencia e nao constitui rating de credito ou recomendacao de investimento.');
  paragraph(`Fonte declarada: ${report.fonte}. Material experimental, sem validacao oficial do Banco Central.`, { size: 9, color: rgb(0.38, 0.46, 0.55) });

  if (report.coverage) {
    heading('Diagnostico gratuito de cobertura');
    paragraph(report.coverage.reason);
    paragraph('Conferido em: ' + report.coverage.checkedAt, { size: 9 });
    paragraph('Ultimo trimestre civil encerrado: ' + report.coverage.latestClosedCalendarQuarter);
    paragraph(report.coverage.periodNotice);
    for (const item of report.coverage.dimensions) { heading(item.label); paragraph(item.state + ': ' + item.explanation); }
    heading('Historico disponivel - nao e uma previsao');
    for (const item of report.coverage.series) paragraph(item.periodo + ': ' + (item.percentual == null ? 'Sem percentual interpretavel' : item.percentual.toLocaleString('pt-BR') + '%') + ' | ' + item.revisao);
    heading('Inventario complementar bruto');
    if (!report.coverage.supplementalIndicators.length) paragraph('Nenhum indicador complementar disponivel para esta instituicao e periodo.');
    for (const item of report.coverage.supplementalIndicators) paragraph(item.code + ' - ' + item.name + ': ' + (item.rawValue ?? 'nao informado') + '. Unidade: ' + item.unit + '. Fonte declarada: ' + (item.source || 'nao informada'));
    for (const item of report.coverage.limitations) paragraph(item, { size: 9 });
  }
  const pages = pdf.getPages();
  pages.forEach((p, index) => p.drawText('JENIOS BankScore | ' + (index + 1) + ' / ' + pages.length, { x: margin, y: 26, size: 8, font: regular }));

  pdf.setTitle(`JENIOS BankScore - ${printable(report.instituicao.nome)}`);
  pdf.setAuthor('JENIOS');
  pdf.setSubject('Laudo tecnico BankScore - homologacao');
  return pdf.save();
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const codigo = params.get('codigo') || '';
    const periodoRaw = params.get('periodo');
    if (!CODE_PATTERN.test(codigo)) return Response.json({ erro: 'Código inválido' }, { status: 400 });
    if (periodoRaw && !periodoValido(periodoRaw)) return Response.json({ erro: 'Período inválido' }, { status: 400 });

    const db = adminClient();
    let periodo = periodoRaw ? Number(periodoRaw) : null;
    if (periodo === null) {
      const latest = await db.from(TABLE).select('periodo').eq('codigo_indicador', '79664').order('periodo', { ascending: false }).limit(1);
      if (latest.error) throw latest.error;
      periodo = latest.data?.[0]?.periodo ?? null;
    }
    if (periodo == null) return Response.json({ erro: 'Nenhum período disponível' }, { status: 404 });

    const result = await db.from(TABLE).select(FIELDS).eq('periodo', periodo).eq('codigo_indicador', '79664').eq('codigo_instituicao', codigo).limit(2);
    if (result.error) throw result.error;
    if (!result.data?.length) return Response.json({ erro: 'Instituição não encontrada' }, { status: 404 });
    if (result.data.length > 1) return Response.json({ erro: 'Dados duplicados: revisão necessária' }, { status: 409 });

    const report = montarLaudo(institution(result.data[0]));
    const bytes = await createReportPdf(report);
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="jenios-bankscore-${codigo}-${periodo}.pdf"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('BankScore PDF:', error?.code || error?.name || 'erro');
    return Response.json({ erro: 'Não foi possível gerar o PDF' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
