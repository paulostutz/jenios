import { createClient } from "@supabase/supabase-js";
import { avaliarIndicador, periodoValido } from "../../../../lib/bankscore/laudo-core.mjs";
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
 const { percentual, revisao }=avaliarIndicador(x);
 return {codigo:x.codigo_instituicao,nome:x.nome_instituicao,periodo:x.periodo,tipo:x.tipo_instituicao,
 percentual,status:x.status,revisao};
}
const HEADERS={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
function fail(e){console.error("BankScore:",e?.code||e?.name||"erro");return Response.json({erro:"Consulta indisponível"},{status:503,headers:HEADERS});}

export async function GET(request){
 try {
 const params=new URL(request.url).searchParams;
 const periodoRaw=params.get("periodo");
 if(periodoRaw && !periodoValido(periodoRaw))return Response.json({erro:"Período inválido"},{status:400,headers:HEADERS});
 let periodo=periodoRaw?Number(periodoRaw):null;
 if(periodo===null){
   const latest=await db().from(TABLE).select("periodo").eq("codigo_indicador","79664").order("periodo",{ascending:false}).limit(1);
   if(latest.error)throw latest.error;
   if(!latest.data?.length)return Response.json({erro:"Nenhum período disponível"},{status:404,headers:HEADERS});
   periodo=Number(latest.data[0].periodo);
 }
 const raw=(params.get("busca")||"").trim().slice(0,80);
 const busca=raw.replace(/[%_,().*\\]/g," ").trim();
 const pagina=Math.min(47,Math.max(1,parseInt(params.get("pagina")||"1",10)||1));
 const tamanho=30;
 let q=db().from(TABLE).select(FIELDS,{count:"exact"}).eq("periodo",periodo).eq("codigo_indicador","79664");
 if(busca)q=q.or(`nome_instituicao.ilike.%${busca}%,codigo_instituicao.ilike.%${busca}%`);
 const {data,count,error}=await q.order("nome_instituicao",{ascending:true}).range((pagina-1)*tamanho,pagina*tamanho-1);
 if(error)throw error;
 return Response.json({periodo,pagina,tamanho,total:count||0,instituicoes:(data||[]).map(transform),
 aviso:"Homologação: dados provisórios, não constituem nota de risco."},{headers:HEADERS});
 }catch(e){return fail(e);}
}
