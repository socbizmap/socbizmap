-- SocBizMap MVP schema
-- Paste this entire file into the Supabase SQL editor (or `supabase db push`).
-- Project ref: mutfwhenuegvdwhgwnty
-- No secrets in this file.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.pin_kind as enum ('seek', 'offer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vertical as enum ('work', 'service');
exception when duplicate_object then null; end $$;

-- Spec: pending | revision | rejected | live | closed | hidden
-- Soft-launch / UI extras: archived | deleted
do $$ begin
  create type public.pin_status as enum (
    'pending', 'revision', 'rejected', 'live', 'closed', 'hidden', 'archived', 'deleted'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pin_category as enum (
    'workers', 'construction', 'home', 'it', 'trade', 'horeca', 'students', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_plan as enum ('free', 'pro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_kind as enum ('person', 'fop', 'company');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum ('photo', 'video');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Updated-at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Approximate bounding box for Харківська область (pilot)
create or replace function public.in_pilot_oblast(p geography)
returns boolean
language sql
immutable
as $$
  select ST_Intersects(
    p::geometry,
    ST_MakeEnvelope(34.85, 48.52, 38.10, 50.46, 4326)
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles (id = auth.users.id)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  display_name text not null default 'Користувач',
  avatar_url text,
  default_mode public.pin_kind not null default 'seek',
  vertical public.vertical not null default 'work',
  radius_km int not null default 10 check (radius_km between 1 and 50),
  last_geog geography(Point, 4326),
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  oblast text not null default 'Харківська',
  locale_override text,
  role public.user_role not null default 'user',
  plan public.user_plan not null default 'free',
  account_kind public.account_kind not null default 'person',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_e164 check (
    phone is null or phone ~ '^\+380[0-9]{9}$'
  ),
  constraint profiles_locale_override_chk check (
    locale_override is null or locale_override in ('uk', 'en')
  )
);

create index if not exists profiles_last_geog_gix on public.profiles using gist (last_geog);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on first successful OTP (registration = first OTP)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    nullif(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'display_name', 'Користувач')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- pins
-- ---------------------------------------------------------------------------

create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.pin_kind not null,
  vertical public.vertical not null default 'work',
  title text not null,
  category public.pin_category not null,
  description text not null default '',
  schedule text not null default '',
  pay_amount numeric(12, 2),
  pay_currency char(3) not null default 'UAH',
  contact_phone text not null,
  geog geography(Point, 4326) not null,
  city text not null default '',
  status public.pin_status not null default 'pending',
  moderation_note text,
  moderated_by uuid references public.profiles (id),
  moderated_at timestamptz,
  expires_at timestamptz,
  -- Highlight window; beta client must not write this (always null)
  boost_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pins_contact_phone_e164 check (contact_phone ~ '^\+380[0-9]{9}$'),
  constraint pins_title_len check (char_length(title) between 1 and 120)
);

-- Generated WGS84 coords for the Expo client (PostgREST cannot return geography easily)
do $$ begin
  alter table public.pins
    add column lat double precision generated always as (ST_Y(geog::geometry)) stored;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.pins
    add column lng double precision generated always as (ST_X(geog::geometry)) stored;
exception when duplicate_column then null; end $$;

create index if not exists pins_geog_gix on public.pins using gist (geog);
create index if not exists pins_status_kind_idx on public.pins (status, kind, vertical);
create index if not exists pins_author_idx on public.pins (author_id, created_at desc);

drop trigger if exists pins_set_updated_at on public.pins;
create trigger pins_set_updated_at
  before update on public.pins
  for each row execute function public.set_updated_at();

-- Quota: calendar month in Europe/Kyiv. INSERT only. Pencil / revision resubmit do not count.
create or replace function public.pins_created_this_month(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.pins
  where author_id = p_user_id
    and date_trunc('month', created_at at time zone 'Europe/Kyiv')
      = date_trunc('month', now() at time zone 'Europe/Kyiv');
$$;

create or replace function public.pin_monthly_quota(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when coalesce((select plan from public.profiles where id = p_user_id), 'free') = 'pro'
    then 30 else 3 end;
$$;

create or replace function public.enforce_pin_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.pins_created_this_month(new.author_id) >= public.pin_monthly_quota(new.author_id) then
    raise exception 'PIN_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;
  new.status := 'pending';
  new.boost_until := null;
  return new;
end;
$$;

drop trigger if exists pins_enforce_quota on public.pins;
create trigger pins_enforce_quota
  before insert on public.pins
  for each row execute function public.enforce_pin_quota();

-- Pencil: substantial edits of live/revision → pending. Never let authors set live or boost_until.
create or replace function public.enforce_pin_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  substantial boolean;
begin
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) into is_admin;

  if not is_admin then
    new.boost_until := old.boost_until;
    new.moderated_by := old.moderated_by;
    new.moderated_at := old.moderated_at;
    if new.status = 'live' and old.status is distinct from 'live' then
      raise exception 'PIN_STATUS_FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  substantial :=
    old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.category is distinct from new.category
    or old.schedule is distinct from new.schedule
    or old.pay_amount is distinct from new.pay_amount
    or old.contact_phone is distinct from new.contact_phone
    or old.geog is distinct from new.geog
    or old.kind is distinct from new.kind
    or old.vertical is distinct from new.vertical;

  if not is_admin
     and substantial
     and old.status in ('live', 'revision')
     and new.status = old.status then
    new.status := 'pending';
    new.moderation_note := null;
  end if;

  if new.status = 'live' and new.expires_at is null then
    new.expires_at := now() + interval '30 days';
  end if;

  return new;
end;
$$;

drop trigger if exists pins_enforce_update_rules on public.pins;
create trigger pins_enforce_update_rules
  before update on public.pins
  for each row execute function public.enforce_pin_update_rules();

-- ---------------------------------------------------------------------------
-- pin_media  photo|video
-- ---------------------------------------------------------------------------

create table if not exists public.pin_media (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins (id) on delete cascade,
  kind public.media_kind not null,
  path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pin_media_pin_idx on public.pin_media (pin_id, sort);

create or replace function public.enforce_pin_media_limits()
returns trigger
language plpgsql
as $$
declare
  photo_count int;
  video_count int;
begin
  select
    count(*) filter (where kind = 'photo'),
    count(*) filter (where kind = 'video')
  into photo_count, video_count
  from public.pin_media
  where pin_id = new.pin_id;

  if new.kind = 'photo' and photo_count >= 5 then
    raise exception 'PIN_MEDIA_PHOTO_LIMIT' using errcode = 'P0001';
  end if;
  if new.kind = 'video' and video_count >= 1 then
    raise exception 'PIN_MEDIA_VIDEO_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists pin_media_limits on public.pin_media;
create trigger pin_media_limits
  before insert on public.pin_media
  for each row execute function public.enforce_pin_media_limits();

-- ---------------------------------------------------------------------------
-- pin_replies  (no chat body; screen 7 shows pins.contact_phone)
-- ---------------------------------------------------------------------------

create table if not exists public.pin_replies (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pin_id, author_id)
);

create index if not exists pin_replies_pin_idx on public.pin_replies (pin_id);

-- ---------------------------------------------------------------------------
-- ratings  one per from × to × pin
-- ---------------------------------------------------------------------------

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  pin_id uuid not null references public.pins (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (from_id, to_id, pin_id),
  constraint ratings_not_self check (from_id <> to_id)
);

create or replace function public.refresh_profile_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    rating_avg = coalesce((select avg(stars)::numeric(3,2) from public.ratings where to_id = p.id), 0),
    rating_count = coalesce((select count(*) from public.ratings where to_id = p.id), 0)
  where p.id = coalesce(new.to_id, old.to_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists ratings_refresh_profile on public.ratings;
create trigger ratings_refresh_profile
  after insert or update or delete on public.ratings
  for each row execute function public.refresh_profile_rating();

-- ---------------------------------------------------------------------------
-- devices  Expo push tokens
-- ---------------------------------------------------------------------------

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists devices_user_idx on public.devices (user_id);

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers for RLS
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_pin_author(p_pin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pins where id = p_pin_id and author_id = auth.uid()
  );
$$;

-- Nearby live pins for map + list (haversine via geography distance)
create or replace function public.list_live_pins_nearby(
  lat double precision,
  lng double precision,
  radius_km integer,
  p_kind public.pin_kind,
  p_vertical public.vertical default null,
  p_search text default null
)
returns table (
  id uuid,
  author_id uuid,
  kind public.pin_kind,
  vertical public.vertical,
  title text,
  category public.pin_category,
  description text,
  schedule text,
  pay_amount numeric,
  pay_currency char(3),
  city text,
  status public.pin_status,
  boost_until timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  lat double precision,
  lng double precision,
  distance_m double precision,
  thumbnail_path text
)
language sql
stable
security invoker
as $$
  select
    p.id,
    p.author_id,
    p.kind,
    p.vertical,
    p.title,
    p.category,
    p.description,
    p.schedule,
    p.pay_amount,
    p.pay_currency,
    p.city,
    p.status,
    p.boost_until,
    p.expires_at,
    p.created_at,
    p.updated_at,
    p.lat,
    p.lng,
    ST_Distance(p.geog, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) as distance_m,
    (
      select m.path from public.pin_media m
      where m.pin_id = p.id and m.kind = 'photo'
      order by m.sort
      limit 1
    ) as thumbnail_path
  from public.pins p
  where p.status = 'live'
    and p.kind = p_kind
    and (p_vertical is null or p.vertical = p_vertical)
    and public.in_pilot_oblast(p.geog)
    and ST_DWithin(
      p.geog,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      greatest(radius_km, 1) * 1000.0
    )
    and (
      p_search is null or length(trim(p_search)) = 0
      or p.title ilike '%' || trim(p_search) || '%'
      or p.description ilike '%' || trim(p_search) || '%'
    )
  order by p.geog <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.pins enable row level security;
alter table public.pin_media enable row level security;
alter table public.pin_replies enable row level security;
alter table public.ratings enable row level security;
alter table public.devices enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

-- Non-admins cannot change role / plan / account_kind (PRO payment is "Скоро")
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from new.id and not public.is_admin() then
    raise exception 'PROFILE_FORBIDDEN' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    new.role := old.role;
    new.plan := old.plan;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_update_rules on public.profiles;
create trigger profiles_enforce_update_rules
  before update on public.profiles
  for each row execute function public.enforce_profile_update_rules();

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- pins: live visible to everyone (incl. guest / anon)
drop policy if exists pins_select_live on public.pins;
create policy pins_select_live on public.pins
  for select using (status = 'live');

drop policy if exists pins_select_own on public.pins;
create policy pins_select_own on public.pins
  for select using (author_id = auth.uid());

drop policy if exists pins_select_admin_queue on public.pins;
create policy pins_select_admin_queue on public.pins
  for select using (
    public.is_admin() and status in ('pending', 'revision', 'rejected')
  );

drop policy if exists pins_insert_own on public.pins;
create policy pins_insert_own on public.pins
  for insert with check (author_id = auth.uid());

drop policy if exists pins_update_own on public.pins;
create policy pins_update_own on public.pins
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists pins_update_admin on public.pins;
create policy pins_update_admin on public.pins
  for update using (public.is_admin())
  with check (public.is_admin());

-- pin_media: public read when parent pin is live; owner + admin otherwise
drop policy if exists pin_media_select on public.pin_media;
create policy pin_media_select on public.pin_media
  for select using (
    exists (select 1 from public.pins p where p.id = pin_id and p.status = 'live')
    or public.is_pin_author(pin_id)
    or public.is_admin()
  );

drop policy if exists pin_media_write_own on public.pin_media;
create policy pin_media_write_own on public.pin_media
  for insert with check (public.is_pin_author(pin_id));

drop policy if exists pin_media_delete_own on public.pin_media;
create policy pin_media_delete_own on public.pin_media
  for delete using (public.is_pin_author(pin_id) or public.is_admin());

-- pin_replies
drop policy if exists pin_replies_select on public.pin_replies;
create policy pin_replies_select on public.pin_replies
  for select using (
    author_id = auth.uid() or public.is_pin_author(pin_id) or public.is_admin()
  );

drop policy if exists pin_replies_insert on public.pin_replies;
create policy pin_replies_insert on public.pin_replies
  for insert with check (author_id = auth.uid());

-- ratings: insert self, select all
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings
  for select using (true);

drop policy if exists ratings_insert_own on public.ratings;
create policy ratings_insert_own on public.ratings
  for insert with check (from_id = auth.uid());

-- devices
drop policy if exists devices_own on public.devices;
create policy devices_own on public.devices
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants  (contact_phone hidden from anon — phone only after login)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

grant select (
  id, author_id, kind, vertical, title, category, description, schedule,
  pay_amount, pay_currency, city, status, boost_until, expires_at,
  created_at, updated_at, lat, lng, geog
) on public.pins to anon;

grant select, insert, update on public.pins to authenticated;

grant select on public.pin_media to anon, authenticated;
grant insert, delete on public.pin_media to authenticated;

grant select, insert on public.pin_replies to authenticated;
grant select on public.ratings to anon, authenticated;
grant insert on public.ratings to authenticated;
grant select, insert, update, delete on public.devices to authenticated;

grant execute on function public.list_live_pins_nearby(double precision, double precision, integer, public.pin_kind, public.vertical, text)
  to anon, authenticated;
grant execute on function public.pins_created_this_month(uuid) to authenticated;
grant execute on function public.pin_monthly_quota(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.in_pilot_oblast(geography) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets: avatars, pin-media
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'pin-media',
    'pin-media',
    true,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pin_media_public_read on storage.objects;
create policy pin_media_public_read on storage.objects
  for select using (bucket_id = 'pin-media');

drop policy if exists pin_media_owner_write on storage.objects;
create policy pin_media_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pin-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pin_media_owner_update on storage.objects;
create policy pin_media_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pin-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pin_media_owner_delete on storage.objects;
create policy pin_media_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pin-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
