# Public web beta (Expo static export)

Testers open the app in a browser at an HTTPS URL — not `localhost`. Native Expo (`npx expo start`, iOS, Android, EAS) is unchanged.

## Build env (public client only)

Expo inlines `EXPO_PUBLIC_*` **at export time**. Set them as **build** environment variables on the host (Vercel Project Settings, Cloudflare Pages **Build** env, or GitHub Actions secrets). Do **not** put `service_role` anywhere in this app or in hosting env.

| Name | Required for live | Value |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | `https://mutfwhenuegvdwhgwnty.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Dashboard → Project Settings → API → **anon public** |
| `EXPO_PUBLIC_AUTH_EMAIL` | yes (beta) | `1` (show email magic-link on login) |
| `EXPO_PUBLIC_AUTH_EMAIL_OTP` | no | unset on Free (magic-link only) |

Without URL + anon key the exported site still runs: it uses the **mock** store (`123456`). That is fine for a UI preview; live Auth / map data need the anon key.

Local check (same command CI and Vercel run):

```bash
npm ci
npm run typecheck
npx expo export -p web   # alias: npm run export:web / npm run build (web-only, not native)
npx expo serve
```

Output is `dist/` (gitignored). `public/_redirects` and `public/_headers` are copied into `dist/` for Cloudflare Pages.

## One-click: Vercel (preferred)

`vercel.json` is already in the repo (`expo export -p web` → `dist`, `framework: null`).

1. Open [Import SocBizMap on Vercel](https://vercel.com/new/import?s=https://github.com/socbizmap/socbizmap) (GitHub → `socbizmap/socbizmap`).
2. Framework preset: **Other** (config file sets `framework: null`).
3. Environment variables — Production, Preview, and Development:

   - `EXPO_PUBLIC_SUPABASE_URL` = `https://mutfwhenuegvdwhgwnty.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = anon public key
   - `EXPO_PUBLIC_AUTH_EMAIL` = `1`

4. Deploy. Production URL is `https://<project>.vercel.app`. Every push to `main` redeploys; every PR gets a preview URL.
5. Copy the HTTPS origin into Supabase Auth (below) and redeploy is not required.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/socbizmap/socbizmap&env=EXPO_PUBLIC_SUPABASE_URL,EXPO_PUBLIC_SUPABASE_ANON_KEY,EXPO_PUBLIC_AUTH_EMAIL&envDescription=Public%20Expo%20client%20env%20only.%20Never%20set%20service_role.&envLink=https://github.com/socbizmap/socbizmap/blob/main/docs/WEB.md&project-name=socbizmap&repository-name=socbizmap)

CLI (from a machine logged into the Vercel / GitHub account that owns the project):

```bash
npx vercel@latest
# Production:
npx vercel@latest --prod
```

## Cloudflare Pages (alternative)

`wrangler.toml` sets `pages_build_output_dir = "dist"`.

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → `socbizmap/socbizmap`, production branch `main`.
2. Build command: `npx expo export -p web`
3. Build output directory: `dist`
4. Node version: `22` (see `.node-version`)
5. Same three **Build** env vars as Vercel. Deploy on every push to `main`; PRs get `*.pages.dev` previews.

Or GitHub Actions: add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Workflow `.github/workflows/web.yml` exports `dist` and runs `wrangler pages deploy` when those secrets are present.

```bash
npx expo export -p web
npx wrangler pages deploy dist --project-name=socbizmap
```

## Auth: Site URL + redirect allowlist

Magic-link `ConfirmationURL` must land on this origin. The client already uses `window.location.origin + '/auth/callback'`.

Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://<deploy-host>` (the production Vercel or Pages origin)
- **Redirect URLs** (add all that you use):

  - `https://<deploy-host>/auth/callback`
  - `https://<deploy-host>/**`
  - Preview hosts, e.g. `https://*.vercel.app/**` and/or `https://*.pages.dev/**`
  - Existing local / native: `http://localhost:8081/auth/callback`, `socbizmap://auth/callback`

No `service_role` key. No change to Expo scheme `socbizmap` for mobile.

## GitHub Actions secrets (optional)

Used by `.github/workflows/web.yml` so CI export matches production:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_AUTH_EMAIL` (defaults to `1` if unset)
- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — only if you want Pages deploy from Actions

Vercel Git integration does **not** need these Actions secrets; set the same names in the Vercel project env UI.
