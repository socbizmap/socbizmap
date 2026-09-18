-- Smoke fixes after PR #1 apply (2026-09-17)
-- 1) Hide contact_phone from anon REST (PostgREST needs table-level SELECT; use view instead)
-- 2) Expose public storage buckets to anon listBuckets

revoke all on table public.pins from anon;

create or replace view public.pins_public
with (security_invoker = true) as
select
  id, author_id, kind, vertical, title, category, description, schedule,
  pay_amount, pay_currency, city, status, boost_until, expires_at,
  created_at, updated_at, lat, lng, geog
from public.pins;

grant select on public.pins_public to anon, authenticated;

drop policy if exists "buckets_public_read" on storage.buckets;
create policy "buckets_public_read" on storage.buckets
  for select to anon, authenticated
  using (public = true);
