import {filterBuyer} from './buyer.mjs';
import {publicOrder} from './orders.mjs';
import {createInterPixClient,verifyPixCharge,pixTxid,interPixConfigured} from './inter-pix.mjs';
import {loadJeniosInterServerEnv} from './inter-vault.mjs';
const fail=(message,status)=>Object.assign(Error(message),{status});
export async function pixStatus({db,user,id,client=null,env=process.env}) {
  pixTxid(id);
  const {data:order,error}=await filterBuyer(db.from('jenios_pay_orders').select('*').eq('id',id),user).maybeSingle();
  if(error)throw fail('Não foi possível consultar o pedido.',503);
  if(!order)throw fail('Pedido não encontrado.',404);
  const {data:payment,error:paymentError}=await db.from('jenios_pay_payments').select('id,amount_cents,provider_payment_id').eq('order_id',id).eq('provider','inter_pix').maybeSingle();
  if(paymentError)throw fail('Não foi possível consultar o pagamento.',503);
  if(!payment||payment.amount_cents!==order.amount_cents||payment.provider_payment_id!==pixTxid(id))throw fail('Este pedido não possui cobrança Pix.',404);
  if(['paid','cancelled','expired','refunded'].includes(order.status))return {...publicOrder(order),orderId:id};
  const runtimeEnv=env.JENIOS_PAY_PROVIDER==='inter_pix'&&!interPixConfigured(env)&&
   env.JENIOS_INTER_CHARGES_ENABLED==='true'
   ?await loadJeniosInterServerEnv(db,env):env;
  const providerClient=client||createInterPixClient({env:runtimeEnv});
  const charge=await providerClient.read(payment.provider_payment_id);
  const verified=verifyPixCharge(charge,order,{env:runtimeEnv});
  if(verified.status==='paid'){
    const {error:confirmError}=await db.rpc('jenios_confirm_inter_pix',{p_order_id:id,p_txid:verified.txid,p_amount:order.amount_cents,p_end_to_end_id:verified.paymentId,p_paid_at:verified.paidAt});
    if(confirmError)throw fail('O banco confirmou o recebimento. A liberação está em conferência; consulte novamente sem fazer outro pagamento.',503);
  }
  // Expiry/cancellation is displayed from the bank. Keep the local order retryable
  // so a bank-confirmed payment arriving concurrently can still be reconciled.
  return {...publicOrder(order),orderId:id,status:verified.status,...(verified.pixCode?{pixCode:verified.pixCode,expiresAt:verified.expiresAt}:{})};
}
