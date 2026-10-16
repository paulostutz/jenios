import {createSocialFeedClient, SocialFeedError} from './feed-client.mjs';

// Every request belongs to the account that started the action, including after awaits.
export function createScopedFeedClient({auth, fence, ticket, fetchImpl}) {
  return createSocialFeedClient({fetchImpl, getAccessToken: async () => {
    const valid = () => ticket.owner && fence.current(ticket);
    if (!valid()) throw new SocialFeedError('SESSION_CHANGED', 401);
    const result = await auth.getSession();
    if (!valid()) throw new SocialFeedError('SESSION_CHANGED', 401);
    if (result.error) throw new SocialFeedError('INVALID_SESSION', 401);
    const session = result.data?.session;
    if (session?.user?.id !== ticket.owner || session.user.is_anonymous) {
      throw new SocialFeedError('SESSION_CHANGED', 401);
    }
    return session.access_token;
  }});
}
