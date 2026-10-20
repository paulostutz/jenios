import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {handleAssistant} from '../../../../lib/assistant/service.mjs';
// Grátis é sempre offline/local: este endpoint nunca utiliza uma API generativa paga.
import {ASSISTANT_HEADERS} from '../../../../lib/assistant/contracts.mjs';
import {GET as trends} from '../../tendencias/route';
import {GET as bankscoreSearch} from '../../bankscore/instituicoes/route';
import {GET as bankscoreBasic} from '../../bankscore/laudo/route';
import {POST as bankscoreFull} from '../../bankscore/detailed/route';
import {POST as cryptoBasic} from '../../crypto-validator/route';
import {POST as cryptoFull} from '../../crypto-validator/detailed/route';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
const handlers={trends,bankscoreSearch,bankscoreBasic,bankscoreFull,cryptoBasic,cryptoFull};
async function handle(request){try{requirePayToken(request);return await handleAssistant(request,{db:getJeniosPayAdmin(),handlers,env:{...process.env,OPENAI_API_KEY:'',JENIOS_ASSISTANT_MODEL:''}});}catch(e){return Response.json({ok:false,error:e.status?e.message:'Atendimento não configurado.',executionEnabled:false},{status:e.status||503,headers:ASSISTANT_HEADERS});}}
export const GET=handle;export const POST=handle;