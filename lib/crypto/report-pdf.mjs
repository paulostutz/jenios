import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const clean = value=>String(value??'Não informado').replace(/[—–]/g,'-').replace(/[^\x20-\x7e\xa0-\xff\n]/g,' ');
export async function createCryptoReportPdf(report) {
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const purple=rgb(.36,.13,.72),ink=rgb(.09,.12,.2),muted=rgb(.35,.4,.48);
  const left=48,width=499;let page,y;
  function newPage(){page=pdf.addPage([595,842]);y=750;page.drawText('JENIOS | CRYPTO INTELLIGENCE',{x:left,y:795,size:12,font:bold,color:purple});page.drawText('Consulta informativa - evidências e limitações',{x:left,y:777,size:9,font:regular,color:muted});}
  function wrap(value,font,size){
    const lines=[];
    for(const raw of clean(value).split('\n')){
      let current='';
      for(const word of raw.split(/\s+/).filter(Boolean)){
        if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){lines.push(current);current='';}
        if(font.widthOfTextAtSize(word,size)>width){
          let fragment='';
          for(const char of word){if(fragment&&font.widthOfTextAtSize(fragment+char,size)>width){lines.push(fragment);fragment='';}fragment+=char;}
          current=fragment;
        }else current=current?current+' '+word:word;
      }
      lines.push(current);
    }
    return lines;
  }
  function paragraph(value,{size=10,font=regular,color=ink,gap=9}={}){
    for(const line of wrap(value,font,size)){if(y<size+58)newPage();page.drawText(line,{x:left,y,size,font,color});y-=size+4;}
    y-=gap;
  }
  function heading(value){if(y<115)newPage();paragraph(value,{size:13,font:bold,color:purple,gap:8});}
  newPage();heading('Relatório de consulta on-chain');
  for(const [label,value] of [['Rede',report.networkLabel],['Tipo',report.type],['Identificador',report.identifier],['Estado observado',report.status],['Provedor',report.provider||'Não confirmado'],['Consultado em',report.checkedAt]]){paragraph(label,{size:9,font:bold,color:muted,gap:2});paragraph(value);}
  if(report.authenticity){heading('Identidade do ativo');paragraph(report.authenticity.label,{font:bold});paragraph('Emissor de referência: '+(report.authenticity.issuer||'Não identificado'));paragraph('Catálogo conferido em: '+report.authenticity.registryCheckedAt);if(report.authenticity.source)paragraph('Fonte do emissor: '+report.authenticity.source,{size:9});}
  heading('Evidências observadas');
  const evidence=Object.entries(report.evidence||{});
  if(!evidence.length)paragraph('Nenhuma evidência disponível nesta consulta.');
  for(const [label,value]of evidence){paragraph(label,{size:9,font:bold,color:muted,gap:2});paragraph(typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'Não informado'));}
  if(report.providerError){heading('Indisponibilidade da fonte');paragraph('O provedor não respondeu de forma válida. Não foi possível concluir a verificação.');}
  if(report.detail){
    heading('Interpretação detalhada');
    paragraph('Pedido: '+report.detail.orderId,{size:9});
    paragraph(report.detail.methodology);
    for(const finding of report.detail.findings){heading(finding.title);paragraph('Classificação: '+({observed:'observado',attention:'atenção',inconclusive:'inconclusivo'}[finding.level]||'inconclusivo'),{size:9,font:bold});paragraph(finding.explanation);}
    heading('Escopo da consulta detalhada');
    for(const limitation of report.detail.limitations)paragraph(limitation,{size:9});
  }
  if(report.inventory){
    heading('Inventario dos tokens da carteira');
    paragraph(report.inventory.available?(report.inventory.complete?'Leitura do indice concluida':'Inventario parcial'):'Inventario indisponivel',{font:bold});
    if(report.inventory.scope)paragraph(report.inventory.scope,{size:9});
    if(report.inventory.summary)paragraph(`Contratos com referencia de emissor: ${report.inventory.summary.issuerMatches}. Simbolo semelhante, endereco diferente: ${report.inventory.summary.symbolMismatches}. Sem referencia no catalogo limitado: ${report.inventory.summary.unreferenced}. Contagens nao equivalem a patrimonio verdadeiro/falso.`,{size:9});
    for(const warning of report.inventory.warnings||[])paragraph(warning,{size:9});
    for(const token of report.inventory.tokens||[]){
      heading(token.symbol||'Simbolo nao confirmado');paragraph('Contrato/mint: '+token.address,{size:9});
      paragraph('Saldo: '+(token.amount===null?token.rawBalance+' unidades brutas':token.amount));
      paragraph(token.authenticity.label);if(token.authenticity.source)paragraph('Fonte do emissor: '+token.authenticity.source,{size:9});
    }
    if(report.inventory.available&&!report.inventory.tokens.length)paragraph('Nenhum saldo positivo retornado nesta cobertura.');
    paragraph('Nao soma quantidades de tokens diferentes nem calcula patrimonio falso. Correspondencia de endereco nao garante liquidez, preco ou resgate.',{size:9});
  }
  heading('Limites da análise');paragraph(report.disclaimer||'A consulta não certifica autenticidade ou titularidade.');paragraph('Um nome ou símbolo de token pode ser copiado. Endereço, rede e fonte do emissor devem ser comparados. Não consta no catálogo não significa falso. Não informe senhas, chaves privadas ou frase-semente.',{size:9});
  if(report.explorerUrl){heading('Consulta independente');paragraph(report.explorerUrl,{size:9});}
  const pages=pdf.getPages();pages.forEach((p,index)=>p.drawText('JENIOS - '+(index+1)+' / '+pages.length,{x:left,y:30,size:8,font:regular,color:muted}));
  pdf.setTitle('JENIOS - Consulta de criptoativos');pdf.setAuthor('JENIOS');return pdf.save();
}
