import { createClient } from '@supabase/supabase-js';
import { lerTodasPaginas, prepararRanking } from '../../../../lib/bankscore/ranking-core.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const TABLE = 'jenios_bankscore_homologacao';
const FIELDS = 'codigo_instituicao,nome_instituicao,periodo,tipo_instituicao,codigo_indicador,indice_basileia_bruto,indice_basileia_percentual_provisorio,status';
const HEADERS = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers:HEADERS});
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ranking:[],codigo:'CONFIG',erro:'BankScore não configurado'},503);
  try {
    const db = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const ultimo = await db.from(TABLE).select('periodo').eq('codigo_indicador','79664').order('periodo',{ascending:false}).limit(1);
    if (ultimo.error) throw ultimo.error;
    const periodo = ultimo.data?.[0]?.periodo;
    if (periodo == null) return json({ranking:[],universo:0,elegiveis:0,periodo:null,aviso:'Nenhum período disponível.'});
    const registros = await lerTodasPaginas(async (inicio,fim) => {
      const res = await db.from(TABLE).select(FIELDS).eq('periodo',periodo).eq('codigo_indicador','79664').order('codigo_instituicao',{ascending:true}).range(inicio,fim);
      if (res.error) throw res.error;
      return res.data || [];
    });
    return json(prepararRanking(registros,periodo));
  } catch (error) {
    console.error('BankScore ranking:',error?.code || error?.message || 'consulta-falhou');
    return json({ranking:[],codigo:'CONSULTA',erro:'Não foi possível consultar o ranking completo.'},503);
  }
}
