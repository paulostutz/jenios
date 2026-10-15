import {socialContext} from '../auth.mjs';import {validUUID} from '../validation.mjs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const offset=Number(new URL(request.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return reply({error:'INVALID_OFFSET'},400);
 const rows=await ctx.db.from('user_blocks').select('blocked_id,created_at').eq('blocker_id',ctx.userId).order('created_at',{ascending:false}).order('blocked_id',{ascending:false}).range(offset,offset+49);
 if(rows.error)return reply({error:'BLOCKS_UNAVAILABLE'},503);
 const ids=(rows.data||[]).map(x=>x.blocked_id),profiles=ids.length?await ctx.db.from('profiles').select('id,handle,display_name').in('id',ids):{data:[]};
 if(profiles.error)return reply({error:'BLOCKS_UNAVAILABLE'},503);
 return reply({profiles:ids.map(id=>profiles.data.find(p=>p.id===id)||{id,display_name:'Conta indisponível'}),nextOffset:ids.length===50?offset+50:null});
}
export async function POST(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 let body;try{body=await request.json();}catch{return reply({error:'INVALID_JSON'},400);}
 if(!validUUID(body?.id)||body.id===ctx.userId)return reply({error:'INVALID_PROFILE'},400);
 const result=await ctx.db.from('user_blocks').upsert({blocker_id:ctx.userId,blocked_id:body.id},{onConflict:'blocker_id,blocked_id',ignoreDuplicates:true});
 return result.error?reply({error:'BLOCK_NOT_SAVED'},503):reply({blocked:true});
}
export async function DELETE(request){
 const ctx=await socialContext(request);if(ctx.error)return reply({error:ctx.error},ctx.status);
 const id=new URL(request.url).searchParams.get('id');if(!validUUID(id))return reply({error:'INVALID_PROFILE'},400);
 const result=await ctx.db.from('user_blocks').delete().eq('blocker_id',ctx.userId).eq('blocked_id',id);
 return result.error?reply({error:'BLOCK_NOT_REMOVED'},503):reply({blocked:false});
}
