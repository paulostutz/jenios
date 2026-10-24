/** B282: no more prepaid AI credits; existing historical settlements remain read-only internally. */
export const dynamic='force-dynamic';export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){
 return Response.json({ok:false,code:'AI_CREDITS_SALES_DISABLED',
  error:'O suporte avançado está incluído exclusivamente nos planos de R$ 149,90 e R$ 199,90. Não há pacotes avulsos.'},
 {status:410,headers});
}
