-- R64 REVIEW ONLY. Apply only to an explicitly selected disposable/QA Platform DB.
-- This file is not an applied Supabase migration and creates no cron/provider call.
-- No customer wallet, broker order, real/Paper execution or production telemetry.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jenios_robot_events_r64 (
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
CREATE INDEX IF NOT EXISTS jenios_robot_events_r64_period
  ON public.jenios_robot_events_r64(scope_id,occurred_at_ms,event_id);
CREATE TABLE IF NOT EXISTS public.jenios_robot_config_r64 (
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
CREATE TABLE IF NOT EXISTS public.jenios_robot_budgets_r64 (
  month text PRIMARY KEY CHECK(month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  reserved_nano_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_nano_usd>=0),
  spent_nano_usd bigint NOT NULL DEFAULT 0 CHECK(spent_nano_usd>=0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.jenios_robot_cycles_r64 (
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
CREATE UNIQUE INDEX IF NOT EXISTS jenios_robot_cycles_r64_provider_response
  ON public.jenios_robot_cycles_r64(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jenios_robot_cycles_r64_reports
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_ingest(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_read_receipts(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_claim_cycle(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_read_cycle(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_analyst_policy(p_input jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('generationEnabled',generation_enabled,'requiresReconciliation',requires_reconciliation,
    'allowedModels',allowed_models,'pricingVersion',pricing_version,'pricingApproved',pricing_approved,
    'ratesVerifiedAt',rates_verified_at,'maxRequestProviderNanoUsd',max_request_nano_usd,
    'monthlyProviderLimitNanoUsd',monthly_limit_nano_usd)
    FROM public.jenios_robot_config_r64 WHERE singleton=true;
$$;

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_reserve_dispatch(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_complete_cycle(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r64_read_reports(p_input jsonb)
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
COMMIT;
