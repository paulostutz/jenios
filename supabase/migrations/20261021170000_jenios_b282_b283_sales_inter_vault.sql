-- JENIOS B282–B284: isolated SALES AI budget and Bank Inter vault setup.
-- Install ONLY in JENIOS Social homologacao first. NEVER install in CHEFE or Letter.
-- These RPCs are service_role-only; no public/authenticated Execute. No charge is created.
create table if not exists public.jenios_sales_budget_b282(
 month text primary key check(month ~ '^[0-9]{4}-[0-9]{2}$'),
 reserved_micro_usd bigint not null default 0 check(reserved_micro_usd>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.jenios_sales_visitor_b282(
 month text not null,visitor_hash text not null check(visitor_hash ~ '^[a-f0-9]{64}$'),
 hour text not null check(hour ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$'),
 calls integer not null default 0 check(calls between 0 and 12),
 primary key(month,visitor_hash,hour)
);
alter table public.jenios_sales_budget_b282 enable row level security;
alter table public.jenios_sales_visitor_b282 enable row level security;
revoke all on public.jenios_sales_budget_b282,public.jenios_sales_visitor_b282 from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.jenios_sales_budget_b282,public.jenios_sales_visitor_b282 to service_role;
create or replace function public.jenios_sales_budget_hold_b282(
 p_month text,p_visitor_hash text,p_hour text,p_amount_micro_usd bigint,p_limit_micro_usd bigint
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare n integer; used bigint;
begin
 if p_month is null or p_month !~ '^[0-9]{4}-[0-9]{2}$'
  or p_hour !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$'
  or left(p_hour,7)<>p_month or p_visitor_hash !~ '^[a-f0-9]{64}$'
  or p_amount_micro_usd<>20000 or p_limit_micro_usd<1000000 or p_limit_micro_usd>1000000000
 then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('jenios-sales-budget:'||p_month,0));
 select coalesce(reserved_micro_usd,0) into used from public.jenios_sales_budget_b282 where month=p_month;
 if coalesce(used,0)+p_amount_micro_usd>p_limit_micro_usd then return false;end if;
 select coalesce(calls,0) into n from public.jenios_sales_visitor_b282 where month=p_month and visitor_hash=p_visitor_hash and hour=p_hour;
 if coalesce(n,0)>=12 then return false;end if;
 insert into public.jenios_sales_budget_b282(month,reserved_micro_usd) values(p_month,p_amount_micro_usd)
 on conflict(month) do update set reserved_micro_usd=jenios_sales_budget_b282.reserved_micro_usd+excluded.reserved_micro_usd,updated_at=now();
 insert into public.jenios_sales_visitor_b282(month,visitor_hash,hour,calls) values(p_month,p_visitor_hash,p_hour,1)
 on conflict(month,visitor_hash,hour) do update set calls=jenios_sales_visitor_b282.calls+1;
 return true;
end $$;
revoke all on function public.jenios_sales_budget_hold_b282(text,text,text,bigint,bigint) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_sales_budget_hold_b282(text,text,text,bigint,bigint) to service_role;

create table if not exists public.jenios_inter_settings_b283(
 singleton boolean primary key default true check(singleton),
 secret_id uuid not null,
 client_id_suffix text not null,
 pix_key_suffix text not null,
 cert_fingerprint_sha256 text not null,
 cert_expires_at timestamptz not null,
 bank_authenticated boolean not null default false,
 configuration_version integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.jenios_inter_settings_b283 enable row level security;
revoke all on public.jenios_inter_settings_b283 from PUBLIC,anon,authenticated;
grant select,insert,update on public.jenios_inter_settings_b283 to service_role;
create or replace function public.jenios_inter_status_b283()
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.jenios_inter_settings_b283%rowtype;
begin
 select * into r from public.jenios_inter_settings_b283 where singleton=true;
 if not found then return jsonb_build_object('configured',false,'bankAuthenticated',false,'chargesEnabled',false,'status','not_configured');end if;
 return jsonb_build_object('configured',true,'clientIdLast4',r.client_id_suffix,
  'pixKeyLast4',r.pix_key_suffix,'certificateExpiresAt',r.cert_expires_at,
  'fingerprintSha256',r.cert_fingerprint_sha256,'bankAuthenticated',r.bank_authenticated,
  'chargesEnabled',false,'configurationVersion',r.configuration_version,'updatedAt',r.updated_at,
  'status','configuration_saved_pending_payment_homologation');
end $$;
revoke all on function public.jenios_inter_status_b283() from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_status_b283() to service_role;
create or replace function public.jenios_inter_store_b283(
 p_client_id text,p_client_secret text,p_certificate text,p_private_key text,
 p_pix_key text,p_account_number text,p_cert_fingerprint text,p_cert_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,vault as $$
declare r public.jenios_inter_settings_b283%rowtype; bundle jsonb; sid uuid;
begin
 if length(trim(coalesce(p_client_id,''))) not between 8 and 200
  or length(coalesce(p_client_secret,'')) not between 16 and 500
  or p_client_id ~ '[[:space:]]' or p_client_secret ~ '[[:cntrl:]]'
  or p_certificate not like '%-----BEGIN CERTIFICATE-----%'
  or (p_private_key not like '%-----BEGIN PRIVATE KEY-----%'
   and p_private_key not like '%-----BEGIN RSA PRIVATE KEY-----%'
   and p_private_key not like '%-----BEGIN EC PRIVATE KEY-----%')
  or length(p_certificate) not between 100 and 32768
  or length(p_private_key) not between 100 and 32768
  or length(trim(coalesce(p_pix_key,''))) not between 4 and 140
  or p_cert_fingerprint !~ '^[a-f0-9]{64}$'
  or p_cert_expires_at <= now() or p_cert_expires_at > now()+interval '4 years'
  or length(coalesce(p_account_number,''))>60
 then raise exception 'JENIOS_INTER_INVALID_MATERIAL' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('jenios-inter-b283',0));
 select * into r from public.jenios_inter_settings_b283 where singleton=true for update;
 bundle:=jsonb_build_object('client_id',trim(p_client_id),'client_secret',p_client_secret,
  'certificate',p_certificate,'private_key',p_private_key,'pix_key',trim(p_pix_key),
  'account_number',coalesce(p_account_number,''),'purpose','jenios_pix_configuration_only');
 if not found then
  select vault.create_secret(bundle::text,'jenios_b283_inter_pix','JENIOS Inter Pix, separate from Chefe and Letter') into sid;
  insert into public.jenios_inter_settings_b283(singleton,secret_id,client_id_suffix,
   pix_key_suffix,cert_fingerprint_sha256,cert_expires_at)
  values(true,sid,right(trim(p_client_id),4),right(trim(p_pix_key),4),p_cert_fingerprint,p_cert_expires_at);
 else
  perform vault.update_secret(r.secret_id,bundle::text);
  update public.jenios_inter_settings_b283
   set client_id_suffix=right(trim(p_client_id),4),pix_key_suffix=right(trim(p_pix_key),4),
    cert_fingerprint_sha256=p_cert_fingerprint,cert_expires_at=p_cert_expires_at,
    bank_authenticated=false,configuration_version=configuration_version+1,updated_at=now()
  where singleton=true;
 end if;
 return public.jenios_inter_status_b283();
end $$;
revoke all on function public.jenios_inter_store_b283(text,text,text,text,text,text,text,timestamptz) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_store_b283(text,text,text,text,text,text,text,timestamptz) to service_role;

create or replace function public.jenios_inter_load_b283()
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public,vault as $$
declare sid uuid; decrypted jsonb;
begin
 select secret_id into sid from public.jenios_inter_settings_b283 where singleton=true;
 if sid is null then return null; end if;
 select decrypted_secret::jsonb into decrypted from vault.decrypted_secrets where id=sid;
 if decrypted is null then raise exception 'JENIOS_INTER_VAULT_UNAVAILABLE';end if;
 return decrypted;
end $$;
revoke all on function public.jenios_inter_load_b283() from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_load_b283() to service_role;

create or replace function public.jenios_inter_mark_auth_b283(p_authenticated boolean)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.jenios_inter_settings_b283 set bank_authenticated=p_authenticated,updated_at=now() where singleton=true;
 return public.jenios_inter_status_b283();
end $$;
revoke all on function public.jenios_inter_mark_auth_b283(boolean) from PUBLIC,anon,authenticated;
grant execute on function public.jenios_inter_mark_auth_b283(boolean) to service_role;
