# Supabase

This folder contains all database migrations and seed data for MietCheck Map.

## Applying migrations

For now, while we don't have the Supabase CLI set up, apply migrations
manually via the Supabase dashboard:

1. Open your Supabase project → **SQL Editor** → **+ New query**
2. Paste the contents of the next un-applied migration file
   from `migrations/` (in chronological order)
3. Click **Run**
4. Verify success in the Output panel

When we ingest data, the next phase will add automated migration tooling.

## Migration order

Run in chronological order:

1. `20260502_0001_initial_schema.sql` — PostGIS extension, cities, districts,
   data_sources, rent_data_points, RLS policies
