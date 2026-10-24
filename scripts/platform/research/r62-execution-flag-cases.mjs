/**
 * R62: observe the built QA route failing closed when a local test process has
 * an execution/Paper flag other than the explicit string 'false'. These values
 * are isolated configuration fixtures, never deployment or account settings.
 * The shared runner supplies a credential-free Next process on loopback and
 * records browser requests; this does not assert host-wide network isolation.
 */
import assert from 'node:assert/strict';

const EXECUTION_FLAGS = Object.freeze([
  ['real_execution', 'JENIOS_REAL_EXECUTION_ENABLED'],
  ['private_paper_transport', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED'],
  ['private_paper_executor', 'JENIOS_PRIVATE_PAPER_EXECUTOR'],
]);
const NO_TRANSPORT_ATTEMPTS = Object.freeze({
  externalRequests: 0, apiRequests: 0, mutations: 0, webSockets: 0,
});

export function registerR62ExecutionFlagCases(harness) {
  const { check, getPage, getExpect, startServer, origin, route, report } = harness;
  assert.equal(origin, 'http://127.0.0.1:4317', 'R62 execution-flag fixtures must remain on the dedicated loopback server.');
  assert.equal(route, '/platform/homologacao/robos');
  assert.ok(Array.isArray(report.gateResults), 'The shared runner must retain gate evidence.');

  for (const [name, flag] of EXECUTION_FLAGS) {
    for (const [variant, value] of [['true', 'true'], ['absent', undefined]]) {
      const id = `r62_${name}_${variant}_is_404`;
      check(id, 'execution_flag_gate', async () => {
        // startServer constructs fresh safe defaults, then varies just this flag.
        await startServer({ [flag]: value });
        const page = getPage();
        const expect = getExpect();
        const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
        assert.ok(response, 'The direct route must receive an HTTP response.');
        const evidence = {
          scenario: id,
          flag,
          fixtureValue: value === undefined ? 'ABSENT' : value,
          expectedStatus: 404,
          status: response.status(),
          consoleRendered: await page.getByTestId('robot-acceptance-console').count() > 0,
        };
        report.gateResults.push(evidence);
        assert.equal(evidence.status, 404, `${flag}=${variant} must deny the direct route.`);
        assert.equal(evidence.consoleRendered, false, 'The denied route must not render the console.');
        await expect(page.getByTestId('robot-acceptance-console')).toHaveCount(0);

        const parentResponse = await page.goto(`${origin}/platform/homologacao`, { waitUntil: 'networkidle' });
        assert.ok(parentResponse, 'The informational parent route must receive an HTTP response.');
        evidence.parentStatus = parentResponse.status();
        assert.equal(evidence.parentStatus, 200, 'The parent keeps its existing preview/candidate access rule.');
        await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
        evidence.parentLinkAbsent = true;
        evidence.transportAttempts = { ...report.attempts };
        assert.deepEqual(evidence.transportAttempts, NO_TRANSPORT_ATTEMPTS);
        assert.deepEqual(report.pageErrors, []);
        return evidence;
      });
    }
  }
}
