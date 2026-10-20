import { audienceInput, boostDestination } from './boost.mjs';
import { boostAudienceMatches, boostViewerDemographics } from './boost-audience.mjs';
import { signBoostDelivery, verifyBoostDelivery } from './boost-proof.mjs';
import { POST_FIELDS, publicPost } from './schema.mjs';

export async function serveBoost({ db, viewerDb, user, body, env = process.env, now = Date.now() }) {
  const audience = audienceInput(body), demographics = boostViewerDemographics(body);
  const result = await db.rpc('jenios_boost_candidates', { p_viewer_id: user.id, p_country: audience.country, p_region: audience.region, p_city: audience.city });
  if (result.error) throw result.error;
  for (const campaign of result.data || []) {
    // Demographic filters are checked before loading a post or issuing a signed delivery proof.
    // Missing voluntary data never qualifies for a restricted demographic audience.
    if (!boostAudienceMatches(campaign.target, demographics)) continue;
    // Re-read through the viewer's RLS context. Service-role lookup is not visibility permission.
    const { data: row, error } = await viewerDb.from('posts').select(POST_FIELDS).eq('id', campaign.post_id).maybeSingle();
    if (error) throw error;
    if (!row || row.archived_at || row.author_id !== campaign.owner_id || row.author_id === user.id) continue;
    const profile = await viewerDb.from('profiles').select('display_name,handle').eq('id', campaign.owner_id).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) continue;
    const destination = campaign.target.objective === 'profile' ? '/social/perfil/' + encodeURIComponent(campaign.owner_id) : boostDestination(campaign.target.destination, campaign.target.objective);
    if (!destination) continue;
    return { ad: { campaignId: campaign.order_id, post: publicPost(row), author: { name: profile.data?.display_name || 'Anunciante', handle: profile.data?.handle || '' }, destination, objective: campaign.target.objective, proof: signBoostDelivery(campaign, user.id, { env, now }) } };
  }
  return { ad: null };
}
export async function recordBoostEvent({ db, user, body, env = process.env, now = Date.now() }) {
  if (!['impression', 'click'].includes(body?.kind)) throw Object.assign(new Error('Evento inválido.'), { status: 400 });
  const proof = verifyBoostDelivery(body.proof, user.id, { env, now });
  const result = await db.rpc('jenios_boost_event', { p_order_id: proof.orderId, p_viewer_id: user.id, p_revision: proof.revision, p_kind: body.kind });
  if (result.error) throw result.error;
  return { recorded: result.data === true };
}
