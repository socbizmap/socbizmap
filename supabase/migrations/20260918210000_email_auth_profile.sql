-- Email magic-link / OTP users: store email on profiles and allow null phone.
-- Phone SMS still needs Twilio Trust Hub; email uses Supabase Auth templates.
-- Safe to re-run.

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique
  on public.profiles (email)
  where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_email text;
  v_name text;
begin
  v_phone := nullif(trim(coalesce(new.phone, '')), '');
  if v_phone is not null then
    if left(v_phone, 1) <> '+' then
      v_phone := '+' || regexp_replace(v_phone, '[^0-9]', '', 'g');
    else
      v_phone := '+' || regexp_replace(substr(v_phone, 2), '[^0-9]', '', 'g');
    end if;
    if v_phone !~ '^\+380[0-9]{9}$' then
      v_phone := null;
    end if;
  end if;

  v_email := nullif(lower(trim(coalesce(new.email, ''))), '');
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  if v_name is null and v_email is not null then
    v_name := nullif(split_part(v_email, '@', 1), '');
  end if;

  insert into public.profiles (id, phone, email, display_name)
  values (
    new.id,
    v_phone,
    v_email,
    coalesce(v_name, 'Користувач')
  )
  on conflict (id) do update
    set
      phone = coalesce(public.profiles.phone, excluded.phone),
      email = coalesce(public.profiles.email, excluded.email),
      display_name = case
        when public.profiles.display_name is null
          or public.profiles.display_name = 'Користувач'
        then excluded.display_name
        else public.profiles.display_name
      end;

  return new;
end;
$$;
