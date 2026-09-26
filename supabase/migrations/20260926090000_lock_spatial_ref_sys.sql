-- Supabase security advisor 0013 `rls_disabled_in_public` (email 2026-09-23).
--
-- Audit 2026-09-26 (project mutfwhenuegvdwhgwnty): the ONLY table in schema
-- public with RLS disabled is `public.spatial_ref_sys` — the PostGIS
-- EPSG/SRID catalogue (~8.5k reference rows, no user data). Every app table
-- (pins, pin_media, pin_replies, messages, profiles, ratings, devices) already
-- has RLS enabled with policies; they are NOT changed here. The views
-- pins_public (security_invoker), geometry_columns and geography_columns are
-- views, not tables.
--
-- The app never touches spatial_ref_sys directly, but PostGIS reads it
-- internally (geography/SRID 4326 lookups used by list_live_pins_nearby,
-- in_pilot_oblast, pins.geog). Before this migration anon/authenticated could
-- INSERT/UPDATE/DELETE/TRUNCATE it through PostgREST (verified in a
-- rolled-back transaction), e.g. deleting SRID 4326 would break the map.
-- So: reads stay open, API writes are blocked.
--
-- On hosted Supabase the table and the postgis extension are owned by
-- `supabase_admin`, so the `postgres` role gets "must be owner" on
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY and its REVOKEs are no-ops
-- (grants were made by supabase_admin). Hence two layers:
--   1. If the migrating role owns the table (local dev / self-hosted), do the
--      proper fix: enable RLS, read-only policy, explicit grants.
--   2. Always: a statement-level BEFORE trigger (postgres holds the TRIGGER
--      privilege) that rejects INSERT/UPDATE/DELETE/TRUNCATE from the API
--      roles anon and authenticated. supabase_admin / postgres / service_role
--      (PostGIS upgrades, backups/restores) are unaffected.
-- The advisor lint itself only checks relrowsecurity, so on hosted it will
-- keep reporting spatial_ref_sys until Supabase relocates PostGIS out of
-- public (Support) or ships the linter fix excluding extension-owned tables
-- (supabase/supabase#47206, supabase/splinter#157).

do $$
declare
  v_owner oid;
begin
  select c.relowner into v_owner
  from pg_catalog.pg_class c
  where c.oid = pg_catalog.to_regclass('public.spatial_ref_sys');

  if v_owner is null then
    raise notice 'public.spatial_ref_sys not found (PostGIS not in public) — nothing to do';
  elsif pg_catalog.pg_has_role(current_user, v_owner, 'USAGE') then
    execute 'alter table public.spatial_ref_sys enable row level security';
    execute 'drop policy if exists spatial_ref_sys_read_all on public.spatial_ref_sys';
    execute 'create policy spatial_ref_sys_read_all on public.spatial_ref_sys
               for select to anon, authenticated using (true)';
    execute 'revoke all on public.spatial_ref_sys from anon, authenticated';
    execute 'grant select on public.spatial_ref_sys to anon, authenticated';
    execute 'grant all on public.spatial_ref_sys to service_role';
  else
    raise notice 'public.spatial_ref_sys is owned by %, not %: RLS/grants cannot be changed by this role; installing write-guard trigger only',
      pg_catalog.pg_get_userbyid(v_owner), current_user;
  end if;
end
$$;

create or replace function public.guard_spatial_ref_sys_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'public.spatial_ref_sys is read-only for API roles'
      using errcode = '42501';
  end if;
  return null; -- statement-level trigger: return value ignored
end;
$$;

comment on function public.guard_spatial_ref_sys_write() is
  'Blocks INSERT/UPDATE/DELETE/TRUNCATE on PostGIS public.spatial_ref_sys from anon/authenticated (RLS cannot be enabled: table owned by supabase_admin).';

revoke all on function public.guard_spatial_ref_sys_write() from public, anon, authenticated;
grant execute on function public.guard_spatial_ref_sys_write() to service_role;

do $$
begin
  if pg_catalog.to_regclass('public.spatial_ref_sys') is not null then
    execute 'drop trigger if exists spatial_ref_sys_api_readonly on public.spatial_ref_sys';
    execute 'create trigger spatial_ref_sys_api_readonly
               before insert or update or delete or truncate on public.spatial_ref_sys
               for each statement execute function public.guard_spatial_ref_sys_write()';
  end if;
end
$$;
