import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {requirePlatformAdmin} from '../../../../../lib/platform/admin-permissions.mjs';
import {privateReadinessHttp} from '../../../../../lib/platform/release260/b252-private-review-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** B252: disabled on production regardless of flags; dedicated Platform DB only. */
export async function GET(request){
 return privateReadinessHttp(request,{createDb:getJeniosPlatformAdmin,authorize:requirePlatformAdmin});
}
