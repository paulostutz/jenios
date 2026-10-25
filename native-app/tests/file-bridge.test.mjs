import {Buffer} from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePdfMessage} from '../src/file-bridge.ts';
const pdf=Buffer.from('%PDF-1.7\nTest\n%%EOF');
const good={kind:'jenios-pdf',filename:'jenios-bankscore-123.pdf',mime:'application/pdf',bytes:pdf.length,base64:pdf.toString('base64')};
const check=(value,url='https://www.jenios.com.br/bankscore')=>validatePdfMessage(JSON.stringify(value),url);
test('accepts only bounded first-party PDF payloads',()=>assert.deepEqual(check(good),{base64:good.base64,filename:good.filename,bytes:good.bytes}));
test('rejects foreign origins, non-PDF data, unsafe paths and inconsistent sizes',()=>{
 assert.equal(check(good,'https://evil.example'),null);
 for(const patch of [{filename:'../../secret.pdf'},{filename:'invoice.html'},{mime:'text/html'},{bytes:1},{base64:Buffer.from('<script>evil</script>').toString('base64')},{base64:good.base64+'!'}, {kind:'execute'}])assert.equal(check({...good,...patch}),null);
 assert.equal(validatePdfMessage('{','https://www.jenios.com.br'),null);
});
