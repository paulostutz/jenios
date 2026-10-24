/** Object-presence check only: never an authorization to send or release production. */
export const EMAIL_DATABASE_OBJECTS=Object.freeze([
 'financeOutbox','transactionalOutbox','dunningOutbox','marketingLedger',
 'marketingPreferences','newsletterEditions','resendEvents','financeRecipientIndex',
 'transactionalClaim','transactionalComplete','dunningClaim','marketingPlanner',
 'marketingClaim','marketingSuppress','resendSuppressionRpc',
 'universityMilestoneTrigger','subscriptionLifecycleTrigger'
]);
export function sanitizeEmailDatabasePreflight(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const checks=Object.fromEntries(EMAIL_DATABASE_OBJECTS.map(key=>[key,source[key]===true]));
 return Object.freeze({...checks,allRequired:source.allRequired===true&&Object.values(checks).every(Boolean)});
}
export async function readEmailDatabasePreflight(db){
 try{
  if(typeof db?.rpc!=='function')return sanitizeEmailDatabasePreflight(null);
  const result=await db.rpc('jenios_email_preflight_b305');
  return sanitizeEmailDatabasePreflight(result?.error?null:result?.data);
 }catch{return sanitizeEmailDatabasePreflight(null);}
}
