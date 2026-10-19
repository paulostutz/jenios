/** B85: inspect two identity providers independently. This never links accounts
 * or conveys role, private diagnostics, subscriptions, or access tokens.
 */
const validUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
async function currentVerifiedUser(client){
 if(!client?.auth?.getUser)return null;
 try{
  const {data,error}=await client.auth.getUser();
  return !error&&validUuid(data?.user?.id)&&!data.user.is_anonymous?data.user:null;
 }catch{return null;}
}
export function describeIndependentSessions(social,platform,profileVerified=false){
 const socialOk=Boolean(profileVerified&&validUuid(social?.id)&&!social?.is_anonymous);
 const platformOk=Boolean(validUuid(platform?.id)&&!platform?.is_anonymous);
 return Object.freeze({
  socialVerified:socialOk,platformVerified:platformOk,
  state:socialOk&&platformOk?'both_unlinked':socialOk?'social_simulation_only':
    platformOk?'platform_private_only':'guest',
  linkVerified:false,
  canReadPrivatePlatformDataFromSocial:false,
  canUsePaidPlatformFromSocial:false,
  canAdminPlatformFromSocial:false,
  canExecuteReal:false
 });
}
export async function inspectIndependentSessions({socialClient,platformClient,socialProfileGate}={}){
 const [social,platform]=await Promise.all([
  currentVerifiedUser(socialClient),currentVerifiedUser(platformClient)
 ]);
 let verifiedProfile=false;
 if(social&&typeof socialProfileGate==='function'){
  try{
   const profile=await socialProfileGate(socialClient);
   const again=await currentVerifiedUser(socialClient);
   verifiedProfile=profile?.status==='ready'&&profile.userId===social.id&&again?.id===social.id;
  }catch{}
 }
 return describeIndependentSessions(social,platform,verifiedProfile);
}
