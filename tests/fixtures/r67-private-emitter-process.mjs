/** Private LOCAL acceptance subprocess, never part of public positive coverage.
 * Private paths and ephemeral keys arrive over IPC; none enter argv or reports.
 * This is a test driver, not a production worker or an operational data source.
 */
import { loadR67VerifiedPrivateCore, inspectR67VerifiedPrivateCore } from '../../lib/platform/research/robot-r67-private-core-loader.mjs';
import { createR67DurableEmitter } from '../../lib/platform/research/robot-r67-durable-emitter.mjs';
import { createR67LoopbackObservationSender } from '../../lib/platform/research/robot-r67-loopback-transport.mjs';
import { R67_ORIGIN } from '../../lib/platform/research/robot-r67-private-protocol.mjs';

if (typeof process.send !== 'function' || process.env.JENIOS_R67_PROCESS_FIXTURE !== 'true') {
  throw Error('R67_ACCEPTANCE_PRIVATE_IPC_REQUIRED');
}
let emitter, sendCalls = 0;
let serial = Promise.resolve();
process.on('message', message => {
  serial = serial.then(async () => {
    const { id, action } = message ?? {};
    try {
      let result;
      if (action === 'open') {
        if (emitter) throw Error('R67_ACCEPTANCE_ALREADY_OPEN');
        const { privateCoreDirectory, directory, key, privateKeyPem, scopeId, sourceId } = message.config;
        const handle = await loadR67VerifiedPrivateCore({ directory: privateCoreDirectory });
        emitter = createR67DurableEmitter({ enabled: true, domain: R67_ORIGIN, handle,
          directory, key, privateKeyPem, scopeId, sourceId });
        result = { sessionId: emitter.sessionId, trustedSource: emitter.trustedSource,
          core: inspectR67VerifiedPrivateCore(handle), inspect: emitter.inspect() };
      } else if (action === 'capture') {
        if (!emitter) throw Error('R67_ACCEPTANCE_NOT_OPEN');
        const records = [];
        for (const command of message.commands) records.push(await emitter.captureBatch(command));
        // Returned records have completed durable capture, including lock release.
        result = { records, inspect: emitter.inspect(), sendCalls };
      } else if (action === 'flush') {
        if (!emitter) throw Error('R67_ACCEPTANCE_NOT_OPEN');
        const send = createR67LoopbackObservationSender({ origin: message.origin,
          trustedSource: emitter.trustedSource, timeoutMs: 3000 });
        const flushed = await emitter.flush({ limit: message.limit ?? 20,
          send: record => { sendCalls++; return send(record); } });
        result = { flushed, inspect: emitter.inspect(), sendCalls };
      } else if (action === 'inspect') {
        if (!emitter) throw Error('R67_ACCEPTANCE_NOT_OPEN');
        result = { inspect: emitter.inspect(), sendCalls };
      } else if (action === 'close') {
        process.send({ id, ok: true, result: { closed: true } }, () => process.disconnect());
        return;
      } else throw Error('R67_ACCEPTANCE_ACTION');
      process.send({ id, ok: true, result });
    } catch (error) {
      const raw = error?.code || error?.message || '';
      const code = /^(?:R67|B297)_[A-Z0-9_]+$/.test(raw) ? raw : 'R67_ACCEPTANCE_CHILD_FAILURE';
      process.send({ id, ok: false, error: code });
    }
  });
});
