# Armitage Ops

Armitage Ops is a private internal operations-control app for residential remodeling projects. It is focused on daily field reporting, variance tracking, schedule enforcement, proof photos, labor logging, and PM-reviewed change-order draft readiness.

This is not generic project management software. The morning whiteboard remains the plan; the end-of-day field report records the jobsite reality and the exceptions that need enforcement tomorrow.

## MVP scope

- `/login`
- `/projects`
- `/projects/[slug]`
- `/projects/[slug]/board`
- `/projects/[slug]/field-report/new`
- `/projects/[slug]/reports/[reportId]`
- `/projects/[slug]/change-orders/[id]`
- `/projects/[slug]/schedule`

The intended production stack is Next.js App Router, TypeScript, Supabase auth/database/photo storage, Vercel deployment, and GitHub integration.

## Project structure

- `app/` route files and page layouts
- `components/` shared UI building blocks
- `lib/` local data helpers, scheduling logic, types, and app rules
- `prisma/` database schema and seed entry point
- `supabase/` SQL schema notes for the Supabase migration
- `public/ops-schedule-template.csv` schedule import template

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

For the current local preview fallback:

```bash
node scripts/temp-homepage-server.mjs
```

## Deployment path

1. Push this repo to GitHub.
2. Connect GitHub to Vercel.
3. Create the Supabase project.
4. Add Supabase environment variables to Vercel.
5. Replace local JSON persistence with Supabase database and storage calls.

Change orders are draft-only in this app. They require PM review and are never sent automatically.
