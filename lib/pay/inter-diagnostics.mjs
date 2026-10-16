import {createPrivateKey,createPublicKey,X509Certificate} from 'node:crypto';
import {createInterPixClient,interPixConfigured} from './inter-pix.mjs';
const keys=['INTER_CLIENT_ID','INTER_CLIENT_SECRET','INTER_CERTIFICATE','INTER_PRIVATE_KEY','INTER_PIX_KEY'];
export function interConfiguration(env=process.env){
 const variables=keys.map(key=>({key,present:Boolean(env[key]?.trim())}));
 let certificate='missing',validUntil=null;
 if(env.INTER_CERTIFICATE&&env.INTER_PRIVATE_KEY){try{
  const cert=new X509Certificate(env.INTER_CERTIFICATE.replace(/\\n/g,'\n')),privateKey=createPrivateKey(env.INTER_PRIVATE_KEY.replace(/\\n/g,'\n'));
  const matches=cert.publicKey.export({type:'spki',format:'der'}).equals(createPublicKey(privateKey).export({type:'spki',format:'der'}));
  validUntil=cert.validTo;certificate=!matches?'mismatch':Date.parse(cert.validTo)<=Date.now()?'expired':Date.parse(cert.validFrom)>Date.now()?'not_yet_valid':'valid';
 }catch{certificate='invalid';}}
 return {variables,providerEnabled:env.JENIOS_PAY_PROVIDER==='inter_pix',configured:Boolean(interPixConfigured(env)),certificate,validUntil,branch:env.VERCEL_GIT_COMMIT_REF||null};
}
export async function diagnoseInter({env=process.env,client=createInterPixClient({env})}={}){
 const config=interConfiguration(env);
 if(!config.configured)return {...config,authenticated:false,message:'Disponibilize as variáveis ausentes nesta branch e selecione JENIOS_PAY_PROVIDER=inter_pix.'};
 if(config.certificate!=='valid')return {...config,authenticated:false,message:'Confira validade, formato e correspondência do certificado com a chave privada.'};
 // A read-only probe requests both required scopes; it never creates a charge.
 try{await client.read('00000000000000000000000000000000');}
 catch(e){if(e.bankStatus!==404)throw e;}
 return {...config,authenticated:true,message:'Conexão e consulta Pix confirmadas. A autenticação solicitou cob.read e cob.write. Valide a emissão pelo botão de compra; este teste não cria cobrança.'};
}
