import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('B305-R31 finance outbox recipient FK has a covering partial index',()=>{
 const sql=readFileSync('supabase/migrations/20261023022906_jenios_b305_finance_outbox_recipient_index.sql','utf8');
 assert.match(sql,/jenios_b305_finance_outbox_recipient_idx/);
 assert.match(sql,/jenios_pay_email_outbox_b305\(recipient_user_id\)/);
 assert.match(sql,/WHERE recipient_user_id IS NOT NULL/);
 assert.doesNotMatch(sql,/DROP INDEX|DROP TABLE|ALTER TABLE .* DROP/);
});
