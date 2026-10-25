export type AreaId = 'social' | 'platform';
export const ORIGIN = 'https://www.jenios.com.br';
export const AREAS: Record<AreaId, { id: AreaId; title: string; tag: string; description: string; tint: string; path: string }> = {
  social: { id: 'social', title: 'Social', tag: 'Conectar e descobrir', description: 'Comunidade, notícias e tendências para ampliar sua visão do mercado.', tint: '#ceb8ff', path: '/social' },
  platform: { id: 'platform', title: 'Platform', tag: 'Analisar e praticar', description: 'Sua área de análise, aprendizado e simulação, em um só lugar.', tint: '#93e7d0', path: '/platform/entrar?next=%2Fdashboard-logado' },
};
export const areaUrl = (area: AreaId) => ORIGIN + AREAS[area].path;
export type NavigationDecision = 'internal' | 'external' | 'blocked';
// Top-level navigation only. Embedded market widgets retain their own origins.
// No credentials, refresh tokens or user IDs cross a JS bridge.
export function navigationDecision(raw: string): NavigationDecision {
  try {
    if (raw.length > 4096 || /[\u0000-\u0020\\]/.test(raw)) return 'blocked';
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return 'blocked';
    if (url.hostname === 'www.jenios.com.br' || url.hostname === 'jenios.com.br') return 'internal';
    return 'external';
  } catch { return 'blocked'; }
}
