/** B167 — service-role-only persistence; all queries require verified Platform user id. */
const table='jenios_platform_demo_broker_connections';
const deny=()=>{throw Object.assign(new Error('DEMO_DATABASE_UNAVAILABLE'),{status:503});};
const one=({data,error})=>{if(error)deny();return data??null;};
export function demoStore(db){
 if(!db?.from)deny();
 return {
  async claimConnectAttempt(owner,provider){const r=await db.rpc('jenios_platform_demo_claim_attempt',{p_user:owner,p_provider:provider});if(r.error)deny();return r.data===true;},
  async findByScope(owner,provider,environment){return one(await db.from(table).select('*').eq('user_id',owner).eq('provider',provider).eq('environment',environment).maybeSingle());},
  async findById(owner,id){return one(await db.from(table).select('*').eq('user_id',owner).eq('id',id).maybeSingle());},
  async list(owner){const result=await db.from(table).select('id,user_id,provider,environment,status,identity_verified,last_sync_at,position_count,open_order_count,last_error_code').eq('user_id',owner).order('created_at',{ascending:false}).limit(24);if(result.error)deny();return result.data||[];},
  async insert(record){const result=await db.from(table).insert(record).select('*').single();if(result.error)deny();return result.data;},
  async removeRevoked(owner,id){const result=await db.from(table).delete().eq('id',id).eq('user_id',owner).eq('status','revoked').select('id');if(result.error)deny();return !!result.data?.length;},
  async claimSync(owner,row,nowIso,leaseUntil){
   const r=await db.from(table).update({sync_lease_until:leaseUntil,revision:row.revision+1}).eq('user_id',owner).eq('id',row.id).eq('status','active').eq('revision',row.revision).lt('sync_lease_until',nowIso).select('id');
   if(r.error)deny();return r.data?.length===1;
  },
  async finishSync(owner,row,changes){
   const r=await db.from(table).update({...changes,sync_lease_until:'1970-01-01T00:00:00.000Z',revision:row.revision+2})
    .eq('user_id',owner).eq('id',row.id).eq('status','active').eq('revision',row.revision+1).select('id');
   if(r.error)deny();return r.data?.length===1;
  },
  async releaseSync(owner,row,code){
   const r=await db.from(table).update({last_error_code:code,sync_lease_until:'1970-01-01T00:00:00.000Z',revision:row.revision+2})
    .eq('user_id',owner).eq('id',row.id).eq('status','active').eq('revision',row.revision+1).select('id');
   if(r.error)deny();return r.data?.length===1;
  },
  async revoke(owner,row){
   const r=await db.from(table).update({status:'revoked',credential_box:null,snapshot_box:null,external_digest:null,revision:row.revision+2,identity_verified:false,last_error_code:null,position_count:0,open_order_count:0,sync_lease_until:'1970-01-01T00:00:00.000Z'})
    .eq('user_id',owner).eq('id',row.id).eq('status','active').select('id');
   if(r.error)deny();return r.data?.length===1;
  }
 };
}
