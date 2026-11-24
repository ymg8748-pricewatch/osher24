-- osher24: read-only functions for the branch-vs-branch screens (war, "where am I expensive", promos, department list).
-- Run once in the Supabase SQL editor, ONLY after the owner approves. They only SELECT from the existing table `br24`.
-- They use the SAME token check as br24_find (the hash of the token must exist in table br24_token).
-- Nothing else is created or changed. No table, no policy, no grant to anything but `anon` execute on the new functions.

create or replace function public.br24_chk(tok text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from br24_token where h = encode(sha256(convert_to(tok, 'utf8')), 'hex')) then raise exception 'denied'; end if;
end $$;

-- mode: 1 = price including promotions, 0 = shelf price only
create or replace function public.br24_war(tok text, me text, mode int default 1) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ix int := case when mode = 0 then 0 else 1 end; res jsonb;
begin
  perform public.br24_chk(tok);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.avg_gap desc), '[]'::jsonb) into res from (
    select s.br, count(*)::int as n,
           count(*) filter (where s.o - s.m > 0.004)::int as cheaper,   -- I am cheaper than that branch
           count(*) filter (where abs(s.o - s.m) <= 0.004)::int as equal,
           count(*) filter (where s.m - s.o > 0.004)::int as pricier,   -- I am more expensive
           round(avg((s.o - s.m) / s.o * 100)::numeric, 2)::float8 as avg_gap
    from (select v.key as br, (t.d->me->>ix)::float8 as m, (v.value->>ix)::float8 as o
          from br24 t, jsonb_each(t.d) v
          where t.d->me is not null and v.key <> me) s
    where s.o > 0 and s.m > 0 group by s.br) x;
  return jsonb_build_object('rows', res);
end $$;

-- Products where I am more expensive than the cheapest other branch (or than one chosen branch `vs`).
-- minc: minimum gap in shekels; minp: minimum gap in percent of the cheaper price; sort: 'gap' | 'n' (number of cheaper branches)
create or replace function public.br24_exp(tok text, me text, vs text default '', minc numeric default 1,
                                           minp numeric default 0, mode int default 1, page int default 0,
                                           sort text default 'gap', q text default '') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ix int := case when mode = 0 then 0 else 1 end; res jsonb; tot int;
begin
  perform public.br24_chk(tok);
  page := greatest(0, least(page, 1000)); minc := greatest(0.01, least(coalesce(minc, 1), 1000)); minp := greatest(0, least(coalesce(minp, 0), 1000));
  with z as (
    select t.code, t.name, (t.d->me->>ix)::float8 as m, c.k, c.p, c.n
    from br24 t
    cross join lateral (
      select (array_agg(v.key order by (v.value->>ix)::float8))[1] as k,
             min((v.value->>ix)::float8) as p,
             count(*) filter (where (t.d->me->>ix)::float8 - (v.value->>ix)::float8 >= minc - 0.004) as n
      from jsonb_each(t.d) v
      where v.key <> me and (vs = '' or v.key = vs) and (v.value->>ix)::float8 > 0) c
    where t.d->me is not null and (q = '' or t.name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%')
  ), f as (
    select * from z where p > 0 and m - p >= minc - 0.004 and (m - p) / p * 100 >= minp - 0.0001
  )
  select (select count(*) from f), coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into tot, res from (
    select code, name, m, k as cheapest, p as cheapest_price, n::int as n_cheaper
    from f order by case when sort = 'n' then n end desc nulls last, m - p desc, name, code
    limit 80 offset page * 80) r;
  return jsonb_build_object('total', tot, 'rows', res, 'more', (page + 1) * 80 < tot);
end $$;

-- Active promotions in one branch. d[branch] = [shelf, effective, minQty, text, kind]
create or replace function public.br24_promos(tok text, br text, page int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb; tot int;
begin
  perform public.br24_chk(tok);
  page := greatest(0, least(page, 1000));
  select count(*) into tot from br24 t where jsonb_array_length(coalesce(t.d->br, '[]'::jsonb)) > 2 and coalesce(t.d->br->>3, '') <> '';
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into res from (
    select code, name, (t.d->br->>0)::float8 as shelf, (t.d->br->>1)::float8 as eff,
           (t.d->br->>2)::float8 as qty, t.d->br->>3 as text, (t.d->br->>4)::int as kind
    from br24 t
    where jsonb_array_length(coalesce(t.d->br, '[]'::jsonb)) > 2 and coalesce(t.d->br->>3, '') <> ''
    order by name, code limit 100 offset page * 100) r;
  return jsonb_build_object('total', tot, 'rows', res, 'more', (page + 1) * 100 < tot);
end $$;

-- Compact catalog for the department screens, from the point of view of branch `me`.
-- row = [code, name, my price, cheapest other price, cheapest branch, number of branches cheaper than me]
-- 3000 rows per page, so the whole catalog is about 4 calls, cached 5 minutes at the edge.
create or replace function public.br24_list(tok text, me text, mode int default 1, page int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ix int := case when mode = 0 then 0 else 1 end; res jsonb; tot int;
begin
  perform public.br24_chk(tok);
  page := greatest(0, least(page, 100));
  select count(*) into tot from br24 t where t.d->me is not null;
  select coalesce(jsonb_agg(jsonb_build_array(r.code, r.name, r.m, r.p, r.k, r.n) order by r.code), '[]'::jsonb) into res from (
    select t.code, t.name, (t.d->me->>ix)::float8 as m, c.p, c.k, c.n::int as n
    from (select * from br24 where d->me is not null order by code limit 3000 offset page * 3000) t
    cross join lateral (
      select min((v.value->>ix)::float8) as p,
             (array_agg(v.key order by (v.value->>ix)::float8))[1] as k,
             count(*) filter (where (v.value->>ix)::float8 < (t.d->me->>ix)::float8 - 0.004) as n
      from jsonb_each(t.d) v where v.key <> me and (v.value->>ix)::float8 > 0) c
    where (t.d->me->>ix)::float8 > 0 and c.p is not null) r;
  return jsonb_build_object('rows', res, 'total', tot, 'more', (page + 1) * 3000 < tot);
end $$;

-- The site calls these with the anon key. Allow execute for anon only on the new read functions.
revoke all on function public.br24_war(text, text, int), public.br24_exp(text, text, text, numeric, numeric, int, int, text, text),
  public.br24_promos(text, text, int), public.br24_list(text, text, int, int), public.br24_chk(text) from public;
grant execute on function public.br24_war(text, text, int), public.br24_exp(text, text, text, numeric, numeric, int, int, text, text),
  public.br24_promos(text, text, int), public.br24_list(text, text, int, int) to anon;
