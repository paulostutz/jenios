import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLATFORM_SLOGAN,SOCIAL_SLOGAN} from '../../lib/brand/identity.mjs';
test('JENIOS S03 preserves correct separate Platform/Social identity on production portal',()=>{
 assert.equal(PLATFORM_SLOGAN,'A Plataforma Que Transforma o Seu Erro Em Lucro');
 assert.equal(SOCIAL_SLOGAN,null);
 const home=readFileSync('app/page.js','utf8');
 const social=home.split('{/* Card Jenios Social */}')[1]?.split('{/* Card JENIOS Platform')[0];
 const platform=home.split('{/* Card JENIOS Platform')[1]?.split('{/* Rodapé Oficial */}')[0];
 const footer=home.split('{/* Rodapé Oficial */}')[1];
 assert.ok(social&&platform&&footer);
 assert.doesNotMatch(social,/PLATFORM_SLOGAN/);
 assert.match(platform,/\{PLATFORM_SLOGAN\}/);
 assert.doesNotMatch(footer,/PLATFORM_SLOGAN/);
 assert.match(home,/href="\/social"/);assert.match(home,/href="\/lp"/);
});
