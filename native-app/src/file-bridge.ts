import {navigationDecision} from './navigation.ts';
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export function validatePdfMessage(raw: string, sourceUrl: string) {
  if(navigationDecision(sourceUrl)!=='internal'||raw.length>Math.ceil(MAX_PDF_BYTES*4/3)+1024)return null;
  try{
    const value=JSON.parse(raw);
    if(value?.kind!=='jenios-pdf'||value.mime!=='application/pdf'||typeof value.base64!=='string')return null;
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value.base64)||value.base64.length%4!==0||!value.base64.startsWith('JVBERi0'))return null;
    const bytes=value.base64.length*3/4-(value.base64.endsWith('==')?2:value.base64.endsWith('=')?1:0);
    if(bytes<8||bytes>MAX_PDF_BYTES||value.bytes!==bytes)return null;
    if(typeof value.filename!=='string'||!/^jenios-[a-zA-Z0-9_-]{1,100}\.pdf$/.test(value.filename))return null;
    return {base64:value.base64,filename:value.filename,bytes};
  }catch{return null;}
}
// Only download clicks for bounded PDF blobs from the verified first-party page.
// The native side also checks origin/type/length and asks before opening the share sheet.
export const PDF_BRIDGE_SCRIPT = `(()=>{
 if(window.top!==window||window.__jeniosPdfBridge)return true;
 if(location.protocol!=='https:'||!['www.jenios.com.br','jenios.com.br'].includes(location.hostname))return true;
 window.__jeniosPdfBridge=true;
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[download]');
  if(!link||!/^jenios-[a-zA-Z0-9_-]{1,100}\\.pdf$/.test(link.download)||!link.href.startsWith('blob:'+location.origin+'/'))return;
  event.preventDefault();
  fetch(link.href).then(r=>r.blob()).then(async blob=>{
   if(blob.type!=='application/pdf'||blob.size<8||blob.size>${MAX_PDF_BYTES}||await blob.slice(0,5).text()!=='%PDF-')throw Error('PDF inválido');
   const reader=new FileReader();reader.onload=()=>window.ReactNativeWebView.postMessage(JSON.stringify({kind:'jenios-pdf',filename:link.download,mime:blob.type,bytes:blob.size,base64:String(reader.result).split(',')[1]}));reader.readAsDataURL(blob);
  }).catch(()=>alert('Não foi possível preparar o PDF. Gere o relatório novamente.'));
 },true);return true;
})();true;`;
