/** B233: read-only audit of Next routes; never changes a router or starts a server. */
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const forbidden=['app/api/platform/broker-execution/route.js',
 'app/api/platform/paper-execution/route.js','app/api/platform/live-trading/route.js',
 'app/api/platform/private-observer/route.js'];
export function inspectReleaseRouteBoundaries(root){
 if(typeof root!=='string'||!root.startsWith('/'))throw Error('B233_ABSOLUTE_SOURCE_ROOT_REQUIRED');
 const found=forbidden.filter(path=>existsSync(resolve(root,path)));
 const qa=resolve(root,'app/platform/homologacao/page.js');
 if(!existsSync(qa))throw Error('B233_QA_PAGE_MISSING');
 const content=readFileSync(qa,'utf8');
 const qaRuntimeGated=content.includes("process.env.VERCEL_ENV!=='preview'")&&
  content.includes("process.env.JENIOS_QA_CANDIDATE_ENABLED!=='true'")&&content.includes('notFound()');
 return Object.freeze({schema:'JENIOS_B233_PUBLIC_ROUTE_GUARD',
  forbiddenRoutesFound:Object.freeze(found),previewStaticInformationGated:qaRuntimeGated,
  compliant:found.length===0&&qaRuntimeGated,
  mutations:0,networkCalls:0,realOrderRoutesCertified:false});
}
