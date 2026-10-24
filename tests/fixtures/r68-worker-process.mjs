/** LOCAL ACCEPTANCE ONLY. Real R65 stores/tick over a disposable psql adapter.
 * This is not the production runtime factory, hosted PostgREST, real Auth or a
 * private R67 source. Its optional one-time lost capture ACK is an explicit fault.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createR64DatabaseStore, R64_DATABASE_RPCS } from '../../lib/platform/research/robot-r64-database-store.mjs';
import { createR65DatabaseStore, R65_DATABASE_RPCS } from '../../lib/platform/research/robot-r65-database-store.mjs';
import { runR65EvolutionTick } from '../../lib/platform/research/robot-r65-cycle-worker.mjs';
import { runR68R65Worker } from '../../lib/platform/research/robot-r68-cycle-supervisor.mjs';

export function createR68WorkerPostgres(env = process.env) {
  assert.equal(env.JENIOS_R68_DISPOSABLE_DB, 'true', 'Explicit disposable R68 DB flag required');
  const url = new URL(env.JENIOS_R68_TEST_DATABASE_URL || 'invalid:');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.pathname, '/jenios_r68_worker_qa'); assert.equal(url.search, ''); assert.equal(url.hash, '');
  const childEnv = { ...env, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1', PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'jenios_r68_worker_qa',
    PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=5000', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
  delete childEnv.PGSERVICE; delete childEnv.PGSERVICEFILE; delete childEnv.PGPASSFILE;
  const psql = sql => new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
      { env: childEnv, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.on('error', () => reject(Error('R68_POSTGRES_PROCESS_UNAVAILABLE')));
    child.on('close', code => code === 0 ? resolve(stdout.trim()) :
      reject(Error(stderr.match(/R6[458]_[A-Z0-9_]+/)?.[0] || 'R68_POSTGRES_QUERY_FAILED')));
    child.stdin.end(sql);
  });
  const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
  const names = new Set([...Object.values(R64_DATABASE_RPCS), ...Object.values(R65_DATABASE_RPCS)]);
  const db = { async rpc(name, args) {
    assert.ok(names.has(name));
    try { return { data: JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(args.p_input) + ');')), error: null }; }
    catch (error) { return { data: null, error: { message: error.message } }; }
  } };
  return { psql, db };
}

async function childMain() {
  assert.equal(process.env.JENIOS_R68_WORKER_PROCESS_FIXTURE, 'true');
  assert.equal(typeof process.send, 'function');
  const controller = new AbortController();
  process.once('SIGTERM', () => controller.abort()); process.once('SIGINT', () => controller.abort());
  process.once('disconnect', () => controller.abort());
  process.once('message', async config => {
    try {
      assert.equal(config?.action, 'start'); assert.match(config.scopeId, /^scope:[a-f0-9]{16}$/);
      assert.equal(typeof config.loseFirstCaptureAck, 'boolean');
      assert.ok(['AUTO_APPLIED', 'REJECTED', null].includes(config.stopAfterStatus));
      const { db, psql } = createR68WorkerPostgres();
      assert.equal(await psql('SELECT current_database();'), 'jenios_r68_worker_qa');
      const observationStore = createR64DatabaseStore({ db }), original = createR65DatabaseStore({ db });
      let lostCaptureAcks = 0;
      const lifecycleStore = { ...original, async recordValidationCase(args) {
        const saved = await original.recordValidationCase(args);
        if (config.loseFirstCaptureAck && lostCaptureAcks === 0) {
          lostCaptureAcks++;
          throw Object.assign(Error('R65_DATABASE_UNAVAILABLE'), { code: 'R65_DATABASE_UNAVAILABLE' });
        }
        return saved;
      } };
      const runtime = { runTick: () => runR65EvolutionTick({ observationStore, lifecycleStore,
        scopeId: config.scopeId, env: process.env }) };
      const summary = await runR68R65Worker({ runtime, env: process.env, signal: controller.signal,
        emitEvent(event) {
          if (process.connected) process.send({ kind: 'event', event });
          if (event.event === 'TICK_SUCCEEDED' && event.status === config.stopAfterStatus) controller.abort();
        } });
      process.send({ kind: 'result', summary, fixture: { lostCaptureAcks,
        faultKind: lostCaptureAcks ? 'EXPLICIT_RESPONSE_LOSS_AFTER_FIRST_LOCAL_POSTGRES_CAPTURE_COMMIT' : null } }, () => process.disconnect());
      if (summary.status === 'FAILED') process.exitCode = 1;
    } catch {
      if (process.connected) process.send({ kind: 'error', code: 'R68_WORKER_PROCESS_FIXTURE_FAILED' }, () => process.disconnect());
      process.exitCode = 1;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await childMain();
