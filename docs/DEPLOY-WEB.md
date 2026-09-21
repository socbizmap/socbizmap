# Web deploy (static export)

`app.json` sets `expo.web.output` to `static`. Production HTML is `npx expo export -p web`, written to `dist/` (one HTML file per route, for example `dist/login.html`).

## Clean URLs are required

The production static host must serve extensionless paths. On Vercel that is `cleanUrls: true` in the root `vercel.json` (already set). With it, `/login` maps to `login.html`.

Without clean URLs, `/login`, `/map`, `/start`, `/auth/callback`, and the other static routes 404. Only the `.html` paths (`/login.html`) exist on disk.

`trailingSlash` is `false`, so `/login/` redirects to `/login`.

## Dynamic routes

Pins and chats are not known at build time, so Expo exports the dynamic templates with the bracket names:

- `dist/pin/[id].html`
- `dist/chat/[pinId].html`

`vercel.json` rewrites `/pin/:id` and `/chat/:pinId` to those files. Query strings (for example `/chat/:pinId?peer=`) are preserved. Do not add a single-page catch-all rewrite to `/index.html`; this export is multi-page HTML, not an SPA.

## Vercel Git deploys

Root `vercel.json` sets:

- `buildCommand`: `npx expo export -p web`
- `outputDirectory`: `dist`
- `framework`: `null` (do not let Vercel pick a Node/SPA preset)

That command builds web only. It does not change `expo start`, iOS, or Android. EAS and local mobile builds do not read `vercel.json`.

Set the same public env vars as local `.env` on the Vercel project (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and the optional auth flags). If URL or anon key is missing, the export still builds and the site uses the mock data layer.
