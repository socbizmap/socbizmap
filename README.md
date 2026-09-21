# SocBizMap

Мапа роботи та послуг для Харківської області (пілот: Харків і Зміїв).

Клієнт: React Native + Expo (TypeScript). Бекенд: Supabase (Auth phone OTP `+380` **або** email magic-link/OTP, Postgres + PostGIS, Storage). Без токена, без NFT, без окремого Node API.

**ТМ SocBizMap, св. № 302167.** Оператор: ТОВ «ФІРМА «ТОН, ЛТД»», ЄДРПОУ 14112108.

## Запуск (mock, без ключів)

```bash
npm install
cp .env.example .env   # залиште ANON_KEY порожнім
npm run typecheck
npx expo start
```

Mock OTP: `123456` (телефон і email). Адмін у mock: `+380500000000`.

SMS на live не піде, поки Twilio Trust Hub KYC не закритий. Email на **Free**: magic-link (`ConfirmationURL`), без коду в листі — див. [docs/SUPABASE.md](docs/SUPABASE.md). `{{ .Token }}` OTP у листі — лише після custom SMTP або Pro.

## Live Supabase

Див. [docs/SUPABASE.md](docs/SUPABASE.md). Змінні лише в `.env`, не в git:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_AUTH_EMAIL` (необовʼязково, `1` = одразу показати email-вхід)
- `EXPO_PUBLIC_AUTH_EMAIL_OTP` (лише коли в шаблоні є `{{ .Token }}`; на Free не ставити)

Міграції: `supabase/migrations/` — вставити в SQL Editor проєкту `mutfwhenuegvdwhgwnty` у порядку імен файлів. Нова: `20260919120000_cabinet_chat.sql` (кабінет + чат).

Кабінет і чат на live: [docs/SUPABASE.md](docs/SUPABASE.md) §9. Без env — mock: `+380501000001` (Продовжити / архів), `+380501000002` (чат по мітці).

Веб (static export на Vercel): хост має вмикати clean URLs (`cleanUrls: true`), інакше `/login` не відкриє `login.html` і чисті шляхи дадуть 404. Див. [docs/DEPLOY-WEB.md](docs/DEPLOY-WEB.md).

## Екрани

Сплеш, вхід, старт (Робота / Послуги; Барахолка — «Скоро»), мапа зі списком (іконка зверху справа), картка мітки, створення/олівець, **кабінет** (активні / спливають / архів, Продовжити), **чат** по мітці, повідомлення, відгук надіслано, оцінка, черга admin.
