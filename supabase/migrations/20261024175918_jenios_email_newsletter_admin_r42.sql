-- R42: audited, optimistic editing for the existing approved newsletter model.
BEGIN;
ALTER TABLE public.jenios_newsletter_editions_b305
 ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);

CREATE OR REPLACE FUNCTION public.jenios_manage_newsletter_r42(
 p_actor_id uuid,p_action text,p_edition_id uuid,p_expected_revision integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE edition public.jenios_newsletter_editions_b305%ROWTYPE;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'NEWSLETTER_R42_SERVICE_REQUIRED' USING errcode='42501'; END IF;
 -- The API verifies the current non-anonymous Master via Auth.getUser.
 -- Audit FK validates actor existence without granting direct Auth table reads.
 IF p_actor_id IS NULL THEN RAISE EXCEPTION 'NEWSLETTER_R42_ACTOR_REQUIRED' USING errcode='42501'; END IF;
 IF p_action NOT IN ('create','save','approve','retire') OR p_action IS NULL
  THEN RAISE EXCEPTION 'NEWSLETTER_R42_ACTION_INVALID' USING errcode='22023'; END IF;
 IF p_action IN ('create','save') THEN
  IF jsonb_typeof(p_payload)<>'object' OR jsonb_typeof(p_payload->'items')<>'array'
     OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 5
     OR (p_payload->>'edition_key') !~ '^[a-z0-9][a-z0-9-]{2,119}$'
     OR p_payload->>'subject' IS DISTINCT FROM 'JENIOS | Radar de Mercado'
     OR p_payload->>'scheduled_at' IS NULL
  THEN RAISE EXCEPTION 'NEWSLETTER_R42_PAYLOAD_INVALID' USING errcode='22023'; END IF;
 END IF;
 IF p_action='create' THEN
  IF p_edition_id IS NOT NULL OR p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'NEWSLETTER_R42_CONFLICT'; END IF;
  INSERT INTO public.jenios_newsletter_editions_b305(edition_key,subject,items,scheduled_at)
  VALUES(p_payload->>'edition_key',p_payload->>'subject',p_payload->'items',(p_payload->>'scheduled_at')::timestamptz)
  RETURNING * INTO edition;
 ELSE
  SELECT * INTO edition FROM public.jenios_newsletter_editions_b305 WHERE id=p_edition_id FOR UPDATE;
  IF NOT FOUND OR p_expected_revision IS NULL OR edition.revision<>p_expected_revision
   OR edition.status='retired' OR (p_action IN ('save','approve') AND edition.status<>'draft')
  THEN RAISE EXCEPTION 'NEWSLETTER_R42_CONFLICT'; END IF;
  IF p_action='save' THEN
   IF p_payload->>'edition_key' IS DISTINCT FROM edition.edition_key THEN RAISE EXCEPTION 'NEWSLETTER_R42_CONFLICT'; END IF;
   UPDATE public.jenios_newsletter_editions_b305 SET subject=p_payload->>'subject',items=p_payload->'items',
    scheduled_at=(p_payload->>'scheduled_at')::timestamptz,revision=revision+1,updated_at=clock_timestamp()
   WHERE id=p_edition_id RETURNING * INTO edition;
  ELSIF p_action='approve' THEN
   IF edition.scheduled_at<=now() THEN RAISE EXCEPTION 'NEWSLETTER_R42_SCHEDULE'; END IF;
   UPDATE public.jenios_newsletter_editions_b305 SET status='approved',revision=revision+1,updated_at=clock_timestamp()
   WHERE id=p_edition_id RETURNING * INTO edition;
  ELSE
   UPDATE public.jenios_newsletter_editions_b305 SET status='retired',revision=revision+1,updated_at=clock_timestamp()
   WHERE id=p_edition_id RETURNING * INTO edition;
  END IF;
 END IF;
 INSERT INTO public.jenios_admin_audit(actor_id,action,target)
 VALUES(p_actor_id,'newsletter.'||p_action,jsonb_build_object('editionId',edition.id,'editionKey',edition.edition_key,
  'revision',edition.revision,'status',edition.status,'scheduledAt',edition.scheduled_at));
 RETURN to_jsonb(edition);
END $$;
REVOKE ALL ON FUNCTION public.jenios_manage_newsletter_r42(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_manage_newsletter_r42(uuid,text,uuid,integer,jsonb) TO service_role;
COMMIT;
