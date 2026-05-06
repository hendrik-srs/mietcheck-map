-- =====================================================================
-- MietCheck Map — Crowdsourced rent submissions (Phase 4.5)
-- =====================================================================
-- Anonymous opt-in submissions from the Fairness-Check form. We deliberately
-- store NO identifying data:
--   * no IP, no user agent, no email, no user id
--   * no street address (only the resolved district_id)
--   * coarse building-age bracket only
-- The submitter is gone the moment the row is inserted.
--
-- Submissions land with status='pending'. Operator (the project owner) reviews
-- via Supabase Studio and flips status to 'approved' or 'rejected'. Only
-- approved rows are publicly readable; later phases will surface them on the
-- map and in the verdict logic.
--
-- Inserts are done exclusively through the service-role admin client via the
-- submit_crowdsourced_rent RPC. There is no public INSERT policy — that keeps
-- the surface for abuse small and lets the server action validate cleanly.
-- =====================================================================

create table if not exists public.crowdsourced_rents (
  id                    uuid primary key default gen_random_uuid(),
  district_id           uuid not null references public.districts(id) on delete cascade,
  size_sqm              numeric(6,2) not null,
  monthly_rent_eur      numeric(8,2) not null,
  building_age_bracket  text,
  status                text not null default 'pending',
  submitted_at          timestamptz not null default now(),
  reviewed_at           timestamptz,
  review_notes          text,
  constraint crowdsourced_rents_size_check
    check (size_sqm > 5 and size_sqm < 1000),
  constraint crowdsourced_rents_rent_check
    check (monthly_rent_eur > 50 and monthly_rent_eur < 20000),
  constraint crowdsourced_rents_age_check
    check (building_age_bracket is null or building_age_bracket in (
      'vor_1949', '1949_1990', '1991_2010', 'nach_2010'
    )),
  constraint crowdsourced_rents_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists crowdsourced_rents_district_status_idx
  on public.crowdsourced_rents (district_id, status);
create index if not exists crowdsourced_rents_status_submitted_idx
  on public.crowdsourced_rents (status, submitted_at desc);

comment on table public.crowdsourced_rents is
  'Opt-in anonymous rent submissions from /check. Only status=approved rows are public.';

-- Row Level Security ---------------------------------------------------
alter table public.crowdsourced_rents enable row level security;

drop policy if exists "Public read approved crowdsourced_rents"
  on public.crowdsourced_rents;

create policy "Public read approved crowdsourced_rents"
  on public.crowdsourced_rents for select
  using (status = 'approved');

-- Grants: anon/authenticated may SELECT (RLS still filters to approved rows).
-- service_role gets full access for inserts and review actions.
grant select on public.crowdsourced_rents to anon, authenticated;
grant all    on public.crowdsourced_rents to service_role;

-- =====================================================================
-- RPC: submit_crowdsourced_rent
-- =====================================================================
-- Server-action entry point. Always inserts as 'pending'. Returns the new id
-- so the caller can show a confirmation. Validates inputs at the edge so a
-- compromised client can't inject odd values; the Zod check on the Next.js
-- side is the first line, this is the last.
--
-- Caller MUST be the service_role client. The function is SECURITY INVOKER
-- (default) and the public role does not have INSERT privileges, so an
-- accidental anon-key call will fail.
-- =====================================================================
create or replace function public.submit_crowdsourced_rent(
  p_district_id           uuid,
  p_size_sqm              numeric,
  p_monthly_rent_eur      numeric,
  p_building_age_bracket  text default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_district_id is null then
    raise exception 'district_id is required';
  end if;

  insert into public.crowdsourced_rents (
    district_id, size_sqm, monthly_rent_eur, building_age_bracket
  )
  values (
    p_district_id, p_size_sqm, p_monthly_rent_eur, p_building_age_bracket
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.submit_crowdsourced_rent is
  'Insert an anonymous rent submission as status=pending. Service-role only.';
