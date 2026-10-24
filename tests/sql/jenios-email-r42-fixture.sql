-- LOCAL/CI ONLY. The runner requires a loopback server, an empty database,
-- and the jenios_email_r42_ database-name prefix before loading this fixture.
-- This is not a Supabase migration and must never be applied to a hosted project.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
 id uuid PRIMARY KEY,
 email text,
 email_confirmed_at timestamptz,
 raw_app_meta_data jsonb NOT NULL DEFAULT '{}',
 raw_user_meta_data jsonb NOT NULL DEFAULT '{}',
 is_anonymous boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.jenios_learning_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 state jsonb NOT NULL DEFAULT '{}',
 revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_learning_state ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.jenios_learning_state TO service_role;
CREATE TABLE public.jenios_admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL,
 target jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jenios_admin_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.jenios_admin_audit TO service_role;
