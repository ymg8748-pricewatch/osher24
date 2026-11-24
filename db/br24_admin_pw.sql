-- osher24: lets the network manager change branch passwords from inside the site.
-- Run once in the Supabase SQL editor, ONLY after the owner approves.
-- Creates ONE new small table (24 rows at most) holding a salted hash per branch, never the password.
-- RLS is on with no policy and no grant, so the table cannot be read or written through the public API.
-- The site reaches it only through the three token-gated functions below (same br24_chk token check as the other functions).
-- No existing table, policy or function is touched.

create table if not exists public.br24_pw (
  code text primary key,
  h text not null,
  updated_at timestamptz not null default now()
);
alter table public.br24_pw enable row level security;
revoke all on public.br24_pw from anon, authenticated;

create or replace function public.br24_pw_all(tok text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.br24_chk(tok);
  return coalesce((select jsonb_object_agg(code, jsonb_build_object('h', h, 't', updated_at)) from br24_pw), '{}'::jsonb);
end $$;

create or replace function public.br24_pw_set(tok text, c text, hh text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.br24_chk(tok);
  if c !~ '^[0-9]{3}$' or hh !~ '^[0-9a-f]{64}$' then raise exception 'bad input'; end if;
  insert into br24_pw(code, h, updated_at) values (c, hh, now())
    on conflict (code) do update set h = excluded.h, updated_at = now();
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public.br24_pw_del(tok text, c text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.br24_chk(tok);
  delete from br24_pw where code = c;
  return '{"ok":true}'::jsonb;
end $$;

revoke all on function public.br24_pw_all(text), public.br24_pw_set(text, text, text), public.br24_pw_del(text, text) from public;
grant execute on function public.br24_pw_all(text), public.br24_pw_set(text, text, text), public.br24_pw_del(text, text) to anon;
