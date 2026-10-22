import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {requirePlatformAdmin} from '../../../../../lib/platform/admin-permissions.mjs';
import {b303BrokerPreflightHttp} from '../../../../../lib/platform/connections/b303-private-preview-readiness.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** B303 Preview-only; requires an authenticated admin of the dedicated Platform DB. */
export async function GET(request){return b303BrokerPreflightHttp(request,
 {createDb:getJeniosPlatformAdmin,authorize:requirePlatformAdmin});}