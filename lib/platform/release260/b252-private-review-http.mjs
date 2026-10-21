/** B252: Preview-only authenticated *read-only* Platform release review.
 * No buyer data, account identifiers, trading intents, tokens or secrets returned.
 * Product-owner review is NOT an approval to deploy or start financial operations.
 */
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};
function reply(status,data){return Response.json(data,{status,headers});}
export async function privateReadinessHttp(request,{env=process.env,createDb,authorize}={}){
 if(env?.VERCEL_ENV!=='preview'||env?.JENIOS_QA_CANDIDATE_ENABLED!=='true'||
    env?.JENIOS_QA_ADMIN_READONLY_ENABLED!=='true')return reply(404,{error:'NOT_AVAILABLE'});
 if(request?.method!=='GET')return reply(405,{error:'METHOD_NOT_ALLOWED'});
 if(typeof createDb!=='function'||typeof authorize!=='function')return reply(503,{error:'QA_BACKEND_UNAVAILABLE'});
 try{
   const db=createDb();
   const grant=await authorize(request,db,'platform.admin');
   if(!grant?.user?.id||!Array.isArray(grant.permissions)||!grant.permissions.includes('platform.admin'))
     return reply(403,{error:'QA_ADMIN_REQUIRED'});
   return reply(200,{schema:'JENIOS_B252_PRIVATE_RELEASE_REVIEW',
     authenticatedPlatformAdministrator:true,
     currentRelease:'B250_TECHNICAL_CANDIDATE',
     checks:['AUTHENTICATED_BROWSER_QA','EXTERNAL_PAYMENT_SANDBOX',
       'INDEPENDENT_BROKER_PAPER_QA','OWNER_RELEASE_REVIEW'],
     externalPaymentCertified:false,brokerPaperCertified:false,
     prospectiveRobotsCertified:false,productionPromotionAuthorized:false,
     ordersSent:0,chargesCreated:0,liveExecution:false});
 }catch(error){
   const status=[401,403].includes(error?.status)?error.status:503;
   return reply(status,{error:status===401?'PLATFORM_LOGIN_REQUIRED':
     status===403?'QA_ADMIN_REQUIRED':'QA_BACKEND_UNAVAILABLE'});
 }
}
