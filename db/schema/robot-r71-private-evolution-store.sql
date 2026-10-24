-- R71 REVIEW ONLY. Apply only to explicitly selected disposable PostgreSQL.
-- Extends R67 by atomic, signed contextual pairs and a separate bounded policy
-- history. No old R67 enrichment, R64/R65 rewrite, hosted install or execution.
-- App verification owns Ed25519/JS canonical digests. SQL owns admission time,
-- immutable membership and SHA256_POSTGRESQL_JSONB_TEXT_UTF8_V1 state digests.
BEGIN;

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_digest(value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path='' AS $$
  SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex');
$$;
CREATE OR REPLACE FUNCTION public.jenios_robot_r71_fields(value jsonb, names text[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  RETURN (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(names) AND value ?& names;
END; $$;
CREATE OR REPLACE FUNCTION public.jenios_robot_r71_integer(value jsonb, minimum bigint, maximum bigint)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'number' OR coalesce(value#>>'{}','') !~ '^-?[0-9]{1,16}$'
    THEN RETURN false; END IF;
  RETURN (value#>>'{}')::numeric BETWEEN minimum AND maximum;
END; $$;
CREATE OR REPLACE FUNCTION public.jenios_robot_r71_version(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.jenios_robot_r71_fields(value,ARRAY['versionId','activationGeneration','forwardPositionOpen'])
    OR NOT public.jenios_robot_r71_integer(value->'activationGeneration',0,31)
    OR jsonb_typeof(value->'versionId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(value->'forwardPositionOpen') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
  RETURN (value->'forwardPositionOpen'='false'::jsonb AND value->>'versionId'='private:r71-reference-v1')
    OR (value->'forwardPositionOpen'='true'::jsonb AND value->>'versionId'='private:r71-position-context-v1');
END; $$;
CREATE OR REPLACE FUNCTION public.jenios_robot_r71_scope(value jsonb)
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

CREATE TABLE IF NOT EXISTS public.jenios_robot_private_evolution_r71 (
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
CREATE TABLE IF NOT EXISTS public.jenios_robot_private_observations_r71 (
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
CREATE INDEX IF NOT EXISTS jenios_robot_private_observations_r71_period
  ON public.jenios_robot_private_observations_r71(scope_id,source_id,captured_at_ms,event_id);
CREATE TABLE IF NOT EXISTS public.jenios_robot_private_studies_r71 (
  scope_id text NOT NULL, source_id text NOT NULL, source_key_sha256 text NOT NULL,
  snapshot_id uuid NOT NULL, operation_id text NOT NULL CHECK(operation_id ~ '^op:[a-f0-9]{32}$'),
  request_digest text NOT NULL, snapshot jsonb NOT NULL, frozen_at_ms bigint NOT NULL,
  PRIMARY KEY(scope_id,source_id,snapshot_id), UNIQUE(scope_id,source_id,operation_id)
);
CREATE TABLE IF NOT EXISTS public.jenios_robot_private_study_members_r71 (
  scope_id text NOT NULL, source_id text NOT NULL, snapshot_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 257), event_id text NOT NULL,
  record_digest text NOT NULL, annotation_digest text NOT NULL, entry_count integer NOT NULL,
  PRIMARY KEY(scope_id,source_id,snapshot_id,ordinal), UNIQUE(scope_id,source_id,snapshot_id,event_id),
  FOREIGN KEY(scope_id,source_id,snapshot_id) REFERENCES public.jenios_robot_private_studies_r71(scope_id,source_id,snapshot_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(scope_id,source_id,event_id) REFERENCES public.jenios_robot_private_observations_r71(scope_id,source_id,event_id)
);
CREATE TABLE IF NOT EXISTS public.jenios_robot_private_validation_cases_r71 (
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_now(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.jenios_robot_r71_fields(p_input,ARRAY['scopeId','sourceId','sourceKeySha256'])
    OR NOT public.jenios_robot_r71_scope(p_input) THEN RAISE EXCEPTION 'R71_DATABASE_SCOPE'; END IF;
  RETURN jsonb_build_object('nowMs',floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
END; $$;

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_ingest_private_observation(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_freeze_study(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_read_study_page(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_read_state(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_read_validation_cases(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_read_overview(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_plan(value jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r71_append_state(p_input jsonb)
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
COMMIT;
