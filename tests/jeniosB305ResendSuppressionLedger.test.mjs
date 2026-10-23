import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('B305-R25 suppression ledger is private, idempotent and stores no email address',()=>{
 const sql=readFileSync('supabase/migrations/20261023015029_jenios_b305_resend_suppression_webhook.sql','utf8');
 assert.match(sql,/event_id text PRIMARY KEY/);
 assert.match(sql,/ON CONFLICT\(event_id\) DO NOTHING/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/marketing_opt_in=false/);
 assert.match(sql,/email\.complained/);
 assert.match(sql,/hard_bounce/);
 assert.match(sql,/ignored_transient/);
 const tableSql=sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.jenios_resend_webhook_events_b305'),sql.indexOf('ALTER TABLE public.jenios_resend_webhook_events_b305 ENABLE ROW LEVEL SECURITY'));
 assert.doesNotMatch(tableSql,/recipient_email\s+text/);
 assert.doesNotMatch(sql,/api\.resend\.com|RESEND_WEBHOOK_SECRET|svix-signature/);
});
