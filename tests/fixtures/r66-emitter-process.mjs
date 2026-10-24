/** IPC-only R66 acceptance fixture. Secrets arrive over the private IPC channel;
 * no argv/env/artifact contains a signing or outbox key. This is not a worker.
 */
import { createR66DurableEmitter } from '../../lib/platform/research/robot-r66-durable-emitter.mjs';
import { createR66LoopbackObservationSender } from '../../lib/platform/research/robot-r66-loopback-transport.mjs';

if (typeof process.send !== 'function' || process.env.JENIOS_R66_PROCESS_FIXTURE !== 'true') {
  throw Error('R66_ACCEPTANCE_PRIVATE_IPC_REQUIRED');
}
let emitter, fixedNowMs = null, sendCalls = 0;
let serial = Promise.resolve();
process.on('message', message => {
  serial = serial.then(async () => {
    const { id, action } = message ?? {};
    try {
      let result;
      if (action === 'open') {
        if (emitter) throw Error('R66_ACCEPTANCE_ALREADY_OPEN');
        const { directory, key, privateKeyPem, scopeId, sourceId, state, nowMs } = message.config;
        fixedNowMs = nowMs ?? null;
        emitter = createR66DurableEmitter({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME',
          directory, key, privateKeyPem, scopeId, sourceId, getActiveState: () => state,
          ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', planCode: 'platform-global-crypto',
            symbol: 'BTC-USD', capital: 1000, leverage: 2 },
          now: () => fixedNowMs ?? Date.now() });
        result = { sessionId: emitter.sessionId, trustedSource: emitter.trustedSource, inspect: emitter.inspect() };
      } else if (action === 'capture') {
        if (!emitter) throw Error('R66_ACCEPTANCE_NOT_OPEN');
        const records = [];
        for (const command of message.commands) {
          if (command.kind === 'assisted') records.push(emitter.captureAssisted(command.value));
          else if (command.kind === 'ultra') records.push(emitter.captureUltra(command.value));
          else throw Error('R66_ACCEPTANCE_CAPTURE_KIND');
        }
        // Returning this message proves every capture has left its synchronous
        // persistence critical section. The parent may now inject SIGKILL.
        result = { records, inspect: emitter.inspect(), sendCalls };
      } else if (action === 'flush') {
        if (!emitter) throw Error('R66_ACCEPTANCE_NOT_OPEN');
        const send = createR66LoopbackObservationSender({ origin: message.origin,
          trustedSource: emitter.trustedSource, timeoutMs: 3000 });
        const flushed = await emitter.flush({ limit: message.limit ?? 20,
          send: record => { sendCalls++; return send(record); } });
        result = { flushed, inspect: emitter.inspect(), sendCalls };
      } else if (action === 'clock') {
        if (!Number.isSafeInteger(message.nowMs) || message.nowMs < 0) throw Error('R66_ACCEPTANCE_CLOCK');
        fixedNowMs = message.nowMs; result = { clock: 'EXPLICIT_EXPIRATION_FIXTURE', nowMs: fixedNowMs };
      } else if (action === 'inspect') result = { inspect: emitter.inspect(), sendCalls };
      else if (action === 'close') {
        process.send({ id, ok: true, result: { closed: true } }, () => process.disconnect());
        return;
      } else throw Error('R66_ACCEPTANCE_ACTION');
      process.send({ id, ok: true, result });
    } catch (error) {
      // Do not return raw filesystem errors, secrets or request configuration.
      const code = /^R6[456]_[A-Z0-9_]+$/.test(error?.code || error?.message || '') ?
        error.code || error.message : 'R66_ACCEPTANCE_CHILD_FAILURE';
      process.send({ id, ok: false, error: code });
    }
  });
});
