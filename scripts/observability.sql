-- ============================================================================
-- PROTOCOL MAKER — OBSERVABILITY VIEWS + ADMIN QUERIES
-- ============================================================================
-- Run this in Supabase SQL Editor when you want to see what's happening
-- across all users. Safe to run repeatedly — view is replaced each time.
--
-- Use these to spot problems EARLY:
--   - fallback_count / n > 10% → AI is failing → check API keys / quotas
--   - groq dominating claude → ANTHROPIC_API_KEY misconfigured or rate-limited
--   - bio_age_delta swinging wildly → engine calibration drift
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 7-day rollup view: model_used + generation_source breakdown per day
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.protocol_stats_7d as
select
  date_trunc('day', created_at)::date          as day,
  coalesce(model_used, '(null)')               as model_used,
  coalesce(generation_source, '(null)')        as generation_source,
  count(*)                                     as n,
  round(avg(longevity_score)::numeric, 1)      as avg_score,
  round(avg(biological_age_decimal)::numeric, 2) as avg_bio_age,
  round(avg(aging_pace)::numeric, 3)           as avg_pace,
  count(*) filter (where generation_source = 'fallback') as fallback_count
from public.protocols
where created_at > now() - interval '7 days'
  and deleted_at is null
group by 1, 2, 3
order by 1 desc, n desc;

grant select on public.protocol_stats_7d to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 30-day per-user activity (who's logging, who's churned)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.user_activity_30d as
select
  p.id as user_id,
  p.created_at as profile_created,
  p.onboarding_completed,
  (select max(created_at) from public.protocols where user_id = p.id and deleted_at is null) as last_protocol_at,
  (select count(*) from public.protocols where user_id = p.id and deleted_at is null) as protocol_count,
  (select count(*) from public.blood_tests where user_id = p.id and deleted_at is null) as blood_test_count,
  (select count(distinct date) from public.daily_metrics where user_id = p.id and date > current_date - 30) as days_logged_30d,
  (select count(*) from public.compliance_logs where user_id = p.id and date > current_date - 30 and completed = true) as compliance_completed_30d,
  (select count(*) from public.compliance_logs where user_id = p.id and date > current_date - 30) as compliance_total_30d,
  case
    when (select max(date) from public.daily_metrics where user_id = p.id) > current_date - 7 then 'active'
    when (select max(date) from public.daily_metrics where user_id = p.id) > current_date - 30 then 'occasional'
    when (select max(date) from public.daily_metrics where user_id = p.id) > current_date - 90 then 'cold'
    else 'churned'
  end as activity_state
from public.profiles p
where p.deleted_at is null;

grant select on public.user_activity_30d to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AT-A-GLANCE QUERIES — copy/paste in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Last 7 days protocol generation breakdown
-- select * from protocol_stats_7d;

-- 2) Fallback rate (alert if > 10%)
-- select
--   round(100.0 * sum(case when generation_source = 'fallback' then 1 else 0 end) / count(*), 1) as fallback_pct,
--   count(*) as total
-- from protocols
-- where created_at > now() - interval '7 days' and deleted_at is null;

-- 3) Active vs churned users
-- select activity_state, count(*) from user_activity_30d group by 1;

-- 4) Top 20 most active users last 30 days
-- select user_id, days_logged_30d, compliance_completed_30d, protocol_count
-- from user_activity_30d
-- where activity_state = 'active'
-- order by days_logged_30d desc, compliance_completed_30d desc
-- limit 20;

-- 5) Onboarded but never generated a protocol (broken funnel)
-- select count(*) from user_activity_30d where onboarding_completed = true and protocol_count = 0;

-- 6) Average bio age delta this week (engine drift check)
-- select
--   round(avg(biological_age_decimal - chronological_age)::numeric, 2) as avg_delta,
--   stddev(biological_age_decimal - chronological_age) as delta_stddev,
--   count(*) as n
-- from protocols
-- cross join lateral (select (protocol_json -> 'diagnostic' ->> 'chronologicalAge')::numeric as chronological_age) c
-- where created_at > now() - interval '7 days' and deleted_at is null;
