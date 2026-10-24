/**
 * R62 boundary coverage for the existing R61 synthetic console.
 * These checks reach the unchanged limits through actual browser controls.
 * No adapter calls, React-state injection, patched limits or external orders.
 * Register before negative access cases, while the QA server is enabled.
 */
import assert from 'node:assert/strict';

const SNAPSHOT_LIMIT = 500;
const EVENT_LIMIT = 1000;
const CASE_BUDGET_MS = 300000;

export function registerR62SessionLimitCases(harness) {
  const { check, getPage, getExpect, ultra, ultraEvent, expectEmptyUltra, origin, route } = harness;

  async function freshSession() {
    const page = getPage();
    const expect = getExpect();
    const response = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, 'The boundary cases require the enabled local QA route.');
    await expect(page.getByTestId('robot-acceptance-console')).toBeVisible();
    await expectEmptyUltra();
    await expect(page.getByTestId('ultra-plan')).toHaveValue('platform-global-crypto');
    await expect(page.getByTestId('ultra-symbol')).toHaveValue('BTC-USD');
    await expect(page.getByTestId('ultra-scenario')).toHaveValue('normal');
    await page.getByTestId('ultra-start').click();
    const initial = await ultra('RUNNING', true, 2);
    assert.ok(initial.sessionId, 'The initial session must expose its generated identifier.');
    return initial;
  }

  async function clickAndObserve(button, events, status, allow, sessionId, deadline) {
    assert.ok(Date.now() < deadline, 'The bounded session-limit case exceeded its CI time budget.');
    const page = getPage();
    const expect = getExpect();
    const control = page.getByTestId(button);
    await expect(control).toBeEnabled();
    // A native Playwright click exercises the existing React handler. Waiting
    // for the increment prevents event coalescing from skipping history entries.
    await control.click();
    const result = page.getByTestId('ultra-result');
    await expect(result).toHaveAttribute('data-events', String(events));
    await expect(result).toHaveAttribute('data-status', status);
    await expect(result).toHaveAttribute('data-allow', String(allow));
    await expect(result).toHaveAttribute('data-session-id', sessionId);
  }

  async function rejectionAndRestart(previous, attemptedEventCount) {
    const page = getPage();
    const expect = getExpect();
    const error = page.getByTestId('ultra-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toContainText('A sessão foi encerrada nesta tela');
    await expect(page.getByTestId('ultra-result')).toHaveCount(0);
    const controls = ['ultra-step', 'ultra-pause', 'ultra-resume'];
    for (const id of controls) await expect(page.getByTestId(id)).toBeDisabled();
    await expect(page.getByTestId('ultra-start')).toBeEnabled();
    const rejected = {
      attemptedEventCount,
      previousSessionId: previous.sessionId,
      previousAllowedResultRemoved: true,
      advancePauseResumeDisabled: true,
      visibleAlert: await error.innerText(),
    };
    await page.getByTestId('ultra-start').click();
    const restarted = await ultra('RUNNING', true, 2);
    assert.ok(restarted.sessionId);
    assert.notEqual(restarted.sessionId, previous.sessionId, 'A rejected session must not reuse its identifier.');
    await expect(page.getByTestId('ultra-error')).toHaveCount(0);
    await expect(page.getByTestId('ultra-step')).toBeEnabled();
    await expect(page.getByTestId('ultra-pause')).toBeEnabled();
    await expect(page.getByTestId('ultra-resume')).toBeDisabled();
    return { rejected, restarted };
  }

  check('r62_snapshot_limit_revokes_previous_decision_and_allows_new_session', 'session_limit', async () => {
    const deadline = Date.now() + CASE_BUDGET_MS;
    const initial = await freshSession();
    for (let events = initial.eventCount + 1; events <= SNAPSHOT_LIMIT; events += 1) {
      await clickAndObserve('ultra-step', events, 'RUNNING', true, initial.sessionId, deadline);
    }
    const before = await ultra('RUNNING', true, SNAPSHOT_LIMIT);
    await ultraEvent('normal');
    const boundary = await rejectionAndRestart(before, SNAPSHOT_LIMIT + 1);
    return {
      evidenceKind: 'SYNTHETIC_FIXTURE', boundary: 'maxSnapshots', limit: SNAPSHOT_LIMIT,
      interaction: 'Playwright locator.click; DOM count and state confirmed after every accepted event.',
      snapshotEventsObserved: SNAPSHOT_LIMIT,
      normalEventButtonClicksBeforeRejection: SNAPSHOT_LIMIT - initial.eventCount,
      initial, before, ...boundary,
    };
  });

  check('r62_event_limit_revokes_previous_decision_and_allows_new_session', 'session_limit', async () => {
    const deadline = Date.now() + CASE_BUDGET_MS;
    const initial = await freshSession();
    const pairs = (EVENT_LIMIT - initial.eventCount - 2) / 2;
    assert.equal(pairs, 498);
    let events = initial.eventCount;
    for (let pair = 0; pair < pairs; pair += 1) {
      await clickAndObserve('ultra-pause', ++events, 'PAUSED', false, initial.sessionId, deadline);
      await clickAndObserve('ultra-resume', ++events, 'RUNNING', false, initial.sessionId, deadline);
    }
    assert.equal(events, 998);
    const awaitingConfirmation = await ultra('RUNNING', false, events);
    await clickAndObserve('ultra-step', ++events, 'RUNNING', false, initial.sessionId, deadline);
    await clickAndObserve('ultra-step', ++events, 'RUNNING', true, initial.sessionId, deadline);
    assert.equal(events, EVENT_LIMIT);
    const before = await ultra('RUNNING', true, EVENT_LIMIT);
    await ultraEvent('normal');
    const boundary = await rejectionAndRestart(before, EVENT_LIMIT + 1);
    return {
      evidenceKind: 'SYNTHETIC_FIXTURE', boundary: 'maxEvents', limit: EVENT_LIMIT,
      interaction: 'Playwright locator.click; DOM count and state confirmed after every accepted event.',
      pauseButtonClicks: pairs, resumeButtonClicks: pairs,
      snapshotEventsFromObservedActions: initial.eventCount + 2,
      initial, awaitingConfirmation, before, ...boundary,
    };
  });
}
