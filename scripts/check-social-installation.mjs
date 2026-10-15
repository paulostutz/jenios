// Read-only installation check. Never migrates, changes flags, seeds prices or charges.
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const env=process.env;
const results=[];
const record=(name,ok,note)=>results.push({name,status:ok?'OK':'PENDENTE',note});
const url=env.NEXT_PUBLIC_SUPABASE_URL;
const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
const publishable=env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
record('Supabase servidor',Boolean(url&&secret),'URL e credencial administrativa somente no servidor.');
record('Supabase navegador',Boolean(url&&publishable),'URL e chave pública para autenticação existente.');
let checkoutValid=false;
try {const parsed=new URL(env.JENIOS_PAY_CHECKOUT_URL);checkoutValid=parsed.protocol==='https:'&&!parsed.username&&!parsed.password;}catch{}
record('Endpoint JENIOS PAY',checkoutValid&&Boolean(env.JENIOS_PAY_API_TOKEN),'Verificação de presença/formato; não chama PAY nem valida compatibilidade do contrato.');
record('Especialistas ativados',env.JENIOS_SPECIALIST_ORDERS_ENABLED==='true','Requer migração de atendimentos instalada.');
record('Campanhas ativadas',env.JENIOS_BOOST_CAMPAIGNS_ENABLED==='true','Requer migração de campanhas instalada.');
record('Assinatura de exibição',Buffer.byteLength(env.JENIOS_BOOST_SIGNING_SECRET||'','utf8')>=32,'Chave própria de pelo menos 32 bytes; valor nunca impresso.');
record('Patrocinados no feed',env.NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED==='true','Variável pública requer novo build após alteração.');
record('Mídia remota',env.NEXT_PUBLIC_SOCIAL_REMOTE_MEDIA_ENABLED==='true','Mídias locais não substituem armazenamento compartilhado.');
if(url&&secret) {
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,options)=>fetch(input,{...options,signal:AbortSignal.timeout(10000)})}});
  const tables=[
    ['jenios_pay_orders','id,user_id,status,amount_cents,currency,external_reference'],
    ['jenios_pay_products','code,price_cents,currency,active,billing_type,updated_at'],
    ['jenios_specialist_orders','order_id,buyer_id,seller_id,snapshot,state,revision'],
    ['jenios_boost_campaigns','order_id,owner_id,post_id,target,state,starts_at,ends_at,revision'],
    ['jenios_boost_events','order_id,viewer_id,event_day,kind'],
    ['posts','id,author_id,body,media_type,media_path'],
    ['user_blocks','blocker_id,blocked_id'],
  ];
  const checks=await Promise.allSettled(tables.map(async([table,columns])=>{
    const {error}=await db.from(table).select(columns,{head:true}).limit(0);
    return {table,error};
  }));
  checks.forEach((outcome,index)=>record(`Estrutura ${tables[index][0]}`,outcome.status==='fulfilled'&&!outcome.value.error,'Consulta somente leitura; falha pode ser estrutura, privilégio, rede ou configuração. Não cria tabela alternativa.'));
  try {
    const {data,error}=await db.storage.listBuckets();
    const bucket=data?.find(item=>item.id===(env.SOCIAL_MEDIA_BUCKET||'social-media'));
    record('Bucket de mídia',!error&&Boolean(bucket?.public),'Bucket público esperado pelo fluxo existente; não criado nem alterado.');
  }catch{record('Bucket de mídia',false,'Consulta indisponível; nenhuma alteração.');}
}else record('Inspeção de estruturas',false,'Não executada: configuração administrativa ausente.');
// Structural success is deliberately not labelled a completed/homologated Social.
console.log(JSON.stringify({readOnly:true,configurationChecks:results,notValidated:['RLS e permissões de RPC','Compatibilidade do checkout PAY e confirmação real','Emissão paga real do laudo BankScore no escopo de capitalização','Criação dos tokens e identidade institucional','Inventário completo de tokens do Validador','Navegador, duas contas reais e entrega dos serviços','Recorrência da Platform, em área separada']},null,2));
if(results.some(item=>item.status==='PENDENTE'))process.exitCode=1;
