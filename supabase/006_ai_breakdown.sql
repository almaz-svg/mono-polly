-- Adds a structured 0-100 rubric breakdown (understanding / originality /
-- feasibility / monetization + feedback / strongPoint / weakPoint) next to
-- the existing single ai_score/ai_reason, so admin and team panels can show
-- the per-criterion detail the judge model returns instead of just the
-- weighted total.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.

alter table submissions add column if not exists ai_breakdown jsonb;

notify pgrst, 'reload schema';
