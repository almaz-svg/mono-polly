-- Bug fix: TeamPanel.jsx and Admin.jsx have referenced submissions.screenshot_url
-- since the screenshot-upload feature was added, but no migration ever created
-- the column — it only ever existed in README's original CREATE TABLE-less form.
-- Every submission insert has been failing with "Could not find the
-- 'screenshot_url' column of 'submissions' in the schema cache" as a result,
-- with or without an attached screenshot.
--
-- Run this once in the Supabase SQL Editor.
-- Safe to re-run.

alter table submissions add column if not exists screenshot_url text;

-- PostgREST caches the schema; reload it so the new column is visible
-- immediately instead of waiting for the next automatic refresh.
notify pgrst, 'reload schema';
