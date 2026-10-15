// Local verification only: never deploys, migrates, seeds or calls a payment gateway.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !['--installation', '--browser', '--skip-build'].includes(arg))) {
  console.error('Uso: node scripts/verify-social-release.mjs [--installation] [--browser] [--skip-build]');
  process.exit(2);
}
const results = [];
async function run(name, command, argv, env = process.env) {
  console.log(`\nVERIFICANDO: ${name}`);
  const child = spawn(command, argv, { stdio: 'inherit', env });
  const status = await new Promise(resolve => {
    child.once('error', () => resolve(false));
    child.once('exit', code => resolve(code === 0));
  });
  results.push({ etapa: name, estado: status ? 'APROVADO' : 'FALHOU' });
  return status;
}
async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}
let server;
try {
  if (!await run('Testes automatizados', 'npm', ['test'])) throw Error('TESTS');
  if (!args.has('--skip-build') && !await run('Build', 'npm', ['run', 'build'])) throw Error('BUILD');
  if (args.has('--skip-build')) results.push({ etapa: 'Build', estado: 'NÃO EXECUTADO — usando saída existente' });
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'ignore', 'inherit'] });
  let exited = false;
  server.once('error', () => { exited = true; });
  server.once('exit', () => { exited = true; });
  let ready = false;
  for (let attempt = 0; attempt < 60 && !exited; attempt++) {
    try {
      const response = await fetch(base + '/api/jenios-pay/products', { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(250);
  }
  if (!ready) { results.push({ etapa: 'Servidor local', estado: 'FALHOU' }); throw Error('SERVER'); }
  const env = { ...process.env, TEST_BASE_URL: base };
  await run('Verificações HTTP', process.execPath, ['scripts/test-finance-http.mjs'], env);
  if (args.has('--installation')) await run('Configuração e estruturas — somente leitura', process.execPath, ['scripts/check-social-installation.mjs']);
  else results.push({ etapa: 'Configuração e estruturas', estado: 'NÃO EXECUTADO' });
  if (args.has('--browser')) {
    await run('Navegador Social', process.execPath, ['scripts/test-social-ui.mjs'], env);
    await run('Navegador financeiro', process.execPath, ['scripts/test-finance-ui.mjs'], env);
  } else results.push({ etapa: 'Navegador', estado: 'NÃO EXECUTADO' });
} catch {
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const closed = once(server, 'exit').catch(() => {});
    server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    await closed;
    clearTimeout(timer);
  }
  console.table(results);
  console.log('Este resultado não homologa cobranças, fluxos com duas contas ou fontes externas. Nenhuma instalação ou alteração remota foi realizada.');
  if (results.some(row => row.estado === 'FALHOU')) process.exitCode = 1;
}
