/** S05: validate server-produced attachments before downloading, do not trust HTML error bodies. */
export const MAX_REPORT_PDF_BYTES = 20 * 1024 * 1024;
export async function downloadVerifiedReportPdf(response,filename,{
  isCurrent=()=>true,dom=globalThis.document,urlApi=globalThis.URL,scheduler=globalThis.setTimeout
}={}) {
  if(!response?.ok)throw Error('Não foi possível gerar o relatório.');
  if(!/^application\/pdf(?:\s*;|\s*$)/i.test(response.headers?.get('content-type')||''))
    throw Error('O serviço não retornou um arquivo PDF válido.');
  if(!/^jenios-(?:bankscore|crypto)-detalhado\.pdf$/.test(filename))throw Error('Nome de arquivo não autorizado.');
  const length=Number(response.headers?.get('content-length')||0);
  if(length>MAX_REPORT_PDF_BYTES)throw Error('O arquivo excedeu o limite de segurança.');
  const blob=await response.blob();
  if(blob.size<8||blob.size>MAX_REPORT_PDF_BYTES||await blob.slice(0,5).text()!=='%PDF-')
    throw Error('O conteúdo recebido não é um PDF válido.');
  if(!isCurrent())return false;
  if(!dom?.createElement||!dom.body?.appendChild||!urlApi?.createObjectURL||!urlApi?.revokeObjectURL||typeof scheduler!=='function')
    throw Error('Este navegador não permite o download agora.');
  const url=urlApi.createObjectURL(blob);
  try {
    const anchor=dom.createElement('a');anchor.href=url;anchor.download=filename;anchor.rel='noopener';
    dom.body.appendChild(anchor);anchor.click();anchor.remove();
  }finally{
    // Safari may still be reading the Blob after click(); don't revoke immediately.
    scheduler(()=>urlApi.revokeObjectURL(url),60_000);
  }
  return true;
}
