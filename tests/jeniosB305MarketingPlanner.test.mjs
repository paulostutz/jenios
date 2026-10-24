import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');

test('B305-R20 preference API authenticates user and only writes marketing preference fields',()=>{
 const src=read('app/api/social/email-preferences/route.js');
 assert.match(src,/socialContext/);
 assert.match(src,/getJeniosPayAdmin/);
 assert.match(src,/marketing_opt_in:body\.marketingOptIn/);
 assert.match(src,/opted_out_at:body\.marketingOptIn\?null:now/);
 assert.doesNotMatch(src,/complaint_at:\s*body|hard_bounce_at:\s*body/);
});
test('B305-R20 preferences page exposes opt in and opt out without server secrets',()=>{
 const src=read('app/preferencias/page.js');
 assert.match(src,/Ativar comunicações/);
 assert.match(src,/Desativar comunicações/);
 assert.match(src,/\/api\/social\/email-preferences/);
 assert.doesNotMatch(src,/SUPABASE_SECRET_KEY|service_role|RESEND_API_KEY/);
});
test('B305-R20 planner requires explicit opt in and approved newsletter',()=>{
 const sql=read('supabase/migrations/20261023005515_jenios_b305_marketing_planner.sql');
 assert.match(sql,/p\.marketing_opt_in=true/);
 assert.match(sql,/p\.opted_out_at IS NULL/);
 assert.match(sql,/p\.complaint_at IS NULL/);
 assert.match(sql,/p\.hard_bounce_at IS NULL/);
 assert.match(sql,/prod\.active=true/);
 assert.match(sql,/e\.status='approved'/);
 assert.match(sql,/cart_recovery/);
 assert.match(sql,/no_plan_nurture/);
 assert.match(sql,/newsletter/);
 assert.doesNotMatch(sql,/api\.resend\.com|RESEND_API_KEY/);
});
test('B305-R20 planner route is cron-protected and disabled by default',()=>{
 const src=read('app/api/internal/email/marketing-plan/route.js');
 assert.match(src,/CRON_SECRET/);
 assert.match(src,/JENIOS_MARKETING_PLANNER_ENABLED!=='true'/);
 assert.match(src,/jenios_plan_marketing_emails_r42/);
});
