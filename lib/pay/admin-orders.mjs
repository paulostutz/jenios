import { publicOrder } from './orders.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES=['pending','awaiting_payment','paid','failed','cancelled','expired','refunded'];
export async function listAdminOrders(db,{customer='',status=''}={}) {
  customer=String(customer).trim();status=String(status).trim();
  if(customer.length>100 || status&&!STATES.includes(status))throw Object.assign(Error('Filtro inválido.'),{status:400});
  let query=db.from('jenios_pay_orders').select('id,user_id,product_id,amount_cents,currency,status,created_at,external_reference').order('created_at',{ascending:false}).limit(100);
  if(status)query=query.eq('status',status);
  if(customer) {
    if(UUID.test(customer))query=query.eq('user_id',customer);
    else {
      // Only display names, never Auth emails. Escape SQL LIKE wildcard characters.
      const pattern=customer.replace(/[\\%_]/g,char=>'\\'+char);
      const {data,error}=await db.from('profiles').select('id').ilike('display_name',`%${pattern}%`).limit(50);
      if(error)throw error;
      if(!data?.length)return {orders:[],orderLimit:100,customerSearchLimit:50};
      query=query.in('user_id',data.map(row=>row.id));
    }
  }
  const {data,error}=await query;if(error)throw error;
  const ids=[...new Set((data||[]).map(row=>row.user_id))];
  let profiles=[];
  if(ids.length){const result=await db.from('profiles').select('id,display_name').in('id',ids);if(result.error)throw result.error;profiles=result.data||[];}
  return {orders:(data||[]).map(row=>({...publicOrder(row),customerId:row.user_id,customerName:profiles.find(profile=>profile.id===row.user_id)?.display_name||'Cliente sem nome cadastrado'})),orderLimit:100,customerSearchLimit:50};
}
