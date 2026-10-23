-- B305-R23 — durable University milestones from jenios_learning_state.
BEGIN;
ALTER TABLE public.jenios_transactional_email_outbox_b305
 ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.jenios_transactional_email_outbox_b305
 DROP CONSTRAINT IF EXISTS jenios_b305_transactional_payload_object;
ALTER TABLE public.jenios_transactional_email_outbox_b305
 ADD CONSTRAINT jenios_b305_transactional_payload_object
 CHECK (jsonb_typeof(payload)='object');

ALTER TABLE public.jenios_transactional_email_outbox_b305
 DROP CONSTRAINT IF EXISTS jenios_transactional_email_outbox_b305_event_kind_check;
ALTER TABLE public.jenios_transactional_email_outbox_b305
 ADD CONSTRAINT jenios_transactional_email_outbox_b305_event_kind_check
 CHECK (event_kind IN ('social_welcome','plan_activated','plan_cancel_scheduled','plan_cancelled','plan_reactivated','plan_changed','university_milestone'));

CREATE OR REPLACE FUNCTION public.jenios_university_completed_lessons_b305(p_state jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT count(DISTINCT e.value)::integer
 FROM jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(p_state->'completedLessons')='array'
   THEN p_state->'completedLessons' ELSE '[]'::jsonb END
 ) AS e(value)
 WHERE e.value IN ('mercado','day-swing','risco','candles','tempo','contexto',
  'ordens','tamanho','plano','rompimentos','correcoes','indicadores',
  'estatistica','backtest','automacao');
$$;

CREATE OR REPLACE FUNCTION public.jenios_university_completed_tracks_b305(p_state jsonb)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE lessons jsonb;
BEGIN
 lessons:=CASE WHEN jsonb_typeof(p_state->'completedLessons')='array'
  THEN p_state->'completedLessons' ELSE '[]'::jsonb END;
 RETURN
  (CASE WHEN lessons @> '["mercado","day-swing","risco"]'::jsonb THEN 1 ELSE 0 END)+
  (CASE WHEN lessons @> '["candles","tempo","contexto"]'::jsonb THEN 1 ELSE 0 END)+
  (CASE WHEN lessons @> '["ordens","tamanho","plano"]'::jsonb THEN 1 ELSE 0 END)+
  (CASE WHEN lessons @> '["rompimentos","correcoes","indicadores"]'::jsonb THEN 1 ELSE 0 END)+
  (CASE WHEN lessons @> '["estatistica","backtest","automacao"]'::jsonb THEN 1 ELSE 0 END);
END $$;

CREATE OR REPLACE FUNCTION public.jenios_queue_university_milestones_b305()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_count integer; new_count integer; track_count integer; threshold integer;
BEGIN
 IF NEW.revision<>OLD.revision+1 OR NEW.state->>'version'<>'r26.1' THEN RETURN NEW; END IF;
 old_count:=CASE WHEN OLD.state->>'version'='r26.1'
  THEN public.jenios_university_completed_lessons_b305(OLD.state) ELSE 0 END;
 new_count:=public.jenios_university_completed_lessons_b305(NEW.state);
 IF new_count<old_count OR new_count>15 THEN RETURN NEW; END IF;
 track_count:=public.jenios_university_completed_tracks_b305(NEW.state);
 FOREACH threshold IN ARRAY ARRAY[5,10,15] LOOP
  IF old_count<threshold AND new_count>=threshold THEN
   INSERT INTO public.jenios_transactional_email_outbox_b305(
    user_id,event_kind,reference_key,status,payload
   ) VALUES (
    NEW.user_id,'university_milestone',
    NEW.user_id::text||':university:lessons:'||threshold::text,
    'pending',
    jsonb_build_object(
     'milestoneKey','lessons-'||threshold::text,
     'curriculumVersion','r26.1',
     'completedLessons',new_count,'totalLessons',15,
     'completedTracks',track_count,'totalTracks',5
    )
   )
   ON CONFLICT(event_kind,reference_key) DO NOTHING;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.jenios_university_completed_lessons_b305(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_university_completed_tracks_b305(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jenios_queue_university_milestones_b305() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jenios_university_completed_lessons_b305(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_university_completed_tracks_b305(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.jenios_queue_university_milestones_b305() TO service_role;

DROP TRIGGER IF EXISTS jenios_b305_university_milestones ON public.jenios_learning_state;
CREATE TRIGGER jenios_b305_university_milestones
 AFTER UPDATE OF state,revision ON public.jenios_learning_state
 FOR EACH ROW WHEN (OLD.state IS DISTINCT FROM NEW.state)
 EXECUTE FUNCTION public.jenios_queue_university_milestones_b305();
COMMIT;
