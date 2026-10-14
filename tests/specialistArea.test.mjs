import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/especialistas/page.js', import.meta.url), 'utf8');
const social = readFileSync(new URL('../app/social/page.js', import.meta.url), 'utf8');

test('área do especialista usa a tabela existente', () => {
  assert.match(page, /jenios_specialist_profiles/);
  assert.match(page, /upsert\(/);
  assert.match(page, /onConflict:"user_id"/);
});

test('currículo exige conta autenticada', () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /Faça login para salvar/);
});

test('YouTube é validado e links externos são protegidos', () => {
  assert.match(page, /youtube\\\.com\|youtu\\\.be/);
  assert.match(page, /rel="noopener noreferrer"/);
});

test('Social oferece acesso direto à área do especialista', () => {
  assert.match(social, /\['Especialistas', '\/especialistas'\]/);
});
