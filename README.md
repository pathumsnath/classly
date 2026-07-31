# Classly

Mobile-friendly web app (PWA) for a single tuition institute to run classes,
attendance, fee collection, and tutor salaries. See `tuitionflow-v1-spec.md`
for the full V1 specification.

Current status: **Phase A (Foundation)** — schema, RLS, and auth. No feature
UI (people, classes, attendance, fees, salaries) yet; that's Phase B/C.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (region: closest
   to Sri Lanka, e.g. Singapore).
2. Apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   (Or paste `supabase/migrations/0001_init.sql` into the SQL Editor.)
3. **Enable phone auth**: Authentication → Providers → Phone → enable, and
   turn off "Confirm phone" only if you don't want OTP verification
   (Classly's signup flow expects phone confirmation to be **on**).
4. **Route OTP SMS through Notify.lk** (Section 6 of the spec — Supabase's
   default SMS provider is not used): Authentication → Hooks → Send SMS
   hook → HTTPS → point it at `<your-app-url>/api/auth/sms-hook`. Copy the
   generated secret into `SUPABASE_AUTH_HOOK_SECRET`.
5. Copy `Project Settings → API` values into `.env.local` (see below).

### 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Project Settings → API.
- `SUPABASE_AUTH_HOOK_SECRET` — from the Send SMS hook setup above.
- `INVITE_TOKEN_SECRET` — any random string, e.g. `openssl rand -base64 32`.
- `NOTIFY_LK_USER_ID` / `NOTIFY_LK_API_KEY` / `NOTIFY_LK_SENDER_ID` —
  optional. If left blank, SMS sends (OTP, invites) are logged to the
  server console instead of actually sent — useful for local development
  without a Notify.lk account.

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `/signup` creates the
first owner account for a new institute.

## Deployment

Push to GitHub, connect the repo to Vercel, add the same environment
variables in Vercel → Project → Environment Variables. See Section 9 of the
spec for the full deployment checklist.
