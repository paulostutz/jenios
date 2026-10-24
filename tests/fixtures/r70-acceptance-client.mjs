/** Explicit public acceptance caller. It never loads the private core or
 * represents this protocol-only path as the real R70 host. Process startup
 * trust is NODE_EXTRA_CA_CERTS; TLS verification is never disabled.
 */
import assert from 'node:assert/strict';
import { createR70PreflightClient } from '../../lib/platform/research/robot-r70-preflight-client.mjs';
import { createR69HttpsObservationSender } from '../../lib/platform/research/robot-r69-https-transport.mjs';
import { inspectR67IntakeAcknowledgement } from '../../lib/platform/research/robot-r67-private-protocol.mjs';

let input = '', bytes = 0, phase = 'PREFLIGHT', senderInvoked = false, preflight = null;
try {
  for await (const chunk of process.stdin) {
    bytes += chunk.length; assert.ok(bytes <= 524288); input += chunk;
  }
  const command = JSON.parse(input), origin = new URL(command.targetPins.origin);
  assert.equal(origin.protocol, 'https:'); assert.equal(origin.hostname, '127.0.0.1'); assert.ok(origin.port);
  assert.ok(['probe', 'probeAndSend'].includes(command.action));
  const probe = createR70PreflightClient({ targetPins: command.targetPins, trustedSource: command.trustedSource,
    privateKeyPem: command.privateKeyPem, timeoutMs: 3000 });
  preflight = await probe();
  let acknowledgement = null;
  if (command.action === 'probeAndSend') {
    phase = 'OBSERVATION'; senderInvoked = true;
    const send = createR69HttpsObservationSender({ origin: origin.origin, trustedSource: command.trustedSource });
    const response = await send(command.record), body = await response.json();
    acknowledgement = inspectR67IntakeAcknowledgement(body, command.record, response.status);
  }
  process.stdout.write(JSON.stringify({ ok: true, phase, senderInvoked, preflight, acknowledgement,
    privateCoreExecuted: false, storage: 'VOLATILE_PROTOCOL_SINK_NOT_DATABASE' }) + '\n');
} catch (error) {
  const code = /^R(?:67|69|70)_[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'R70_ACCEPTANCE_CLIENT_UNCONFIRMED';
  process.stdout.write(JSON.stringify({ ok: false, code, phase, senderInvoked, preflight,
    privateCoreExecuted: false, storage: 'VOLATILE_PROTOCOL_SINK_NOT_DATABASE' }) + '\n');
  process.exitCode = 2;
}
