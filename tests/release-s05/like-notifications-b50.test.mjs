import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/release-review/20261018_s05_b50_like_notifications.sql','utf8');
const notifications=readFileSync('lib/social/notifications.mjs','utf8');

test('S05-B50 migrates only the two missing like notifications with clear production preflight',()=>{
 assert.match(sql,/^BEGIN;/m);
 assert.match(sql,/^COMMIT;/m);
 assert.match(sql,/S05_B50_REFUSE_ISOLATED_STAGING/);
 assert.match(sql,/S05_B50_REQUIRED_SOCIAL_SCHEMA_MISSING/);
 assert.match(sql,/S05_B50_ALREADY_INSTALLED_REVIEW_BEFORE_REAPPLY/);
 assert.doesNotMatch(sql,/\bDROP (TABLE|TRIGGER|POLICY|SCHEMA)\b|\bTRUNCATE\b|\bDELETE FROM\b/i);
});
test('S05-B50 post and comment like trigger are after insert and do not alter existing notifications',()=>{
 assert.match(sql,/AFTER INSERT ON public\.post_likes/);
 assert.match(sql,/AFTER INSERT ON public\.comment_likes/);
 assert.match(sql,/jenios_notify_post_like_b50/);
 assert.match(sql,/jenios_notify_comment_like_b50/);
 assert.doesNotMatch(sql,/jenios_notify_comment_v7|jenios_notify_follow_v7|jenios_notify_direct_v7/);
});
test('S05-B50 notifications never expose archived, hidden, self-liked or blocked interactions',()=>{
 assert.match(sql,/p\.archived_at IS NULL/g);
 assert.match(sql,/recipient=actor/);
 assert.match(sql,/b\.blocker_id=recipient AND b\.blocked_id=actor/);
 assert.match(sql,/b\.blocker_id=actor AND b\.blocked_id=recipient/);
 assert.match(sql,/jenios_social_private\.hidden_posts/);
 assert.match(sql,/auth\.uid\(\) IS DISTINCT FROM actor/);
});
test('S05-B50 trigger is private with explicit execution denial and no client-visible credentials',()=>{
 assert.match(sql,/CREATE FUNCTION jenios_private\.notify_like_event_v1\(\)/);
 assert.match(sql,/SECURITY DEFINER\s+SET search_path = ''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION jenios_private\.notify_like_event_v1\(\)\s+FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/GRANT EXECUTE|NEXT_PUBLIC_|SUPABASE_SECRET_KEY|INTER_CLIENT_SECRET/);
});
test('S05-B50 a notification write failure does not stop a valid like',()=>{
 assert.match(sql,/EXCEPTION WHEN OTHERS THEN/);
 assert.match(sql,/RETURN NEW;/);
 assert.match(sql,/JENIOS_S05_B50_LIKE_NOTIFICATION_FAILED/);
});
test('S05-B50 notification targets remain relative to the Social and compatible with existing UI',()=>{
 assert.match(sql,/'\/social\?post='\|\|relevant_post::text/);
 assert.match(sql,/event_kind:='post_like'/);
 assert.match(sql,/event_kind:='comment_like'/);
 assert.match(notifications,/safeAppTarget/);
});
