import {randomBytes,createHash} from 'node:crypto';
import {assistantSameOrigin} from '../connections/request-origin.mjs';
import {validateOperation} from './operation.mjs';
import {ultraPeriodStart} from './reporting.mjs';
import {workspaceReportViewR125 as workspaceReportView} from './client/report-r125.mjs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const deviceTokenHash=token=>createHash('sha256').update(token).digest('hex');
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
async function body(request,max){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))fail(415,'Formato não suportado.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Dados ausentes.');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'Envie um lote menor.');}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'Dados inválidos.');}
}
function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(400,'Dados inválidos.');}
async function owner(request,db){const token=(request.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i)?.[1];if(!token)fail(401,'Entre com sua conta da Platform.');const {data,error}=await db.auth.getUser(token);if(error||!data?.user?.id||data.user.is_anonymous)fail(401,'Entre com sua conta da Platform.');return data.user.id;}
export async function devicesHttp(request,{getAdmin,now=()=>new Date(),random=randomBytes}={}){
 try{
  const db=getAdmin(),userId=await owner(request,db);
  if(request.method==='GET'){
   const url=new URL(request.url),environment=url.searchParams.get('environment')||'live',period=url.searchParams.get('period')||'30d',page=Number(url.searchParams.get('page')||0);
   const deviceId=url.searchParams.get('deviceId');
   if(!['demo','live'].includes(environment)||!Number.isSafeInteger(page)||page<0||page>100000||(deviceId!==null&&!uuid(deviceId))||[...url.searchParams.keys()].some(k=>!['environment','period','page','deviceId'].includes(k)))fail(400,'Filtro inválido.');
   let since;try{since=ultraPeriodStart(period,now());}catch{fail(400,'Período inválido.');}
   if(deviceId){
    const devices=await db.from('jenios_ultra_devices').select('id,label,provider,market,environment,created_at,expires_at,revoked_at,last_seen_at,runtime_state').eq('user_id',userId).order('created_at',{ascending:false}).limit(100);
    if(devices.error)fail(503,'Não foi possível consultar as conexões.');
    const selected=devices.data?.find(d=>d.id===deviceId&&d.environment===environment);
    if(!selected)fail(404,'Conexão não encontrada neste ambiente.');
    // One bounded read. Reject truncated responses instead of showing partial totals.
    const rows=await db.from('jenios_ultra_operations').select('payload',{count:'exact'}).eq('user_id',userId).eq('device_id',deviceId).limit(5001);
    if(rows.error||!Array.isArray(rows.data)||!Number.isSafeInteger(rows.count)||rows.count!==rows.data.length||rows.count>5000)fail(503,'O histórico desta conexão precisa de uma consulta completa. Use o relatório local enquanto a exportação é preparada.');
    if(rows.data.some(r=>r.payload?.market!==selected.market))fail(503,'O mercado dos registros não corresponde à conexão selecionada.');
    const observed=now();let report;
    try{report=workspaceReportView({schema:'JENIOS_ULTRA_OPERATIONS_V1',provider:selected.provider,environment,connectionLabel:selected.label,generatedAt:observed.toISOString(),operations:rows.data.map(r=>r.payload)},{period,page,now:observed});}
    catch{fail(503,'Não foi possível consolidar os registros desta conexão.');}
    report.operations=report.operations.map(o=>({...o,deviceId,deviceLabel:selected.label,provider:selected.provider,environment}));
    return reply({ok:true,devices:devices.data,report:{...report,days:[],accountScope:'single_sync_connection',independentlyVerified:false}});
   }
   const [devices,report]=await Promise.all([
    db.from('jenios_ultra_devices').select('id,label,provider,market,environment,created_at,expires_at,revoked_at,last_seen_at,runtime_state').eq('user_id',userId).order('created_at',{ascending:false}).limit(100),
    db.rpc('jenios_ultra_operations_report',{p_user_id:userId,p_environment:environment,p_since:since,p_until:now().toISOString(),p_page:page})
   ]);
   if(devices.error||report.error)fail(503,'Não foi possível consultar o acompanhamento.');
   return reply({ok:true,devices:devices.data||[],report:report.data});
  }
  if(request.method!=='POST')return reply({ok:false,error:'Método inválido.'},405);
  if(!request.headers.has('origin')||!assistantSameOrigin(request))fail(403,'Origem não autorizada.');
  const input=await body(request,4096);exact(input,['action','label','provider','market','environment','deviceId']);
  if(input.action==='revoke'){
   if(!uuid(input.deviceId))fail(400,'Conexão inválida.');
   const result=await db.from('jenios_ultra_devices').update({revoked_at:now().toISOString()}).eq('user_id',userId).eq('id',input.deviceId).select('id');
   if(result.error)fail(503,'Não foi possível revogar a sincronização.');if(!result.data?.length)fail(404,'Conexão não encontrada.');return reply({ok:true});
  }
  if(input.action!=='create'||typeof input.label!=='string'||input.label.trim().length<1||input.label.length>80||!['profit','binance','mt5'].includes(input.provider)||!['b3','crypto','forex'].includes(input.market)||!['demo','live'].includes(input.environment)||input.provider==='profit'&&input.market!=='b3'||input.provider==='binance'&&input.market!=='crypto'||input.provider==='mt5'&&input.market==='crypto')fail(400,'Confira os dados do robô.');
  const token='ju_dev_'+random(32).toString('hex');
  const result=await db.from('jenios_ultra_devices').insert({user_id:userId,label:input.label.trim(),provider:input.provider,market:input.market,environment:input.environment,token_hash:deviceTokenHash(token)}).select('id,label,provider,market,environment,expires_at').single();
  if(result.error)fail(503,'Não foi possível preparar a sincronização.');
  return reply({ok:true,device:result.data,token,scope:'operations_upload_only'},201);
 }catch(e){return reply({ok:false,error:e.status?e.message:'Acompanhamento indisponível.'},e.status||503);}
}
export async function telemetryHttp(request,{getAdmin,now=Date.now}={}){
 try{
  if(request.method!=='POST')return reply({ok:false,error:'Método inválido.'},405);
  const token=(request.headers.get('authorization')||'').match(/^Bearer (ju_dev_[a-f0-9]{64})$/)?.[1];if(!token)fail(401,'Sincronização não autorizada.');
  const input=await body(request,300000);exact(input,['schema','operations','runtimeState','provider','environment','connectionFingerprint']);
  if(!['profit','binance','mt5'].includes(input.provider)||!['demo','live'].includes(input.environment)||typeof input.connectionFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(input.connectionFingerprint)||input.schema!=='JENIOS_ULTRA_TELEMETRY_V1'||!Array.isArray(input.operations)||input.operations.length>100||!['idle','monitoring','running','paused','reconciling','error'].includes(input.runtimeState))fail(400,'Lote inválido.');
  let operations;try{operations=input.operations.map(o=>validateOperation(o,{now:now()}));}catch{fail(400,'Registro de operação inválido.');}
  const result=await getAdmin().rpc('jenios_ultra_ingest',{p_token_hash:deviceTokenHash(token),p_operations:operations,p_runtime_state:input.runtimeState,p_provider:input.provider,p_environment:input.environment,p_fingerprint:input.connectionFingerprint});
  if(result.error){const message=String(result.error.message||'');if(message.includes('ULTRA_DEVICE_UNAUTHORIZED'))fail(401,'Sincronização expirada ou revogada.');if(message.includes('ULTRA_'))fail(409,'O registro conflita com o histórico. Confira a conciliação local.');fail(503,'Sincronização temporariamente indisponível.');}
  return reply(result.data);
 }catch(e){return reply({ok:false,error:e.status?e.message:'Sincronização indisponível.'},e.status||503);}
}
