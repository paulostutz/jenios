import {gatewayConfig} from '../pay/gateway.mjs';
import {boostEnabled} from './boost.mjs';
import {assertBoostSigningConfig} from './boost-proof.mjs';
/** Public readiness only. Never returns credentials, key values or a fabricated checkout. */
export function boostReadiness(env=process.env){
 let payment=false,signing=false;
 try{payment=Boolean(gatewayConfig(env));}catch{}
 try{assertBoostSigningConfig(env);signing=true;}catch{}
 const campaigns=boostEnabled(env),distribution=env.NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED==='true';
 const ready=payment&&campaigns&&signing&&distribution;
 return {ready,method:env.JENIOS_PAY_PROVIDER==='inter_pix'?'pix':'checkout',message:!payment?'O pagamento está indisponível porque a integração financeira da JENIOS PAY ainda não está pronta neste ambiente.':!ready?'A veiculação de campanhas ainda depende da configuração administrativa. O pagamento não será iniciado.':'Pagamento disponível. Confira e confirme os dados da campanha.'};
}
