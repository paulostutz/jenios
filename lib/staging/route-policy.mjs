/**
 * S04-B12: deliberately tiny staging attack surface. This source is ONLY to be
 * published on jenios-s04-b12-staging-integracao-20261017, never on production.
 * Do not add BankScore, validator, PAY, Inter, user content, or trial routes.
 */
const pages = new Set(['/login', '/cadastro', '/s04-laboratorio', '/auth/confirm', '/recuperar-senha', '/redefinir-senha']);
const publicAssets = new Set(['/favicon.ico', '/icon.svg', '/robots.txt']);
const publicRpc = new Set(['/api/social/handles','/api/s05/video-readiness']);
const methods = new Set(['GET', 'HEAD']);

export function stagingRouteDecision(pathname, method = 'GET') {
  if (typeof pathname !== 'string' || typeof method !== 'string') return 'block';
  if (!methods.has(method.toUpperCase())) return 'block';
  if (pathname === '/' || pathname === '/social') return 'redirect';
  if (pages.has(pathname) || publicAssets.has(pathname) || publicRpc.has(pathname)) return 'allow';
  if (pathname.startsWith('/_next/static/')) return 'allow';
  return 'block';
}
