-- Security audit 2026-09-26, step 1 of 2 (additive; safe with the pre-fix client).
--   C1: get_my_profile() so the client reads its own full profile without table-wide SELECT.
--   H2: enforce_profile_update_rules keeps rating_*, account_kind, email, phone (plus role, plan)
--       unchanged for end users. service_role and direct DB sessions (no end-user JWT) are trusted.
--   H4: get_pin_contact(pin_id) returns contact_phone for a live pin, logs each reveal and caps
--       distinct pins per user per Kyiv day. Authors and admins are not limited.
--   continue_pin becomes SECURITY DEFINER (author check kept) so it still works after step 2
--   revokes column SELECT on pins.contact_phone from authenticated.
-- Step 2 (20260926200100) revokes the broad grants. Deploy the client that uses these RPCs
-- between step 1 and step 2.

-- ---------------------------------------------------------------- C1: own profile
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.profiles p where p.id = auth.uid();
$$;

comment on function public.get_my_profile() is
  'Full profile row of the caller (auth.uid()). Other users are read through column grants (public fields only).';

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;

-- ---------------------------------------------------------------- H2: protected profile columns
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), '');
begin
  -- Trusted callers: service_role key, or a direct DB session (SQL editor / migrations)
  -- that carries no end-user JWT at all.
  if v_role = 'service_role' or (v_role = '' and auth.uid() is null) then
    return new;
  end if;

  if auth.uid() is distinct from new.id and not public.is_admin() then
    raise exception 'PROFILE_FORBIDDEN' using errcode = 'P0001';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  -- Ratings are maintained by the system only.
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;

  if not public.is_admin() then
    new.role := old.role;
    new.plan := old.plan;
    new.account_kind := old.account_kind;
    new.email := old.email;
    new.phone := old.phone;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------- H4: contact phone via RPC
create table if not exists public.pin_contact_reveals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pin_id uuid not null references public.pins (id) on delete cascade,
  revealed_on date not null default ((now() at time zone 'Europe/Kyiv')::date),
  created_at timestamptz not null default now(),
  primary key (user_id, revealed_on, pin_id)
);

create index if not exists pin_contact_reveals_pin_idx on public.pin_contact_reveals (pin_id);

comment on table public.pin_contact_reveals is
  'Audit log of contact_phone reveals through get_pin_contact(); one row per user, Kyiv day and pin.';

alter table public.pin_contact_reveals enable row level security;
revoke all on table public.pin_contact_reveals from public, anon, authenticated;
grant all on table public.pin_contact_reveals to service_role;

create or replace function public.get_pin_contact(p_pin_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_daily_limit constant integer := 30;
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Kyiv')::date;
  v_author uuid;
  v_status public.pin_status;
  v_expires timestamptz;
  v_phone text;
  v_used integer;
begin
  if v_uid is null then
    return null;
  end if;

  select p.author_id, p.status, p.expires_at, p.contact_phone
    into v_author, v_status, v_expires, v_phone
  from public.pins p
  where p.id = p_pin_id;

  if not found then
    return null;
  end if;

  -- Own pins (edit form) and the moderation queue: no limit, no log.
  if v_author = v_uid or public.is_admin() then
    return v_phone;
  end if;

  if v_status <> 'live' or (v_expires is not null and v_expires <= now()) then
    return null;
  end if;

  -- Re-opening a pin already revealed today does not use quota.
  if exists (
    select 1 from public.pin_contact_reveals r
    where r.user_id = v_uid and r.revealed_on = v_today and r.pin_id = p_pin_id
  ) then
    return v_phone;
  end if;

  -- Serialize per user so parallel calls cannot overshoot the cap.
  perform pg_advisory_xact_lock(hashtextextended('get_pin_contact:' || v_uid::text, 0));

  select count(*) into v_used
  from public.pin_contact_reveals r
  where r.user_id = v_uid and r.revealed_on = v_today;

  if v_used >= c_daily_limit then
    raise exception 'CONTACT_RATE_LIMIT' using errcode = 'P0001';
  end if;

  insert into public.pin_contact_reveals (user_id, pin_id, revealed_on)
  values (v_uid, p_pin_id, v_today)
  on conflict do nothing;

  return v_phone;
end;
$$;

comment on function public.get_pin_contact(uuid) is
  'contact_phone of a live pin for a signed-in user; logged in pin_contact_reveals, max 30 distinct pins per user per Kyiv day. Authors and admins unlimited.';

revoke all on function public.get_pin_contact(uuid) from public, anon;
grant execute on function public.get_pin_contact(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- continue_pin: definer
create or replace function public.continue_pin(p_pin_id uuid)
returns public.pins
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pins;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  update public.pins
  set expires_at = greatest(expires_at, now()) + interval '30 days'
  where id = p_pin_id
    and author_id = auth.uid()
    and status = 'live'
    and auto_renew = true
    and expires_at is not null
    and expires_at > now()
    and expires_at <= now() + interval '3 days'
  returning * into r;

  if r.id is null then
    raise exception 'PIN_CONTINUE_FORBIDDEN' using errcode = 'P0001';
  end if;
  return r;
end;
$$;

revoke all on function public.continue_pin(uuid) from public, anon;
grant execute on function public.continue_pin(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
