import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {createReversoSubscriptionHandlerV2} from '../../../../../lib/platform/reverso/subscription/http-v2.mjs';
import {createReversoPublishedSubscriptionSource} from '../../../../../lib/platform/reverso/publication-boundary-v1.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function dispatch(request) {
  let db;
  const getUser = async req => {
    const token = req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i)?.[1];
    if (!token) return null;
    db ??= getJeniosPlatformAdmin();
    const {data, error} = await db.auth.getUser(token);
    return error ? null : data?.user;
  };
  return createReversoSubscriptionHandlerV2({getUser,
    source: createReversoPublishedSubscriptionSource({env: process.env})})(request);
}
export async function GET(request) { return dispatch(request); }
export async function POST(request) { return dispatch(request); }
