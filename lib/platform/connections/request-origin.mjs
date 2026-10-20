/** Exact-origin guard with a loopback-only canonical-host fallback for local Next.js.
 * Never trusts X-Forwarded-Host and never permits a foreign or opaque browser origin.
 */
const loopback=host=>['localhost','127.0.0.1','[::1]'].includes(host);
export function assistantSameOrigin(request){
 const raw=request.headers.get('origin');
 if(raw===null)return true;
 try{
  const origin=new URL(raw),url=new URL(request.url);
  if(raw!==origin.origin||!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||request.headers.get('sec-fetch-site')==='cross-site')return false;
  if(raw===url.origin)return true;
  // Next may canonicalize a loopback request URL differently from its HTTP Host.
  // This exception is limited to two loopback authorities; external hosts never qualify.
  const host=request.headers.get('host');
  if(!loopback(url.hostname)||!host||!/^[A-Za-z0-9.:[\]-]+$/.test(host))return false;
  const authority=new URL(url.protocol+'//'+host);
  return loopback(authority.hostname)&&raw===authority.origin;
 }catch{return false;}
}
