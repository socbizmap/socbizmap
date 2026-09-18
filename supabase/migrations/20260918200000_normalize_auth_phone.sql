-- Normalize Auth phone to E.164 (+380…) in handle_new_user
-- Supabase Auth often stores phone digits without leading +.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
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

  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    v_phone,
    coalesce(new.raw_user_meta_data->>'display_name', 'Користувач')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
