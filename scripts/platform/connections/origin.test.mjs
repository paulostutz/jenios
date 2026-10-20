import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantSameOrigin} from '../../../lib/platform/connections/request-origin.mjs';
// Browser-to-local-Next origin handling: no forwarded-header trust, no cross-site bypass.
test('B160 exact HTTPS origin and non-browser requests remain valid',()=>{
 assert.equal(assistantSameOrigin(new Request('https://jenios.example/api/assistant/free',{headers:{origin:'https://jenios.example'}})),true);
 assert.equal(assistantSameOrigin(new Request('https://jenios.example/api/assistant/free')),true);
});
test('B160 local canonical URL respects matching loopback Host only',()=>{
 assert.equal(assistantSameOrigin(new Request('http://localhost:3127/api/assistant/free',{headers:{host:'127.0.0.1:3127',origin:'http://127.0.0.1:3127','sec-fetch-site':'same-origin'}})),true);
 assert.equal(assistantSameOrigin(new Request('http://localhost:3127/api/assistant/free',{headers:{host:'127.0.0.1:3127',origin:'http://127.0.0.1:9999'}})),false);
});
for(const origin of ['https://foreign.example','null','https://jenios.example/path','https://user:secret@jenios.example'])test('B160 origin rejection '+origin,()=>{
 assert.equal(assistantSameOrigin(new Request('https://jenios.example/api/assistant/free',{headers:{origin,host:'jenios.example','x-forwarded-host':'foreign.example'}})),false);
});
test('B160 neither loopback canonicalization nor forwarded host authorize an external site',()=>{
 assert.equal(assistantSameOrigin(new Request('http://localhost:3127/api/assistant/free',{headers:{origin:'http://evil.example',host:'evil.example'}})),false);
 assert.equal(assistantSameOrigin(new Request('https://jenios.example/api/assistant/free',{headers:{origin:'https://jenios.example','sec-fetch-site':'cross-site'}})),false);
});
