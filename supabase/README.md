# Armitage Operations Supabase Setup

This app is designed for Supabase auth, Postgres, and private photo storage.

1. Create a Supabase project for `ops.armitageinteriors.com`.
2. Run `supabase/schema.sql` in the SQL editor or through the Supabase CLI.
3. Add these Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Keep the `field-report-photos` bucket private. Signed URLs should be generated for PM/office review screens.
5. Do not automate client delivery of change orders. The database status model stops at PM review / manual send.

The local preview path writes submitted reports to `storage/operations/field-reports.json` and photos to
`storage/operations/photos`. That keeps field-report submission testable before the Supabase client is wired in.
