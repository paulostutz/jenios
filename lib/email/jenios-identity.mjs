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
