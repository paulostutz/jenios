import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('B305-R32 SQL preflight is read-only and service-role only',()=>{
 const sql=readFileSync('supabase/migrations/20261023023300_jenios_b305_email_preflight.sql','utf8');
 assert.match(sql,/STABLE/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/allRequired/);
 assert.match(sql,/jenios_b305_university_milestones/);
 assert.match(sql,/jenios_b305_finance_outbox_recipient_idx/);
 assert.match(sql,/REVOKE ALL .* PUBLIC,anon,authenticated/s);
 assert.match(sql,/GRANT EXECUTE .* service_role/s);
 assert.doesNotMatch(sql,/INSERT INTO|UPDATE |DELETE FROM|DROP TABLE/);
});
