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

SMS на live не піде, поки Twilio Trust Hub KYC не закритий. Email-вхід працює з шаблонів Supabase Auth — див. [docs/SUPABASE.md](docs/SUPABASE.md).

## Live Supabase

Див. [docs/SUPABASE.md](docs/SUPABASE.md). Змінні лише в `.env`, не в git:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_AUTH_EMAIL` (необовʼязково, `1` = одразу показати email-вхід)

Міграції: `supabase/migrations/` — вставити в SQL Editor проєкту `mutfwhenuegvdwhgwnty` у порядку імен файлів. Нова: `20260918210000_email_auth_profile.sql`.

## Екрани

Сплеш, вхід, старт (Робота / Послуги; Барахолка — «Скоро»), мапа зі списком (іконка зверху справа), картка мітки, створення/олівець, профіль, відгук надіслано, оцінка, черга admin.
