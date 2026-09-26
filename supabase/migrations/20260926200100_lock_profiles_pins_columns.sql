-- Security audit 2026-09-26, step 2 of 2. Apply only after the client that uses
-- get_my_profile() / get_pin_contact() and explicit pin column lists is deployed.
--   C1: anon loses all access to profiles; authenticated may SELECT public columns only.
--   H2: authenticated may UPDATE user-editable columns only (trigger from step 1 stays as a backstop).
--   H4: authenticated loses SELECT on pins.contact_phone (read it through get_pin_contact()).

-- ---------------------------------------------------------------- profiles
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select (id, display_name, avatar_url, rating_avg, rating_count, account_kind)
  on public.profiles to authenticated;

grant update (display_name, avatar_url, default_mode, vertical, radius_km, last_geog, locale_override)
  on public.profiles to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------- pins.contact_phone
-- Revoking table-level SELECT also drops existing column-level SELECT grants.
revoke select on table public.pins from authenticated;
grant select (
  id, author_id, kind, vertical, title, category, description, schedule,
  pay_amount, pay_currency, geog, city, status, moderation_note, moderated_by,
  moderated_at, expires_at, boost_until, created_at, updated_at, lat, lng, auto_renew
) on public.pins to authenticated;

notify pgrst, 'reload schema';
