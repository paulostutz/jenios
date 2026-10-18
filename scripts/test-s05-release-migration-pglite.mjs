import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const moduleId=process.env.JENIOS_PGLITE_MODULE || '@electric-sql/pglite';
const {PGlite}=await import(moduleId);

const db=new PGlite();
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
let passed=0;
const check=(name,cond)=>{assert.ok(cond,name);passed++;console.log('PASS '+name)};
try {
  const init=[
    "CREATE ROLE anon;",
    "CREATE ROLE authenticated;",
    "CREATE ROLE service_role BYPASSRLS;",
    "CREATE SCHEMA auth;",
    "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    "CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;",
    "GRANT USAGE ON SCHEMA auth TO authenticated;",
    "GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO authenticated;",
    "CREATE TABLE auth.users(id uuid PRIMARY KEY,is_anonymous boolean NOT NULL DEFAULT false,raw_user_meta_data jsonb,last_sign_in_at timestamptz);",
    "CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),handle text UNIQUE,display_name text NOT NULL DEFAULT '');",
    "CREATE TABLE public.posts(id uuid PRIMARY KEY,author_id uuid);",
    "GRANT USAGE ON SCHEMA public TO authenticated,anon,service_role;",
    "GRANT SELECT ON public.profiles TO authenticated,anon;"
  ].join('\n');
  await db.ex¶»§q«^