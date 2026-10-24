-- R65 REVIEW ONLY; additive after robot-r64-operational-store.sql.
-- Apply only to an explicitly selected disposable QA database. No production,
-- hosted Supabase, provider, customer wallet, order, purge or scheduler operation.
-- Archives are LOGICAL COPIES: originals remain and no space is reclaimed.
-- Digest format: SHA-256 of PostgreSQL jsonb::text encoded as UTF-8. This is not
-- the JavaScript canonical digest used by R64 telemetry/input envelopes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.jenios_robot_observation_provenance_r65 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  event_id text NOT NULL CHECK(event_id ~ '^evt:[a-f0-9]{16}$'),
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  provenance jsonb NOT NULL CHECK(jsonb_typeof(provenance)='object' AND octet_length(provenance::text)<=8192),
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_id,event_id),
  FOREIGN KEY(scope_id,event_id) REFERENCES public.jenios_robot_events_r64(scope_id,event_id)
);

CREATE TABLE IF NOT EXISTS public.jenios_robot_reconciliations_r65 (
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
CREATE UNIQUE INDEX IF NOT EXISTS jenios_robot_reconciliations_r65_response
  ON public.jenios_robot_reconciliations_r65(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jenios_robot_reconciliations_r65_scope
  ON public.jenios_robot_reconciliations_r65(scope_id,resolved_at DESC,cycle_id);

CREATE TABLE IF NOT EXISTS public.jenios_robot_archives_r65 (
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
CREATE INDEX IF NOT EXISTS jenios_robot_archives_r65_scope
  ON public.jenios_robot_archives_r65(scope_id,created_at DESC,archive_id);
CREATE TABLE IF NOT EXISTS public.jenios_robot_archive_items_r65 (
  scope_id text NOT NULL CHECK(scope_id ~ '^scope:[a-f0-9]{16}$'),
  item_kind text NOT NULL CHECK(item_kind IN('CYCLE','EVENT')),
  item_id text NOT NULL,
  archive_id uuid NOT NULL REFERENCES public.jenios_robot_archives_r65(archive_id),
  PRIMARY KEY(scope_id,item_kind,item_id)
);

CREATE TABLE IF NOT EXISTS public.jenios_robot_evolution_r65 (
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
CREATE TABLE IF NOT EXISTS public.jenios_robot_validation_cases_r65 (
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_digest(value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path='' AS $$
  SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex');
$$;

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_ingest_observation(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_guard_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF OLD.status<>'PREVIEW' OR NEW.status<>'COMMITTED'
    OR (to_jsonb(NEW)-ARRAY['status','operation_id','actor_id','request_digest','committed_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','operation_id','actor_id','request_digest','committed_at'])
    THEN RAISE EXCEPTION 'R65_DATABASE_ARCHIVE_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS jenios_robot_r65_guard_archive ON public.jenios_robot_archives_r65;
CREATE TRIGGER jenios_robot_r65_guard_archive BEFORE UPDATE ON public.jenios_robot_archives_r65
  FOR EACH ROW EXECUTE FUNCTION public.jenios_robot_r65_guard_archive();

-- The worker gains only a disable capability, never approval or funding rights.
CREATE OR REPLACE FUNCTION public.jenios_robot_r65_disable_only()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user='service_role' AND NEW.generation_enabled IS DISTINCT FROM false
    THEN RAISE EXCEPTION 'R65_DATABASE_POLICY_ENABLE_FORBIDDEN'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS jenios_robot_r65_disable_only ON public.jenios_robot_config_r64;
CREATE TRIGGER jenios_robot_r65_disable_only BEFORE UPDATE OF generation_enabled
  ON public.jenios_robot_config_r64 FOR EACH ROW EXECUTE FUNCTION public.jenios_robot_r65_disable_only();
GRANT UPDATE(generation_enabled) ON public.jenios_robot_config_r64 TO service_role;

-- Late R64 workers cannot rewrite a reconciled/archived historical cycle.
-- The response lock also serializes identity checks across R64 and R65 ledgers.
CREATE OR REPLACE FUNCTION public.jenios_robot_r65_guard_cycle()
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
DROP TRIGGER IF EXISTS jenios_robot_r65_guard_cycle ON public.jenios_robot_cycles_r64;
CREATE TRIGGER jenios_robot_r65_guard_cycle BEFORE INSERT OR UPDATE OR DELETE
  ON public.jenios_robot_cycles_r64 FOR EACH ROW EXECUTE FUNCTION public.jenios_robot_r65_guard_cycle();

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_reconcile_cost(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_read_evolution(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_append_evolution(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_read_cycle_hypothesis(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_record_validation_case(p_input jsonb)
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
CREATE OR REPLACE FUNCTION public.jenios_robot_r65_read_validation_cases(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_archive_preview(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_archive_commit(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_read_archive(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r65_read_overview(p_input jsonb)
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
COMMIT;
