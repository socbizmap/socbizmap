# SocBizMap + Supabase

Live project host: `mutfwhenuegvdwhgwnty.supabase.co`  
Expo env (public only — never commit the anon key):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

If either variable is missing or empty, the app uses the **mock** data layer (AsyncStorage key `socbizmap.mock.v11`). Mock OTP code: `123456`. Admin mock phone: `+380500000000`.

## 1. Apply migrations

SQL files live in `supabase/migrations/` and are ordered by filename:

1. `supabase/migrations/20260917120000_init.sql` — PostGIS, tables (`profiles`, `pins`, `pin_media`, `pin_replies`, `ratings`, `devices`), RLS, RPCs (`list_live_pins_nearby`, quota helpers), storage buckets `avatars` + `pin-media`.
2. `supabase/migrations/20260917220000_smoke_fixes.sql` — **already applied live** (2026-09-17). Re-run is safe (`create or replace` / `drop policy if exists`).

### SQL editor (fastest)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project `mutfwhenuegvdwhgwnty` → **SQL Editor**.
2. Paste each file in filename order (skip `20260917220000_smoke_fixes.sql` if this project already has it).
3. Init is safe to re-run: enums/tables use `if not exists` / `duplicate_object` guards; policies are dropped then created.

### CLI

```bash
npx supabase login
npx supabase link --project-ref mutfwhenuegvdwhgwnty
npx supabase db push
```

Do not put the service role key in this repo.

## 2. Auth — Phone OTP (Twilio)

In Dashboard → **Authentication** → **Providers** (or **Auth** → **Providers**):

1. Enable **Phone** (SMS OTP). Supabase sends via **Twilio** — set the Twilio credentials there, not in this repo.
2. Restrict to Ukraine `+380` if the provider allows a country allowlist.
3. Registration = first successful OTP; trigger `handle_new_user` inserts `profiles`.

There is no password and no Google/Apple/Facebook in v1.

## 3. Expo env

```bash
cp .env.example .env
```

Set:

```
EXPO_PUBLIC_SUPABASE_URL=https://mutfwhenuegvdwhgwnty.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Dashboard → Project Settings → API → anon public>
```

Restart Expo (`npx expo start`) so `EXPO_PUBLIC_*` is inlined. The client reads these in `src/lib/supabase.ts`. JWT session uses `expo-secure-store` on native and `localStorage` on web.

Without the anon key the splash screen shows **Дані: mock** and never talks to the project.

## 4. Guest reads (anon has no table SELECT on `pins`)

PostgREST needs **table-level** `SELECT` to expose a table. A column grant that omits `contact_phone` is not enough, so **anon has no `SELECT` on `public.pins`**.

Guests (and the Expo map) must use:

- RPC **`list_live_pins_nearby`** — map/list, no `contact_phone`
- View **`pins_public`** — same public columns, **no `contact_phone`**

Logged-in users `select` `public.pins` (includes phone after login). Authors and admin still see own / queue rows via RLS.

## 5. Storage — `buckets_public_read`

Buckets **`avatars`** and **`pin-media`** are public objects, but the Storage API `listBuckets` / bucket metadata needs a policy on `storage.buckets`:

```sql
-- in 20260917220000_smoke_fixes.sql (already live)
create policy "buckets_public_read" on storage.buckets
  for select to anon, authenticated
  using (public = true);
```

Object paths: `avatars/{user_id}/…`, `pin-media/{user_id}/…`. Object policies stay owner-write / public-read on `storage.objects`.

## 6. What the schema enforces

- Public map/list: `status = live` only, via RPC / `pins_public`.
- Author sees own pins in any status. Admin sees `pending|revision|rejected`.
- New pin `INSERT` → `pending`, `boost_until` forced null. Calendar-month quota in `Europe/Kyiv`: 3 (`free`) / 30 (`pro`). Pencil `UPDATE` and `revision` → `pending` do **not** consume quota.
- Substantial author edits of `live`/`revision` flip status back to `pending`.
- `pin_media.kind` is `photo` (max 5) or `video` (max 1).
- `pin_replies` has no chat body; the app shows `pins.contact_phone` after a reply.
- Storage paths: `avatars/{user_id}/…`, `pin-media/{user_id}/…`.

Statuses: `pending | revision | rejected | live | closed | hidden | archived | deleted`. Public map uses `live`. Beta UI does not write `boost_until`.

## 7. Smoke without backend

```bash
npm install
npm run typecheck
npx expo start
```

No `.env` required. Create a pin after mock OTP; it stays `pending` and is absent from the public map until an admin (`+380500000000`) sets `live`.
