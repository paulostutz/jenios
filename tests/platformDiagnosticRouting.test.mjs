import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDiagnostic, persistLocalReport, readLocalReport, MODE_KEY,
  canExecuteReal, adaptiveModeSuggestion, protectionSummary
} from '../lib/platform/diagnostic-routing.mjs';

function storage() {
  const state = new Map();
  return { getItem(k) { return state.get(k) ?? null; },
    setItem(k,v) { state.set(k, String(v)); } };
}
test('perfil disciplinado inicia em modo manual', () => {
  assert.equal(classifyDiagnostic({ tecnico_positivo: 10 }).mode, 'manual');
});
test('perfil de risco inicia com orientação reversa', () => {
  assert.equal(classifyDiagnostic({ impulsivo: 8, tecnico_positivo: 2 }).mode, 'reversa');
});
test('swing não define vulnerabilidade automaticamente', () => {
  assert.equal(classifyDiagnostic({ tecnico_positivo: 10 }).mode, 'manual');
});
test('laudo determina início e se recupera ao retornar à mesa', () => {
  const local = storage();
  const first = persistLocalReport(local, {tecnico_positivo: 10}, 'ESTRUTURADO', '2026-10-18T20:00:00Z');
  assert.equal(first.mode, 'manual');
  assert.equal(readLocalReport(local).mode, 'manual');
  assert.equal(local.getItem(MODE_KEY), 'manual');
});
test('registro antigo ou manipulado não vale como laudo', () => {
  const local = storage();
  local.setItem('jenios_diagnostico_realizado','true');
  assert.equal(readLocalReport(local), null);
  local.setItem('jenios_diagnostico_laudo','{"mode":"reversa"}');
  assert.equal(readLocalReport(local), null);
});
test('localStorage jamais concede autorização de conta real', () => {
  assert.equal(canExecuteReal(), false);
  assert.equal(canExecuteReal({serverDiagnosticVerified: true}), false);
  assert.equal(canExecuteReal({serverDiagnosticVerified:true,serverAccountReady:true,serverBrokerReady:true}), false);
  assert.equal(canExecuteReal({serverDiagnosticVerified:true,serverAccountReady:true,serverBrokerReady:true,executionAuthorized:true}), true);
});
test('sugestão adaptativa exige perdas reais verificadas e nunca troca modo por conta própria', () => {
  assert.equal(adaptiveModeSuggestion([{pnl:-1,verified:true}], 'manual'), null);
  assert.equal(adaptiveModeSuggestion(Array(5).fill({pnl:-1,verified:false}), 'manual'), null);
  const trades = Array(5).fill({pnl:-10,verified:true});
  assert.match(adaptiveModeSuggestion(trades, 'manual'), /Considere pausar/);
  assert.equal(adaptiveModeSuggestion(trades, 'reversa'), null);
});
test('contagem de proteção não fabrica perda evitada', () => {
  assert.deepEqual(protectionSummary(null), {blocked:0,avoidedLoss:null});
  assert.deepEqual(protectionSummary([{type:'risk_block',verified:false,amount:1000},{type:'risk_block',verified:true,amount:2000}]), {blocked:1,avoidedLoss:null});
});
