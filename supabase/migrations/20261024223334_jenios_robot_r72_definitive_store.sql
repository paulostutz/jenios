-- R72: definitive JENIOS Platform database installation, explicitly authorized
-- by the owner on 2026-10-24 ("Publique ja no banco final" / "Vamos logo para o definitivo").
-- Target: xaicvhagftzjkqphnbgx, dedicated Platform database also required by G44 production.
-- This is a fresh-object installation only. Existing R64/R65/R67/R71 objects cause refusal.
-- Certified source files remain unchanged. Historical QA-only comments inside them
-- describe their original certification; this wrapper records the later hosted authorization.
-- Only install headers/outer transaction markers are adapted; all 39 function bodies,
-- table definitions, checks, grants, indexes and trigger behavior remain certified bytes.
-- One DO statement is atomic. No internal COMMIT, strategy execution, provider call,
-- observation, budget mutation, customer record or scheduler is executed here.
DO $r72_install$
DECLARE r record; object_oid oid; body_hash text; is_definer boolean; protected_rls boolean;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('jenios_robot_r72_definitive_install',0)) THEN
    RAISE EXCEPTION 'R72_INSTALL_BUSY';
  END IF;
  PERFORM pg_catalog.set_config('lock_timeout','5s',true);
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated','service_role'))<>3 THEN
    RAISE EXCEPTION 'R72_MANAGED_ROLES_MISSING';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname ~ '^jenios_robot_.*_r(64|65|67|71)($|_)')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname ~ '^jenios_robot_r(64|65|67|71)_') THEN
    RAISE EXCEPTION 'R72_EXISTING_OBJECTS_REQUIRE_REVIEW';
  END IF;
  -- Certified source: db/schema/robot-r64-operational-store.sql; SHA256 5a377a85f86ec3f7044409050eeb35e2ae0a67e7d1050b6b8bf35c13731e4d3c
  EXECUTE $r72_r64_source$
-- R64 REVIEW ONLY. Apply only to an explicitly selected disposable/QA Platform DB.
-- This file is not an applied Supabase migration and creates no cron/provider call.
-- No customer wallet, broker order, real/Paper execution or production telemetry.

CREATE TABLE public.jenios_robot_events_r64 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  source_id text NOT NULL CHECK(source_id ~ '^source:[a-f0-9]{16}$'),
  session_id text NOT NULL CHECK(session_id ~ '^session:[a-f0-9]{16}$'),
  event_id text NOT NULL CHECK(event_id ~ '^evt:[a-f0-9]{16}$'),
  sequence bigint NOT NULL CHECK(sequence BETWEEN 1 AND 9007199254740991),
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  admitted_at_ms bigint NOT NULL CHECK(admitted_at_ms BETWEEN 1 AND 9007199254740991),
  occurred_at_ms bigint NOT NULL CHECK(occurred_at_ms BETWEEN 1 AND 9007199254740991),
  captured_at_ms bigint NOT NULL CHECK(captured_at_ms BETWEEN occurred_at_ms AND admitted_at_ms),
  receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object' AND octet_length(receipt::text)<=8192
    AND receipt->>'schema'='JENIOS_R64_TELEMETRY_ADMISSION_V1'
    AND receipt->>'evidenceKind'='SIGNED_QA_REPLAY'),
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_id,event_id), UNIQUE(scope_id,source_id,session_id,sequence)
);
CREATE INDEX jenios_robot_events_r64_period
  ON public.jenios_robot_events_r64(scope_id,occurred_at_ms,event_id);
CREATE TABLE public.jenios_robot_config_r64 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  generation_enabled boolean NOT NULL DEFAULT false,
  requires_reconciliation boolean NOT NULL DEFAULT false,
  allowed_models text[] NOT NULL DEFAULT '{}' CHECK(cardinality(allowed_models)<=16),
  pricing_version text CHECK(pricing_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  pricing_approved boolean NOT NULL DEFAULT false,
  rates_verified_at timestamptz,
  max_request_nano_usd bigint NOT NULL DEFAULT 0 CHECK(max_request_nano_usd BETWEEN 0 AND 1000000000),
  monthly_limit_nano_usd bigint NOT NULL DEFAULT 0 CHECK(monthly_limit_nano_usd BETWEEN 0 AND 1000000000000)
);
INSERT INTO public.jenios_robot_config_r64(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE public.jenios_robot_budgets_r64 (
  month text PRIMARY KEY CHECK(month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  reserved_nano_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_nano_usd>=0),
  spent_nano_usd bigint NOT NULL DEFAULT 0 CHECK(spent_nano_usd>=0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.jenios_robot_cycles_r64 (
  cycle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  period_key text NOT NULL CHECK(period_key ~ '^r64:daily:[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  input_digest text NOT NULL CHECK(input_digest ~ '^[a-f0-9]{64}$'),
  input jsonb NOT NULL CHECK(jsonb_typeof(input)='object' AND octet_length(input::text)<=1048576
    AND input->>'schema'='JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1'
    AND input->>'evidenceKind'='SIGNED_QA_REPLAY'),
  state text NOT NULL DEFAULT 'CLAIMED' CHECK(state IN('CLAIMED','DISPATCHED','COMPLETED','NEEDS_RECONCILIATION')),
  lease_owner uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_generation bigint NOT NULL DEFAULT 1 CHECK(lease_generation BETWEEN 1 AND 9007199254740991),
  lease_until timestamptz NOT NULL DEFAULT(clock_timestamp()+interval '60 seconds'),
  request jsonb,
  budget_month text REFERENCES public.jenios_robot_budgets_r64(month),
  reserved_nano_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_nano_usd BETWEEN 0 AND 1000000000),
  settled_nano_usd bigint CHECK(settled_nano_usd>=0),
  provider_response_id text,
  result jsonb CHECK(result IS NULL OR jsonb_typeof(result)='object' AND octet_length(result::text)<=65536),
  report jsonb CHECK(report IS NULL OR jsonb_typeof(report)='object' AND octet_length(report::text)<=262144
    AND report->>'schema'='JENIOS_R64_OPERATIONAL_REPORT_V1'
    AND report->>'evidenceKind'='SIGNED_QA_REPLAY'),
  completion_digest text,
  audit_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  dispatched_at timestamptz,
  completed_at timestamptz,
  UNIQUE(scope_id,period_key)
);
CREATE UNIQUE INDEX jenios_robot_cycles_r64_provider_response
  ON public.jenios_robot_cycles_r64(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX jenios_robot_cycles_r64_reports
  ON public.jenios_robot_cycles_r64(scope_id,period_key DESC) WHERE state IN('COMPLETED','NEEDS_RECONCILIATION','DISPATCHED');

ALTER TABLE public.jenios_robot_events_r64 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_cycles_r64 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_budgets_r64 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_config_r64 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_robot_events_r64,public.jenios_robot_cycles_r64,
  public.jenios_robot_budgets_r64,public.jenios_robot_config_r64 FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.jenios_robot_events_r64 TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.jenios_robot_cycles_r64,public.jenios_robot_budgets_r64 TO service_role;
-- Config approval is an operator-owned action, not an API/worker mutation.
GRANT SELECT ON public.jenios_robot_config_r64 TO service_role;

CREATE FUNCTION public.jenios_robot_r64_ingest(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p jsonb:=p_input->'receipt'; previous public.jenios_robot_events_r64%ROWTYPE;
  latest public.jenios_robot_events_r64%ROWTYPE; n bigint; happened bigint; captured bigint; admitted bigint;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>8192
    OR p->>'schema' IS DISTINCT FROM 'JENIOS_R64_TELEMETRY_ADMISSION_V1'
    OR p->>'evidenceKind' IS DISTINCT FROM 'SIGNED_QA_REPLAY'
    OR coalesce(p->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(p->>'sourceId','') !~ '^source:[a-f0-9]{16}$'
    OR coalesce(p->>'sessionId','') !~ '^session:[a-f0-9]{16}$'
    OR coalesce(p->>'eventId','') !~ '^evt:[a-f0-9]{16}$'
    OR coalesce(p->>'payloadDigest','') !~ '^[a-f0-9]{64}$'
    OR p->'proof'->'configuredSourceSignatureVerified' IS DISTINCT FROM 'true'::jsonb
    OR p->'proof'->'independentBrokerAttestation' IS DISTINCT FROM 'false'::jsonb
    OR p->'proof'->'independentCustomerConsentVerified' IS DISTINCT FROM 'false'::jsonb
    OR jsonb_typeof(p->'sequence') IS DISTINCT FROM 'number'
    OR coalesce(p->>'sequence','') !~ '^[0-9]{1,16}$'
    OR jsonb_typeof(p->'event') IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'R64_DATABASE_RECEIPT'; END IF;
  n:=(p->>'sequence')::bigint;
  happened:=(p->'event'->>'occurredAtMs')::bigint;
  captured:=(p->'event'->>'capturedAtMs')::bigint;
  admitted:=(p->>'admittedAtMs')::bigint;
  IF n<1 OR happened<1 OR captured<happened OR admitted<captured
    OR (p->>'expiresAtMs')::bigint<=admitted OR captured-happened>86400000
  THEN RAISE EXCEPTION 'R64_DATABASE_RECEIPT'; END IF;
  -- Serialize the producer/session cursor, including the initially empty stream.
  PERFORM pg_advisory_xact_lock(hashtextextended('r64-ingest:'||(p->>'scopeId')||':'||
    (p->>'sourceId')||':'||(p->>'sessionId'),0));
  SELECT * INTO previous FROM public.jenios_robot_events_r64
    WHERE scope_id=p->>'scopeId' AND event_id=p->>'eventId';
  IF FOUND THEN
    -- Re-verifying an identical signed envelope on retry may have a later admission
    -- clock. Keep the first committed receipt; never replace its original time.
    IF previous.payload_digest IS DISTINCT FROM p->>'payloadDigest'
      OR (previous.receipt-'admittedAtMs') IS DISTINCT FROM (p-'admittedAtMs')
      THEN RAISE EXCEPTION 'R64_DATABASE_RECEIPT_CONFLICT'; END IF;
    RETURN jsonb_build_object('status','ALREADY_STORED','scopeId',previous.scope_id,'eventId',previous.event_id);
  END IF;
  SELECT * INTO latest FROM public.jenios_robot_events_r64
    WHERE scope_id=p->>'scopeId' AND source_id=p->>'sourceId' AND session_id=p->>'sessionId'
    ORDER BY sequence DESC LIMIT 1;
  IF FOUND AND (n<=latest.sequence OR happened<latest.occurred_at_ms
       OR captured<latest.captured_at_ms OR admitted<latest.admitted_at_ms)
  THEN RAISE EXCEPTION 'R64_DATABASE_SEQUENCE_REPLAY'; END IF;
  INSERT INTO public.jenios_robot_events_r64(scope_id,source_id,session_id,event_id,sequence,
    payload_digest,admitted_at_ms,occurred_at_ms,captured_at_ms,receipt)
    VALUES(p->>'scopeId',p->>'sourceId',p->>'sessionId',p->>'eventId',n,
      p->>'payloadDigest',admitted,happened,captured,p);
  RETURN jsonb_build_object('status','STORED','scopeId',p->>'scopeId','eventId',p->>'eventId');
END;
$$;

CREATE FUNCTION public.jenios_robot_r64_read_receipts(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE start_ms bigint:=(p_input->'period'->>'startMs')::bigint;
  end_ms bigint:=(p_input->'period'->>'endMs')::bigint; result jsonb;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$' OR start_ms IS NULL OR end_ms IS NULL
    OR start_ms<0 OR end_ms<=start_ms OR end_ms-start_ms>86400000
    THEN RAISE EXCEPTION 'R64_DATABASE_PERIOD'; END IF;
  SELECT coalesce(jsonb_agg(x.receipt ORDER BY x.occurred_at_ms,x.source_id,x.session_id,x.sequence,x.event_id),'[]'::jsonb)
    INTO result FROM (SELECT * FROM public.jenios_robot_events_r64
      WHERE scope_id=p_input->>'scopeId' AND occurred_at_ms>=start_ms AND occurred_at_ms<end_ms
      ORDER BY occurred_at_ms,source_id,session_id,sequence,event_id LIMIT 5001) x;
  IF jsonb_array_length(result)>5000 THEN RAISE EXCEPTION 'R64_DATABASE_RECEIPT_OVERFLOW'; END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.jenios_robot_r64_claim_cycle(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_robot_cycles_r64%ROWTYPE; inserted boolean:=false; clock_now timestamptz:=clock_timestamp();
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(p_input->>'periodKey','') !~ '^r64:daily:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR coalesce(p_input->>'inputDigest','') !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(p_input->'input') IS DISTINCT FROM 'object' OR octet_length((p_input->'input')::text)>1048576
    OR p_input->'input'->>'schema' IS DISTINCT FROM 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1'
    OR p_input->'input'->>'evidenceKind' IS DISTINCT FROM 'SIGNED_QA_REPLAY'
    OR p_input->'input'->>'scopeId' IS DISTINCT FROM p_input->>'scopeId'
    OR p_input->'input'->>'periodKey' IS DISTINCT FROM p_input->>'periodKey'
    THEN RAISE EXCEPTION 'R64_DATABASE_CYCLE_INPUT'; END IF;
  IF to_char(to_date(right(p_input->>'periodKey',10),'YYYY-MM-DD'),'YYYY-MM-DD')<>right(p_input->>'periodKey',10)
    THEN RAISE EXCEPTION 'R64_DATABASE_PERIOD'; END IF;
  INSERT INTO public.jenios_robot_cycles_r64(scope_id,period_key,input_digest,input)
    VALUES(p_input->>'scopeId',p_input->>'periodKey',p_input->>'inputDigest',p_input->'input')
    ON CONFLICT(scope_id,period_key) DO NOTHING RETURNING * INTO c;
  inserted:=FOUND;
  SELECT * INTO c FROM public.jenios_robot_cycles_r64
    WHERE scope_id=p_input->>'scopeId' AND period_key=p_input->>'periodKey' FOR UPDATE;
  IF c.input_digest IS DISTINCT FROM p_input->>'inputDigest' OR c.input IS DISTINCT FROM p_input->'input'
    THEN RAISE EXCEPTION 'R64_DATABASE_INPUT_CONFLICT'; END IF;
  clock_now:=clock_timestamp();
  IF c.state='COMPLETED' THEN RETURN jsonb_build_object('status','COMPLETED','cycleId',c.cycle_id); END IF;
  IF c.state='NEEDS_RECONCILIATION' THEN RETURN jsonb_build_object('status',c.state,'cycleId',c.cycle_id); END IF;
  IF c.state='DISPATCHED' THEN
    IF c.lease_until<=clock_now THEN
      UPDATE public.jenios_robot_cycles_r64 SET state='NEEDS_RECONCILIATION',
        audit_code='LEASE_EXPIRED_AFTER_DISPATCH',updated_at=clock_now WHERE cycle_id=c.cycle_id;
      RETURN jsonb_build_object('status','NEEDS_RECONCILIATION','cycleId',c.cycle_id);
    END IF;
    RETURN jsonb_build_object('status','BUSY','cycleId',c.cycle_id);
  END IF;
  IF NOT inserted AND c.lease_until>clock_now THEN RETURN jsonb_build_object('status','BUSY','cycleId',c.cycle_id); END IF;
  IF NOT inserted THEN
    UPDATE public.jenios_robot_cycles_r64 SET lease_owner=gen_random_uuid(),
      lease_generation=lease_generation+1,lease_until=clock_now+interval '60 seconds',updated_at=clock_now
      WHERE cycle_id=c.cycle_id RETURNING * INTO c;
  END IF;
  RETURN jsonb_build_object('status','CLAIMED','cycleId',c.cycle_id,'leaseOwner',c.lease_owner,
    'leaseGeneration',c.lease_generation,'input',c.input);
END;
$$;

CREATE FUNCTION public.jenios_robot_r64_read_cycle(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_robot_cycles_r64%ROWTYPE;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(p_input->>'periodKey','') !~ '^r64:daily:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    THEN RAISE EXCEPTION 'R64_DATABASE_SCOPE'; END IF;
  SELECT * INTO c FROM public.jenios_robot_cycles_r64
    WHERE scope_id=p_input->>'scopeId' AND period_key=p_input->>'periodKey';
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
  RETURN jsonb_build_object('cycleId',c.cycle_id,'scopeId',c.scope_id,'periodKey',c.period_key,
    'status',c.state,'inputDigest',c.input_digest,'input',c.input,'leaseGeneration',c.lease_generation,
    'leaseUntilMs',floor(extract(epoch FROM c.lease_until)*1000)::bigint,'report',c.report);
END;
$$;

CREATE FUNCTION public.jenios_robot_r64_analyst_policy(p_input jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('generationEnabled',generation_enabled,'requiresReconciliation',requires_reconciliation,
    'allowedModels',allowed_models,'pricingVersion',pricing_version,'pricingApproved',pricing_approved,
    'ratesVerifiedAt',rates_verified_at,'maxRequestProviderNanoUsd',max_request_nano_usd,
    'monthlyProviderLimitNanoUsd',monthly_limit_nano_usd)
    FROM public.jenios_robot_config_r64 WHERE singleton=true;
$$;

CREATE FUNCTION public.jenios_robot_r64_reserve_dispatch(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_robot_cycles_r64%ROWTYPE; cfg public.jenios_robot_config_r64%ROWTYPE;
  b public.jenios_robot_budgets_r64%ROWTYPE; r jsonb:=p_input->'request'; amount bigint;
  month_key text; expected_amount bigint; clock_now timestamptz:=clock_timestamp();
BEGIN
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(r))<>6
    OR coalesce(r->>'fingerprint','') !~ '^[a-f0-9]{64}$'
    OR coalesce(r->>'model','') !~ '^[A-Za-z0-9._:-]{1,80}$'
    OR coalesce(r->>'pricingVersion','') !~ '^[A-Za-z0-9._:-]{1,80}$'
    OR r->'maxInputTokens' IS DISTINCT FROM '8000'::jsonb OR r->'maxOutputTokens' IS DISTINCT FROM '700'::jsonb
    OR jsonb_typeof(r->'reservationNanoUsd') IS DISTINCT FROM 'number'
    OR coalesce(r->>'reservationNanoUsd','') !~ '^[0-9]{1,10}$'
    THEN RAISE EXCEPTION 'R64_DATABASE_RESERVATION'; END IF;
  amount:=(r->>'reservationNanoUsd')::bigint;
  IF amount<1 OR amount>1000000000 THEN RAISE EXCEPTION 'R64_DATABASE_RESERVATION'; END IF;
  SELECT * INTO cfg FROM public.jenios_robot_config_r64 WHERE singleton=true;
  SELECT * INTO c FROM public.jenios_robot_cycles_r64 WHERE cycle_id=(p_input->>'cycleId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R64_DATABASE_CYCLE_MISSING'; END IF;
  IF c.lease_owner IS DISTINCT FROM (p_input->>'leaseOwner')::uuid
    OR c.lease_generation IS DISTINCT FROM (p_input->>'leaseGeneration')::bigint
    THEN RAISE EXCEPTION 'R64_DATABASE_STALE_LEASE'; END IF;
  IF c.state<>'CLAIMED' THEN RETURN jsonb_build_object('dispatchGranted',false,'reason',
    CASE WHEN c.state='DISPATCHED' THEN 'ALREADY_DISPATCHED' ELSE c.state END); END IF;
  clock_now:=clock_timestamp();
  IF c.lease_until<=clock_now THEN RAISE EXCEPTION 'R64_DATABASE_STALE_LEASE'; END IF;
  IF NOT cfg.generation_enabled OR cfg.requires_reconciliation OR NOT cfg.pricing_approved
    OR cfg.rates_verified_at IS NULL OR cfg.rates_verified_at>clock_now
    OR cfg.rates_verified_at<clock_now-interval '30 days'
    OR cfg.pricing_version IS DISTINCT FROM r->>'pricingVersion' OR NOT((r->>'model')=ANY(cfg.allowed_models))
    THEN RETURN jsonb_build_object('dispatchGranted',false,'reason','POLICY_DISABLED_OR_UNVERIFIED'); END IF;
  -- Same conservative pure quote as PRO_PRICING_VERSION, without its retail/customer component.
  expected_amount:=CASE r->>'model' WHEN 'gpt-6-luna' THEN 1350000 WHEN 'gpt-6.1-sol' THEN 27000000 ELSE NULL END;
  IF r->>'pricingVersion'<>'2026-10-20-v2-nano' OR expected_amount IS NULL OR amount<>expected_amount
    THEN RETURN jsonb_build_object('dispatchGranted',false,'reason','PRICING_QUOTE_MISMATCH'); END IF;
  IF amount>cfg.max_request_nano_usd OR amount>cfg.monthly_limit_nano_usd
    THEN RETURN jsonb_build_object('dispatchGranted',false,'reason','BUDGET_EXHAUSTED'); END IF;
  month_key:=to_char(clock_now AT TIME ZONE 'UTC','YYYY-MM');
  INSERT INTO public.jenios_robot_budgets_r64(month) VALUES(month_key) ON CONFLICT DO NOTHING;
  SELECT * INTO b FROM public.jenios_robot_budgets_r64 WHERE month=month_key FOR UPDATE;
  -- A contended budget lock may outlive this worker lease or policy approval.
  clock_now:=clock_timestamp();
  IF c.lease_until<=clock_now THEN RAISE EXCEPTION 'R64_DATABASE_STALE_LEASE'; END IF;
  SELECT * INTO cfg FROM public.jenios_robot_config_r64 WHERE singleton=true;
  IF NOT cfg.generation_enabled OR cfg.requires_reconciliation OR NOT cfg.pricing_approved
    OR cfg.rates_verified_at IS NULL OR cfg.rates_verified_at>clock_now
    OR cfg.rates_verified_at<clock_now-interval '30 days'
    OR cfg.pricing_version IS DISTINCT FROM r->>'pricingVersion' OR NOT((r->>'model')=ANY(cfg.allowed_models))
    THEN RETURN jsonb_build_object('dispatchGranted',false,'reason','POLICY_DISABLED_OR_UNVERIFIED'); END IF;
  IF amount>cfg.max_request_nano_usd OR amount>cfg.monthly_limit_nano_usd
    THEN RETURN jsonb_build_object('dispatchGranted',false,'reason','BUDGET_EXHAUSTED'); END IF;
  IF b.reserved_nano_usd+b.spent_nano_usd>cfg.monthly_limit_nano_usd-amount
    THEN RETURN jsonb_build_object('dispatchGranted',false,'reason','BUDGET_EXHAUSTED'); END IF;
  UPDATE public.jenios_robot_budgets_r64 SET reserved_nano_usd=reserved_nano_usd+amount,updated_at=clock_now WHERE month=month_key;
  UPDATE public.jenios_robot_cycles_r64 SET state='DISPATCHED',request=r,budget_month=month_key,
    reserved_nano_usd=amount,dispatched_at=clock_now,updated_at=clock_now WHERE cycle_id=c.cycle_id;
  RETURN jsonb_build_object('dispatchGranted',true,'reason','DISPATCHED','reservationNanoUsd',amount,'budgetMonth',month_key);
END;
$$;

CREATE FUNCTION public.jenios_robot_r64_complete_cycle(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_robot_cycles_r64%ROWTYPE; r jsonb:=p_input->'result'; report_value jsonb:=p_input->'report';
  original_digest text; paid_cost bigint:=0; uncertain boolean:=false; audit_reason text:='COMPLETED';
  response_id text; clock_now timestamptz:=clock_timestamp();
BEGIN
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR octet_length(r::text)>65536
    OR coalesce(r->>'kind','') NOT IN('not_generated','usage_confirmed','unknown')
    OR r->'retryAllowed' IS DISTINCT FROM 'false'::jsonb OR r->'mayPromote' IS DISTINCT FROM 'false'::jsonb
    OR jsonb_typeof(report_value) IS DISTINCT FROM 'object' OR octet_length(report_value::text)>262144
    OR report_value->>'schema' IS DISTINCT FROM 'JENIOS_R64_OPERATIONAL_REPORT_V1'
    OR report_value->>'evidenceKind' IS DISTINCT FROM 'SIGNED_QA_REPLAY'
    OR report_value->'actualBrokerPnl' IS DISTINCT FROM 'null'::jsonb
    OR report_value->'actualLossesAvoided' IS DISTINCT FROM 'null'::jsonb
    OR report_value->'realTradeAccuracy' IS DISTINCT FROM 'null'::jsonb
    OR report_value->'realOrdersSent' IS DISTINCT FROM '0'::jsonb
    OR report_value->'externalPaperOrdersSent' IS DISTINCT FROM '0'::jsonb
    OR report_value->'productionMonitoringStarted' IS DISTINCT FROM 'false'::jsonb
    THEN RAISE EXCEPTION 'R64_DATABASE_COMPLETION'; END IF;
  IF jsonb_typeof(r->'httpRequests') IS DISTINCT FROM 'number' OR coalesce(r->>'httpRequests','') !~ '^[0-2]$'
    OR jsonb_typeof(r->'inferenceRequests') IS DISTINCT FROM 'number' OR coalesce(r->>'inferenceRequests','') !~ '^[01]$'
    THEN RAISE EXCEPTION 'R64_DATABASE_ANALYSIS_RESULT'; END IF;
  IF r->>'kind'='not_generated' AND (r->'inferenceRequests' IS DISTINCT FROM '0'::jsonb
    OR r->'costNanoUsd' IS DISTINCT FROM 'null'::jsonb OR r->'usage' IS DISTINCT FROM 'null'::jsonb
    OR r->'providerResponseId' IS DISTINCT FROM 'null'::jsonb)
    THEN RAISE EXCEPTION 'R64_DATABASE_ANALYSIS_RESULT'; END IF;
  IF r->>'kind'='usage_confirmed' THEN
    IF r->'inferenceRequests' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(r->'costNanoUsd') IS DISTINCT FROM 'number'
      OR coalesce(r->>'costNanoUsd','') !~ '^[0-9]{1,15}$' OR jsonb_typeof(r->'usage') IS DISTINCT FROM 'object'
      OR coalesce(r->>'providerResponseId','') !~ '^resp_[A-Za-z0-9_-]{1,160}$'
      THEN RAISE EXCEPTION 'R64_DATABASE_ANALYSIS_RESULT'; END IF;
    paid_cost:=(r->>'costNanoUsd')::bigint;
  ELSIF r->'costNanoUsd' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'R64_DATABASE_ANALYSIS_RESULT'; END IF;
  response_id:=r->>'providerResponseId';
  IF response_id IS NOT NULL AND response_id !~ '^resp_[A-Za-z0-9_-]{1,160}$'
    THEN RAISE EXCEPTION 'R64_DATABASE_ANALYSIS_RESULT'; END IF;
  original_digest:=encode(sha256(convert_to(jsonb_build_object('result',r,'report',report_value)::text,'UTF8')),'hex');
  -- The budget row serializes settlements across independent cycle owners.
  SELECT * INTO c FROM public.jenios_robot_cycles_r64 WHERE cycle_id=(p_input->>'cycleId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R64_DATABASE_CYCLE_MISSING'; END IF;
  IF report_value->>'scopeId' IS DISTINCT FROM c.scope_id OR report_value->>'periodKey' IS DISTINCT FROM c.period_key
    THEN RAISE EXCEPTION 'R64_DATABASE_REPORT_SCOPE'; END IF;
  IF c.completion_digest IS NOT NULL THEN
    IF c.completion_digest<>original_digest THEN RAISE EXCEPTION 'R64_DATABASE_COMPLETION_CONFLICT'; END IF;
    RETURN jsonb_build_object('status',c.state,'cycleId',c.cycle_id,'replayed',true,'report',c.report);
  END IF;
  IF c.lease_owner IS DISTINCT FROM (p_input->>'leaseOwner')::uuid
    OR c.lease_generation IS DISTINCT FROM (p_input->>'leaseGeneration')::bigint
    THEN RAISE EXCEPTION 'R64_DATABASE_STALE_LEASE'; END IF;
  clock_now:=clock_timestamp();
  IF c.state='CLAIMED' THEN
    IF c.lease_until<=clock_now THEN RAISE EXCEPTION 'R64_DATABASE_STALE_LEASE'; END IF;
    IF r->>'kind'<>'not_generated' THEN RAISE EXCEPTION 'R64_DATABASE_PROVIDER_NOT_DISPATCHED'; END IF;
  ELSIF c.state IN('DISPATCHED','NEEDS_RECONCILIATION') THEN
    IF r->>'fingerprint' IS DISTINCT FROM c.request->>'fingerprint'
      OR r->>'model' IS DISTINCT FROM c.request->>'model'
      OR r->>'pricingVersion' IS DISTINCT FROM c.request->>'pricingVersion'
      THEN RAISE EXCEPTION 'R64_DATABASE_PROVIDER_BINDING'; END IF;
    PERFORM month FROM public.jenios_robot_budgets_r64 WHERE month=c.budget_month FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'R64_DATABASE_BUDGET_INVARIANT'; END IF;
    clock_now:=clock_timestamp();
    IF c.state='NEEDS_RECONCILIATION' OR c.lease_until<=clock_now THEN uncertain:=true;audit_reason:='LEASE_OR_RECONCILIATION_REVIEW'; END IF;
    IF r->>'kind'='unknown' THEN uncertain:=true;audit_reason:='PROVIDER_RESULT_UNKNOWN'; END IF;
    IF paid_cost>c.reserved_nano_usd THEN uncertain:=true;audit_reason:='PROVIDER_COST_EXCEEDS_RESERVATION'; END IF;
    IF response_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.jenios_robot_cycles_r64
      WHERE provider_response_id=response_id AND cycle_id<>c.cycle_id)
      THEN uncertain:=true;audit_reason:='DUPLICATE_PROVIDER_RESPONSE';response_id:=NULL; END IF;
    IF NOT uncertain THEN
      UPDATE public.jenios_robot_budgets_r64 SET reserved_nano_usd=reserved_nano_usd-c.reserved_nano_usd,
        spent_nano_usd=spent_nano_usd+paid_cost,updated_at=clock_now
        WHERE month=c.budget_month AND reserved_nano_usd>=c.reserved_nano_usd;
      IF NOT FOUND THEN RAISE EXCEPTION 'R64_DATABASE_BUDGET_INVARIANT'; END IF;
    END IF;
  ELSE RAISE EXCEPTION 'R64_DATABASE_COMPLETION_STATE'; END IF;
  IF uncertain THEN
    report_value:=report_value || jsonb_build_object('hypotheses',NULL,'maturity',
      jsonb_build_object('stage','RECONCILIATION_REQUIRED','label','Observações registradas; análise exige reconciliação',
        'completionCeilingKnown',false),'providerAudit',
      CASE WHEN jsonb_typeof(report_value->'providerAudit')='object' THEN report_value->'providerAudit' ELSE '{}'::jsonb END ||
        jsonb_build_object('kind','unknown','analysisStatus','NOT_AVAILABLE','reason','DURABLE_RECONCILIATION_REQUIRED',
          'costNanoUsd',NULL,'usage',NULL));
  END IF;
  UPDATE public.jenios_robot_cycles_r64 SET state=CASE WHEN uncertain THEN 'NEEDS_RECONCILIATION' ELSE 'COMPLETED' END,
    settled_nano_usd=CASE WHEN uncertain THEN NULL ELSE paid_cost END,provider_response_id=response_id,
    result=r,report=report_value,completion_digest=original_digest,audit_code=audit_reason,
    updated_at=clock_now,completed_at=clock_now WHERE cycle_id=c.cycle_id RETURNING * INTO c;
  RETURN jsonb_build_object('status',c.state,'cycleId',c.cycle_id,'replayed',false,'report',c.report);
END;
$$;

CREATE FUNCTION public.jenios_robot_r64_read_reports(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; maximum integer:=(p_input->>'limit')::integer;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$' OR maximum IS NULL OR maximum<1 OR maximum>30
    THEN RAISE EXCEPTION 'R64_DATABASE_REPORT_LIMIT'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('cycleId',x.cycle_id,'scopeId',x.scope_id,'periodKey',x.period_key,
    'status',CASE WHEN x.state='DISPATCHED' THEN 'NEEDS_RECONCILIATION' ELSE x.state END,
    'report',x.report) ORDER BY x.period_key DESC),'[]'::jsonb) INTO result
    FROM (SELECT cycle_id,scope_id,period_key,state,report FROM public.jenios_robot_cycles_r64
      WHERE scope_id=p_input->>'scopeId' AND (state IN('COMPLETED','NEEDS_RECONCILIATION')
        OR state='DISPATCHED' AND lease_until<=clock_timestamp())
      ORDER BY period_key DESC LIMIT maximum) x;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.jenios_robot_r64_ingest(jsonb),
  public.jenios_robot_r64_read_receipts(jsonb),public.jenios_robot_r64_claim_cycle(jsonb),
  public.jenios_robot_r64_read_cycle(jsonb),public.jenios_robot_r64_analyst_policy(jsonb),
  public.jenios_robot_r64_reserve_dispatch(jsonb),public.jenios_robot_r64_complete_cycle(jsonb),
  public.jenios_robot_r64_read_reports(jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_robot_r64_ingest(jsonb),
  public.jenios_robot_r64_read_receipts(jsonb),public.jenios_robot_r64_claim_cycle(jsonb),
  public.jenios_robot_r64_read_cycle(jsonb),public.jenios_robot_r64_analyst_policy(jsonb),
  public.jenios_robot_r64_reserve_dispatch(jsonb),public.jenios_robot_r64_complete_cycle(jsonb),
  public.jenios_robot_r64_read_reports(jsonb) TO service_role;
COMMENT ON TABLE public.jenios_robot_events_r64 IS 'Signed QA replay only. Signature integrity is not independent broker, customer or consent attestation.';
COMMENT ON TABLE public.jenios_robot_budgets_r64 IS 'Internal provider budget. No customer wallet, retail charge or broker financial performance.';
COMMENT ON TABLE public.jenios_robot_cycles_r64 IS 'Immutable period input; single provider dispatch; ambiguous attempts retain reservation and require reconciliation.';

$r72_r64_source$;

  -- Certified source: db/schema/robot-r65-lifecycle-store.sql; SHA256 0c9234f8b6f7d8d23725971663be82b4c69592224027760d895c505074d54887
  EXECUTE $r72_r65_source$
-- R65 REVIEW ONLY; additive after robot-r64-operational-store.sql.
-- Apply only to an explicitly selected disposable QA database. No production,
-- hosted Supabase, provider, customer wallet, order, purge or scheduler operation.
-- Archives are LOGICAL COPIES: originals remain and no space is reclaimed.
-- Digest format: SHA-256 of PostgreSQL jsonb::text encoded as UTF-8. This is not
-- the JavaScript canonical digest used by R64 telemetry/input envelopes.

CREATE TABLE public.jenios_robot_observation_provenance_r65 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  event_id text NOT NULL CHECK(event_id ~ '^evt:[a-f0-9]{16}$'),
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  provenance jsonb NOT NULL CHECK(jsonb_typeof(provenance)='object' AND octet_length(provenance::text)<=8192),
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_id,event_id),
  FOREIGN KEY(scope_id,event_id) REFERENCES public.jenios_robot_events_r64(scope_id,event_id)
);

CREATE TABLE public.jenios_robot_reconciliations_r65 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  cycle_id uuid PRIMARY KEY REFERENCES public.jenios_robot_cycles_r64(cycle_id),
  operation_id text NOT NULL CHECK(operation_id ~ '^op:[a-f0-9]{32}$'),
  actor_id text NOT NULL CHECK(actor_id ~ '^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
  request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
  resolution_kind text NOT NULL CHECK(resolution_kind IN('CONFIRMED_USAGE','CONFIRMED_NO_CHARGE')),
  cost_nano_usd bigint NOT NULL CHECK(cost_nano_usd BETWEEN 0 AND 9007199254740991),
  provider_response_id text CHECK(provider_response_id ~ '^resp_[A-Za-z0-9_-]{1,160}$'),
  evidence_digest text NOT NULL CHECK(evidence_digest ~ '^[a-f0-9]{64}$'),
  original_reservation_nano_usd bigint NOT NULL CHECK(original_reservation_nano_usd>0),
  budget_month text NOT NULL REFERENCES public.jenios_robot_budgets_r64(month),
  over_reservation boolean NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(scope_id,operation_id),
  CHECK((resolution_kind='CONFIRMED_USAGE' AND provider_response_id IS NOT NULL)
    OR (resolution_kind='CONFIRMED_NO_CHARGE' AND provider_response_id IS NULL AND cost_nano_usd=0))
);
CREATE UNIQUE INDEX jenios_robot_reconciliations_r65_response
  ON public.jenios_robot_reconciliations_r65(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX jenios_robot_reconciliations_r65_scope
  ON public.jenios_robot_reconciliations_r65(scope_id,resolved_at DESC,cycle_id);

CREATE TABLE public.jenios_robot_archives_r65 (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  cutoff_ms bigint NOT NULL CHECK(cutoff_ms BETWEEN 0 AND 9007199254740991),
  batch_limit integer NOT NULL CHECK(batch_limit BETWEEN 1 AND 10),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object' AND octet_length(manifest::text)<=16777216),
  manifest_digest text NOT NULL CHECK(manifest_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'PREVIEW' CHECK(status IN('PREVIEW','COMMITTED')),
  operation_id text CHECK(operation_id ~ '^op:[a-f0-9]{32}$'),
  actor_id text CHECK(actor_id='system:r65' OR actor_id ~ '^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
  request_digest text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT(clock_timestamp()+interval '15 minutes'),
  committed_at timestamptz,
  UNIQUE(scope_id,operation_id),
  CHECK(status='PREVIEW' OR (operation_id IS NOT NULL AND actor_id IS NOT NULL AND committed_at IS NOT NULL AND request_digest IS NOT NULL))
);
CREATE INDEX jenios_robot_archives_r65_scope
  ON public.jenios_robot_archives_r65(scope_id,created_at DESC,archive_id);
CREATE TABLE public.jenios_robot_archive_items_r65 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  item_kind text NOT NULL CHECK(item_kind IN('CYCLE','EVENT')),
  item_id text NOT NULL,
  archive_id uuid NOT NULL REFERENCES public.jenios_robot_archives_r65(archive_id),
  PRIMARY KEY(scope_id,item_kind,item_id)
);

CREATE TABLE public.jenios_robot_evolution_r65 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  revision integer NOT NULL CHECK(revision BETWEEN 0 AND 32),
  operation_id text NOT NULL CHECK(operation_id ~ '^op:[a-f0-9]{32}$'),
  actor_id text NOT NULL CHECK(actor_id='system:r65' OR actor_id ~ '^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
  request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  state_digest text NOT NULL CHECK(state_digest ~ '^[a-f0-9]{64}$'),
  state jsonb NOT NULL CHECK(jsonb_typeof(state)='object' AND octet_length(state::text)<=1048576
    AND state->>'schema'='JENIOS_R65_EVOLUTION_STATE_V1' AND state->>'scopeId'=scope_id
    AND (state->>'revision')::integer=revision),
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_id,revision), UNIQUE(scope_id,operation_id)
);
CREATE TABLE public.jenios_robot_validation_cases_r65 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  plan_id text NOT NULL CHECK(plan_id ~ '^plan:[a-f0-9]{16}$'),
  case_id text NOT NULL CHECK(case_id ~ '^case:[a-f0-9]{16}$'),
  baseline_allow boolean NOT NULL,
  candidate_allow boolean NOT NULL,
  validation_case jsonb NOT NULL CHECK(jsonb_typeof(validation_case)='object'
    AND validation_case->>'scopeId'=scope_id AND validation_case->>'caseId'=case_id
    AND validation_case->>'evidenceKind'='SYNTHETIC_FIXTURE'),
  PRIMARY KEY(scope_id,plan_id,case_id)
);

ALTER TABLE public.jenios_robot_reconciliations_r65 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_archives_r65 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_archive_items_r65 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_evolution_r65 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_validation_cases_r65 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_observation_provenance_r65 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_robot_reconciliations_r65,public.jenios_robot_archives_r65,
  public.jenios_robot_archive_items_r65,public.jenios_robot_evolution_r65,
  public.jenios_robot_validation_cases_r65,public.jenios_robot_observation_provenance_r65 FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.jenios_robot_reconciliations_r65,public.jenios_robot_archives_r65,
  public.jenios_robot_archive_items_r65,public.jenios_robot_evolution_r65,
  public.jenios_robot_validation_cases_r65,public.jenios_robot_observation_provenance_r65 TO service_role;
GRANT UPDATE(status,operation_id,actor_id,request_digest,committed_at)
  ON public.jenios_robot_archives_r65 TO service_role;

CREATE FUNCTION public.jenios_robot_r65_digest(value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path='' AS $$
  SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex');
$$;

CREATE FUNCTION public.jenios_robot_r65_ingest_observation(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p jsonb:=p_input->'provenance'; r jsonb:=p_input->'receipt'; stored jsonb; result jsonb; field_name text; inserted boolean;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>8192
    OR (SELECT count(*) FROM jsonb_object_keys(p))<>24
    OR p->>'schema' IS DISTINCT FROM 'JENIOS_R65_RUNTIME_PROVENANCE_V1'
    OR p->>'origin' IS DISTINCT FROM 'R61_SYNTHETIC_RUNTIME'
    OR p->>'runtimeEvidenceKind' IS DISTINCT FROM 'SYNTHETIC_FIXTURE'
    OR p->>'transportEvidenceKind' IS DISTINCT FROM 'SIGNED_QA_REPLAY'
    OR p->>'eventId' IS DISTINCT FROM r->>'eventId' OR p->>'payloadDigest' IS DISTINCT FROM r->>'payloadDigest'
    OR coalesce(p->>'inputDigest','') !~ '^[a-f0-9]{64}$'
    OR p->>'policyVersion' IS DISTINCT FROM r->'event'->>'policyVersion'
    OR coalesce(p->>'policyVersion','') NOT IN('research:r65-v1','research:r65-v2')
    OR p->>'robot' IS DISTINCT FROM r->'event'->>'robot'
    OR coalesce(p->>'activationGeneration','') !~ '^[0-2]$'
    OR coalesce(p->>'clockSource','') NOT IN('WALL_CLOCK_QA_EXECUTION','PINNED_QA_REPLAY_CLOCK')
    OR (p->>'clockSource'='WALL_CLOCK_QA_EXECUTION') IS DISTINCT FROM (r->'event'->>'occurredAtMs'=r->'event'->>'capturedAtMs')
    OR p->'realOrdersSent' IS DISTINCT FROM '0'::jsonb OR p->'externalPaperOrdersSent' IS DISTINCT FROM '0'::jsonb
    OR p->'actualBrokerPnl' IS DISTINCT FROM 'null'::jsonb OR p->'actualLossesAvoided' IS DISTINCT FROM 'null'::jsonb
    OR p->'realTradeAccuracy' IS DISTINCT FROM 'null'::jsonb
    THEN RAISE EXCEPTION 'R65_DATABASE_PROVENANCE'; END IF;
  FOREACH field_name IN ARRAY ARRAY['automaticPromotionAllowed','executionAllowed','customerMonitoringActive',
    'independentBrokerAttestation','independentCustomerConsentVerified'] LOOP
    IF p->field_name IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'R65_DATABASE_PROVENANCE'; END IF;
  END LOOP;
  IF p->>'robot'='ultrafast' THEN
    IF p->>'runtimeHook' IS DISTINCT FROM 'R65_ACTIVE_RUNTIME_R61_AND_R47'
      OR coalesce(p->>'controlEvent','') NOT IN('snapshot','pause','resume')
      OR p->>'marketAgeOrigin' IS DISTINCT FROM (CASE WHEN p->>'controlEvent'='snapshot' THEN 'SYNTHETIC_INPUT' ELSE 'NO_MARKET_OBSERVATION' END)
      OR (p->>'controlEvent'<>'snapshot' AND (r->'event'->>'issue'<>'NONE' OR r->'event'->>'kind'<>'decision'
        OR r->'event'->>'decision'<>'BLOCK' OR r->'event'->'marketAgeMs'<>'0'::jsonb))
      THEN RAISE EXCEPTION 'R65_DATABASE_PROVENANCE'; END IF;
  ELSIF p->>'runtimeHook' IS DISTINCT FROM 'R61_ASSISTED_ACCEPTANCE'
    OR p->>'controlEvent' IS DISTINCT FROM 'assisted_evaluation' OR p->>'marketAgeOrigin' IS DISTINCT FROM 'NO_MARKET_OBSERVATION'
    OR r->'event'->'marketAgeMs' IS DISTINCT FROM '0'::jsonb OR r->'event'->>'kind' IS DISTINCT FROM 'decision'
    OR r->'event'->>'issue' IS DISTINCT FROM 'NONE' OR coalesce(r->'event'->>'decision','') NOT IN('KEEP','ADVISE')
    OR (p->>'robot'='manual' AND r->'event'->>'decision'<>'KEEP')
    THEN RAISE EXCEPTION 'R65_DATABASE_PROVENANCE'; END IF;
  result:=public.jenios_robot_r64_ingest(jsonb_build_object('receipt',r));
  INSERT INTO public.jenios_robot_observation_provenance_r65(scope_id,event_id,payload_digest,provenance)
    VALUES(r->>'scopeId',r->>'eventId',r->>'payloadDigest',p) ON CONFLICT DO NOTHING;
  inserted:=FOUND;
  SELECT provenance INTO stored FROM public.jenios_robot_observation_provenance_r65
    WHERE scope_id=r->>'scopeId' AND event_id=r->>'eventId';
  IF stored IS DISTINCT FROM p THEN RAISE EXCEPTION 'R65_DATABASE_PROVENANCE_CONFLICT'; END IF;
  RETURN jsonb_build_object('status',CASE WHEN inserted OR result->>'status'='STORED' THEN 'STORED' ELSE 'ALREADY_STORED' END,
    'scopeId',r->>'scopeId','eventId',r->>'eventId');
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_guard_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF OLD.status<>'PREVIEW' OR NEW.status<>'COMMITTED'
    OR (to_jsonb(NEW)-ARRAY['status','operation_id','actor_id','request_digest','committed_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','operation_id','actor_id','request_digest','committed_at'])
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jenios_robot_r65_guard_archive BEFORE UPDATE ON public.jenios_robot_archives_r65
  FOR EACH ROW EXECUTE FUNCTION public.jenios_robot_r65_guard_archive();

-- The worker gains only a disable capability, never approval or funding rights.
CREATE FUNCTION public.jenios_robot_r65_disable_only()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user='service_role' AND NEW.generation_enabled IS DISTINCT FROM false
    THEN RAISE EXCEPTION 'R65_DATABASE_POLICY_ENABLE_FORBIDDEN'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jenios_robot_r65_disable_only BEFORE UPDATE OF generation_enabled
  ON public.jenios_robot_config_r64 FOR EACH ROW EXECUTE FUNCTION public.jenios_robot_r65_disable_only();
GRANT UPDATE(generation_enabled) ON public.jenios_robot_config_r64 TO service_role;

-- Late R64 workers cannot rewrite a reconciled/archived historical cycle.
-- The response lock also serializes identity checks across R64 and R65 ledgers.
CREATE FUNCTION public.jenios_robot_r65_guard_cycle()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP<>'INSERT' AND (EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 WHERE cycle_id=OLD.cycle_id)
    OR EXISTS(SELECT 1 FROM public.jenios_robot_archive_items_r65
      WHERE scope_id=OLD.scope_id AND item_kind='CYCLE' AND item_id=OLD.cycle_id::text))
    AND (TG_OP='DELETE' OR to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD))
    THEN RAISE EXCEPTION 'R65_DATABASE_CYCLE_FROZEN'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.provider_response_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('r65-response:'||NEW.provider_response_id,0));
    IF EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65
      WHERE provider_response_id=NEW.provider_response_id AND cycle_id<>NEW.cycle_id)
      THEN RAISE EXCEPTION 'R65_DATABASE_PROVIDER_RESPONSE_CONFLICT'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jenios_robot_r65_guard_cycle BEFORE INSERT OR UPDATE OR DELETE
  ON public.jenios_robot_cycles_r64 FOR EACH ROW EXECUTE FUNCTION public.jenios_robot_r65_guard_cycle();

CREATE FUNCTION public.jenios_robot_r65_reconcile_cost(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET timezone='UTC' AS $$
DECLARE c public.jenios_robot_cycles_r64%ROWTYPE; previous public.jenios_robot_reconciliations_r65%ROWTYPE;
  r jsonb:=p_input->'resolution'; amount bigint; response_id text; request_hash text; budget_spent bigint;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(p_input->>'operationId','') !~ '^op:[a-f0-9]{32}$'
    OR coalesce(p_input->>'actorId','') !~ '^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR coalesce(p_input->>'expectedFingerprint','') !~ '^[a-f0-9]{64}$'
    OR coalesce(p_input->>'evidenceDigest','') !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(r))<>3
    OR coalesce(r->>'kind','') NOT IN('CONFIRMED_USAGE','CONFIRMED_NO_CHARGE')
    OR jsonb_typeof(r->'costNanoUsd') IS DISTINCT FROM 'number'
    OR coalesce(r->>'costNanoUsd','') !~ '^[0-9]{1,16}$'
    THEN RAISE EXCEPTION 'R65_DATABASE_RECONCILIATION'; END IF;
  amount:=(r->>'costNanoUsd')::bigint; response_id:=r->>'providerResponseId';
  IF amount>9007199254740991 OR (r->>'kind'='CONFIRMED_USAGE' AND coalesce(response_id,'') !~ '^resp_[A-Za-z0-9_-]{1,160}$')
    OR (r->>'kind'='CONFIRMED_NO_CHARGE' AND (amount<>0 OR r->'providerResponseId' IS DISTINCT FROM 'null'::jsonb))
    THEN RAISE EXCEPTION 'R65_DATABASE_RECONCILIATION'; END IF;
  request_hash:=public.jenios_robot_r65_digest(p_input);
  PERFORM pg_advisory_xact_lock(hashtextextended('r65-cost-operation:'||(p_input->>'scopeId')||':'||(p_input->>'operationId'),0));
  SELECT * INTO c FROM public.jenios_robot_cycles_r64
    WHERE scope_id=p_input->>'scopeId' AND cycle_id=(p_input->>'cycleId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R65_DATABASE_CYCLE_MISSING'; END IF;
  SELECT * INTO previous FROM public.jenios_robot_reconciliations_r65
    WHERE scope_id=c.scope_id AND operation_id=p_input->>'operationId';
  IF FOUND THEN
    IF previous.request_digest<>request_hash THEN RAISE EXCEPTION 'R65_DATABASE_OPERATION_CONFLICT'; END IF;
    UPDATE public.jenios_robot_config_r64 SET generation_enabled=false WHERE singleton=true;
    RETURN jsonb_build_object('status','RECONCILED','cycleId',c.cycle_id,'scopeId',c.scope_id,'replayed',true,
      'resolutionKind',previous.resolution_kind,'costNanoUsd',previous.cost_nano_usd,
      'overReservation',previous.over_reservation,'generationEnabled',false);
  END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 WHERE cycle_id=c.cycle_id)
    THEN RAISE EXCEPTION 'R65_DATABASE_ALREADY_RECONCILED'; END IF;
  IF c.request->>'fingerprint' IS DISTINCT FROM p_input->>'expectedFingerprint'
    THEN RAISE EXCEPTION 'R65_DATABASE_REQUEST_BINDING'; END IF;
  IF NOT(c.state='NEEDS_RECONCILIATION' OR (c.state='DISPATCHED' AND c.lease_until<=clock_timestamp()))
    OR c.reserved_nano_usd<=0 OR c.budget_month IS NULL OR c.settled_nano_usd IS NOT NULL
    THEN RAISE EXCEPTION 'R65_DATABASE_RECONCILIATION_STATE'; END IF;
  SELECT spent_nano_usd INTO budget_spent FROM public.jenios_robot_budgets_r64
    WHERE month=c.budget_month FOR UPDATE;
  IF NOT FOUND OR budget_spent>9007199254740991-amount THEN RAISE EXCEPTION 'R65_DATABASE_BUDGET_INVARIANT'; END IF;
  IF response_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('r65-response:'||response_id,0));
    IF (c.provider_response_id IS NOT NULL AND c.provider_response_id<>response_id)
      OR EXISTS(SELECT 1 FROM public.jenios_robot_cycles_r64 WHERE provider_response_id=response_id AND cycle_id<>c.cycle_id)
      OR EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 WHERE provider_response_id=response_id AND cycle_id<>c.cycle_id)
      THEN RAISE EXCEPTION 'R65_DATABASE_PROVIDER_RESPONSE_CONFLICT'; END IF;
  END IF;
  UPDATE public.jenios_robot_budgets_r64 SET reserved_nano_usd=reserved_nano_usd-c.reserved_nano_usd,
    spent_nano_usd=spent_nano_usd+amount,updated_at=clock_timestamp()
    WHERE month=c.budget_month AND reserved_nano_usd>=c.reserved_nano_usd;
  IF NOT FOUND THEN RAISE EXCEPTION 'R65_DATABASE_BUDGET_INVARIANT'; END IF;
  INSERT INTO public.jenios_robot_reconciliations_r65(scope_id,cycle_id,operation_id,actor_id,request_digest,
    request_fingerprint,resolution_kind,cost_nano_usd,provider_response_id,evidence_digest,
    original_reservation_nano_usd,budget_month,over_reservation)
    VALUES(c.scope_id,c.cycle_id,p_input->>'operationId',p_input->>'actorId',request_hash,
      p_input->>'expectedFingerprint',r->>'kind',amount,response_id,p_input->>'evidenceDigest',
      c.reserved_nano_usd,c.budget_month,amount>c.reserved_nano_usd);
  UPDATE public.jenios_robot_config_r64 SET generation_enabled=false WHERE singleton=true;
  RETURN jsonb_build_object('status','RECONCILED','cycleId',c.cycle_id,'scopeId',c.scope_id,'replayed',false,
    'resolutionKind',r->>'kind','costNanoUsd',amount,'overReservation',amount>c.reserved_nano_usd,'generationEnabled',false);
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_read_evolution(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.jenios_robot_evolution_r65%ROWTYPE;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$' THEN RAISE EXCEPTION 'R65_DATABASE_SCOPE'; END IF;
  SELECT * INTO e FROM public.jenios_robot_evolution_r65 WHERE scope_id=p_input->>'scopeId' ORDER BY revision DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
  IF e.state_digest<>public.jenios_robot_r65_digest(e.state) THEN RAISE EXCEPTION 'R65_DATABASE_STATE_INTEGRITY'; END IF;
  RETURN jsonb_build_object('scopeId',e.scope_id,'revision',e.revision,'stateDigest',e.state_digest,'state',e.state);
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_append_evolution(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous public.jenios_robot_evolution_r65%ROWTYPE; existing public.jenios_robot_evolution_r65%ROWTYPE;
  s jsonb:=p_input->'state'; expected integer; rev integer; request_hash text; state_hash text; field_name text;
  command jsonb; validation_rows jsonb; plan jsonb; now_ms bigint;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(p_input->>'operationId','') !~ '^op:[a-f0-9]{32}$'
    OR NOT(coalesce(p_input->>'actorId','')='system:r65' OR coalesce(p_input->>'actorId','') ~ '^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
    OR jsonb_typeof(p_input->'expectedRevision') IS DISTINCT FROM 'number'
    OR coalesce(p_input->>'expectedRevision','') !~ '^(-1|[0-9]{1,2})$'
    OR jsonb_typeof(s) IS DISTINCT FROM 'object' OR octet_length(s::text)>1048576
    OR s->>'schema' IS DISTINCT FROM 'JENIOS_R65_EVOLUTION_STATE_V1'
    OR s->>'scopeId' IS DISTINCT FROM p_input->>'scopeId'
    OR jsonb_typeof(s->'revision') IS DISTINCT FROM 'number' OR coalesce(s->>'revision','') !~ '^[0-9]{1,2}$'
    OR jsonb_typeof(s->'journal') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'history') IS DISTINCT FROM 'array'
    OR jsonb_typeof(s->'versions') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'activeVersion') IS DISTINCT FROM 'object'
    OR s->>'observationEvidenceKind' IS DISTINCT FROM 'SIGNED_QA_REPLAY'
    OR s->>'validationEvidenceKind' IS DISTINCT FROM 'SYNTHETIC_FIXTURE'
    OR s->>'applicationEnvironment' IS DISTINCT FROM 'QA_RESEARCH_ONLY'
    OR s->'alignmentGuardThreshold' IS DISTINCT FROM '0.65'::jsonb
    OR s->'manualOperatorControlPreserved' IS DISTINCT FROM 'true'::jsonb
    OR s->'losseshometroSyntheticOnly' IS DISTINCT FROM 'true'::jsonb
    OR s->'policy'->'minConsecutiveFresh' IS DISTINCT FROM '2'::jsonb
    OR s->'realOrdersSent' IS DISTINCT FROM '0'::jsonb OR s->'externalPaperOrdersSent' IS DISTINCT FROM '0'::jsonb
    OR s->'actualBrokerPnl' IS DISTINCT FROM 'null'::jsonb OR s->'actualLossesAvoided' IS DISTINCT FROM 'null'::jsonb
    OR s->'realTradeAccuracy' IS DISTINCT FROM 'null'::jsonb
    OR coalesce(s->'activeVersion'->>'maxAgeMs','') NOT IN('750','500')
    THEN RAISE EXCEPTION 'R65_DATABASE_EVOLUTION_STATE'; END IF;
  FOREACH field_name IN ARRAY ARRAY['operationalDataAccepted','liveExecutionAllowed','externalPaperExecutionAllowed',
    'productionConfigurationChanged','productionMonitoringStarted','deploymentPerformed','r15ProspectiveBackfill','commercialPerformanceCertified'] LOOP
    IF s->field_name IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'R65_DATABASE_EVOLUTION_STATE'; END IF;
  END LOOP;
  expected:=(p_input->>'expectedRevision')::integer; rev:=(s->>'revision')::integer;
  IF expected NOT BETWEEN -1 AND 31 OR rev<>expected+1 OR rev>32
    OR jsonb_array_length(s->'journal')<>rev OR jsonb_array_length(s->'history')<>rev
    OR jsonb_array_length(s->'versions') NOT BETWEEN 1 AND 2
    OR coalesce(s->>'createdAtMs','') !~ '^[0-9]{1,16}$' OR coalesce(s->>'updatedAtMs','') !~ '^[0-9]{1,16}$'
    OR (s->>'createdAtMs')::bigint>(s->>'updatedAtMs')::bigint
    OR (s->>'updatedAtMs')::bigint>floor(extract(epoch FROM clock_timestamp())*1000)::bigint
    OR coalesce(s->'activeVersion'->>'activationGeneration','') !~ '^[0-2]$'
    THEN RAISE EXCEPTION 'R65_DATABASE_EVOLUTION_STATE'; END IF;
  IF expected=-1 AND (p_input->'previousDigest' IS DISTINCT FROM 'null'::jsonb
      OR s->'activeVersion'->>'versionId'<>'research:r65-v1' OR s->'activeVersion'->>'maxAgeMs'<>'750'
      OR s->'activeVersion'->>'activationGeneration'<>'0')
    OR expected>=0 AND coalesce(p_input->>'previousDigest','') !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'R65_DATABASE_STATE_DIGEST'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('r65-evolution:'||(p_input->>'scopeId'),0));
  request_hash:=public.jenios_robot_r65_digest(p_input); state_hash:=public.jenios_robot_r65_digest(s);
  SELECT * INTO existing FROM public.jenios_robot_evolution_r65
    WHERE scope_id=p_input->>'scopeId' AND operation_id=p_input->>'operationId';
  IF FOUND THEN
    IF existing.request_digest<>request_hash THEN RAISE EXCEPTION 'R65_DATABASE_OPERATION_CONFLICT'; END IF;
    IF existing.state_digest<>public.jenios_robot_r65_digest(existing.state)
      THEN RAISE EXCEPTION 'R65_DATABASE_STATE_INTEGRITY'; END IF;
    RETURN jsonb_build_object('scopeId',existing.scope_id,'revision',existing.revision,'stateDigest',existing.state_digest,'state',existing.state,'replayed',true);
  END IF;
  SELECT * INTO previous FROM public.jenios_robot_evolution_r65 WHERE scope_id=p_input->>'scopeId' ORDER BY revision DESC LIMIT 1;
  IF (NOT FOUND AND expected<>-1) OR (FOUND AND previous.revision<>expected)
    THEN RAISE EXCEPTION 'R65_DATABASE_REVISION_CONFLICT'; END IF;
  IF expected>=0 THEN
    IF previous.state_digest<>p_input->>'previousDigest' OR previous.state_digest<>public.jenios_robot_r65_digest(previous.state)
      THEN RAISE EXCEPTION 'R65_DATABASE_STATE_DIGEST'; END IF;
    IF s->'createdAtMs' IS DISTINCT FROM previous.state->'createdAtMs'
      OR (s->>'updatedAtMs')::bigint<(previous.state->>'updatedAtMs')::bigint
      OR (s->'activeVersion'->>'activationGeneration')::integer<(previous.state->'activeVersion'->>'activationGeneration')::integer
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(previous.state->'journal') WITH ORDINALITY x(value,n)
        WHERE value IS DISTINCT FROM s->'journal'->(n::integer-1))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(previous.state->'history') WITH ORDINALITY x(value,n)
        WHERE value IS DISTINCT FROM s->'history'->(n::integer-1))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(previous.state->'versions') WITH ORDINALITY x(value,n)
        WHERE value IS DISTINCT FROM s->'versions'->(n::integer-1))
      THEN RAISE EXCEPTION 'R65_DATABASE_STATE_CONTINUITY'; END IF;
    command:=s->'journal'->(rev-1);
    now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
    IF command->>'action'='REGISTER' THEN
      IF (s->'pendingEvaluation'->'plan'->>'startsAtMs')::bigint<=now_ms
        THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_REGISTRATION_LATE'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.jenios_robot_cycles_r64 c
        WHERE c.scope_id=p_input->>'scopeId'
          AND c.cycle_id=(s->'pendingEvaluation'->'observation'->>'sourceCycleId')::uuid
          AND c.state='COMPLETED'
          AND c.input->'study'->>'inputDigest'=s->'pendingEvaluation'->'observation'->'study'->>'inputDigest'
          AND NOT EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 r WHERE r.cycle_id=c.cycle_id))
        THEN RAISE EXCEPTION 'R65_DATABASE_SOURCE_CYCLE_BINDING'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(command->'receipts') AS incoming(value) WHERE NOT EXISTS
        (SELECT 1 FROM public.jenios_robot_observation_provenance_r65 p
          JOIN public.jenios_robot_events_r64 e ON e.scope_id=p.scope_id AND e.event_id=p.event_id
          WHERE p.scope_id=p_input->>'scopeId' AND p.event_id=incoming.value->>'eventId'
            AND p.payload_digest=incoming.value->>'payloadDigest' AND e.receipt=incoming.value
            AND p.provenance->>'origin'='R61_SYNTHETIC_RUNTIME'
            AND p.provenance->>'runtimeEvidenceKind'='SYNTHETIC_FIXTURE'
            AND p.provenance->>'transportEvidenceKind'='SIGNED_QA_REPLAY'
            AND p.provenance->>'policyVersion'=previous.state->'activeVersion'->>'versionId'
            AND p.provenance->'activationGeneration'=previous.state->'activeVersion'->'activationGeneration'))
        THEN RAISE EXCEPTION 'R65_DATABASE_PROVENANCE_BINDING'; END IF;
    ELSIF command->>'action'='EVALUATE' THEN
      plan:=previous.state->'pendingEvaluation'->'plan';
      IF plan IS NULL OR now_ms<(plan->>'endsAtMs')::bigint
        THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_WINDOW_OPEN'; END IF;
      SELECT coalesce(jsonb_agg(validation_case ORDER BY case_id),'[]'::jsonb) INTO validation_rows
        FROM public.jenios_robot_validation_cases_r65 WHERE scope_id=p_input->>'scopeId' AND plan_id=plan->>'planId';
      IF command->'validationCases' IS DISTINCT FROM validation_rows
        THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_EVIDENCE_MISMATCH'; END IF;
    ELSIF command->>'action'<>'ROLLBACK' OR command->>'action' IS NULL THEN
      RAISE EXCEPTION 'R65_DATABASE_EVOLUTION_COMMAND';
    END IF;
  END IF;
  INSERT INTO public.jenios_robot_evolution_r65(scope_id,revision,operation_id,actor_id,request_digest,state_digest,state)
    VALUES(p_input->>'scopeId',rev,p_input->>'operationId',p_input->>'actorId',request_hash,state_hash,s);
  RETURN jsonb_build_object('scopeId',p_input->>'scopeId','revision',rev,'stateDigest',state_hash,'state',s,'replayed',false);
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_read_cycle_hypothesis(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.jenios_robot_cycles_r64%ROWTYPE;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$' THEN RAISE EXCEPTION 'R65_DATABASE_SCOPE'; END IF;
  SELECT * INTO c FROM public.jenios_robot_cycles_r64 WHERE scope_id=p_input->>'scopeId' AND cycle_id=(p_input->>'cycleId')::uuid;
  IF NOT FOUND OR c.state<>'COMPLETED' OR c.result->>'analysisStatus' IS DISTINCT FROM 'VALID'
    OR c.result->>'kind' IS DISTINCT FROM 'usage_confirmed'
    OR coalesce(c.result->>'analysisDigest','') !~ '^[a-f0-9]{64}$'
    OR c.result->'analysis'->>'schema' IS DISTINCT FROM 'JENIOS_R64_ANALYST_HYPOTHESES_V1'
    OR jsonb_typeof(c.result->'analysis'->'proposals') IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 WHERE cycle_id=c.cycle_id)
    THEN RETURN 'null'::jsonb; END IF;
  RETURN jsonb_build_object('cycleId',c.cycle_id,'analysisDigest',c.result->>'analysisDigest',
    'proposals',c.result->'analysis'->'proposals');
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_record_validation_case(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous public.jenios_robot_validation_cases_r65%ROWTYPE; s jsonb; plan jsonb; definition jsonb;
  now_ms bigint; value jsonb;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(p_input->>'planId','') !~ '^plan:[a-f0-9]{16}$' OR coalesce(p_input->>'caseId','') !~ '^case:[a-f0-9]{16}$'
    OR jsonb_typeof(p_input->'baselineAllow') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_input->'candidateAllow') IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_CASE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('r65-evolution:'||(p_input->>'scopeId'),0));
  SELECT * INTO previous FROM public.jenios_robot_validation_cases_r65 WHERE scope_id=p_input->>'scopeId'
    AND plan_id=p_input->>'planId' AND case_id=p_input->>'caseId';
  IF FOUND THEN
    IF previous.baseline_allow IS DISTINCT FROM (p_input->>'baselineAllow')::boolean
      OR previous.candidate_allow IS DISTINCT FROM (p_input->>'candidateAllow')::boolean
      THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_CONFLICT'; END IF;
    RETURN jsonb_build_object('status','ALREADY_STORED','case',previous.validation_case);
  END IF;
  SELECT state INTO s FROM public.jenios_robot_evolution_r65 WHERE scope_id=p_input->>'scopeId' ORDER BY revision DESC LIMIT 1;
  plan:=s->'pendingEvaluation'->'plan';
  IF plan->>'planId' IS DISTINCT FROM p_input->>'planId' OR plan->>'scopeId' IS DISTINCT FROM p_input->>'scopeId'
    OR plan->>'evidenceKind' IS DISTINCT FROM 'SYNTHETIC_FIXTURE'
    THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_PLAN'; END IF;
  now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF now_ms<(plan->>'startsAtMs')::bigint OR now_ms>=(plan->>'endsAtMs')::bigint
    THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_WINDOW_CLOSED'; END IF;
  SELECT x INTO definition FROM jsonb_array_elements(plan->'caseDefinitions') x WHERE x->>'caseId'=p_input->>'caseId';
  IF NOT FOUND THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_CASE'; END IF;
  value:=jsonb_build_object('caseId',p_input->>'caseId','scopeId',p_input->>'scopeId','evidenceKind','SYNTHETIC_FIXTURE',
    'occurredAtMs',now_ms,'snapshotAgesMs',definition->'snapshotAgesMs','expectedAllow',definition->'expectedAllow');
  INSERT INTO public.jenios_robot_validation_cases_r65(scope_id,plan_id,case_id,baseline_allow,candidate_allow,validation_case)
    VALUES(p_input->>'scopeId',p_input->>'planId',p_input->>'caseId',(p_input->>'baselineAllow')::boolean,
      (p_input->>'candidateAllow')::boolean,value);
  RETURN jsonb_build_object('status','STORED','case',value);
END;
$$;
CREATE FUNCTION public.jenios_robot_r65_read_validation_cases(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$' OR coalesce(p_input->>'planId','') !~ '^plan:[a-f0-9]{16}$'
    THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_PLAN'; END IF;
  SELECT coalesce(jsonb_agg(validation_case ORDER BY case_id),'[]'::jsonb) INTO result
    FROM public.jenios_robot_validation_cases_r65 WHERE scope_id=p_input->>'scopeId' AND plan_id=p_input->>'planId';
  IF jsonb_array_length(result)>200 THEN RAISE EXCEPTION 'R65_DATABASE_VALIDATION_LIMIT'; END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_archive_preview(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET timezone='UTC' AS $$
DECLARE cutoff bigint; maximum integer; copies jsonb; events jsonb; manifest_value jsonb;
  a public.jenios_robot_archives_r65%ROWTYPE;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR jsonb_typeof(p_input->'cutoffMs') IS DISTINCT FROM 'number' OR coalesce(p_input->>'cutoffMs','') !~ '^[0-9]{1,16}$'
    OR jsonb_typeof(p_input->'limit') IS DISTINCT FROM 'number' OR coalesce(p_input->>'limit','') !~ '^[0-9]{1,2}$'
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_REQUEST'; END IF;
  cutoff:=(p_input->>'cutoffMs')::bigint; maximum:=(p_input->>'limit')::integer;
  IF cutoff>floor(extract(epoch FROM clock_timestamp())*1000)::bigint OR maximum NOT BETWEEN 1 AND 10
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_REQUEST'; END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_robot_cycles_r64 c WHERE c.scope_id=p_input->>'scopeId'
    AND c.created_at<=to_timestamp(cutoff/1000.0) AND c.state<>'COMPLETED'
    AND NOT EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 r WHERE r.cycle_id=c.cycle_id))
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_PENDING'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('cycleId',c.cycle_id,'snapshot',to_jsonb(c),'reconciliation',
    (SELECT to_jsonb(r) FROM public.jenios_robot_reconciliations_r65 r WHERE r.cycle_id=c.cycle_id)) ORDER BY c.cycle_id),'[]'::jsonb)
    INTO copies FROM (SELECT c.* FROM public.jenios_robot_cycles_r64 c WHERE c.scope_id=p_input->>'scopeId'
      AND c.created_at<=to_timestamp(cutoff/1000.0) AND NOT EXISTS(SELECT 1 FROM public.jenios_robot_archive_items_r65 i
        WHERE i.scope_id=c.scope_id AND i.item_kind='CYCLE' AND i.item_id=c.cycle_id::text)
      ORDER BY c.cycle_id LIMIT maximum) c;
  SELECT coalesce(jsonb_agg(jsonb_build_object('eventId',e.event_id,'snapshot',to_jsonb(e),'provenance',
    (SELECT p.provenance FROM public.jenios_robot_observation_provenance_r65 p
      WHERE p.scope_id=e.scope_id AND p.event_id=e.event_id)) ORDER BY e.event_id),'[]'::jsonb)
    INTO events FROM (SELECT e.* FROM public.jenios_robot_events_r64 e WHERE e.scope_id=p_input->>'scopeId'
      AND e.admitted_at_ms<=cutoff AND NOT EXISTS(SELECT 1 FROM public.jenios_robot_archive_items_r65 i
        WHERE i.scope_id=e.scope_id AND i.item_kind='EVENT' AND i.item_id=e.event_id)
      ORDER BY e.event_id LIMIT maximum) e;
  manifest_value:=jsonb_build_object('schema','JENIOS_R65_LOGICAL_ARCHIVE_V1','scopeId',p_input->>'scopeId',
    'archiveMode','LOGICAL_COPY_ONLY','physicalDeletionPerformed',false,'spaceReclaimedBytes',0,
    'cutoffMs',cutoff,'cycles',copies,'events',events);
  IF jsonb_array_length(copies)+jsonb_array_length(events)=0 THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_EMPTY'; END IF;
  INSERT INTO public.jenios_robot_archives_r65(scope_id,cutoff_ms,batch_limit,manifest,manifest_digest)
    VALUES(p_input->>'scopeId',cutoff,maximum,manifest_value,public.jenios_robot_r65_digest(manifest_value)) RETURNING * INTO a;
  RETURN jsonb_build_object('scopeId',a.scope_id,'archiveId',a.archive_id,'status',a.status,'manifestDigest',a.manifest_digest,
    'eventCount',jsonb_array_length(events),'cycleCount',jsonb_array_length(copies),'archiveMode','LOGICAL_COPY_ONLY',
    'physicalDeletionPerformed',false,'spaceReclaimedBytes',0,'expiresAtMs',floor(extract(epoch FROM a.expires_at)*1000)::bigint);
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_archive_commit(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET timezone='UTC' AS $$
DECLARE a public.jenios_robot_archives_r65%ROWTYPE; item jsonb; current_value jsonb; request_hash text;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$' OR coalesce(p_input->>'operationId','') !~ '^op:[a-f0-9]{32}$'
    OR coalesce(p_input->>'manifestDigest','') !~ '^[a-f0-9]{64}$'
    OR NOT(coalesce(p_input->>'actorId','')='system:r65' OR coalesce(p_input->>'actorId','') ~ '^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_REQUEST'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('r65-archive:'||(p_input->>'scopeId'),0));
  SELECT * INTO a FROM public.jenios_robot_archives_r65
    WHERE scope_id=p_input->>'scopeId' AND archive_id=(p_input->>'archiveId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_MISSING'; END IF;
  request_hash:=public.jenios_robot_r65_digest(p_input);
  IF a.manifest_digest<>p_input->>'manifestDigest' OR a.manifest_digest<>public.jenios_robot_r65_digest(a.manifest)
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_INTEGRITY'; END IF;
  IF a.status='COMMITTED' THEN
    IF a.request_digest<>request_hash THEN RAISE EXCEPTION 'R65_DATABASE_OPERATION_CONFLICT'; END IF;
    RETURN jsonb_build_object('scopeId',a.scope_id,'archiveId',a.archive_id,'status','COMMITTED','manifestDigest',a.manifest_digest,
      'replayed',true,'archiveMode','LOGICAL_COPY_ONLY','physicalDeletionPerformed',false,'spaceReclaimedBytes',0);
  END IF;
  IF a.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_EXPIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_robot_archives_r65 WHERE scope_id=a.scope_id AND operation_id=p_input->>'operationId')
    THEN RAISE EXCEPTION 'R65_DATABASE_OPERATION_CONFLICT'; END IF;
  -- Lock selected cycle rows in a fixed order before revalidating snapshots.
  PERFORM cycle_id FROM public.jenios_robot_cycles_r64 WHERE scope_id=a.scope_id AND cycle_id IN
    (SELECT (x->>'cycleId')::uuid FROM jsonb_array_elements(a.manifest->'cycles') x) ORDER BY cycle_id FOR UPDATE;
  IF a.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_EXPIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_robot_cycles_r64 c WHERE c.scope_id=a.scope_id
    AND c.created_at<=to_timestamp(a.cutoff_ms/1000.0) AND c.state<>'COMPLETED'
    AND NOT EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 r WHERE r.cycle_id=c.cycle_id))
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_PENDING'; END IF;
  FOR item IN SELECT x FROM jsonb_array_elements(a.manifest->'cycles') x LOOP
    SELECT jsonb_build_object('cycleId',c.cycle_id,'snapshot',to_jsonb(c),'reconciliation',
      (SELECT to_jsonb(r) FROM public.jenios_robot_reconciliations_r65 r WHERE r.cycle_id=c.cycle_id))
      INTO current_value FROM public.jenios_robot_cycles_r64 c WHERE c.scope_id=a.scope_id AND c.cycle_id=(item->>'cycleId')::uuid;
    IF current_value IS DISTINCT FROM item THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_STALE'; END IF;
    IF EXISTS(SELECT 1 FROM public.jenios_robot_archive_items_r65 WHERE scope_id=a.scope_id AND item_kind='CYCLE' AND item_id=item->>'cycleId')
      THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_ALREADY_COPIED'; END IF;
    INSERT INTO public.jenios_robot_archive_items_r65 VALUES(a.scope_id,'CYCLE',item->>'cycleId',a.archive_id);
  END LOOP;
  FOR item IN SELECT x FROM jsonb_array_elements(a.manifest->'events') x LOOP
    SELECT jsonb_build_object('eventId',e.event_id,'snapshot',to_jsonb(e),'provenance',
      (SELECT p.provenance FROM public.jenios_robot_observation_provenance_r65 p
        WHERE p.scope_id=e.scope_id AND p.event_id=e.event_id)) INTO current_value
      FROM public.jenios_robot_events_r64 e WHERE e.scope_id=a.scope_id AND e.event_id=item->>'eventId';
    IF current_value IS DISTINCT FROM item THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_STALE'; END IF;
    IF EXISTS(SELECT 1 FROM public.jenios_robot_archive_items_r65 WHERE scope_id=a.scope_id AND item_kind='EVENT' AND item_id=item->>'eventId')
      THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_ALREADY_COPIED'; END IF;
    INSERT INTO public.jenios_robot_archive_items_r65 VALUES(a.scope_id,'EVENT',item->>'eventId',a.archive_id);
  END LOOP;
  UPDATE public.jenios_robot_archives_r65 SET status='COMMITTED',operation_id=p_input->>'operationId',actor_id=p_input->>'actorId',
    request_digest=request_hash,committed_at=clock_timestamp() WHERE archive_id=a.archive_id;
  RETURN jsonb_build_object('scopeId',a.scope_id,'archiveId',a.archive_id,'status','COMMITTED','manifestDigest',a.manifest_digest,
    'replayed',false,'archiveMode','LOGICAL_COPY_ONLY','physicalDeletionPerformed',false,'spaceReclaimedBytes',0);
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_read_archive(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET timezone='UTC' AS $$
DECLARE a public.jenios_robot_archives_r65%ROWTYPE;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$' THEN RAISE EXCEPTION 'R65_DATABASE_SCOPE'; END IF;
  SELECT * INTO a FROM public.jenios_robot_archives_r65
    WHERE scope_id=p_input->>'scopeId' AND archive_id=(p_input->>'archiveId')::uuid AND status='COMMITTED';
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
  IF a.manifest_digest<>public.jenios_robot_r65_digest(a.manifest)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(a.manifest->'cycles') x WHERE NOT EXISTS
      (SELECT 1 FROM public.jenios_robot_archive_items_r65 i WHERE i.scope_id=a.scope_id AND i.item_kind='CYCLE'
        AND i.item_id=x->>'cycleId' AND i.archive_id=a.archive_id))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(a.manifest->'events') x WHERE NOT EXISTS
      (SELECT 1 FROM public.jenios_robot_archive_items_r65 i WHERE i.scope_id=a.scope_id AND i.item_kind='EVENT'
        AND i.item_id=x->>'eventId' AND i.archive_id=a.archive_id))
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_INTEGRITY'; END IF;
  RETURN jsonb_build_object('scopeId',a.scope_id,'archiveId',a.archive_id,'status','COMMITTED','manifestDigest',a.manifest_digest,
    'digestAlgorithm','SHA256_POSTGRESQL_JSONB_TEXT_UTF8_V1','verified',true,'manifest',a.manifest);
END;
$$;

CREATE FUNCTION public.jenios_robot_r65_read_overview(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE maximum integer; archives jsonb; resolved jsonb; pending jsonb; evolution jsonb;
BEGIN
  IF coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR jsonb_typeof(p_input->'limit') IS DISTINCT FROM 'number' OR coalesce(p_input->>'limit','') !~ '^[0-9]{1,2}$'
    THEN RAISE EXCEPTION 'R65_DATABASE_OVERVIEW_LIMIT'; END IF;
  maximum:=(p_input->>'limit')::integer;
  IF maximum NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'R65_DATABASE_OVERVIEW_LIMIT'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('archiveId',x.archive_id,'status',x.status,'manifestDigest',x.manifest_digest,
    'eventCount',jsonb_array_length(x.manifest->'events'),'cycleCount',jsonb_array_length(x.manifest->'cycles'),
    'createdAtMs',floor(extract(epoch FROM x.created_at)*1000)::bigint) ORDER BY x.created_at DESC,x.archive_id),'[]'::jsonb)
    INTO archives FROM (SELECT * FROM public.jenios_robot_archives_r65 WHERE scope_id=p_input->>'scopeId'
      ORDER BY created_at DESC,archive_id LIMIT maximum) x;
  SELECT coalesce(jsonb_agg(jsonb_build_object('cycleId',x.cycle_id,'resolutionKind',x.resolution_kind,
    'costNanoUsd',x.cost_nano_usd,'resolvedAtMs',floor(extract(epoch FROM x.resolved_at)*1000)::bigint,
    'overReservation',x.over_reservation) ORDER BY x.resolved_at DESC,x.cycle_id),'[]'::jsonb)
    INTO resolved FROM (SELECT * FROM public.jenios_robot_reconciliations_r65 WHERE scope_id=p_input->>'scopeId'
      ORDER BY resolved_at DESC,cycle_id LIMIT maximum) x;
  SELECT coalesce(jsonb_agg(jsonb_build_object('cycleId',x.cycle_id,'requestFingerprint',x.request->>'fingerprint',
    'reservationNanoUsd',x.reserved_nano_usd) ORDER BY x.created_at DESC,x.cycle_id),'[]'::jsonb)
    INTO pending FROM (SELECT c.* FROM public.jenios_robot_cycles_r64 c WHERE c.scope_id=p_input->>'scopeId'
      AND (c.state='NEEDS_RECONCILIATION' OR c.state='DISPATCHED' AND c.lease_until<=clock_timestamp())
      AND NOT EXISTS(SELECT 1 FROM public.jenios_robot_reconciliations_r65 r WHERE r.cycle_id=c.cycle_id)
      ORDER BY c.created_at DESC,c.cycle_id LIMIT maximum) x;
  SELECT jsonb_build_object('revision',revision,'stateDigest',state_digest,'activeVersion',state->'activeVersion')
    INTO evolution FROM public.jenios_robot_evolution_r65 WHERE scope_id=p_input->>'scopeId' ORDER BY revision DESC LIMIT 1;
  RETURN jsonb_build_object('scopeId',p_input->>'scopeId','archiveMode','LOGICAL_COPY_ONLY','physicalDeletionPerformed',false,
    'spaceReclaimedBytes',0,'archives',archives,'reconciliations',resolved,'pendingReconciliations',pending,'evolution',evolution);
END;
$$;

REVOKE ALL ON FUNCTION public.jenios_robot_r65_digest(jsonb),public.jenios_robot_r65_disable_only(),
  public.jenios_robot_r65_ingest_observation(jsonb),
  public.jenios_robot_r65_guard_cycle(),public.jenios_robot_r65_guard_archive(),public.jenios_robot_r65_reconcile_cost(jsonb),
  public.jenios_robot_r65_read_evolution(jsonb),public.jenios_robot_r65_append_evolution(jsonb),
  public.jenios_robot_r65_record_validation_case(jsonb),public.jenios_robot_r65_read_validation_cases(jsonb),
  public.jenios_robot_r65_archive_preview(jsonb),public.jenios_robot_r65_archive_commit(jsonb),
  public.jenios_robot_r65_read_archive(jsonb),public.jenios_robot_r65_read_overview(jsonb),
  public.jenios_robot_r65_read_cycle_hypothesis(jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_robot_r65_digest(jsonb),public.jenios_robot_r65_disable_only(),
  public.jenios_robot_r65_ingest_observation(jsonb),
  public.jenios_robot_r65_guard_cycle(),public.jenios_robot_r65_guard_archive(),public.jenios_robot_r65_reconcile_cost(jsonb),
  public.jenios_robot_r65_read_evolution(jsonb),public.jenios_robot_r65_append_evolution(jsonb),
  public.jenios_robot_r65_record_validation_case(jsonb),public.jenios_robot_r65_read_validation_cases(jsonb),
  public.jenios_robot_r65_archive_preview(jsonb),public.jenios_robot_r65_archive_commit(jsonb),
  public.jenios_robot_r65_read_archive(jsonb),public.jenios_robot_r65_read_overview(jsonb),
  public.jenios_robot_r65_read_cycle_hypothesis(jsonb) TO service_role;
COMMENT ON TABLE public.jenios_robot_archives_r65 IS 'Logical copy only. Original events/cycles remain. No DELETE, purge, space reclamation or independent backup attestation.';
COMMENT ON TABLE public.jenios_robot_reconciliations_r65 IS 'Server-authorized administrative resolution, not provider attestation. Original R64 report/result unchanged; generation disabled, never re-enabled.';
COMMENT ON TABLE public.jenios_robot_evolution_r65 IS 'Append-only QA research evolution snapshots. Adapter replays the bounded engine; no production configuration or broker execution.';
COMMENT ON TABLE public.jenios_robot_validation_cases_r65 IS 'Preregistered synthetic cases captured during the DB-clock validation window; no retrospective completion of missing cases.';

$r72_r65_source$;

  -- Certified source: db/schema/robot-r67-private-capture-store.sql; SHA256 5172c89d6f94cbfa50ae789fd2df09e9843c63a81d663a798971833ae7dec58b
  EXECUTE $r72_r67_source$
-- R67 REVIEW ONLY: isolated original-private-core SYNTHETIC batches.
-- Validate only in an explicitly selected disposable local PostgreSQL database.
-- No insert/read dependency on R64 observations, R65 evolution, provider budgets,
-- customer data or order tables. Never apply to hosted databases in this block.
-- Signature authentication and JavaScript canonical digests belong to the
-- application verifier. SQL checks shape/bindings and real database-clock TTL;
-- jsonb::text is NOT substituted for any JavaScript signature/digest format.

CREATE TABLE public.jenios_robot_private_captures_r67 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  source_id text NOT NULL CHECK(source_id ~ '^source:[a-f0-9]{16}$'),
  session_id text NOT NULL CHECK(session_id ~ '^session:[a-f0-9]{16}$'),
  event_id text NOT NULL CHECK(event_id ~ '^evt:[a-f0-9]{16}$'),
  operation_id text NOT NULL CHECK(operation_id ~ '^op:[a-f0-9]{32}$'),
  sequence bigint NOT NULL CHECK(sequence BETWEEN 1 AND 1000000000),
  captured_at_ms bigint NOT NULL CHECK(captured_at_ms BETWEEN 1 AND 9007199254740991),
  expires_at_ms bigint NOT NULL CHECK(expires_at_ms - captured_at_ms = 120000),
  admitted_at_ms bigint NOT NULL CHECK(admitted_at_ms >= captured_at_ms AND admitted_at_ms < expires_at_ms),
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  provenance_digest text NOT NULL CHECK(provenance_digest ~ '^[a-f0-9]{64}$'),
  record_digest text NOT NULL CHECK(record_digest ~ '^[a-f0-9]{64}$'),
  receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt) = 'object' AND octet_length(receipt::text) <= 8192
    AND receipt->>'schema' = 'JENIOS_R67_PRIVATE_QA_RECEIPT_V1'
    AND receipt->>'scopeId' = scope_id AND receipt->>'sourceId' = source_id
    AND receipt->>'eventId' = event_id),
  signed_record jsonb NOT NULL CHECK(jsonb_typeof(signed_record) = 'object' AND octet_length(signed_record::text) <= 262144
    AND signed_record->>'schema' = 'JENIOS_R67_PRIVATE_QA_OBSERVATION_V1'),
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_id,event_id),
  UNIQUE(scope_id,source_id,session_id,sequence),
  UNIQUE(scope_id,source_id,operation_id)
);
CREATE INDEX jenios_robot_private_captures_r67_recent
  ON public.jenios_robot_private_captures_r67(scope_id,source_id,admitted_at_ms DESC,event_id);

ALTER TABLE public.jenios_robot_private_captures_r67 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_robot_private_captures_r67 FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.jenios_robot_private_captures_r67 TO service_role;

CREATE FUNCTION public.jenios_robot_r67_ingest_private_capture(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  r jsonb := p_input->'receipt'; b jsonb := p_input->'record';
  p jsonb := b->'envelope'->'payload'; v jsonb := b->'provenance'; c jsonb := p->'capture';
  previous public.jenios_robot_private_captures_r67%ROWTYPE;
  latest public.jenios_robot_private_captures_r67%ROWTYPE;
  field_name text; n bigint; captured bigint; expires bigint; admitted bigint; db_now bigint;
  count_value integer; e jsonb; scenario jsonb; entry_index integer := 0;
  manual_count integer := 0; hybrid_count integer := 0; reverse_count integer := 0;
  scenario_ids text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR octet_length(r::text)>8192
    OR jsonb_typeof(b) IS DISTINCT FROM 'object' OR octet_length(b::text)>262144
    OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(v) IS DISTINCT FROM 'object'
    OR jsonb_typeof(c) IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'R67_DATABASE_SHAPE'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_input))<>4
    OR NOT p_input ?& ARRAY['scopeId','sourceId','receipt','record']
    OR (SELECT count(*) FROM jsonb_object_keys(r))<>22
    OR NOT r ?& ARRAY['schema','evidenceKind','runtimeOrigin','scopeId','sourceId','sessionId','eventId',
      'sequence','capturedAtMs','expiresAtMs','admittedAtMs','payloadDigest','provenanceDigest','recordDigest',
      'captureCount','counts','engineSha256','serviceSha256','originalVersion','policyVersion','generation','sourceKeySha256']
    OR (SELECT count(*) FROM jsonb_object_keys(b))<>4
    OR NOT b ?& ARRAY['schema','envelope','provenance','provenanceSignatureBase64']
    OR jsonb_typeof(b->'envelope') IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(b->'envelope'))<>2
    OR NOT (b->'envelope') ?& ARRAY['payload','signatureBase64']
    OR (SELECT count(*) FROM jsonb_object_keys(p))<>11
    OR NOT p ?& ARRAY['schema','evidenceKind','scopeId','sourceId','sessionId','eventId','sequence','capturedAtMs','expiresAtMs','scenarios','capture']
    OR (SELECT count(*) FROM jsonb_object_keys(v))<>32
    OR NOT v ?& ARRAY['schema','origin','runtimeEvidenceKind','transportEvidenceKind','eventId','operationId',
      'payloadDigest','inputDigest','captureDigest','engineSha256','serviceSha256','originalVersion','policyVersion',
      'generation','runtimeHook','clockSource','loaderEvidence','localExecutableBytesVerified','automaticPromotionAllowed',
      'executionAllowed','customerMonitoringActive','privateOperationalSourceActive','realOrdersSent','externalPaperOrdersSent',
      'paidProviderCalls','actualBrokerPnl','actualLossesAvoided','realTradeAccuracy','commercialPerformanceCertified',
      'independentRuntimeAttestation','independentBrokerAttestation','independentCustomerConsentVerified']
    THEN RAISE EXCEPTION 'R67_DATABASE_SHAPE'; END IF;
  IF r->>'schema' IS DISTINCT FROM 'JENIOS_R67_PRIVATE_QA_RECEIPT_V1'
    OR r->>'evidenceKind' IS DISTINCT FROM 'SIGNED_PRIVATE_QA_CAPTURE'
    OR r->>'runtimeOrigin' IS DISTINCT FROM 'ORIGINAL_PRIVATE_CORE_SYNTHETIC_RUNTIME'
    OR b->>'schema' IS DISTINCT FROM 'JENIOS_R67_PRIVATE_QA_OBSERVATION_V1'
    OR p->>'schema' IS DISTINCT FROM 'JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1'
    OR p->>'evidenceKind' IS DISTINCT FROM r->>'evidenceKind'
    OR v->>'schema' IS DISTINCT FROM 'JENIOS_R67_PRIVATE_RUNTIME_PROVENANCE_V1'
    OR v->>'origin' IS DISTINCT FROM r->>'runtimeOrigin'
    OR v->>'runtimeEvidenceKind' IS DISTINCT FROM 'SYNTHETIC_PRIVATE_LAB_ONLY'
    OR v->>'transportEvidenceKind' IS DISTINCT FROM r->>'evidenceKind'
    OR v->>'runtimeHook' IS DISTINCT FROM 'B297_CAPTURE_VERIFIED_ANALYZE_REQUEST'
    OR v->>'clockSource' IS DISTINCT FROM 'WALL_CLOCK_QA_EXECUTION'
    OR v->>'loaderEvidence' IS DISTINCT FROM 'VM_SOURCE_TEXT_MODULE_PINNED_BYTES'
    OR v->'localExecutableBytesVerified' IS DISTINCT FROM 'true'::jsonb
    THEN RAISE EXCEPTION 'R67_DATABASE_DOMAIN'; END IF;
  IF coalesce(r->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(r->>'sourceId','') !~ '^source:[a-f0-9]{16}$'
    OR coalesce(r->>'sessionId','') !~ '^session:[a-f0-9]{16}$'
    OR coalesce(r->>'eventId','') !~ '^evt:[a-f0-9]{16}$'
    OR p_input->>'scopeId' IS DISTINCT FROM r->>'scopeId'
    OR p_input->>'sourceId' IS DISTINCT FROM r->>'sourceId'
    OR coalesce(v->>'operationId','') !~ '^op:[a-f0-9]{32}$'
    OR v->>'eventId' IS DISTINCT FROM r->>'eventId'
    OR v->'payloadDigest' IS DISTINCT FROM r->'payloadDigest'
    THEN RAISE EXCEPTION 'R67_DATABASE_SCOPE'; END IF;
  FOREACH field_name IN ARRAY ARRAY['scopeId','sourceId','sessionId','eventId','sequence','capturedAtMs','expiresAtMs'] LOOP
    IF p->field_name IS DISTINCT FROM r->field_name THEN RAISE EXCEPTION 'R67_DATABASE_RECORD_BINDING'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['payloadDigest','provenanceDigest','recordDigest','sourceKeySha256'] LOOP
    IF jsonb_typeof(r->field_name) IS DISTINCT FROM 'string' OR coalesce(r->>field_name,'') !~ '^[a-f0-9]{64}$'
      THEN RAISE EXCEPTION 'R67_DATABASE_DIGEST'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['inputDigest','captureDigest'] LOOP
    IF jsonb_typeof(v->field_name) IS DISTINCT FROM 'string' OR coalesce(v->>field_name,'') !~ '^[a-f0-9]{64}$'
      THEN RAISE EXCEPTION 'R67_DATABASE_DIGEST'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['engineSha256','serviceSha256','originalVersion','policyVersion','generation'] LOOP
    IF v->field_name IS DISTINCT FROM r->field_name THEN RAISE EXCEPTION 'R67_DATABASE_EXECUTABLE_BINDING'; END IF;
  END LOOP;
  IF r->>'engineSha256' IS DISTINCT FROM '9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea'
    OR r->>'serviceSha256' IS DISTINCT FROM 'cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be'
    OR r->>'originalVersion' IS DISTINCT FROM 'jenios-research-r29.1'
    OR r->>'policyVersion' IS DISTINCT FROM 'private:r67-v1' OR r->'generation' IS DISTINCT FROM '0'::jsonb
    THEN RAISE EXCEPTION 'R67_DATABASE_EXECUTABLE_BINDING'; END IF;
  FOREACH field_name IN ARRAY ARRAY['automaticPromotionAllowed','executionAllowed','customerMonitoringActive',
    'privateOperationalSourceActive','commercialPerformanceCertified','independentRuntimeAttestation',
    'independentBrokerAttestation','independentCustomerConsentVerified'] LOOP
    IF v->field_name IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'R67_DATABASE_INVARIANT'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['realOrdersSent','externalPaperOrdersSent','paidProviderCalls'] LOOP
    IF v->field_name IS DISTINCT FROM '0'::jsonb THEN RAISE EXCEPTION 'R67_DATABASE_INVARIANT'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['actualBrokerPnl','actualLossesAvoided','realTradeAccuracy'] LOOP
    IF v->field_name IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'R67_DATABASE_INVARIANT'; END IF;
  END LOOP;
  IF coalesce(b->'envelope'->>'signatureBase64','') !~ '^([A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$'
    OR coalesce(b->>'provenanceSignatureBase64','') !~ '^([A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$'
    THEN RAISE EXCEPTION 'R67_DATABASE_SIGNATURE_FORMAT'; END IF;
  FOREACH field_name IN ARRAY ARRAY['sequence','capturedAtMs','expiresAtMs','admittedAtMs','captureCount'] LOOP
    IF jsonb_typeof(r->field_name) IS DISTINCT FROM 'number' OR coalesce(r->>field_name,'') !~ '^[0-9]{1,16}$'
      OR (r->>field_name)::numeric > 9007199254740991
      THEN RAISE EXCEPTION 'R67_DATABASE_TIME'; END IF;
  END LOOP;
  n:=(r->>'sequence')::bigint; captured:=(r->>'capturedAtMs')::bigint;
  expires:=(r->>'expiresAtMs')::bigint; admitted:=(r->>'admittedAtMs')::bigint;
  IF (r->>'captureCount')::numeric<3 OR (r->>'captureCount')::numeric>60
    THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;
  count_value:=(r->>'captureCount')::integer;
  IF n<1 OR n>1000000000 OR captured<1 OR expires-captured<>120000 OR admitted<captured OR admitted>=expires
    OR count_value<3 OR count_value>60 THEN RAISE EXCEPTION 'R67_DATABASE_TIME'; END IF;
  IF c->>'schema' IS DISTINCT FROM 'JENIOS_B297_PRIVATE_READONLY_CAPTURE_V1'
    OR c->>'source' IS DISTINCT FROM 'SYNTHETIC_PRIVATE_LAB_ONLY'
    OR c->>'engineSha256Expected' IS DISTINCT FROM r->>'engineSha256'
    OR c->'readOnly' IS DISTINCT FROM 'true'::jsonb
    OR c->'ordersSent' IS DISTINCT FROM '0'::jsonb OR c->'paperOrdersSent' IS DISTINCT FROM '0'::jsonb
    OR c->'lossesActuallyAvoided' IS DISTINCT FROM 'null'::jsonb
    OR jsonb_typeof(c->'finalEntrySha256') IS DISTINCT FROM 'string'
    OR coalesce(c->>'finalEntrySha256','') !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(c->'entries') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'scenarios') IS DISTINCT FROM 'array'
    OR jsonb_typeof(r->'counts') IS DISTINCT FROM 'object' OR c->'counts' IS DISTINCT FROM r->'counts'
    THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;
  FOREACH field_name IN ARRAY ARRAY['executableBytesVerifiedByAdapter','originalCallbackIdentityAttested',
    'remoteDeliveryAcknowledged','authorizedBrokerFeedObserved','executionEnabled','profitCertified'] LOOP
    IF c->field_name IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_object_keys(c))<>16
    OR (SELECT count(*) FROM jsonb_object_keys(r->'counts'))<>3
    OR NOT (r->'counts') ?& ARRAY['manual','hybrid','reverse']
    OR jsonb_array_length(c->'entries')<>count_value OR jsonb_array_length(p->'scenarios')<>count_value
    THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;
  FOREACH field_name IN ARRAY ARRAY['manual','hybrid','reverse'] LOOP
    IF jsonb_typeof(r->'counts'->field_name) IS DISTINCT FROM 'number'
      OR coalesce(r->'counts'->>field_name,'') !~ '^[1-9][0-9]?$'
      THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(c->'entries') LOOP
    scenario:=p->'scenarios'->entry_index; entry_index:=entry_index+1;
    IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR jsonb_typeof(scenario) IS DISTINCT FROM 'object'
      THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(scenario))<>(CASE WHEN scenario ? 'paused' THEN 5 ELSE 4 END)
      OR NOT scenario ?& ARRAY['id','mode','intent','horizon']
      OR jsonb_typeof(scenario->'id') IS DISTINCT FROM 'string'
      OR coalesce(scenario->>'id','') !~ '^[A-Za-z0-9._-]{1,80}$'
      OR scenario->>'id'=ANY(scenario_ids)
      OR coalesce(scenario->>'mode','') NOT IN('manual','hybrid','reverse')
      OR coalesce(scenario->>'intent','') NOT IN('buy','sell')
      OR coalesce(scenario->>'horizon','') NOT IN('day','swing')
      OR (scenario ? 'paused' AND jsonb_typeof(scenario->'paused') IS DISTINCT FROM 'boolean')
      THEN RAISE EXCEPTION 'R67_DATABASE_SCENARIO'; END IF;
    scenario_ids:=array_append(scenario_ids,scenario->>'id');
    IF (SELECT count(*) FROM jsonb_object_keys(e))<>14
      OR e->'id' IS DISTINCT FROM scenario->'id' OR e->'commercialMode' IS DISTINCT FROM scenario->'mode'
      OR e->'operatorIntent' IS DISTINCT FROM scenario->'intent' OR e->'horizon' IS DISTINCT FROM scenario->'horizon'
      OR e->>'originalVersion' IS DISTINCT FROM r->>'originalVersion'
      OR e->'observedAtMs' IS DISTINCT FROM r->'capturedAtMs'
      OR e->>'delivery' IS DISTINCT FROM 'LOCAL_CAPTURE_NO_PROVIDER_ACK'
      OR e->>'source' IS DISTINCT FROM 'SYNTHETIC_PRIVATE_LAB_ONLY'
      OR jsonb_typeof(e->'rawOutputSha256') IS DISTINCT FROM 'string'
      OR jsonb_typeof(e->'previousSha256') IS DISTINCT FROM 'string'
      OR jsonb_typeof(e->'entrySha256') IS DISTINCT FROM 'string'
      OR coalesce(e->>'rawOutputSha256','') !~ '^[a-f0-9]{64}$'
      OR coalesce(e->>'previousSha256','') !~ '^[a-f0-9]{64}$'
      OR coalesce(e->>'entrySha256','') !~ '^[a-f0-9]{64}$'
      OR jsonb_typeof(e->'decisionAtMs') IS DISTINCT FROM 'number'
      OR coalesce(e->>'decisionAtMs','') !~ '^[0-9]{1,16}$'
      OR (e->>'decisionAtMs')::bigint>captured OR captured-(e->>'decisionAtMs')::bigint>86400000
      THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;
    IF e->>'commercialMode'='manual' THEN manual_count:=manual_count+1;
      IF coalesce(e->>'action','') NOT IN('manual_preview','wait_for_context','pause_new_entries','manage_existing_position')
        OR (e->'suggestedSide' IS DISTINCT FROM 'null'::jsonb AND e->>'suggestedSide' IS DISTINCT FROM e->>'operatorIntent')
        THEN RAISE EXCEPTION 'R67_DATABASE_NATIVE_ACTION'; END IF;
    ELSIF e->>'commercialMode'='hybrid' THEN hybrid_count:=hybrid_count+1;
      IF coalesce(e->>'action','') NOT IN('hybrid_preview','wait_for_confluence','wait_for_context','pause_new_entries','manage_existing_position')
        THEN RAISE EXCEPTION 'R67_DATABASE_NATIVE_ACTION'; END IF;
    ELSIF e->>'commercialMode'='reverse' THEN reverse_count:=reverse_count+1;
      IF coalesce(e->>'action','') NOT IN('reverse_preview','reverse_not_calibrated','preserve_trend_aligned_intent',
        'suggest_trend_aligned_preview','wait_for_context','pause_new_entries','manage_existing_position')
        OR (e->>'action'='reverse_preview' AND e->>'suggestedSide' IS DISTINCT FROM
          CASE WHEN e->>'operatorIntent'='buy' THEN 'sell' ELSE 'buy' END)
        THEN RAISE EXCEPTION 'R67_DATABASE_NATIVE_ACTION'; END IF;
    ELSE RAISE EXCEPTION 'R67_DATABASE_NATIVE_ACTION'; END IF;
    IF (e->'suggestedSide' IS DISTINCT FROM 'null'::jsonb AND coalesce(e->>'suggestedSide','') NOT IN('buy','sell'))
      OR (e->>'action' IN('wait_for_context','wait_for_confluence','reverse_not_calibrated','pause_new_entries','manage_existing_position')
        AND e->'suggestedSide' IS DISTINCT FROM 'null'::jsonb)
      THEN RAISE EXCEPTION 'R67_DATABASE_NATIVE_ACTION'; END IF;
  END LOOP;
  IF manual_count<>(r->'counts'->>'manual')::integer OR hybrid_count<>(r->'counts'->>'hybrid')::integer
    OR reverse_count<>(r->'counts'->>'reverse')::integer THEN RAISE EXCEPTION 'R67_DATABASE_CAPTURE'; END IF;

  -- Lock operation before session in every call; even empty streams are serialized.
  PERFORM pg_advisory_xact_lock(hashtextextended('r67-operation:'||(r->>'scopeId')||':'||
    (r->>'sourceId')||':'||(v->>'operationId'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('r67-session:'||(r->>'scopeId')||':'||
    (r->>'sourceId')||':'||(r->>'sessionId'),0));
  db_now:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF db_now<admitted OR db_now>=expires THEN RAISE EXCEPTION 'R67_DATABASE_WINDOW_CLOSED'; END IF;
  SELECT * INTO previous FROM public.jenios_robot_private_captures_r67
    WHERE scope_id=r->>'scopeId' AND event_id=r->>'eventId';
  IF FOUND THEN
    IF previous.signed_record IS DISTINCT FROM b OR (previous.receipt-'admittedAtMs') IS DISTINCT FROM (r-'admittedAtMs')
      THEN RAISE EXCEPTION 'R67_DATABASE_EVENT_CONFLICT'; END IF;
    RETURN jsonb_build_object('status','ALREADY_STORED','receipt',previous.receipt,'record',previous.signed_record);
  END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_robot_private_captures_r67
    WHERE scope_id=r->>'scopeId' AND source_id=r->>'sourceId' AND operation_id=v->>'operationId')
    THEN RAISE EXCEPTION 'R67_DATABASE_OPERATION_CONFLICT'; END IF;
  SELECT * INTO latest FROM public.jenios_robot_private_captures_r67
    WHERE scope_id=r->>'scopeId' AND source_id=r->>'sourceId' AND session_id=r->>'sessionId'
    ORDER BY sequence DESC LIMIT 1;
  IF FOUND THEN
    IF n<>latest.sequence+1 OR captured<latest.captured_at_ms OR admitted<latest.admitted_at_ms
      THEN RAISE EXCEPTION 'R67_DATABASE_SEQUENCE_REPLAY'; END IF;
  ELSIF n<>1 THEN RAISE EXCEPTION 'R67_DATABASE_SEQUENCE_REPLAY'; END IF;
  BEGIN
    INSERT INTO public.jenios_robot_private_captures_r67(scope_id,source_id,session_id,event_id,operation_id,
      sequence,captured_at_ms,expires_at_ms,admitted_at_ms,payload_digest,provenance_digest,record_digest,receipt,signed_record)
      VALUES(r->>'scopeId',r->>'sourceId',r->>'sessionId',r->>'eventId',v->>'operationId',n,captured,expires,admitted,
        r->>'payloadDigest',r->>'provenanceDigest',r->>'recordDigest',r,b);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'R67_DATABASE_EVENT_CONFLICT'; END;
  RETURN jsonb_build_object('status','STORED','receipt',r,'record',b);
END;
$$;

CREATE FUNCTION public.jenios_robot_r67_read_private_captures(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; amount integer;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'R67_DATABASE_READ_REQUEST'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_input))<>3 OR NOT p_input ?& ARRAY['scopeId','sourceId','limit']
    OR coalesce(p_input->>'scopeId','') !~ '^scope:[a-f0-9]{16}$'
    OR coalesce(p_input->>'sourceId','') !~ '^source:[a-f0-9]{16}$'
    OR jsonb_typeof(p_input->'limit') IS DISTINCT FROM 'number' OR coalesce(p_input->>'limit','') !~ '^[0-9]{1,2}$'
    THEN RAISE EXCEPTION 'R67_DATABASE_READ_REQUEST'; END IF;
  amount:=(p_input->>'limit')::integer;
  IF amount<1 OR amount>30 THEN RAISE EXCEPTION 'R67_DATABASE_READ_REQUEST'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('receipt',x.receipt,'record',x.signed_record)
    ORDER BY x.admitted_at_ms DESC,x.event_id),'[]'::jsonb) INTO result
    FROM (SELECT receipt,signed_record,admitted_at_ms,event_id FROM public.jenios_robot_private_captures_r67
      WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId'
      ORDER BY admitted_at_ms DESC,event_id LIMIT amount) x;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.jenios_robot_r67_ingest_private_capture(jsonb),
  public.jenios_robot_r67_read_private_captures(jsonb) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.jenios_robot_r67_ingest_private_capture(jsonb),
  public.jenios_robot_r67_read_private_captures(jsonb) TO service_role;

$r72_r67_source$;

  -- Certified source: db/schema/robot-r71-private-evolution-store.sql; SHA256 8edeee3a14fbce217dc0538bf3aedd56fe32aaafa06bc01994374c922b723b49
  EXECUTE $r72_r71_source$
-- R71 REVIEW ONLY. Apply only to explicitly selected disposable PostgreSQL.
-- Extends R67 by atomic, signed contextual pairs and a separate bounded policy
-- history. No old R67 enrichment, R64/R65 rewrite, hosted install or execution.
-- App verification owns Ed25519/JS canonical digests. SQL owns admission time,
-- immutable membership and SHA256_POSTGRESQL_JSONB_TEXT_UTF8_V1 state digests.

CREATE FUNCTION public.jenios_robot_r71_digest(value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path='' AS $$
  SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex');
$$;
CREATE FUNCTION public.jenios_robot_r71_fields(value jsonb, names text[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  RETURN (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(names) AND value ?& names;
END; $$;
CREATE FUNCTION public.jenios_robot_r71_integer(value jsonb, minimum bigint, maximum bigint)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'number' OR coalesce(value#>>'{}','') !~ '^-?[0-9]{1,16}$'
    THEN RETURN false; END IF;
  RETURN (value#>>'{}')::numeric BETWEEN minimum AND maximum;
END; $$;
CREATE FUNCTION public.jenios_robot_r71_version(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.jenios_robot_r71_fields(value,ARRAY['versionId','activationGeneration','forwardPositionOpen'])
    OR NOT public.jenios_robot_r71_integer(value->'activationGeneration',0,31)
    OR jsonb_typeof(value->'versionId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(value->'forwardPositionOpen') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
  RETURN (value->'forwardPositionOpen'='false'::jsonb AND value->>'versionId'='private:r71-reference-v1')
    OR (value->'forwardPositionOpen'='true'::jsonb AND value->>'versionId'='private:r71-position-context-v1');
END; $$;
CREATE FUNCTION public.jenios_robot_r71_scope(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  RETURN jsonb_typeof(value) IS NOT DISTINCT FROM 'object'
    AND jsonb_typeof(value->'scopeId') IS NOT DISTINCT FROM 'string'
    AND coalesce(value->>'scopeId','') ~ '^scope:[a-f0-9]{16}$'
    AND jsonb_typeof(value->'sourceId') IS NOT DISTINCT FROM 'string'
    AND coalesce(value->>'sourceId','') ~ '^source:[a-f0-9]{16}$'
    AND jsonb_typeof(value->'sourceKeySha256') IS NOT DISTINCT FROM 'string'
    AND coalesce(value->>'sourceKeySha256','') ~ '^[a-f0-9]{64}$';
END; $$;

CREATE TABLE public.jenios_robot_private_evolution_r71 (
  scope_id text NOT NULL, source_id text NOT NULL, source_key_sha256 text NOT NULL,
  revision integer NOT NULL CHECK(revision BETWEEN 0 AND 31),
  operation_id text NOT NULL CHECK(operation_id ~ '^op:[a-f0-9]{32}$'),
  actor_id text NOT NULL, request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  state_digest text NOT NULL CHECK(state_digest ~ '^[a-f0-9]{64}$'),
  state jsonb NOT NULL CHECK(jsonb_typeof(state)='object' AND octet_length(state::text)<=8388608),
  stored_at_ms bigint NOT NULL,
  PRIMARY KEY(scope_id,source_id,revision), UNIQUE(scope_id,source_id,operation_id),
  CHECK(scope_id ~ '^scope:[a-f0-9]{16}$' AND source_id ~ '^source:[a-f0-9]{16}$'
    AND source_key_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE TABLE public.jenios_robot_private_observations_r71 (
  scope_id text NOT NULL, source_id text NOT NULL, source_key_sha256 text NOT NULL,
  event_id text NOT NULL, operation_id text NOT NULL, state_revision integer NOT NULL,
  captured_at_ms bigint NOT NULL, expires_at_ms bigint NOT NULL, admitted_at_ms bigint NOT NULL,
  purpose text NOT NULL CHECK(purpose IN('OBSERVATION','VALIDATION')), plan_id text,
  record_digest text NOT NULL CHECK(record_digest ~ '^[a-f0-9]{64}$'),
  annotation_digest text NOT NULL CHECK(annotation_digest ~ '^[a-f0-9]{64}$'),
  entry_count integer NOT NULL CHECK(entry_count BETWEEN 3 AND 60),
  receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object' AND octet_length(receipt::text)<=16384),
  signed_record jsonb NOT NULL CHECK(jsonb_typeof(signed_record)='object' AND octet_length(signed_record::text)<=524288),
  PRIMARY KEY(scope_id,source_id,event_id), UNIQUE(scope_id,source_id,operation_id),
  FOREIGN KEY(scope_id,event_id) REFERENCES public.jenios_robot_private_captures_r67(scope_id,event_id),
  FOREIGN KEY(scope_id,source_id,state_revision) REFERENCES public.jenios_robot_private_evolution_r71(scope_id,source_id,revision),
  CHECK(scope_id ~ '^scope:[a-f0-9]{16}$' AND source_id ~ '^source:[a-f0-9]{16}$'
    AND event_id ~ '^evt:[a-f0-9]{16}$' AND operation_id ~ '^op:[a-f0-9]{32}$'
    AND source_key_sha256 ~ '^[a-f0-9]{64}$' AND captured_at_ms>0
    AND expires_at_ms-captured_at_ms=120000 AND admitted_at_ms>=captured_at_ms AND admitted_at_ms<expires_at_ms),
  CHECK((purpose='OBSERVATION' AND plan_id IS NULL) OR (purpose='VALIDATION' AND plan_id ~ '^plan:[a-f0-9]{16}$'))
);
CREATE INDEX jenios_robot_private_observations_r71_period
  ON public.jenios_robot_private_observations_r71(scope_id,source_id,captured_at_ms,event_id);
CREATE TABLE public.jenios_robot_private_studies_r71 (
  scope_id text NOT NULL, source_id text NOT NULL, source_key_sha256 text NOT NULL,
  snapshot_id uuid NOT NULL, operation_id text NOT NULL CHECK(operation_id ~ '^op:[a-f0-9]{32}$'),
  request_digest text NOT NULL, snapshot jsonb NOT NULL, frozen_at_ms bigint NOT NULL,
  PRIMARY KEY(scope_id,source_id,snapshot_id), UNIQUE(scope_id,source_id,operation_id)
);
CREATE TABLE public.jenios_robot_private_study_members_r71 (
  scope_id text NOT NULL, source_id text NOT NULL, snapshot_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 257), event_id text NOT NULL,
  record_digest text NOT NULL, annotation_digest text NOT NULL, entry_count integer NOT NULL,
  PRIMARY KEY(scope_id,source_id,snapshot_id,ordinal), UNIQUE(scope_id,source_id,snapshot_id,event_id),
  FOREIGN KEY(scope_id,source_id,snapshot_id) REFERENCES public.jenios_robot_private_studies_r71(scope_id,source_id,snapshot_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(scope_id,source_id,event_id) REFERENCES public.jenios_robot_private_observations_r71(scope_id,source_id,event_id)
);
CREATE TABLE public.jenios_robot_private_validation_cases_r71 (
  scope_id text NOT NULL, source_id text NOT NULL, plan_id text NOT NULL, case_id text NOT NULL,
  event_id text NOT NULL, validation_case jsonb NOT NULL,
  PRIMARY KEY(scope_id,source_id,plan_id,case_id),
  FOREIGN KEY(scope_id,source_id,event_id) REFERENCES public.jenios_robot_private_observations_r71(scope_id,source_id,event_id)
);

ALTER TABLE public.jenios_robot_private_evolution_r71 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_private_observations_r71 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_private_studies_r71 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_private_study_members_r71 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jenios_robot_private_validation_cases_r71 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_robot_private_evolution_r71,public.jenios_robot_private_observations_r71,
  public.jenios_robot_private_studies_r71,public.jenios_robot_private_study_members_r71,
  public.jenios_robot_private_validation_cases_r71 FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.jenios_robot_private_evolution_r71,public.jenios_robot_private_observations_r71,
  public.jenios_robot_private_studies_r71,public.jenios_robot_private_study_members_r71,
  public.jenios_robot_private_validation_cases_r71 TO service_role;

CREATE FUNCTION public.jenios_robot_r71_now(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256'])
    OR NOT public.jenios_robot_r71_scope(p_input) THEN RAISE EXCEPTION 'R71_DATABASE_SCOPE'; END IF;
  RETURN jsonb_build_object('nowMs',floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
END; $$;

CREATE FUNCTION public.jenios_robot_r71_ingest_private_observation(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  r jsonb:=p_input->'receipt'; b jsonb:=p_input->'record'; a jsonb:=b->'annotation';
  nr jsonb:=r->'nativeReceipt'; nb jsonb:=b->'originalRecord'; p jsonb:=nb->'envelope'->'payload';
  previous public.jenios_robot_private_observations_r71%ROWTYPE;
  state_row public.jenios_robot_private_evolution_r71%ROWTYPE;
  e jsonb; scenario jsonb; native_entry jsonb; plan jsonb; definition jsonb; result jsonb; value jsonb;
  i integer:=0; n integer; now_ms bigint; captured bigint; expires bigint; field_name text; case_ids text[]:=ARRAY[]::text[];
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256','receipt','record'])
    OR NOT public.jenios_robot_r71_scope(p_input)
    OR NOT public.jenios_robot_r71_fields(r,ARRAY['schema','nativeReceipt','recordDigest','annotationDigest','sourceKeySha256',
      'purpose','planId','stateRevision','stateDigest','wrapperVersion','entryCount','admittedAtMs'])
    OR NOT public.jenios_robot_r71_fields(b,ARRAY['schema','originalRecord','annotation','signatureBase64'])
    OR NOT public.jenios_robot_r71_fields(a,ARRAY['schema','recordDigest','purpose','planId','scopeId','sourceId','sessionId',
      'eventId','sequence','capturedAtMs','expiresAtMs','stateRevision','stateDigest','wrapperVersion','entries',
      'policyKind','runtimeEvidenceKind','internalCoreRetuning'])
    OR octet_length(b::text)>524288 OR octet_length(r::text)>16384
    OR jsonb_typeof(nr) IS DISTINCT FROM 'object' OR jsonb_typeof(nb) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p) IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'R71_DATABASE_SHAPE'; END IF;
  IF r->>'schema' IS DISTINCT FROM 'JENIOS_R71_PRIVATE_POLICY_RECEIPT_V1'
    OR b->>'schema' IS DISTINCT FROM 'JENIOS_R71_PRIVATE_POLICY_OBSERVATION_V1'
    OR a->>'schema' IS DISTINCT FROM 'JENIOS_R71_PRIVATE_POLICY_ANNOTATION_V1'
    OR a->>'policyKind' IS DISTINCT FROM 'HONOR_EXISTING_POSITION_CONTEXT_FOR_ASSISTED'
    OR a->>'runtimeEvidenceKind' IS DISTINCT FROM 'ORIGINAL_PRIVATE_CORE_WITH_VERSIONED_EXTERNAL_RUNTIME_POLICY_SYNTHETIC_QA'
    OR a->'internalCoreRetuning' IS DISTINCT FROM 'false'::jsonb
    OR r->'sourceKeySha256' IS DISTINCT FROM p_input->'sourceKeySha256'
    OR nr->'sourceKeySha256' IS DISTINCT FROM p_input->'sourceKeySha256'
    OR a->'recordDigest' IS DISTINCT FROM nr->'recordDigest'
    OR a->'scopeId' IS DISTINCT FROM p_input->'scopeId' OR a->'sourceId' IS DISTINCT FROM p_input->'sourceId'
    OR r->'admittedAtMs' IS DISTINCT FROM nr->'admittedAtMs'
    THEN RAISE EXCEPTION 'R71_DATABASE_BINDING'; END IF;
  FOREACH field_name IN ARRAY ARRAY['scopeId','sourceId','sessionId','eventId','sequence','capturedAtMs','expiresAtMs'] LOOP
    IF a->field_name IS DISTINCT FROM nr->field_name OR a->field_name IS DISTINCT FROM p->field_name
      THEN RAISE EXCEPTION 'R71_DATABASE_BINDING'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['purpose','planId','stateRevision','stateDigest','wrapperVersion'] LOOP
    IF a->field_name IS DISTINCT FROM r->field_name THEN RAISE EXCEPTION 'R71_DATABASE_BINDING'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['recordDigest','annotationDigest','stateDigest','sourceKeySha256'] LOOP
    IF jsonb_typeof(r->field_name) IS DISTINCT FROM 'string' OR coalesce(r->>field_name,'') !~ '^[a-f0-9]{64}$'
      THEN RAISE EXCEPTION 'R71_DATABASE_DIGEST'; END IF;
  END LOOP;
  IF jsonb_typeof(b->'signatureBase64') IS DISTINCT FROM 'string'
    OR coalesce(b->>'signatureBase64','') !~ '^([A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$'
    OR NOT public.jenios_robot_r71_integer(a->'stateRevision',0,31)
    OR NOT public.jenios_robot_r71_integer(a->'capturedAtMs',1,9007199254740991)
    OR NOT public.jenios_robot_r71_integer(a->'expiresAtMs',1,9007199254740991)
    OR NOT public.jenios_robot_r71_integer(r->'admittedAtMs',1,9007199254740991)
    OR NOT public.jenios_robot_r71_integer(r->'entryCount',3,60)
    OR NOT public.jenios_robot_r71_version(a->'wrapperVersion')
    OR jsonb_typeof(a->'entries') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'scenarios') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'capture'->'entries') IS DISTINCT FROM 'array'
    OR coalesce(a->>'purpose','') NOT IN('OBSERVATION','VALIDATION')
    OR (a->>'purpose'='OBSERVATION' AND a->'planId' IS DISTINCT FROM 'null'::jsonb)
    OR (a->>'purpose'='VALIDATION' AND coalesce(a->>'planId','') !~ '^plan:[a-f0-9]{16}$')
    THEN RAISE EXCEPTION 'R71_DATABASE_ANNOTATION'; END IF;
  n:=(r->>'entryCount')::integer; captured:=(a->>'capturedAtMs')::bigint; expires:=(a->>'expiresAtMs')::bigint;
  IF jsonb_array_length(a->'entries')<>n OR nr->'captureCount' IS DISTINCT FROM r->'entryCount'
    OR jsonb_array_length(p->'scenarios')<>n OR jsonb_array_length(p->'capture'->'entries')<>n
    OR expires-captured<>120000 THEN RAISE EXCEPTION 'R71_DATABASE_ANNOTATION'; END IF;
  -- Every R71 mutation locks the same source history first. Native locks keep
  -- their certified operation->session order and are reentrant in the nested RPC.
  PERFORM pg_advisory_xact_lock(hashtextextended('r71-history:'||(p_input->>'scopeId')||':'||(p_input->>'sourceId'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('r67-operation:'||(nr->>'scopeId')||':'||(nr->>'sourceId')||':'||(nb->'provenance'->>'operationId'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('r67-session:'||(nr->>'scopeId')||':'||(nr->>'sourceId')||':'||(nr->>'sessionId'),0));
  now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF now_ms<captured OR now_ms>=expires THEN RAISE EXCEPTION 'R71_DATABASE_ADMISSION_EXPIRED'; END IF;
  SELECT * INTO previous FROM public.jenios_robot_private_observations_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND event_id=nr->>'eventId';
  IF FOUND THEN
    IF previous.source_key_sha256<>p_input->>'sourceKeySha256' OR previous.signed_record IS DISTINCT FROM b
      OR (previous.receipt-'admittedAtMs'-'nativeReceipt') IS DISTINCT FROM (r-'admittedAtMs'-'nativeReceipt')
      OR ((previous.receipt->'nativeReceipt')-'admittedAtMs') IS DISTINCT FROM (nr-'admittedAtMs')
      THEN RAISE EXCEPTION 'R71_DATABASE_EVENT_CONFLICT'; END IF;
    result:=public.jenios_robot_r67_ingest_private_capture(jsonb_build_object('scopeId',p_input->>'scopeId',
      'sourceId',p_input->>'sourceId','receipt',previous.receipt->'nativeReceipt','record',nb));
    RETURN jsonb_build_object('status','ALREADY_STORED','receipt',previous.receipt,'record',previous.signed_record);
  END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_robot_private_captures_r67
    WHERE scope_id=p_input->>'scopeId' AND event_id=nr->>'eventId')
    THEN RAISE EXCEPTION 'R71_DATABASE_RETROACTIVE_ENRICHMENT'; END IF;
  SELECT * INTO state_row FROM public.jenios_robot_private_evolution_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND revision=(a->>'stateRevision')::integer;
  IF NOT FOUND OR state_row.source_key_sha256<>p_input->>'sourceKeySha256'
    OR state_row.state_digest IS DISTINCT FROM a->>'stateDigest'
    OR state_row.state_digest IS DISTINCT FROM public.jenios_robot_r71_digest(state_row.state)
    THEN RAISE EXCEPTION 'R71_DATABASE_STATE_BINDING'; END IF;
  IF a->>'purpose'='OBSERVATION' THEN
    IF state_row.state->'activeVersion' IS DISTINCT FROM a->'wrapperVersion' THEN RAISE EXCEPTION 'R71_DATABASE_VERSION_BINDING'; END IF;
  ELSE
    plan:=state_row.state->'pendingEvaluation';
    IF plan->>'planId' IS DISTINCT FROM a->>'planId' OR plan->'candidateVersion' IS DISTINCT FROM a->'wrapperVersion'
      THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_PLAN'; END IF;
    IF now_ms<(plan->>'startsAtMs')::bigint OR now_ms>=(plan->>'endsAtMs')::bigint
      OR captured<(plan->>'startsAtMs')::bigint OR captured>=(plan->>'endsAtMs')::bigint
      THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_WINDOW'; END IF;
  END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(a->'entries') x LOOP
    scenario:=p->'scenarios'->i; native_entry:=p->'capture'->'entries'->i; i:=i+1;
    IF NOT public.jenios_robot_r71_fields(e,ARRAY['scenarioId','positionOpen','caseId','nativeDecision','effectiveDecision',
      'nativeDecisionDigest','effectiveDecisionDigest','nativeRawOutputSha256'])
      OR NOT public.jenios_robot_r71_fields(e->'nativeDecision',ARRAY['action','side','mayClose'])
      OR NOT public.jenios_robot_r71_fields(e->'effectiveDecision',ARRAY['action','side','mayClose'])
      OR e->'scenarioId' IS DISTINCT FROM scenario->'id' OR e->'scenarioId' IS DISTINCT FROM native_entry->'id'
      OR jsonb_typeof(e->'positionOpen') IS DISTINCT FROM 'boolean'
      OR e->'nativeDecision'->'action' IS DISTINCT FROM native_entry->'action'
      OR e->'nativeDecision'->'side' IS DISTINCT FROM native_entry->'suggestedSide'
      OR e->'nativeRawOutputSha256' IS DISTINCT FROM native_entry->'rawOutputSha256'
      OR e->'nativeDecision'->'mayClose' IS DISTINCT FROM 'true'::jsonb
      OR e->'effectiveDecision'->'mayClose' IS DISTINCT FROM 'true'::jsonb
      THEN RAISE EXCEPTION 'R71_DATABASE_DECISION_BINDING'; END IF;
    FOREACH field_name IN ARRAY ARRAY['nativeDecisionDigest','effectiveDecisionDigest','nativeRawOutputSha256'] LOOP
      IF jsonb_typeof(e->field_name) IS DISTINCT FROM 'string' OR coalesce(e->>field_name,'') !~ '^[a-f0-9]{64}$'
        THEN RAISE EXCEPTION 'R71_DATABASE_DIGEST'; END IF;
    END LOOP;
    IF a->'wrapperVersion'->'forwardPositionOpen'='true'::jsonb AND e->'positionOpen'='true'::jsonb
      AND scenario->>'mode' IN('hybrid','reverse') AND coalesce(scenario->'paused','false'::jsonb)='false'::jsonb
      AND e->'nativeDecision'->>'action'<>'pause_new_entries' THEN
      IF e->'effectiveDecision' IS DISTINCT FROM jsonb_build_object('action','manage_existing_position','side',NULL,'mayClose',true)
        THEN RAISE EXCEPTION 'R71_DATABASE_POLICY_BOUNDARY'; END IF;
    ELSIF e->'effectiveDecision' IS DISTINCT FROM e->'nativeDecision' THEN RAISE EXCEPTION 'R71_DATABASE_POLICY_BOUNDARY'; END IF;
    IF a->>'purpose'='OBSERVATION' THEN
      IF e->'caseId' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_CASE'; END IF;
    ELSE
      IF jsonb_typeof(e->'caseId') IS DISTINCT FROM 'string' OR coalesce(e->>'caseId','') !~ '^case:[a-f0-9]{16}$'
        OR e->>'caseId'=ANY(case_ids) THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_CASE'; END IF;
      case_ids:=array_append(case_ids,e->>'caseId');
      SELECT x INTO definition FROM jsonb_array_elements(plan->'caseDefinitions') x WHERE x->>'caseId'=e->>'caseId';
      IF NOT FOUND OR definition->'scenario' IS DISTINCT FROM scenario OR definition->'positionOpen' IS DISTINCT FROM e->'positionOpen'
        THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_CASE'; END IF;
      IF EXISTS(SELECT 1 FROM public.jenios_robot_private_validation_cases_r71
        WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND plan_id=a->>'planId' AND case_id=e->>'caseId')
        THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_CONFLICT'; END IF;
    END IF;
  END LOOP;
  nr:=jsonb_set(nr,'{admittedAtMs}',to_jsonb(now_ms));
  r:=jsonb_set(jsonb_set(r,'{admittedAtMs}',to_jsonb(now_ms)),'{nativeReceipt}',nr);
  result:=public.jenios_robot_r67_ingest_private_capture(jsonb_build_object('scopeId',p_input->>'scopeId',
    'sourceId',p_input->>'sourceId','receipt',nr,'record',nb));
  IF result->>'status' IS DISTINCT FROM 'STORED' THEN RAISE EXCEPTION 'R71_DATABASE_RETROACTIVE_ENRICHMENT'; END IF;
  IF floor(extract(epoch FROM clock_timestamp())*1000)::bigint>=expires
    OR (a->>'purpose'='VALIDATION' AND floor(extract(epoch FROM clock_timestamp())*1000)::bigint>=(plan->>'endsAtMs')::bigint)
    THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_WINDOW'; END IF;
  INSERT INTO public.jenios_robot_private_observations_r71(scope_id,source_id,source_key_sha256,event_id,operation_id,
    state_revision,captured_at_ms,expires_at_ms,admitted_at_ms,purpose,plan_id,record_digest,annotation_digest,entry_count,receipt,signed_record)
  VALUES(p_input->>'scopeId',p_input->>'sourceId',p_input->>'sourceKeySha256',nr->>'eventId',nb->'provenance'->>'operationId',
    (a->>'stateRevision')::integer,captured,expires,now_ms,a->>'purpose',a->>'planId',r->>'recordDigest',r->>'annotationDigest',n,r,b);
  IF a->>'purpose'='VALIDATION' THEN
    FOR e IN SELECT x FROM jsonb_array_elements(a->'entries') x LOOP
      value:=jsonb_build_object('planId',a->>'planId','caseId',e->>'caseId','eventId',nr->>'eventId',
        'recordDigest',r->>'recordDigest','capturedAtMs',captured,'admittedAtMs',now_ms,
        'nativeDecision',e->'nativeDecision','effectiveDecision',e->'effectiveDecision');
      INSERT INTO public.jenios_robot_private_validation_cases_r71(scope_id,source_id,plan_id,case_id,event_id,validation_case)
      VALUES(p_input->>'scopeId',p_input->>'sourceId',a->>'planId',e->>'caseId',nr->>'eventId',value);
    END LOOP;
  END IF;
  RETURN jsonb_build_object('status','STORED','receipt',r,'record',b);
END; $$;

CREATE FUNCTION public.jenios_robot_r71_freeze_study(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  previous public.jenios_robot_private_studies_r71%ROWTYPE;
  source_state public.jenios_robot_private_evolution_r71%ROWTYPE;
  snapshot_uuid uuid; now_ms bigint; request_hash text; member_hash text; records integer; entries integer; result jsonb;
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256','operationId','period'])
    OR NOT public.jenios_robot_r71_scope(p_input)
    OR jsonb_typeof(p_input->'operationId') IS DISTINCT FROM 'string'
    OR coalesce(p_input->>'operationId','') !~ '^op:[a-f0-9]{32}$'
    OR NOT public.jenios_robot_r71_fields(p_input->'period',ARRAY['startMs','endMs'])
    OR NOT public.jenios_robot_r71_integer(p_input->'period'->'startMs',0,9007199254740991)
    OR NOT public.jenios_robot_r71_integer(p_input->'period'->'endMs',1,9007199254740991)
    THEN RAISE EXCEPTION 'R71_DATABASE_SNAPSHOT_REQUEST'; END IF;
  IF (p_input->'period'->>'startMs')::bigint>=(p_input->'period'->>'endMs')::bigint
    THEN RAISE EXCEPTION 'R71_DATABASE_SNAPSHOT_PERIOD'; END IF;
  -- Freeze does not take the intake/history lock: one INSERT SELECT supplies
  -- the membership MVCC cut, excluding an intake transaction not yet committed.
  PERFORM pg_advisory_xact_lock(hashtextextended('r71-study-operation:'||(p_input->>'scopeId')||':'||
    (p_input->>'sourceId')||':'||(p_input->>'operationId'),0));
  request_hash:=public.jenios_robot_r71_digest(p_input);
  SELECT * INTO previous FROM public.jenios_robot_private_studies_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND operation_id=p_input->>'operationId';
  IF FOUND THEN
    IF previous.request_digest<>request_hash THEN RAISE EXCEPTION 'R71_DATABASE_OPERATION_CONFLICT'; END IF;
    RETURN previous.snapshot;
  END IF;
  SELECT * INTO source_state FROM public.jenios_robot_private_evolution_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' ORDER BY revision DESC LIMIT 1;
  IF NOT FOUND OR source_state.source_key_sha256<>p_input->>'sourceKeySha256'
    THEN RAISE EXCEPTION 'R71_DATABASE_STATE_BINDING'; END IF;
  now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF (p_input->'period'->>'endMs')::bigint>now_ms THEN RAISE EXCEPTION 'R71_DATABASE_SNAPSHOT_FUTURE'; END IF;
  snapshot_uuid:=gen_random_uuid();
  INSERT INTO public.jenios_robot_private_study_members_r71(scope_id,source_id,snapshot_id,ordinal,event_id,
    record_digest,annotation_digest,entry_count)
  SELECT scope_id,source_id,snapshot_uuid,(row_number() OVER(ORDER BY captured_at_ms,event_id))::integer,
    event_id,record_digest,annotation_digest,entry_count
    FROM public.jenios_robot_private_observations_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId'
      AND captured_at_ms>=(p_input->'period'->>'startMs')::bigint AND captured_at_ms<(p_input->'period'->>'endMs')::bigint
    ORDER BY captured_at_ms,event_id LIMIT 257;
  SELECT count(*),coalesce(sum(entry_count),0),public.jenios_robot_r71_digest(coalesce(jsonb_agg(
    jsonb_build_object('ordinal',ordinal,'eventId',event_id,'recordDigest',record_digest,'annotationDigest',annotation_digest)
    ORDER BY ordinal),'[]'::jsonb)) INTO records,entries,member_hash
    FROM public.jenios_robot_private_study_members_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND snapshot_id=snapshot_uuid;
  IF records>256 OR entries>8000 THEN RAISE EXCEPTION 'R71_DATABASE_SNAPSHOT_LIMIT'; END IF;
  result:=jsonb_build_object('schema','JENIOS_R71_PRIVATE_STUDY_SNAPSHOT_V1','snapshotId',snapshot_uuid,
    'scopeId',p_input->>'scopeId','sourceId',p_input->>'sourceId','sourceKeySha256',p_input->>'sourceKeySha256',
    'period',p_input->'period','frozenAtMs',now_ms,'totalRecords',records,'totalEntries',entries,'membershipDigest',member_hash);
  INSERT INTO public.jenios_robot_private_studies_r71(scope_id,source_id,source_key_sha256,snapshot_id,
    operation_id,request_digest,snapshot,frozen_at_ms)
  VALUES(p_input->>'scopeId',p_input->>'sourceId',p_input->>'sourceKeySha256',snapshot_uuid,
    p_input->>'operationId',request_hash,result,now_ms);
  RETURN result;
END; $$;

CREATE FUNCTION public.jenios_robot_r71_read_study_page(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  study public.jenios_robot_private_studies_r71%ROWTYPE; member_hash text; records integer; entries integer;
  rows_json jsonb; last_ordinal integer; after_ordinal integer; page_limit integer;
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256','snapshotId','afterOrdinal','limit'])
    OR NOT public.jenios_robot_r71_scope(p_input)
    OR jsonb_typeof(p_input->'snapshotId') IS DISTINCT FROM 'string'
    OR coalesce(p_input->>'snapshotId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR NOT public.jenios_robot_r71_integer(p_input->'afterOrdinal',0,256)
    OR NOT public.jenios_robot_r71_integer(p_input->'limit',1,10)
    THEN RAISE EXCEPTION 'R71_DATABASE_PAGE_REQUEST'; END IF;
  after_ordinal:=(p_input->>'afterOrdinal')::integer; page_limit:=(p_input->>'limit')::integer;
  SELECT * INTO study FROM public.jenios_robot_private_studies_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND snapshot_id=(p_input->>'snapshotId')::uuid;
  IF NOT FOUND OR study.source_key_sha256<>p_input->>'sourceKeySha256' THEN RAISE EXCEPTION 'R71_DATABASE_SNAPSHOT_NOT_FOUND'; END IF;
  SELECT count(*),coalesce(sum(entry_count),0),public.jenios_robot_r71_digest(coalesce(jsonb_agg(
    jsonb_build_object('ordinal',ordinal,'eventId',event_id,'recordDigest',record_digest,'annotationDigest',annotation_digest)
    ORDER BY ordinal),'[]'::jsonb)) INTO records,entries,member_hash
    FROM public.jenios_robot_private_study_members_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND snapshot_id=study.snapshot_id;
  IF records IS DISTINCT FROM (study.snapshot->>'totalRecords')::integer
    OR entries IS DISTINCT FROM (study.snapshot->>'totalEntries')::integer
    OR member_hash IS DISTINCT FROM study.snapshot->>'membershipDigest'
    OR after_ordinal>records THEN RAISE EXCEPTION 'R71_DATABASE_MEMBERSHIP_CORRUPT'; END IF;
  IF EXISTS(SELECT 1 FROM public.jenios_robot_private_study_members_r71 m
    JOIN public.jenios_robot_private_observations_r71 o USING(scope_id,source_id,event_id)
    WHERE m.scope_id=p_input->>'scopeId' AND m.source_id=p_input->>'sourceId' AND m.snapshot_id=study.snapshot_id
      AND (o.record_digest<>m.record_digest OR o.annotation_digest<>m.annotation_digest OR o.entry_count<>m.entry_count
        OR o.source_key_sha256<>study.source_key_sha256)) THEN RAISE EXCEPTION 'R71_DATABASE_MEMBERSHIP_CORRUPT'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('ordinal',q.ordinal,'receipt',q.receipt,'record',q.signed_record)
    ORDER BY q.ordinal),'[]'::jsonb),max(q.ordinal) INTO rows_json,last_ordinal
    FROM(SELECT m.ordinal,o.receipt,o.signed_record FROM public.jenios_robot_private_study_members_r71 m
      JOIN public.jenios_robot_private_observations_r71 o USING(scope_id,source_id,event_id)
      WHERE m.scope_id=p_input->>'scopeId' AND m.source_id=p_input->>'sourceId' AND m.snapshot_id=study.snapshot_id
        AND m.ordinal>after_ordinal ORDER BY m.ordinal LIMIT page_limit) q;
  IF jsonb_array_length(rows_json)<>least(page_limit,records-after_ordinal) THEN RAISE EXCEPTION 'R71_DATABASE_MEMBERSHIP_CORRUPT'; END IF;
  RETURN jsonb_build_object('snapshot',study.snapshot,'rows',rows_json,
    'nextOrdinal',CASE WHEN coalesce(last_ordinal,after_ordinal)<records THEN last_ordinal ELSE NULL END);
END; $$;

CREATE FUNCTION public.jenios_robot_r71_read_state(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE row_value public.jenios_robot_private_evolution_r71%ROWTYPE;
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256'])
    OR NOT public.jenios_robot_r71_scope(p_input) THEN RAISE EXCEPTION 'R71_DATABASE_SCOPE'; END IF;
  SELECT * INTO row_value FROM public.jenios_robot_private_evolution_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' ORDER BY revision DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
  IF row_value.source_key_sha256<>p_input->>'sourceKeySha256'
    OR row_value.state_digest<>public.jenios_robot_r71_digest(row_value.state)
    THEN RAISE EXCEPTION 'R71_DATABASE_STATE_BINDING'; END IF;
  RETURN jsonb_build_object('scopeId',row_value.scope_id,'sourceId',row_value.source_id,
    'revision',row_value.revision,'stateDigest',row_value.state_digest,'state',row_value.state);
END; $$;

CREATE FUNCTION public.jenios_robot_r71_read_validation_cases(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256','planId'])
    OR NOT public.jenios_robot_r71_scope(p_input) OR jsonb_typeof(p_input->'planId') IS DISTINCT FROM 'string'
    OR coalesce(p_input->>'planId','') !~ '^plan:[a-f0-9]{16}$' THEN RAISE EXCEPTION 'R71_DATABASE_CASE_REQUEST'; END IF;
  PERFORM public.jenios_robot_r71_read_state(p_input-'planId');
  SELECT coalesce(jsonb_agg(validation_case ORDER BY case_id),'[]'::jsonb) INTO result
    FROM public.jenios_robot_private_validation_cases_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND plan_id=p_input->>'planId';
  IF jsonb_array_length(result)>8 THEN RAISE EXCEPTION 'R71_DATABASE_VALIDATION_CONFLICT'; END IF;
  RETURN result;
END; $$;

CREATE FUNCTION public.jenios_robot_r71_read_overview(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE state_row jsonb; snapshots jsonb; operations jsonb; read_limit integer;
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256','limit'])
    OR NOT public.jenios_robot_r71_scope(p_input) OR NOT public.jenios_robot_r71_integer(p_input->'limit',1,30)
    THEN RAISE EXCEPTION 'R71_DATABASE_OVERVIEW_REQUEST'; END IF;
  state_row:=public.jenios_robot_r71_read_state(p_input-'limit'); read_limit:=(p_input->>'limit')::integer;
  SELECT coalesce(jsonb_agg(q.snapshot ORDER BY q.frozen_at_ms DESC,q.snapshot_id),'[]'::jsonb) INTO snapshots
    FROM(SELECT snapshot,frozen_at_ms,snapshot_id FROM public.jenios_robot_private_studies_r71
      WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId'
      ORDER BY frozen_at_ms DESC,snapshot_id LIMIT read_limit) q;
  SELECT coalesce(jsonb_agg(jsonb_build_object('operationId',q.operation_id,'revision',q.revision,'actorId',q.actor_id,
    'stateDigest',q.state_digest,'storedAtMs',q.stored_at_ms,'action',q.state->'journal'->-1->>'action')
    ORDER BY q.revision DESC),'[]'::jsonb) INTO operations
    FROM(SELECT * FROM public.jenios_robot_private_evolution_r71
      WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' ORDER BY revision DESC LIMIT read_limit) q;
  RETURN jsonb_build_object('scopeId',p_input->>'scopeId','sourceId',p_input->>'sourceId',
    'sourceKeySha256',p_input->>'sourceKeySha256','snapshots',snapshots,'operations',operations,'state',state_row);
END; $$;

CREATE FUNCTION public.jenios_robot_r71_plan(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE d jsonb; spec jsonb; i integer:=0; ids text[]:=ARRAY[]::text[];
  specs jsonb:='[["r71_manual_open","manual","buy","day",false,true,"UNCHANGED"],
    ["r71_manual_closed","manual","sell","day",false,false,"UNCHANGED"],
    ["r71_hybrid_open","hybrid","buy","day",false,true,"MANAGE_EXISTING_POSITION"],
    ["r71_hybrid_closed","hybrid","buy","day",false,false,"UNCHANGED"],
    ["r71_reverse_swing_open","reverse","buy","swing",false,true,"MANAGE_EXISTING_POSITION"],
    ["r71_reverse_swing_closed","reverse","sell","swing",false,false,"UNCHANGED"],
    ["r71_hybrid_paused_open","hybrid","buy","day",true,true,"UNCHANGED"],
    ["r71_reverse_day_open","reverse","buy","day",false,true,"MANAGE_EXISTING_POSITION"]]'::jsonb;
BEGIN
  IF NOT public.jenios_robot_r71_fields(value,ARRAY['schema','planId','snapshotId','studyDigest','registeredAtMs',
    'startsAtMs','endsAtMs','baselineVersion','candidateVersion','caseDefinitions'])
    OR value->>'schema' IS DISTINCT FROM 'JENIOS_R71_EVALUATION_PLAN_V1'
    OR jsonb_typeof(value->'planId') IS DISTINCT FROM 'string' OR coalesce(value->>'planId','') !~ '^plan:[a-f0-9]{16}$'
    OR jsonb_typeof(value->'snapshotId') IS DISTINCT FROM 'string'
    OR coalesce(value->>'snapshotId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR jsonb_typeof(value->'studyDigest') IS DISTINCT FROM 'string' OR coalesce(value->>'studyDigest','') !~ '^[a-f0-9]{64}$'
    OR NOT public.jenios_robot_r71_integer(value->'registeredAtMs',1,9007199254740991)
    OR NOT public.jenios_robot_r71_integer(value->'startsAtMs',1,9007199254740991)
    OR NOT public.jenios_robot_r71_integer(value->'endsAtMs',1,9007199254740991)
    OR NOT public.jenios_robot_r71_version(value->'baselineVersion')
    OR NOT public.jenios_robot_r71_version(value->'candidateVersion')
    OR jsonb_typeof(value->'caseDefinitions') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF (value->>'startsAtMs')::bigint-(value->>'registeredAtMs')::bigint<>1000
    OR (value->>'endsAtMs')::bigint-(value->>'startsAtMs')::bigint<>10000
    OR value->'baselineVersion'->'forwardPositionOpen' IS DISTINCT FROM 'false'::jsonb
    OR value->'candidateVersion'->'forwardPositionOpen' IS DISTINCT FROM 'true'::jsonb
    OR (value->'candidateVersion'->>'activationGeneration')::integer<>(value->'baselineVersion'->>'activationGeneration')::integer+1
    OR jsonb_array_length(value->'caseDefinitions')<>8 THEN RETURN false; END IF;
  FOR d IN SELECT x FROM jsonb_array_elements(value->'caseDefinitions') x LOOP
    spec:=specs->i; i:=i+1;
    IF NOT public.jenios_robot_r71_fields(d,ARRAY['caseId','scenario','positionOpen','expectedRouting'])
      OR jsonb_typeof(d->'caseId') IS DISTINCT FROM 'string' OR coalesce(d->>'caseId','') !~ '^case:[a-f0-9]{16}$'
      OR d->>'caseId'=ANY(ids)
      OR d->'scenario' IS DISTINCT FROM jsonb_build_object('id',spec->0,'mode',spec->1,'intent',spec->2,'horizon',spec->3,'paused',spec->4)
      OR d->'positionOpen' IS DISTINCT FROM spec->5 OR d->'expectedRouting' IS DISTINCT FROM spec->6 THEN RETURN false; END IF;
    ids:=array_append(ids,d->>'caseId');
  END LOOP;
  RETURN true;
END; $$;

CREATE FUNCTION public.jenios_robot_r71_append_state(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  s jsonb:=p_input->'state'; old public.jenios_robot_private_evolution_r71%ROWTYPE;
  prior_op public.jenios_robot_private_evolution_r71%ROWTYPE;
  snapshot_row public.jenios_robot_private_studies_r71%ROWTYPE;
  command jsonb; plan jsonb; study jsonb; evaluation jsonb; expected_history jsonb; cases jsonb; supplied_cases jsonb;
  d jsonb; c jsonb; result_case jsonb; case_results jsonb:='[]'::jsonb; missing jsonb:='[]'::jsonb;
  now_ms bigint; request_hash text; state_hash text; at_ms bigint; revision_value integer; action_name text;
  native_missed boolean; candidate_missed boolean; protected_changed boolean; unsupported boolean; apply_allowed boolean;
  observed integer:=0; baseline_missed integer:=0; candidate_missed_count integer:=0; protected_changes integer:=0;
  unsupported_count integer:=0; hybrid_missed integer:=0; reverse_missed integer:=0; status_name text;
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256','operationId',
    'expectedRevision','previousDigest','state','actorId']) OR NOT public.jenios_robot_r71_scope(p_input)
    OR jsonb_typeof(p_input->'operationId') IS DISTINCT FROM 'string'
    OR coalesce(p_input->>'operationId','') !~ '^op:[a-f0-9]{32}$'
    OR NOT public.jenios_robot_r71_integer(p_input->'expectedRevision',-1,30)
    OR jsonb_typeof(p_input->'actorId') IS DISTINCT FROM 'string'
    OR (p_input->>'actorId'<>'system:r71' AND p_input->>'actorId' !~ '^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
    OR ((p_input->'expectedRevision'='-1'::jsonb AND p_input->'previousDigest' IS DISTINCT FROM 'null'::jsonb)
      OR (p_input->'expectedRevision'<>'-1'::jsonb AND (jsonb_typeof(p_input->'previousDigest') IS DISTINCT FROM 'string'
        OR coalesce(p_input->>'previousDigest','') !~ '^[a-f0-9]{64}$')))
    OR NOT public.jenios_robot_r71_fields(s,ARRAY['schema','scopeId','sourceId','sourceKeySha256','createdAtMs','revision',
      'activeVersion','promotions','candidateRetired','latestStudy','pendingEvaluation','evaluations','history','journal'])
    OR octet_length(s::text)>8388608
    THEN RAISE EXCEPTION 'R71_DATABASE_STATE_REQUEST'; END IF;
  IF s->>'schema' IS DISTINCT FROM 'JENIOS_R71_PRIVATE_EVOLUTION_STATE_V1'
    OR s->'scopeId' IS DISTINCT FROM p_input->'scopeId' OR s->'sourceId' IS DISTINCT FROM p_input->'sourceId'
    OR s->'sourceKeySha256' IS DISTINCT FROM p_input->'sourceKeySha256'
    OR NOT public.jenios_robot_r71_integer(s->'createdAtMs',1,9007199254740991)
    OR NOT public.jenios_robot_r71_integer(s->'revision',0,31)
    OR NOT public.jenios_robot_r71_integer(s->'promotions',0,1)
    OR jsonb_typeof(s->'candidateRetired') IS DISTINCT FROM 'boolean'
    OR NOT public.jenios_robot_r71_version(s->'activeVersion')
    OR jsonb_typeof(s->'journal') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'history') IS DISTINCT FROM 'array'
    OR jsonb_typeof(s->'evaluations') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'R71_DATABASE_STATE'; END IF;
  revision_value:=(s->>'revision')::integer;
  IF revision_value<>(p_input->>'expectedRevision')::integer+1 OR jsonb_array_length(s->'journal')<>revision_value+1
    OR jsonb_array_length(s->'evaluations')>1 THEN RAISE EXCEPTION 'R71_DATABASE_STATE'; END IF;
  command:=s->'journal'->-1; action_name:=command->>'action';
  IF NOT public.jenios_robot_r71_integer(command->'atMs',1,9007199254740991)
    OR coalesce(action_name,'') NOT IN('INITIALIZE','STUDY','REGISTER','EVALUATE','ROLLBACK')
    THEN RAISE EXCEPTION 'R71_DATABASE_COMMAND'; END IF;
  at_ms:=(command->>'atMs')::bigint;
  PERFORM pg_advisory_xact_lock(hashtextextended('r71-history:'||(p_input->>'scopeId')||':'||(p_input->>'sourceId'),0));
  now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  request_hash:=public.jenios_robot_r71_digest(p_input);
  SELECT * INTO prior_op FROM public.jenios_robot_private_evolution_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND operation_id=p_input->>'operationId';
  IF FOUND THEN
    IF prior_op.request_digest<>request_hash THEN RAISE EXCEPTION 'R71_DATABASE_OPERATION_CONFLICT'; END IF;
    RETURN jsonb_build_object('scopeId',prior_op.scope_id,'sourceId',prior_op.source_id,'revision',prior_op.revision,
      'stateDigest',prior_op.state_digest,'state',prior_op.state,'replayed',true);
  END IF;
  SELECT * INTO old FROM public.jenios_robot_private_evolution_r71
    WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' ORDER BY revision DESC LIMIT 1;
  IF (FOUND AND (old.revision<>(p_input->>'expectedRevision')::integer OR old.state_digest IS DISTINCT FROM p_input->>'previousDigest'))
    OR (NOT FOUND AND (p_input->>'expectedRevision')::integer<>-1) THEN RAISE EXCEPTION 'R71_DATABASE_STALE_STATE'; END IF;
  IF old.state IS NOT NULL AND (old.source_key_sha256<>p_input->>'sourceKeySha256'
    OR old.state_digest<>public.jenios_robot_r71_digest(old.state)) THEN RAISE EXCEPTION 'R71_DATABASE_STATE_BINDING'; END IF;
  IF at_ms>now_ms OR (s->>'createdAtMs')::bigint>at_ms THEN RAISE EXCEPTION 'R71_DATABASE_CLOCK'; END IF;
  IF revision_value=0 THEN
    IF command IS DISTINCT FROM jsonb_build_object('action','INITIALIZE','atMs',s->'createdAtMs',
      'scopeId',p_input->'scopeId','sourceId',p_input->'sourceId','sourceKeySha256',p_input->'sourceKeySha256')
      OR s->'activeVersion' IS DISTINCT FROM '{"versionId":"private:r71-reference-v1","activationGeneration":0,"forwardPositionOpen":false}'::jsonb
      OR s->'promotions' IS DISTINCT FROM '0'::jsonb OR s->'candidateRetired' IS DISTINCT FROM 'false'::jsonb
      OR s->'latestStudy' IS DISTINCT FROM 'null'::jsonb OR s->'pendingEvaluation' IS DISTINCT FROM 'null'::jsonb
      OR s->'evaluations' IS DISTINCT FROM '[]'::jsonb OR s->'history' IS DISTINCT FROM '[]'::jsonb
      THEN RAISE EXCEPTION 'R71_DATABASE_INITIAL_STATE'; END IF;
  ELSE
    IF s->'createdAtMs' IS DISTINCT FROM old.state->'createdAtMs'
      OR ((s->'journal')-revision_value) IS DISTINCT FROM old.state->'journal'
      OR at_ms<(old.state->'journal'->-1->>'atMs')::bigint OR action_name='INITIALIZE'
      THEN RAISE EXCEPTION 'R71_DATABASE_HISTORY'; END IF;
    IF action_name='STUDY' THEN
      IF NOT public.jenios_robot_r71_fields(command,ARRAY['action','atMs','study'])
        OR s->'latestStudy' IS DISTINCT FROM command->'study'
        OR (s-ARRAY['revision','journal','latestStudy']) IS DISTINCT FROM (old.state-ARRAY['revision','journal','latestStudy'])
        OR old.state->'pendingEvaluation' IS DISTINCT FROM 'null'::jsonb
        OR old.state->'candidateRetired' IS DISTINCT FROM 'false'::jsonb OR old.state->'promotions' IS DISTINCT FROM '0'::jsonb
        THEN RAISE EXCEPTION 'R71_DATABASE_STUDY_TRANSITION'; END IF;
      study:=s->'latestStudy';
      IF jsonb_typeof(study) IS DISTINCT FROM 'object' OR jsonb_typeof(study->'studyDigest') IS DISTINCT FROM 'string'
        OR coalesce(study->>'studyDigest','') !~ '^[a-f0-9]{64}$'
        OR study->'scopeId' IS DISTINCT FROM p_input->'scopeId' OR study->'sourceId' IS DISTINCT FROM p_input->'sourceId'
        OR study->'sourceKeySha256' IS DISTINCT FROM p_input->'sourceKeySha256'
        OR jsonb_typeof(study->'snapshot'->'snapshotId') IS DISTINCT FROM 'string'
        OR coalesce(study->'snapshot'->>'snapshotId','') !~ '^[a-f0-9-]{36}$' THEN RAISE EXCEPTION 'R71_DATABASE_STUDY_BINDING'; END IF;
      SELECT * INTO snapshot_row FROM public.jenios_robot_private_studies_r71
        WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND snapshot_id=(study->'snapshot'->>'snapshotId')::uuid;
      IF NOT FOUND OR snapshot_row.snapshot IS DISTINCT FROM study->'snapshot'
        OR snapshot_row.source_key_sha256<>p_input->>'sourceKeySha256' OR snapshot_row.frozen_at_ms>at_ms
        THEN RAISE EXCEPTION 'R71_DATABASE_STUDY_BINDING'; END IF;
    ELSIF action_name='REGISTER' THEN
      plan:=command->'plan'; study:=old.state->'latestStudy';
      IF NOT public.jenios_robot_r71_fields(command,ARRAY['action','atMs','plan']) OR NOT public.jenios_robot_r71_plan(plan)
        OR old.state->'pendingEvaluation' IS DISTINCT FROM 'null'::jsonb OR old.state->'promotions' IS DISTINCT FROM '0'::jsonb
        OR old.state->'candidateRetired' IS DISTINCT FROM 'false'::jsonb OR old.state->'evaluations' IS DISTINCT FROM '[]'::jsonb
        OR plan->'baselineVersion' IS DISTINCT FROM old.state->'activeVersion'
        OR plan->'snapshotId' IS DISTINCT FROM study->'snapshot'->'snapshotId' OR plan->'studyDigest' IS DISTINCT FROM study->'studyDigest'
        OR s->'pendingEvaluation' IS DISTINCT FROM plan
        OR (s-ARRAY['revision','journal','pendingEvaluation','history']) IS DISTINCT FROM (old.state-ARRAY['revision','journal','pendingEvaluation','history'])
        THEN RAISE EXCEPTION 'R71_DATABASE_REGISTER_TRANSITION'; END IF;
      IF (plan->>'registeredAtMs')::bigint<>at_ms OR now_ms>=(plan->>'startsAtMs')::bigint
        THEN RAISE EXCEPTION 'R71_DATABASE_REGISTRATION_WINDOW'; END IF;
      -- Independently derive policy eligibility from the actual frozen pairs,
      -- not from a caller's study summary or a boolean declaring improvement.
      SELECT count(*) FILTER(WHERE q.required AND q.native_decision IS DISTINCT FROM '{"action":"manage_existing_position","side":null,"mayClose":true}'::jsonb),
        count(*) FILTER(WHERE q.required AND q.mode='hybrid' AND q.native_decision IS DISTINCT FROM '{"action":"manage_existing_position","side":null,"mayClose":true}'::jsonb),
        count(*) FILTER(WHERE q.required AND q.mode='reverse' AND q.native_decision IS DISTINCT FROM '{"action":"manage_existing_position","side":null,"mayClose":true}'::jsonb),
        count(*) FILTER(WHERE NOT q.required AND q.native_decision IS DISTINCT FROM q.effective_decision)
        INTO baseline_missed,hybrid_missed,reverse_missed,protected_changes
      FROM(SELECT e.entry->'nativeDecision' AS native_decision,e.entry->'effectiveDecision' AS effective_decision,
        o.signed_record->'originalRecord'->'envelope'->'payload'->'scenarios'->(e.ordinality-1)::integer->>'mode' AS mode,
        (e.entry->'positionOpen'='true'::jsonb
          AND o.signed_record->'originalRecord'->'envelope'->'payload'->'scenarios'->(e.ordinality-1)::integer->>'mode' IN('hybrid','reverse')
          AND coalesce(o.signed_record->'originalRecord'->'envelope'->'payload'->'scenarios'->(e.ordinality-1)::integer->'paused','false'::jsonb)='false'::jsonb) AS required
        FROM public.jenios_robot_private_study_members_r71 m
        JOIN public.jenios_robot_private_observations_r71 o USING(scope_id,source_id,event_id)
        JOIN LATERAL jsonb_array_elements(o.signed_record->'annotation'->'entries') WITH ORDINALITY e(entry,ordinality) ON true
        WHERE m.scope_id=p_input->>'scopeId' AND m.source_id=p_input->>'sourceId' AND m.snapshot_id=(plan->>'snapshotId')::uuid
          AND o.purpose='OBSERVATION' AND o.signed_record->'annotation'->'wrapperVersion'=old.state->'activeVersion') q;
      IF baseline_missed<3 OR hybrid_missed<1 OR reverse_missed<1 OR protected_changes<>0
        THEN RAISE EXCEPTION 'R71_DATABASE_STUDY_INELIGIBLE'; END IF;
      expected_history:=jsonb_build_object('action','REGISTERED','atMs',at_ms,
        'fromVersionId',old.state->'activeVersion'->>'versionId','toVersionId',s->'activeVersion'->>'versionId',
        'activationGeneration',s->'activeVersion'->'activationGeneration','planId',plan->'planId','studyDigest',plan->'studyDigest','reason',NULL);
    ELSIF action_name='EVALUATE' THEN
      plan:=old.state->'pendingEvaluation'; evaluation:=s->'evaluations'->-1;
      IF NOT public.jenios_robot_r71_fields(command,ARRAY['action','atMs','cases']) OR NOT public.jenios_robot_r71_plan(plan)
        OR jsonb_typeof(command->'cases') IS DISTINCT FROM 'array' OR old.state->'evaluations' IS DISTINCT FROM '[]'::jsonb
        OR old.state->'promotions' IS DISTINCT FROM '0'::jsonb OR old.state->'candidateRetired' IS DISTINCT FROM 'false'::jsonb
        OR s->'pendingEvaluation' IS DISTINCT FROM 'null'::jsonb OR jsonb_array_length(s->'evaluations')<>1
        OR (s-ARRAY['revision','journal','activeVersion','promotions','candidateRetired','pendingEvaluation','evaluations','history'])
          IS DISTINCT FROM (old.state-ARRAY['revision','journal','activeVersion','promotions','candidateRetired','pendingEvaluation','evaluations','history'])
        THEN RAISE EXCEPTION 'R71_DATABASE_EVALUATE_TRANSITION'; END IF;
      IF at_ms<(plan->>'endsAtMs')::bigint OR now_ms<(plan->>'endsAtMs')::bigint THEN RAISE EXCEPTION 'R71_DATABASE_EVALUATION_WINDOW'; END IF;
      SELECT coalesce(jsonb_agg(validation_case ORDER BY case_id),'[]'::jsonb) INTO cases
        FROM public.jenios_robot_private_validation_cases_r71
        WHERE scope_id=p_input->>'scopeId' AND source_id=p_input->>'sourceId' AND plan_id=plan->>'planId';
      SELECT coalesce(jsonb_agg(x ORDER BY x->>'caseId'),'[]'::jsonb) INTO supplied_cases FROM jsonb_array_elements(command->'cases') x;
      IF supplied_cases IS DISTINCT FROM cases THEN RAISE EXCEPTION 'R71_DATABASE_EVALUATION_CASES'; END IF;
      FOR d IN SELECT x FROM jsonb_array_elements(plan->'caseDefinitions') x LOOP
        SELECT x INTO c FROM jsonb_array_elements(cases) x WHERE x->>'caseId'=d->>'caseId';
        IF NOT FOUND THEN missing:=missing||jsonb_build_array(d->'caseId'); CONTINUE; END IF;
        observed:=observed+1;
        native_missed:=d->>'expectedRouting'='MANAGE_EXISTING_POSITION' AND c->'nativeDecision' IS DISTINCT FROM '{"action":"manage_existing_position","side":null,"mayClose":true}'::jsonb;
        candidate_missed:=d->>'expectedRouting'='MANAGE_EXISTING_POSITION' AND c->'effectiveDecision' IS DISTINCT FROM '{"action":"manage_existing_position","side":null,"mayClose":true}'::jsonb;
        protected_changed:=d->>'expectedRouting'='UNCHANGED' AND c->'nativeDecision' IS DISTINCT FROM c->'effectiveDecision';
        unsupported:=CASE WHEN d->>'expectedRouting'='MANAGE_EXISTING_POSITION' THEN candidate_missed ELSE protected_changed END;
        IF native_missed THEN baseline_missed:=baseline_missed+1; END IF;
        IF candidate_missed THEN candidate_missed_count:=candidate_missed_count+1; END IF;
        IF protected_changed THEN protected_changes:=protected_changes+1; END IF;
        IF unsupported THEN unsupported_count:=unsupported_count+1; END IF;
        result_case:=jsonb_build_object('caseId',c->'caseId','eventId',c->'eventId','recordDigest',c->'recordDigest',
          'capturedAtMs',c->'capturedAtMs','admittedAtMs',c->'admittedAtMs','expectedRouting',d->'expectedRouting',
          'nativeDecision',c->'nativeDecision','effectiveDecision',c->'effectiveDecision',
          'baselineMissed',native_missed,'candidateMissed',candidate_missed,'protectedChanged',protected_changed,'unsupportedCandidate',unsupported);
        case_results:=case_results||jsonb_build_array(result_case);
      END LOOP;
      apply_allowed:=observed=8 AND baseline_missed>0 AND candidate_missed_count=0 AND protected_changes=0 AND unsupported_count=0;
      status_name:=CASE WHEN observed<>8 THEN 'REJECTED_INCOMPLETE' WHEN protected_changes>0 OR unsupported_count>0 THEN 'REJECTED_POLICY'
        WHEN NOT apply_allowed THEN 'REJECTED_NO_IMPROVEMENT' ELSE 'APPLIED' END;
      IF evaluation IS DISTINCT FROM jsonb_build_object('schema','JENIOS_R71_EVALUATION_RESULT_V1','planId',plan->'planId',
        'snapshotId',plan->'snapshotId','studyDigest',plan->'studyDigest','completedAtMs',at_ms,'status',status_name,
        'eligibleToApply',apply_allowed,'summary',jsonb_build_object('expectedCases',8,'observedCases',observed,
          'baselineMissedExistingPositionRouting',baseline_missed,'candidateMissedExistingPositionRouting',candidate_missed_count,
          'protectedCaseChanges',protected_changes,'unsupportedCandidateOutcomes',unsupported_count),
        'caseResults',case_results,'missingCaseIds',missing)
        THEN RAISE EXCEPTION 'R71_DATABASE_EVALUATION_RESULT'; END IF;
      IF apply_allowed THEN
        IF s->'activeVersion' IS DISTINCT FROM plan->'candidateVersion' OR s->'promotions' IS DISTINCT FROM '1'::jsonb
          OR s->'candidateRetired' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'R71_DATABASE_APPLY'; END IF;
      ELSIF s->'activeVersion' IS DISTINCT FROM old.state->'activeVersion' OR s->'promotions' IS DISTINCT FROM '0'::jsonb
        OR s->'candidateRetired' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'R71_DATABASE_APPLY'; END IF;
      expected_history:=jsonb_build_object('action',status_name,'atMs',at_ms,
        'fromVersionId',old.state->'activeVersion'->>'versionId','toVersionId',s->'activeVersion'->>'versionId',
        'activationGeneration',s->'activeVersion'->'activationGeneration','planId',plan->'planId','studyDigest',plan->'studyDigest','reason',NULL);
    ELSE
      IF NOT public.jenios_robot_r71_fields(command,ARRAY['action','atMs','reason'])
        OR coalesce(command->>'reason','') NOT IN('OWNER_REQUEST','TECHNICAL_FAILURE','REGRESSION_DETECTED')
        OR p_input->>'actorId'='system:r71' OR old.state->'promotions' IS DISTINCT FROM '1'::jsonb
        OR old.state->'candidateRetired' IS DISTINCT FROM 'false'::jsonb
        OR old.state->'activeVersion'->'forwardPositionOpen' IS DISTINCT FROM 'true'::jsonb
        OR s->'activeVersion' IS DISTINCT FROM jsonb_build_object('versionId','private:r71-reference-v1',
          'activationGeneration',(old.state->'activeVersion'->>'activationGeneration')::integer+1,'forwardPositionOpen',false)
        OR s->'candidateRetired' IS DISTINCT FROM 'true'::jsonb
        OR (s-ARRAY['revision','journal','activeVersion','candidateRetired','history']) IS DISTINCT FROM (old.state-ARRAY['revision','journal','activeVersion','candidateRetired','history'])
        THEN RAISE EXCEPTION 'R71_DATABASE_ROLLBACK'; END IF;
      expected_history:=jsonb_build_object('action','ROLLED_BACK','atMs',at_ms,
        'fromVersionId',old.state->'activeVersion'->>'versionId','toVersionId',s->'activeVersion'->>'versionId',
        'activationGeneration',s->'activeVersion'->'activationGeneration','planId',old.state->'evaluations'->-1->'planId',
        'studyDigest',old.state->'evaluations'->-1->'studyDigest','reason',command->'reason');
    END IF;
    IF action_name<>'STUDY' AND s->'history' IS DISTINCT FROM (old.state->'history'||jsonb_build_array(expected_history))
      THEN RAISE EXCEPTION 'R71_DATABASE_HISTORY'; END IF;
  END IF;
  state_hash:=public.jenios_robot_r71_digest(s);
  INSERT INTO public.jenios_robot_private_evolution_r71(scope_id,source_id,source_key_sha256,revision,operation_id,actor_id,
    request_digest,state_digest,state,stored_at_ms)
  VALUES(p_input->>'scopeId',p_input->>'sourceId',p_input->>'sourceKeySha256',revision_value,p_input->>'operationId',
    p_input->>'actorId',request_hash,state_hash,s,now_ms);
  RETURN jsonb_build_object('scopeId',p_input->>'scopeId','sourceId',p_input->>'sourceId','revision',revision_value,
    'stateDigest',state_hash,'state',s,'replayed',false);
END; $$;

REVOKE ALL ON FUNCTION public.jenios_robot_r71_digest(jsonb),public.jenios_robot_r71_fields(jsonb,text[]),
  public.jenios_robot_r71_integer(jsonb,bigint,bigint),public.jenios_robot_r71_version(jsonb),public.jenios_robot_r71_scope(jsonb),
  public.jenios_robot_r71_plan(jsonb),public.jenios_robot_r71_now(jsonb),public.jenios_robot_r71_ingest_private_observation(jsonb),
  public.jenios_robot_r71_freeze_study(jsonb),public.jenios_robot_r71_read_study_page(jsonb),public.jenios_robot_r71_read_state(jsonb),
  public.jenios_robot_r71_read_validation_cases(jsonb),public.jenios_robot_r71_read_overview(jsonb),public.jenios_robot_r71_append_state(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.jenios_robot_r71_digest(jsonb),public.jenios_robot_r71_fields(jsonb,text[]),
  public.jenios_robot_r71_integer(jsonb,bigint,bigint),public.jenios_robot_r71_version(jsonb),public.jenios_robot_r71_scope(jsonb),
  public.jenios_robot_r71_plan(jsonb),public.jenios_robot_r71_now(jsonb),public.jenios_robot_r71_ingest_private_observation(jsonb),
  public.jenios_robot_r71_freeze_study(jsonb),public.jenios_robot_r71_read_study_page(jsonb),public.jenios_robot_r71_read_state(jsonb),
  public.jenios_robot_r71_read_validation_cases(jsonb),public.jenios_robot_r71_read_overview(jsonb),public.jenios_robot_r71_append_state(jsonb)
  TO service_role;

$r72_r71_source$;
  -- Check actual installed metadata before the atomic statement can commit.
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN('r','p') AND c.relname ~ '^jenios_robot_.*_r(64|65|67|71)$')<>16
    OR (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname ~ '^jenios_robot_r(64|65|67|71)_')<>39
    OR (SELECT count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      AND NOT t.tgisinternal AND t.tgname IN('jenios_robot_r65_guard_archive','jenios_robot_r65_disable_only','jenios_robot_r65_guard_cycle')
      AND c.relname IN('jenios_robot_archives_r65','jenios_robot_config_r64','jenios_robot_cycles_r64'))<>3 THEN
    RAISE EXCEPTION 'R72_OBJECT_COUNTS_MISMATCH';
  END IF;
  FOR r IN SELECT name FROM (VALUES
      ('jenios_robot_events_r64'),
      ('jenios_robot_config_r64'),
      ('jenios_robot_budgets_r64'),
      ('jenios_robot_cycles_r64'),
      ('jenios_robot_observation_provenance_r65'),
      ('jenios_robot_reconciliations_r65'),
      ('jenios_robot_archives_r65'),
      ('jenios_robot_archive_items_r65'),
      ('jenios_robot_evolution_r65'),
      ('jenios_robot_validation_cases_r65'),
      ('jenios_robot_private_captures_r67'),
      ('jenios_robot_private_evolution_r71'),
      ('jenios_robot_private_observations_r71'),
      ('jenios_robot_private_studies_r71'),
      ('jenios_robot_private_study_members_r71'),
      ('jenios_robot_private_validation_cases_r71')
    ) expected(name) LOOP
    object_oid:=pg_catalog.to_regclass('public.'||r.name);
    IF object_oid IS NULL THEN RAISE EXCEPTION 'R72_TABLE_MISSING'; END IF;
    SELECT c.relrowsecurity INTO protected_rls FROM pg_catalog.pg_class c WHERE c.oid=object_oid;
    IF protected_rls IS DISTINCT FROM true THEN RAISE EXCEPTION 'R72_RLS_MISSING'; END IF;
    IF pg_catalog.has_table_privilege('anon',object_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR pg_catalog.has_table_privilege('authenticated',object_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR pg_catalog.has_any_column_privilege('anon',object_oid,'SELECT,INSERT,UPDATE,REFERENCES')
      OR pg_catalog.has_any_column_privilege('authenticated',object_oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'R72_PUBLIC_TABLE_PRIVILEGE';
    END IF;
  END LOOP;
  FOR r IN SELECT signature,expected_hash FROM (VALUES
      ('public.jenios_robot_r64_ingest(jsonb)','2cf5fbb2cba6e0ca67693a3331d79c5ad3501328dbf8e854cab556b2d6a35bcc'),
      ('public.jenios_robot_r64_read_receipts(jsonb)','7279e5de2dbe609fadfe50e9d2a6c7295421c461300792b2f18d86672ae4a41d'),
      ('public.jenios_robot_r64_claim_cycle(jsonb)','f0203b07d0d89ee5e57cc1581197e06fecdaf8f0687f32854651a19f238515f6'),
      ('public.jenios_robot_r64_read_cycle(jsonb)','4e994e0b67909f10c453785959728063d31d78e4b0e2ce6190943f2c235490f4'),
      ('public.jenios_robot_r64_analyst_policy(jsonb)','8898af50f62a97036bdda47150a3b5ffe0ae4c157e55935e7a4487e6f2f1b16e'),
      ('public.jenios_robot_r64_reserve_dispatch(jsonb)','e71233d5d67b27b4a3041ffe1a6fb0167dbf07f4dee48aee6f4bd74fa1eeb3a9'),
      ('public.jenios_robot_r64_complete_cycle(jsonb)','669fcb0541dd6ee4776e74b383f0b22118382ab409b023a0a71d7139f593115a'),
      ('public.jenios_robot_r64_read_reports(jsonb)','0f92840034ac51c4c74b7c9c28c70d180251fab66f31ce73cc42da8cac476ad6'),
      ('public.jenios_robot_r65_digest(jsonb)','a0244e3f247525076c99efb364763652437538991a6982a33c1bcae1975cfac6'),
      ('public.jenios_robot_r65_ingest_observation(jsonb)','87341020c03e3cc8708f2c23a95df7d70accbe9c3740a5c282bacc7364bd6dc0'),
      ('public.jenios_robot_r65_guard_archive()','15c0a2c9b29ed3a1031162c0c641928949e90fc0599bb3ef546bb39d03415acf'),
      ('public.jenios_robot_r65_disable_only()','1c2e66ff7426a15f705f56321697582b54f2ad921e5dfe10aa0c4a9c5f70a560'),
      ('public.jenios_robot_r65_guard_cycle()','e50b43555b583a901eeb6e58777a9c17567a998ba47f5dd6ed4f663766f205a1'),
      ('public.jenios_robot_r65_reconcile_cost(jsonb)','e99cbe7c4b9bc5cb8b9d65695a4e9e75d4a2405ff8fed087791aa1b88ec6eafd'),
      ('public.jenios_robot_r65_read_evolution(jsonb)','c6b2cd9409891d6016f3b2ec5313a09db567f09f8ca7ec7e63319e7351e2a49b'),
      ('public.jenios_robot_r65_append_evolution(jsonb)','4f1b97e6edcb93c19ee05d1e3904b09c69b0d30a382426c964d09fe4236ccf68'),
      ('public.jenios_robot_r65_read_cycle_hypothesis(jsonb)','0df9022a5a6f34433fd49bbeb276e5be4e5953e22681ee2632befdbea0ed1b62'),
      ('public.jenios_robot_r65_record_validation_case(jsonb)','78222d261ba42aa156d55e410d6c4d7cf9f86b34d09fc023396da67c4e0d1bee'),
      ('public.jenios_robot_r65_read_validation_cases(jsonb)','1a72bb7bf8e98779393794814e90de0d3edf447d45c28447bc88a2dfdcc30f66'),
      ('public.jenios_robot_r65_archive_preview(jsonb)','988734da7b56f2f830cc86d8f5a58f44a857651fd1dbbc565dad0cf0d6a9baa9'),
      ('public.jenios_robot_r65_archive_commit(jsonb)','dae24264396ea334f9e4706cd6ffbcb8ad267d952a2cba6dc4749d732c06328c'),
      ('public.jenios_robot_r65_read_archive(jsonb)','4e8d9bb030b8df75f541387adbb3b2123ee08576f31be21793697aaf9677d0c7'),
      ('public.jenios_robot_r65_read_overview(jsonb)','a47c8dcfcddf597062b36536f00f3ac0b9f4b8de9cf5ee04973d8e909875faf0'),
      ('public.jenios_robot_r67_ingest_private_capture(jsonb)','8cda57ef996770e6cafad99bb5fd6b06ea37a12246081e4ff74fc49a54881e03'),
      ('public.jenios_robot_r67_read_private_captures(jsonb)','c935f72e2de63b8ffc12d8d34c8e267a3399cf11798c57577503f9b8f9827869'),
      ('public.jenios_robot_r71_digest(jsonb)','a0244e3f247525076c99efb364763652437538991a6982a33c1bcae1975cfac6'),
      ('public.jenios_robot_r71_fields(jsonb,text[])','b81c110bc9018f193fed894f4f3a41a60a4e725c735c01d5bba30604da2c14ed'),
      ('public.jenios_robot_r71_integer(jsonb,bigint,bigint)','13237bfa140323743eba75ecca8f6cbc119138e2eb1b7d9243d6346717e7cf6e'),
      ('public.jenios_robot_r71_version(jsonb)','90a5be04b1c68e7f76db07efb158b04d767200a671421e20f178677842b95122'),
      ('public.jenios_robot_r71_scope(jsonb)','256693979129bb88493d39a27af4a048f899a21483c9eed1fd9e6aa46f773b61'),
      ('public.jenios_robot_r71_now(jsonb)','f15aebd90dff5816867ec10b6041f2948e01913544388c60983cf16bf0bc5abd'),
      ('public.jenios_robot_r71_ingest_private_observation(jsonb)','9ad6654b560227d975cbb16eac01fc95e8eb8eaebea1e0160638b42b51ea84d4'),
      ('public.jenios_robot_r71_freeze_study(jsonb)','466f77d7ad985389c7491c2a12cf066098b90b6634063411129a11d0d1f7cf5e'),
      ('public.jenios_robot_r71_read_study_page(jsonb)','efff17232141b6c3ba13bced23b6ec6833a66ef3f44224a54a6740751124c918'),
      ('public.jenios_robot_r71_read_state(jsonb)','951936f1ea9e1dbd48f5bc41de7708d93993637be3431fdc51792e99b417f447'),
      ('public.jenios_robot_r71_read_validation_cases(jsonb)','49d1a9b851602057254287b0df49a87e4bcfe3aa830b87131cf8e00beb9e5d45'),
      ('public.jenios_robot_r71_read_overview(jsonb)','c7376520e04a47f61a3f577245e1573ceed7c9a6f9a8c123eed362e083ad8124'),
      ('public.jenios_robot_r71_plan(jsonb)','8907bdcff640f14a14310dd723e5df3558c3958a7958433b73ea3e79dee397bc'),
      ('public.jenios_robot_r71_append_state(jsonb)','5a7099a2b4840f032560661b04e111a5fd22918e4f8eb6f5d66767ec05575597')
    ) expected(signature,expected_hash) LOOP
    object_oid:=pg_catalog.to_regprocedure(r.signature);
    IF object_oid IS NULL THEN RAISE EXCEPTION 'R72_FUNCTION_MISSING'; END IF;
    SELECT encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),p.prosecdef
      INTO body_hash,is_definer FROM pg_catalog.pg_proc p WHERE p.oid=object_oid;
    IF body_hash IS DISTINCT FROM r.expected_hash OR is_definer IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'R72_FUNCTION_DEFINITION_MISMATCH';
    END IF;
    IF pg_catalog.has_function_privilege('anon',object_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',object_oid,'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('service_role',object_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'R72_FUNCTION_PRIVILEGE_MISMATCH';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.jenios_robot_config_r64)<>1
    OR EXISTS(SELECT 1 FROM public.jenios_robot_config_r64
      WHERE generation_enabled OR pricing_approved OR cardinality(allowed_models)<>0
        OR max_request_nano_usd<>0 OR monthly_limit_nano_usd<>0)
    OR EXISTS(SELECT 1 FROM public.jenios_robot_budgets_r64) THEN
    RAISE EXCEPTION 'R72_DISABLED_CONFIG_NOT_CONFIRMED';
  END IF;
  PERFORM pg_catalog.pg_notify('pgrst','reload schema');
END;
$r72_install$;
