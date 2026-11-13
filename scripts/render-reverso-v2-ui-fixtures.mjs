/** Offline SSR evidence only. This does not open a browser or start a server. */
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createJourney, USER, ADMIN, NOW} from '../tests/helpers/reverso-journey-harness-v2.mjs';
import {available, emptyReversoState, validateReversoState} from '../lib/platform/reverso/state-contract.mjs';

const output = process.argv[2];
assert.ok(output && resolve(output) !== resolve('.') && !resolve(output).startsWith(resolve('.') + '/'), 'Choose an evidence directory outside the Git source tree');
mkdirSync(output, {recursive: true});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (name, value) => writeFileSync(resolve(output, name), value);
const widths = [320, 390, 1440], evidence = [];
const stateFixture = (_context, now) => {
  const state = emptyReversoState({subject: USER, now}), opts = {mode: 'demo', observedAt: new Date(now).toISOString()};
  state.sections.entitlement = available({robotId: 'reverso', planId: 'platform-reverso-monthly', planName: 'Reverso mensal — exemplo fictício',
    amountCents: 1990, currency: 'BRL', interval: 'month', status: 'active', paymentStatus: 'confirmed', accessGranted: false, accessObserved: true,
    periodStart: '2026-11-12T21:00:00Z', periodEnd: '2026-12-12T21:00:00Z', sourceValidUntil: new Date(now + 30000).toISOString(),
    performanceRate: 20, cancelAtPeriodEnd: true, reason: 'Registro demonstrativo; não comprova acesso real.'}, opts);
  state.sections.wallet = available({currency: 'BRL', balanceMinor: null, availableMinor: null, pendingMinor: null, reservedMinor: null, debitAuthorized: false}, opts);
  const period = {robotId: 'reverso', accountId: null, accountIds: ['synthetic-a', 'synthetic-b'], provider: 'multiple', environment: 'demo', currency: 'BRL', timeZone: 'America/Sao_Paulo'};
  state.sections.performance = available({periods: [
    {...period, id: 'demo-november', obligationId: null, month: '2026-11', gains: null, losses: null, fees: null, financing: null,
      eligiblePlatformCosts: null, brokerNet: null, costs: null, net: null, eligibleNet: null, performanceRate: 20, participation: null,
      status: 'pending', reason: 'Execução demonstrativa ainda aberta.', pendingReasons: ['Execução aberta; resultado não realizado.']},
    {...period, id: 'demo-october', obligationId: 'demo-october', month: '2026-10', gains: '100.00000000', losses: '20.00000000', fees: '3.00000000', financing: '2.00000000',
      eligiblePlatformCosts: '5.00000000', brokerNet: '75.00000000', costs: '10.00000000', net: '70.00000000', eligibleNet: '70.00000000', performanceRate: 20,
      participation: '14.00000000', status: 'ready_in_test', reason: 'Simulação mensal; regra comercial Reverso pendente.', pendingReasons: []},
  ]}, opts);
  const operation = {id: 'synthetic-operation-a', robotId: 'reverso', connectionId: 'synthetic-connection-a', accountId: 'synthetic-a', provider: 'profit', environment: 'demo', currency: 'BRL',
    symbol: 'FICTICIO', side: 'buy', quantity: '1.000000000000', openedAt: '2026-10-20T14:00:00Z'};
  state.sections.operations = available({rows: [
    {...operation, id: 'synthetic-operation-open', month: '2026-11', state: 'open', openedAt: '2026-11-12T15:00:00Z', closedAt: null, gross: null, fees: null, financing: null, net: null, costsComplete: false},
    {...operation, month: '2026-10', state: 'closed', closedAt: '2026-10-20T15:00:00Z', gross: '100.00000000', fees: '3.00000000', financing: '2.00000000', net: '95.00000000', costsComplete: true},
    {...operation, id: 'synthetic-operation-b', accountId: 'synthetic-b', connectionId: 'synthetic-connection-b', provider: 'mt5', month: '2026-10', state: 'closed',
      openedAt: '2026-10-21T14:00:00Z', closedAt: '2026-10-21T15:00:00Z', gross: '-20.00000000', fees: '0.00000000', financing: '0.00000000', net: '-20.00000000', costsComplete: true},
  ], costsPending: 1, hasMore: false}, opts);
  state.sections.obligations = available([{id: 'demo-october', robotId: 'reverso', month: '2026-10', currency: 'BRL', amountMinor: 1400,
    status: 'ready_in_test', paymentStatus: 'pending', paymentConfirmed: false, paidAt: null}], opts);
  state.sections.cycles = available([], opts);
  state.sections.policy = available({status: 'pending', reason: 'Unidade de apuração, custos e compensação de perdas do Reverso aguardam aprovação comercial.'}, opts);
  return validateReversoState(state, {subject: USER, now});
};

async function capture(name, setup, options) {
  const journey = createJourney(options);
  try {
    await setup(journey); await journey.settle();
    const html = journey.html(), css = journey.css();
    assert.equal(/<script\b/i.test(html), false, 'Static evidence has no scripts');
    for (const width of widths) {
      const file = `${name}-${width}.html`;
      const content = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'"><title>REVFIN002 — ${name} — alvo ${width}px</title><style>html,body{margin:0;background:#e9eaf0}body{width:${width}px;max-width:100%;margin:auto}.evidence-notice{padding:12px;background:#17213a;color:white;font:13px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}${css}</style></head><body><aside class="evidence-notice">Renderização fictícia local REVFIN002. Alvo: ${width}px; viewport não medido. Sessões e dados sintéticos. Não é site publicado, captura de navegador ou aprovação visual.</aside>${html}</body></html>`;
      write(file, content); evidence.push({file, targetWidth: width, sha256: sha256(content), scenario: name, browserRendered: false});
    }
    write(name + '-requests.json', JSON.stringify({syntheticOnly: true, realRequestsSent: 0,
      requests: journey.requests.map(({url, method, body}) => ({url, method, action: body?.action ?? null, interval: body?.offer?.interval ?? null})),
      redirects: journey.redirects}, null, 2) + '\n');
  } finally {journey.unmount();}
}
const select = async (h, interval) => {await h.settle(); await h.click(interval === 'month' ? 'Selecionar mensal' : 'Selecionar anual'); await h.settle();};
const prepare = async h => {await select(h, 'month'); h.accept(); await h.settle(); await h.click('Confirmar contratação demonstrativa'); await h.settle();};
await capture('client-source-unavailable', async h => {h.setUnavailable(true);});
await capture('client-monthly-quote', h => select(h, 'month'));
await capture('client-annual-quote', h => select(h, 'year'));
await capture('client-pending-order', prepare);
await capture('client-uncertain-reference', async h => {h.failNextBefore('prepare'); await prepare(h); await h.click('Consultar a mesma tentativa');});
await capture('client-historical-payment-revoked-right', async h => {await prepare(h); Object.assign(h.records.get(USER)[0].order,
  {status: 'cancelled', cancelled: true, paymentStatus: 'recorded_in_test', periodStart: null, periodEnd: null}); await h.click('Consultar pedido');});
await capture('client-periods-and-operations', async h => {h.setState(USER, stateFixture);});
await capture('admin-selected-customer', async h => {h.setState(USER, stateFixture); await h.settle(); h.selectCustomer(USER);}, {actor: ADMIN, admin: true});
await capture('admin-dedicated-session-required', async () => {}, {actor: null, socialMaster: true, admin: true});

const sources = [
  'app/components/platform/PlatformReversoFinance.js', 'app/components/platform/PlatformReversoFinance.module.css',
  'app/components/platform/PlatformReversoSubscription.js', 'app/components/platform/PlatformReversoSubscription.module.css',
  'app/components/social-auth-return.mjs', 'app/components/platform/PlatformAuthGuard.js', 'app/components/platform/PlatformAdminAccess.js',
  'app/platform/reverso/page.js', 'app/platform/admin/robos/reverso/page.js', 'app/api/platform/reverso/subscription/route.js',
  'lib/platform/reverso/subscription/client-v2.mjs', 'lib/platform/reverso/subscription/view-v2.mjs', 'lib/platform/reverso/subscription/http-v2.mjs',
  'lib/platform/reverso/subscription/runtime-source-v2.mjs', 'lib/platform/reverso/state-contract.mjs', 'lib/platform/reverso/http.mjs',
  'tests/helpers/reverso-journey-harness-v2.mjs', 'tests/reverso-subscription-ui-v2.test.mjs', 'scripts/render-reverso-v2-ui-fixtures.mjs',
];
write('source-hashes.json', JSON.stringify(Object.fromEntries(sources.map(name => [name, sha256(readFileSync(name))])), null, 2) + '\n');
write('evidence.json', JSON.stringify({schema: 'REVFIN002_SYNTHETIC_AUTHENTICATED_SSR_EVIDENCE_V1', fixtureTime: new Date(NOW).toISOString(),
  syntheticOnly: true, authenticatedJourney: 'local components and HTTP handlers with fictitious sessions',
  visualBrowserCheck: 'blocked', screenshotsProduced: 0, measuredViewports: [], requestedViewports: widths,
  productionVisited: false, networkRequestsSent: 0, layoutOverflowVerified: false, renderedFiles: evidence}, null, 2) + '\n');
write('README.md', `# REVFIN002 — evidência local de jornadas autenticadas\n\nEstas páginas são HTML estático obtido dos componentes e handlers HTTP reais, com sessões fictícias e fonte em memória. Os estados financeiros são exemplos sintéticos validados pelo contrato. Não houve acesso a dados, ordens, cobranças ou pagamentos reais.\n\nHá nove estados, cada um preparado para revisão posterior nas larguras solicitadas de 320, 390 e 1440px. A largura declarada no arquivo não comprova viewport de navegador, ausência de overflow, contraste ou aparência final. Os botões são inertes e a política do arquivo bloqueia scripts, rede e envio de formulário.\n\n**Navegador: bloqueado. Capturas: 0. Aprovação visual: pendente.** O plugin Browser não encontrou o contexto da extensão. O inventário permitido do navegador CUA não continha candidata JENIOS ou sessão autorizada correspondente; nenhuma candidata acessível foi fornecida. Não se repetiu a negativa anterior de arquivo/socket nem se criou preview.\n\nAs jornadas demonstram preços, aceite, pedido pendente, recuperação da mesma referência, histórico fictício de pagamento separado do direito cancelado, Admin com titular selecionado, exigência de sessão Platform e demonstração mensal com política comercial Reverso pendente. A fonte em memória não substitui os testes PostgreSQL/serviço nativo mantidos separadamente.\n\nOs JSON de requisições representam chamadas internas ao harness, sem rede; não incluem tokens, pagador ou segredos. source-hashes.json vincula a evidência à fonte. Para regenerar: node scripts/render-reverso-v2-ui-fixtures.mjs /caminho/fora/do/repositorio.\n`);
console.log(JSON.stringify({output: resolve(output), files: evidence.length, visualBrowserCheck: 'blocked', screenshotsProduced: 0, syntheticOnly: true}));
