-- Each team color must be unique within a game (client already filters
-- the picker, this is the race-condition backstop for two teams
-- submitting the same color at the same time).
--
-- Run this once in the Supabase SQL Editor, after 001_rls_and_secrets.sql.

alter table teams
  add constraint teams_game_color_unique unique (game_id, color);
