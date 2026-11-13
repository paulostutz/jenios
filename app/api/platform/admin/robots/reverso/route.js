import { getJeniosPlatformAdmin } from '../../../../../../lib/platform/admin-db.mjs';
import { requirePlatformAdmin } from '../../../../../../lib/platform/admin-permissions.mjs';
import { createReversoStateHandler } from '../../../../../../lib/platform/reverso/http.mjs';
import { createReversoPublishedStateSource } from '../../../../../../lib/platform/reverso/publication-boundary-v1.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  let db;
  const getUser = async req => {
    const token = req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i)?.[1];
    if (!token) return null;
    db ??= getJeniosPlatformAdmin();
    const { data, error } = await db.auth.getUser(token);
    return error ? null : data?.user;
  };
  return createReversoStateHandler({ admin: true, getUser,
    requireAdmin: req => requirePlatformAdmin(req, db, 'platform.admin'),
    readState: createReversoPublishedStateSource({ env: process.env }) })(request);
}
