import {providerPaths} from '../../../../lib/platform/connections/provider-paths.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 return Response.json({ok:true,schema:'JENIOS_B171_PROVIDER_ROUTES',
  totalGuides:12,providerRoutes:providerPaths(),
  credentialsAccepted:false,accountAuthenticated:false,demoOrdersCertified:false,
  realOrdersEnabled:false,withdrawalsEnabled:false,custody:false},
 {headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
