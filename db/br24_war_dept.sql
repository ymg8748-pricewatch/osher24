-- osher24: branch war filtered to one department ("מלחמת סניפים" with a department chooser).
-- The client classifies products into departments by name (public/classify.js) and sends the department's product codes.
-- Run once in the Supabase SQL editor, ONLY after the owner approves. It only SELECTs from the existing table `br24`.
-- Same token check as br24_war. No table, no policy, no data change; grants anon execute on this one function only.

create or replace function public.br24_war_dept(tok text, me text, mode int default 1, codes text[] default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ix int := case when mode = 0 then 0 else 1 end; res jsonb;
begin
  perform public.br24_chk(tok);
  if codes is null or cardinality(codes) = 0 or cardinality(codes) > 5000 then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.avg_gap desc), '[]'::jsonb) into res from (
    select s.br, count(*)::int as n,
           count(*) filter (where s.o - s.m > 0.004)::int as cheaper,   -- I am cheaper than that branch
           count(*) filter (where abs(s.o - s.m) <= 0.004)::int as equal,
           count(*) filter (where s.m - s.o > 0.004)::int as pricier,   -- I am more expensive
           round(avg((s.o - s.m) / s.o * 100)::numeric, 2)::float8 as avg_gap
    from (select v.key as br, (t.d->me->>ix)::float8 as m, (v.value->>ix)::float8 as o
          from br24 t, jsonb_each(t.d) v
          where t.code = any(codes) and t.d->me is not null and v.key <> me) s
    where s.o > 0 and s.m > 0 group by s.br) x;
  return jsonb_build_object('rows', res);
end $$;

revoke all on function public.br24_war_dept(text, text, int, text[]) from public, anon, authenticated;
grant execute on function public.br24_war_dept(text, text, int, text[]) to anon;
