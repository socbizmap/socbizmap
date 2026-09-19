-- Cabinet (auto-renew notice + Continue +30d / archive) and in-app pin chat.
-- Safe to re-run. Project ref: mutfwhenuegvdwhgwnty
-- No secrets in this file.

-- ---------------------------------------------------------------------------
-- pins.auto_renew
-- On → 3-day cabinet notice + Continue (+30d) else archive at expires_at
-- Off → silent archive at expires_at
-- ---------------------------------------------------------------------------

alter table public.pins
  add column if not exists auto_renew boolean not null default true;

-- Live map must not show expired pins even before archive runs
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
    and (p.expires_at is null or p.expires_at > now())
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

-- Authors cannot freely rewrite expires_at; Continue (+30d) is allowed in the 3-day window.
create or replace function public.enforce_pin_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  substantial boolean;
  continue_ok boolean;
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

    if new.expires_at is distinct from old.expires_at then
      continue_ok :=
        old.status = 'live'
        and old.auto_renew
        and old.expires_at is not null
        and old.expires_at > now()
        and old.expires_at <= now() + interval '3 days'
        and new.expires_at > old.expires_at
        and new.expires_at <= greatest(old.expires_at, now()) + interval '30 days' + interval '1 minute';
      if not continue_ok then
        new.expires_at := old.expires_at;
      end if;
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

create or replace function public.continue_pin(p_pin_id uuid)
returns public.pins
language plpgsql
security invoker
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

-- Own expired live pins → archived (map RPC already hides them).
-- Auto-renew off: silent. Auto-renew on: same archive if Continue was not pressed.
create or replace function public.archive_expired_pins()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.pins
  set status = 'archived'
  where author_id = auth.uid()
    and status = 'live'
    and expires_at is not null
    and expires_at < now();

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.continue_pin(uuid) to authenticated;
grant execute on function public.archive_expired_pins() to authenticated;
grant execute on function public.list_live_pins_nearby(double precision, double precision, integer, public.pin_kind, public.vertical, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- messages  (thread = pin + two users; pin author ↔ replier)
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_not_self check (sender_id <> recipient_id),
  constraint messages_body_len check (char_length(trim(body)) between 1 and 2000)
);

create index if not exists messages_thread_idx
  on public.messages (pin_id, created_at);

create index if not exists messages_participants_idx
  on public.messages (sender_id, recipient_id, created_at desc);

create or replace function public.in_pin_thread(p_pin_id uuid, p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and p_other is not null
    and auth.uid() <> p_other
    and exists (select 1 from public.pins where id = p_pin_id)
    and (
      (
        public.is_pin_author(p_pin_id)
        and exists (
          select 1 from public.pin_replies r
          where r.pin_id = p_pin_id and r.author_id = p_other
        )
      )
      or (
        exists (select 1 from public.pins p where p.id = p_pin_id and p.author_id = p_other)
        and exists (
          select 1 from public.pin_replies r
          where r.pin_id = p_pin_id and r.author_id = auth.uid()
        )
      )
    );
$$;

alter table public.messages enable row level security;

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.in_pin_thread(pin_id, recipient_id)
  );

revoke all on table public.messages from anon, public;
grant select, insert on public.messages to authenticated;
grant execute on function public.in_pin_thread(uuid, uuid) to authenticated;

-- Realtime (Free): INSERT events; client also polls if the channel is unavailable.
alter table public.messages replica identity default;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
exception
  when undefined_object then null;
end $$;
