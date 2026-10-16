// Only these two Social reports are free for registered accounts during pre-launch.
// Set this switch to false and redeploy to restore the preserved paid workflow.
export const REPORTS_PRELAUNCH = true;
export function isPrelaunchReport(productCode, scope = 'social') {
  return REPORTS_PRELAUNCH && scope === 'social' && ['social-bankscore-report', 'social-crypto-validator'].includes(productCode);
}
export function prelaunchReportHref(productCode, target = {}) {
  const bank = productCode === 'social-bankscore-report';
  if (!['social-bankscore-report', 'social-crypto-validator'].includes(productCode)) throw new Error('Relatório inválido.');
  const params = new URLSearchParams();
  for (const key of bank ? ['codigo', 'periodo'] : ['network', 'type', 'identifier']) {
    if (target && ['string', 'number'].includes(typeof target[key])) params.set(key, String(target[key]).slice(0, 180));
  }
  return (bank ? '/bankscore/detalhado' : '/social/consulta-detalhada') + (params.size ? '?' + params.toString() : '');
}
