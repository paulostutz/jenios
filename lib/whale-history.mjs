import {validWhaleEvent} from './whale-transfers.mjs';
export function createWhaleHistory(db){
 return {
  async read(){const {data,error}=await db.from('jenios_whale_events').select('id,occurred_at,amount_btc').order('occurred_at',{ascending:false}).order('id',{ascending:false}).limit(3).abortSignal(AbortSignal.timeout(3000));if(error)throw error;return (data||[]).map(row=>({id:row.id,data:row.occurred_at,quantidade:Number(row.amount_btc)}));},
  async save(rows){const valid=rows.filter(row=>validWhaleEvent(row));if(!valid.length)return;const {error}=await db.from('jenios_whale_events').upsert(valid.map(row=>({id:row.id,occurred_at:row.data,amount_btc:row.quantidade})),{onConflict:'id',ignoreDuplicates:true}).abortSignal(AbortSignal.timeout(3000));if(error)throw error;}
 };
}
