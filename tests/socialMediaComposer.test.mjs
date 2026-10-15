import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const composer = readFileSync(new URL('../app/social/page.js', import.meta.url), 'utf8');
const card = readFileSync(new URL('../app/components/SocialPostCard.js', import.meta.url), 'utf8');

test('o mesmo seletor aceita fotos e vídeos', () => {
  assert.match(composer, /accept="image\/\*,video\/\*"/);
  assert.match(composer, /file\.type\.startsWith\('video\/'\)/);
});

test('vídeos são limitados a noventa segundos', () => {
  assert.match(composer, /duracao\s*>\s*90/);
  assert.match(composer, /1 minuto e 30 segundos/);
});

test('preview e publicação renderizam vídeo nativo', () => {
  assert.match(composer, /<video/);
  assert.match(card, /<video/);
  assert.match(card, /playsInline/);
});

test('composer não oferece controles de música', () => {
  assert.doesNotMatch(composer, /adicionar música|biblioteca musical|trilha sonora/i);
});
