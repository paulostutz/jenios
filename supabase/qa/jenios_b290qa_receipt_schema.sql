-- B290 QA ONLY, no payment provider, no Pix confirmation RPC.
-- Requires B289 canonical PAY QA schema. Does not write or confirm payments.
begin;
alter table public.jenios_pay_payments add column if not exists bank_end_to_end_id text;
create unique index if not exists jenios_b290qa_unique_bank_e2e
 on public.jenios_pay_payments(bank_end_to_end_id)
 where bank_end_to_end_id is not null;
alter table public.jenios_pay_payments
 add constraint jenios_b290qa_bank_end_to_end_format
 check(bank_end_to_end_id is null or bank_end_to_end_id ~ '^E[a-zA-Z0-9]{31}$');
-- No financial insert/update for anon/authenticated.
revoke insert,update,delete on public.jenios_pay_payments from public,anon,authenticated;
grant select,insert,update on public.jenios_pay_payments to service_role;
comment on column public.jenios_pay_payments.bank_end_to_end_id is
 'QA evidence field only; a value cannot be inserted by browser or interpreted as a bank attestation without actual Inter verification';
commit;