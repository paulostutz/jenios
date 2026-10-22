/** B305 - Corporate JENIOS email identity. Sending is disabled by default. */
const DOMAIN='jenios.com.br';
export const JENIOS_EMAIL_ADDRESSES=Object.freeze({
  noreply:'noreply@'+DOMAIN,finance:'financeiro@'+DOMAIN,
  ceo:'ceo@'+DOMAIN,directors:'diretoria@'+DOMAIN,
  administrative:'administrativo@'+DOMAIN,legal:'juridico@'+DOMAIN,
  compliance:'compliance@'+DOMAIN,founder:'paulostutz@'+DOMAIN,
  fernanda:'fernandapimentel@'+DOMAIN,marketing:'marketing@'+DOMAIN,
  customerCare:'sac@'+DOMAIN
});
export const JENIOS_FINANCE_SENDER='Financeiro JENIOS <financeiro@jenios.com.br>';
export const JENIOS_LOGO_URL='https://www.jenios.com.br/brand/jenios-logo-horizontal.webp';
export const escapeEmailHtml=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function jeniosEmailSignature({department='Financeiro'}={}){
 const dep=escapeEmailHtml(department);
 return '<table role="presentation" cellspacing="0" cellpadding="0" style="border-top:1px solid #e4e7ee;margin-top:28px;padding-top:18px;width:100%"><tr><td>'+
 '<img src="'+JENIOS_LOGO_URL+'" alt="JENIOS" width="172" style="max-width:172px;height:auto;display:block" />'+
 '<p style="color:#252d3a;font-size:13px;margin:12px 0 4px"><strong>'+dep+' | JENIOS</strong></p>'+
 '<p style="color:#6a7280;font-size:12px;margin:0">jenios.com.br</p></td></tr></table>';
}


export const JENIOS_EMAIL_PALETTE=Object.freeze({
  purple:'#7c3aed',purpleSoft:'#ede9fe',purpleLight:'#c084fc',
  green:'#10b981',greenSoft:'#d1fae5',ink:'#0f172a',
  muted:'#475569',subtle:'#64748b',surface:'#f8fafc',line:'#e2e8f0'
});

export function jeniosEmailShell({eyebrow='JENIOS',title,lead='',body='',department='Relacionamento'}={}){
 const safeEyebrow=escapeEmailHtml(eyebrow),safeTitle=escapeEmailHtml(title||''),safeLead=escapeEmailHtml(lead||'');
 return '<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">'+
 '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px"><tr><td align="center">'+
 '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,.08)">'+
 '<tr><td style="padding:28px 32px 22px;background:linear-gradient(135deg,#f5f3ff 0%,#ffffff 58%,#ecfdf5 100%);border-bottom:1px solid #e2e8f0">'+
 '<img src="'+JENIOS_LOGO_URL+'" alt="JENIOS" width="184" style="display:block;max-width:184px;height:auto;margin:0 0 18px">'+
 '<div style="font-size:11px;letter-spacing:1.4px;font-weight:800;color:#7c3aed;text-transform:uppercase">'+safeEyebrow+'</div>'+
 '<h1 style="font-size:26px;line-height:1.25;margin:8px 0 8px;color:#0f172a">'+safeTitle+'</h1>'+
 (safeLead?'<p style="font-size:15px;line-height:1.65;margin:0;color:#475569">'+safeLead+'</p>':'')+
 '</td></tr><tr><td style="padding:28px 32px">'+body+jeniosEmailSignature({department})+'</td></tr>'+
 '</table><p style="font-size:11px;color:#94a3b8;margin:16px 0 0">Mensagem institucional JENIOS · jenios.com.br</p>'+
 '</td></tr></table></body></html>';
}
