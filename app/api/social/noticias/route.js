import {loadNews} from '../../../../lib/socialNews.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  return Response.json(await loadNews(),{headers:{'Cache-Control':'no-store'}});
}
