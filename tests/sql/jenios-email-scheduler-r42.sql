-- Only the loopback test runner loads these networking/Vault stand-ins.
-- They are rolled back; no HTTP request is performed.
BEGIN;
CREATE SCHEMA net;
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text PRIMARY KEY,decrypted_secret text);
CREATE FUNCTION net.http_get(url text,params jsonb DEFAULT '{}',headers jsonb DEFAULT '{}',timeout_milliseconds integer DEFAULT 5000)
RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
 IF url<>'https://www.jenios.com.br/api/internal/email/dispatch'
 OR headers->>'Authorization'<>'Bearer local-r42-dispatch-fixture-secret-only'
 OR timeout_milliseconds<>65000 THEN RAISE EXCEPTION 'SCHEDULER_REQUEST_NOT_BOUND'; END IF;
 RETURN 4242;
END $$;
DO $$ DECLARE failed boolean:=false; request_result bigint; BEGIN
 IF has_function_privilege('anon','jenios_private.invoke_email_dispatch_r42()','EXECUTE')
 OR has_function_privilege('authenticated','jenios_private.invoke_email_dispatch_r42()','EXECUTE')
 OR has_function_privilege('service_role','jenios_private.invoke_email_dispatch_r42()','EXECUTE')
 THEN RAISE EXCEPTION 'SCHEDULER_PRIVILEGE_EXPOSED'; END IF;
 IF jenios_private.invoke_email_dispatch_r42() IS NOT NULL THEN RAISE EXCEPTION 'DISABLED_SCHEDULER_DISPATCHED'; END IF;
 UPDATE jenios_private.email_scheduler_r42 SET enabled=true WHERE id;
 BEGIN PERFORM jenios_private.invoke_email_dispatch_r42();
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'EMAIL_R42_SCHEDULER_SECRET_MISSING' THEN RAISE; END IF; failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'SCHEDULER_MISSING_SECRET_ACCEPTED'; END IF;
 INSERT INTO vault.decrypted_secrets VALUES('jenios_email_dispatch_r42','local-r42-dispatch-fixture-secret-only');
 request_result:=jenios_private.invoke_email_dispatch_r42();
 IF request_result<>4242 OR (SELECT last_request_id FROM jenios_private.email_scheduler_r42 WHERE email_scheduler_r42.id)<>4242
 THEN RAISE EXCEPTION 'SCHEDULER_RECEIPT_NOT_RECORDED'; END IF;
 IF jenios_private.invoke_email_dispatch_r42() IS NOT NULL THEN RAISE EXCEPTION 'SCHEDULER_DUPLICATE_DISPATCH'; END IF;
END $$;
ROLLBACK;
SELECT 'R42_PRIVATE_SCHEDULER_POSTGRES_PASS' AS result;
