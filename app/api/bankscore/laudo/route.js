import { avaliarIndicador, periodoValido } from '../../../../lib/bankscore/laudo-core.mjs';
import { montarLaudo } from '../../../../lib/bankscore/report-core.mjs';
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const TABLE = "jenios_bankscore_homologacao";
const FIELDS = "codigo_instituicao,nome_instituicao,periodo,tipo_instituicao,codigo_indicador,indice_basileia_bruto,indice_basileia_percentual_provisorio,status";
function db() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error("CONFIG");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function transform(x) {
 const { percentual, revisao } = avaliarIndicador(x);
 return {codigo:x.codigo_instituicao,nome:x.nome_instituicao,periodo:x.periodo,tipo:x.tipo_instituicao,
 percentual:Number.isFinite(percentual)?percentual:null,status:x.status,
 revisao};
}
const HEADERS={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
function fail(e){console.error("BankScore:",e?.code||e?.name||"erro");return Response.json({erro:"Consulta indisponível"},{status:503,headers:HEADERS});}

export async function GET(request){
 try {
 const params=new URL(request.url).searchParams;
 const codigo=params.get("codigo")||"";
 const periodoRaw=params.get("periodo");
 if(periodoRaw && !periodoValido(periodoRaw))return Response.json({erro:"Período inválido"},{status:400,headers:HEADERS});
 let periodo=periodoRaw?Number(periodoRaw):null;
 if (periodo === null) {
   const latest=await db().from(TABLE).select('periodo').eq('codigo_indicador','79664').order('periodo',{ascending:false}).limit(1);
   if(latest.error)throw latest.error;
   if(!latest.data?.length)return Response.json({erro:'Nenhum período disponível'},{status:404,headers:HEADERS});
   periodo=latest.data[0].periodo;
 }
 if(!/^(?:\d{1,12}|C\d{1,12})$/.test(codigo))return Response.json({erro:"Código inválido"},{status:400,headers:HEADERS});
 const {data,error}=await db().from(TABLE).select(FIELDS).eq("periodo",periodo).eq("codigo_indicador","79664").eq("codigo_instituicao",codigo).limit(2);
 if(error)throw error;
 if(!data?.length)return Response.json({erro:"Instituição não encontrada"},{status:404,headers:HEADERS});
 if(data.length>1)return Response.json({erro:"Dados duplicados: revisão necessária"},{status:409,headers:HEADERS});
 const item=transform(data[0]);
 return Response.json(montarLaudo(item),{headers:HEADERS});
 }catch(e){return fail(e);}
}
