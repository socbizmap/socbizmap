# SocBizMap

Мапа роботи та послуг для Харківської області (пілот: Харків і Зміїв).

Клієнт: React Native + Expo (TypeScript). Бекенд: Supabase (Auth OTP `+380`, Postgres + PostGIS, Storage). Без токена, без NFT, без окремого Node API.

**ТМ SocBizMap, св. № 302167.** Оператор: ТОВ «ФІРМА «ТОН, ЛТД»», ЄДРПОУ 14112108.

## Запуск (mock, без ключів)

```bash
npm install
cp .env.example .env   # залиште ANON_KEY порожнім
npm run typecheck
npx expo start
```

Mock OTP: `123456`. Адмін у mock: `+380500000000`.

## Live Supabase

Див. [docs/SUPABASE.md](docs/SUPABASE.md). Змінні лише в `.env`, не в git:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Міграція: `supabase/migrations/20260917120000_init.sql` — вставити в SQL Editor проєкту `mutfwhenuegvdwhgwnty`.

## Екрани

Сплеш, вхід, старт (Робота / Послуги; Барахолка — «Скоро»), мапа зі списком (іконка зверху справа), картка мітки, створення/олівець, профіль, відгук надіслано, оцінка, черга admin.
