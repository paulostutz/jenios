-- R67 REVIEW ONLY: isolated original-private-core SYNTHETIC batches.
-- Validate only in an explicitly selected disposable local PostgreSQL database.
-- No insert/read dependency on R64 observations, R65 evolution, provider budgets,
-- customer data or order tables. Never apply to hosted databases in this block.
-- Signature authentication and JavaScript canonical digests belong to the
-- application verifier. SQL checks shape/bindings and real database-clock TTL;
-- jsonb::text is NOT substituted for any JavaScript signature/digest format.
BEGIN;

CREATE TABLE IF NOT EXISTS public.jenios_robot_private_captures_r67 (
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
CREATE INDEX IF NOT EXISTS jenios_robot_private_captures_r67_recent
  ON public.jenios_robot_private_captures_r67(scope_id,source_id,admitted_at_ms DESC,event_id);

ALTER TABLE public.jenios_robot_private_captures_r67 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jenios_robot_private_captures_r67 FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.jenios_robot_private_captures_r67 TO service_role;

CREATE OR REPLACE FUNCTION public.jenios_robot_r67_ingest_private_capture(p_input jsonb)
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

CREATE OR REPLACE FUNCTION public.jenios_robot_r67_read_private_captures(p_input jsonb)
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
COMMIT;
