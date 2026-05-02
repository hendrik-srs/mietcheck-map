-- =====================================================================
-- MietCheck Map — Grant table privileges to Supabase API roles
-- =====================================================================
-- The initial schema enabled RLS and added public-read policies, but
-- Postgres still requires explicit GRANTs for each role to access the
-- table at all (RLS filters rows, GRANT controls table access).
--
-- Because the project has "Automatically expose new tables and functions"
-- disabled (good security default), Supabase does not auto-grant on
-- table creation. We grant manually here.
--
-- Roles in Supabase:
--   * anon          — used by the publishable key (browser, unauth users)
--   * authenticated — logged-in users (future)
--   * service_role  — used by the secret key, bypasses RLS
-- =====================================================================

-- Reference / read-only data: anyone may SELECT (RLS still applies, but
-- our policies allow public read for these tables).
grant select on public.cities           to anon, authenticated;
grant select on public.districts        to anon, authenticated;
grant select on public.data_sources     to anon, authenticated;
grant select on public.rent_data_points to anon, authenticated;

-- Service role needs full access for ingestion jobs and admin tasks.
grant all on public.cities           to service_role;
grant all on public.districts        to service_role;
grant all on public.data_sources     to service_role;
grant all on public.rent_data_points to service_role;

-- Sequences for any tables with serial/bigserial PKs (not currently used
-- since we use UUIDs and text PKs, but future-proofing for ingestion).
grant usage, select on all sequences in schema public to service_role;

-- Default privileges so that tables / sequences created in the FUTURE
-- automatically receive these grants. This keeps the same security
-- posture without us having to add a GRANT to every new migration.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant all    on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
