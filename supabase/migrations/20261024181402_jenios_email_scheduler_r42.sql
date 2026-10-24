-- R42 uses the existing pg_cron/pg_net/Vault installation.
-- No job is scheduled and no request is made by this migration.
BEGIN;
CREATE SCHEMA IF NOT EXISTS jenios_private;
REVOKE ALL ON SCHEMA jenios_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS jenios_private.email_scheduler_r42(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 enabled boolean NOT NULL DEFAULT false,
 last_invoked_at timestamptz,
 last_request_id bigint
);
ALTER TABLE jenios_private.email_scheduler_r42 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jenios_private.email_scheduler_r42 FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO jenios_private.email_scheduler_r42(id) VALUES(true) ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION jenios_private.invoke_email_dispatch_r42()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE dispatch_secret text; request_id bigint;
BEGIN
 -- Cron's database role owns this private function; browser/service roles cannot call it.
 UPDATE jenios_private.email_scheduler_r42 SET last_invoked_at=clock_timestamp()
 WHERE id AND enabled AND (last_invoked_at IS NULL OR last_invoked_at<now()-interval '1 minute');
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT decrypted_secret INTO dispatch_secret FROM vault.decrypted_secrets
 WHERE name='jenios_email_dispatch_r42';
 IF dispatch_secret IS NULL OR length(dispatch_secret)<24
  THEN RAISE EXCEPTION 'EMAIL_R42_SCHEDULER_SECRET_MISSING'; END IF;
 SELECT net.http_get(
  url:='https://www.jenios.com.br/api/internal/email/dispatch',
  headers:=jsonb_build_object('Authorization','Bearer '||dispatch_secret,'Accept','application/json'),
  timeout_milliseconds:=65000
 ) INTO request_id;
 UPDATE jenios_private.email_scheduler_r42 SET last_request_id=request_id WHERE id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION jenios_private.invoke_email_dispatch_r42() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
