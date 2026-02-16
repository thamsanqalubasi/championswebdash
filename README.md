# Champions Court Desktop Dashboard (Web)

Desktop-first operations dashboard for Champions Court, built with Next.js App Router and TypeScript.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Supabase JS client (for fallback data mode)

## Local Development

From the `web` folder:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Use one of the following data modes.

### Recommended: API mode

- `NEXT_PUBLIC_API_URL=https://your-backend-domain.com`

Notes:

- Do not append `/api` to this value.
- Example: `https://championscourt-api.onrender.com`

### Fallback: Supabase mode

- `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>`

### Optional: Route Guard mode

- `APP_ROUTE_GUARD_ENABLED=true`
- `APP_SESSION_SECRET=<long-random-secret>`

Notes:

- Guard mode protects app routes via middleware.
- Sessions are issued by `POST /api/auth/login` and stored in secure cookie `cc_session`.
- Sessions can be cleared with `POST /api/auth/logout`.
- If guard mode is not enabled, current behavior remains unchanged.

Detailed deployment guidance is in `../VERCEL_ENV_SETUP.md`.

## Available Routes

- `/dashboard`
- `/properties`
- `/tenants`
- `/finance`
- `/finance/invoices`
- `/finance/reports`
- `/maintenance/*`
- `/contracts`
- `/settings`
- `/audit-trail`

## Build & Quality

```bash
npm run build
npm run lint
```

## Deployment

- Deploy target: Vercel
- Root directory: `web`
- Production branch: `main`
