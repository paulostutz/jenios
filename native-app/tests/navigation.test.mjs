import test from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, areaUrl, navigationDecision } from '../src/navigation.ts';
test('the two approved choices resolve to existing flows, without granting access', () => {
  assert.deepEqual(Object.keys(AREAS), ['social', 'platform']);
  assert.equal(areaUrl('social'), 'https://www.jenios.com.br/social');
  const platform = new URL(areaUrl('platform'));
  assert.equal(platform.pathname, '/platform/entrar');
  assert.equal(platform.searchParams.get('next'), '/dashboard-logado');
});
test('approved HTTPS origins retain login and recovery routes', () => {
  for (const url of ['https://www.jenios.com.br/social', 'https://jenios.com.br/platform/entrar', 'https://www.jenios.com.br/social/recuperar?code=opaque', 'https://www.jenios.com.br/dashboard-logado']) assert.equal(navigationDecision(url), 'internal');
});
test('lookalike domains and external sites never receive the in-app session', () => {
  for (const url of ['https://www.jenios.com.br.evil.example/social', 'https://jenios-com-br.example', 'https://www.tradingview.com/chart/', 'https://www.jenios.com.br./']) assert.equal(navigationDecision(url), 'external');
});
test('unsafe protocols, credentials, non-standard ports and malformed URLs are blocked', () => {
  for (const url of ['http://www.jenios.com.br', 'javascript:alert(1)', 'file:///private/data', 'intent://abc', 'data:text/html,Hi', 'https://user:password@www.jenios.com.br', 'https://www.jenios.com.br:444/', 'https://www.jenios.com.br\\@evil.example', 'https://www.jenios.com.br/\n', '/social', '', 'https://www.jenios.com.br/'+'x'.repeat(4096)]) assert.equal(navigationDecision(url), 'blocked', url);
});
