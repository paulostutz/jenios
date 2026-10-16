import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../app/api/bankscore/laudo/route.js',import.meta.url),'utf8');
test('laudo aceita ambos nomes de credencial server-side',()=>{assert.match(src,/SUPABASE_SECRET_KEY\s*\|\|\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/);});
test('laudo não usa chave pública para consultas administrativas',()=>{assert.doesNotMatch(src,/NEXT_PUBLIC_SUPABASE_ANON_KEY/);});
