-- Tier A security fix: enable RLS everywhere (formalizing current open
-- behaviour) and stop the anon key from ever being able to read
-- teams.password / admins.password.
--
-- Run this once in the Supabase SQL Editor for your project.
-- Safe to re-run (uses IF NOT EXISTS / regex guards where it matters).

-- 1. Enable RLS on every table, with permissive policies that keep
--    current behaviour unchanged for everything except `admins`.
alter table games enable row level security;
alter table teams enable row level security;
alter table rounds enable row level security;
alter table market_events enable row level security;
alter table submissions enable row level security;
alter table peer_scores enable row level security;
alter table share_history enable row level security;
alter table admins enable row level security;

drop policy if exists "games_select" on games;
drop policy if exists "games_insert" on games;
drop policy if exists "games_update" on games;
create policy "games_select" on games for select using (true);
create policy "games_insert" on games for insert with check (true);
create policy "games_update" on games for update using (true) with check (true);

drop policy if exists "teams_select" on teams;
drop policy if exists "teams_insert" on teams;
drop policy if exists "teams_update" on teams;
create policy "teams_select" on teams for select using (true);
create policy "teams_insert" on teams for insert with check (true);
create policy "teams_update" on teams for update using (true) with check (true);

drop policy if exists "rounds_select" on rounds;
drop policy if exists "rounds_insert" on rounds;
drop policy if exists "rounds_update" on rounds;
create policy "rounds_select" on rounds for select using (true);
create policy "rounds_insert" on rounds for insert with check (true);
create policy "rounds_update" on rounds for update using (true) with check (true);

drop policy if exists "market_events_select" on market_events;
drop policy if exists "market_events_insert" on market_events;
create policy "market_events_select" on market_events for select using (true);
create policy "market_events_insert" on market_events for insert with check (true);

drop policy if exists "submissions_select" on submissions;
drop policy if exists "submissions_insert" on submissions;
drop policy if exists "submissions_update" on submissions;
create policy "submissions_select" on submissions for select using (true);
create policy "submissions_insert" on submissions for insert with check (true);
create policy "submissions_update" on submissions for update using (true) with check (true);

drop policy if exists "peer_scores_select" on peer_scores;
drop policy if exists "peer_scores_insert" on peer_scores;
create policy "peer_scores_select" on peer_scores for select using (true);
create policy "peer_scores_insert" on peer_scores for insert with check (true);

drop policy if exists "share_history_select" on share_history;
drop policy if exists "share_history_insert" on share_history;
create policy "share_history_select" on share_history for select using (true);
create policy "share_history_insert" on share_history for insert with check (true);

-- `admins` intentionally gets NO policies: with RLS enabled and zero
-- policies, anon/authenticated get zero rows back, full stop. The only
-- door in is the security-definer RPC below.
revoke all on admins from anon, authenticated;

-- 2. Stop the password column from ever being selectable directly,
--    even via `select('*')` (PostgREST omits columns the role has no
--    SELECT privilege on instead of erroring).
revoke select (password) on teams from anon, authenticated;

-- 3. Hash passwords at rest instead of storing them in plaintext.
create extension if not exists pgcrypto;

create or replace function hash_team_password()
returns trigger
language plpgsql
as $$
begin
  if new.password is not null and new.password !~ '^\$2[aby]\$' then
    new.password := crypt(new.password, gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_team_password on teams;
create trigger trg_hash_team_password
  before insert or update of password on teams
  for each row execute function hash_team_password();

-- One-time backfill for rows created before this migration.
update teams set password = crypt(password, gen_salt('bf'))
  where password is not null and password !~ '^\$2[aby]\$';
update admins set password = crypt(password, gen_salt('bf'))
  where password is not null and password !~ '^\$2[aby]\$';

-- 4. The only way to check a password now: security-definer RPCs that
--    run with elevated privileges and only ever return non-secret
--    fields, never the password/hash itself.
create or replace function verify_team_login(p_team_id uuid, p_password text)
returns table(id uuid, name text, color text, shares int, game_id uuid)
language sql
security definer
set search_path = public
as $$
  select t.id, t.name, t.color, t.shares, t.game_id
  from teams t
  where t.id = p_team_id and t.password = crypt(p_password, t.password);
$$;

create or replace function verify_admin_login(p_username text, p_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins a
    where a.username = p_username and a.password = crypt(p_password, a.password)
  );
$$;

revoke all on function verify_team_login(uuid, text) from public;
revoke all on function verify_admin_login(text, text) from public;
grant execute on function verify_team_login(uuid, text) to anon, authenticated;
grant execute on function verify_admin_login(text, text) to anon, authenticated;

-- 5. IMPORTANT: after this migration, the only way into /admin is a row
-- in `admins` with username='admin' (the hardcoded 'marketwars2024'
-- bundle fallback is gone). If you don't already have an admin row,
-- uncomment and run this with your own password before deploying:
-- insert into admins (username, password) values ('admin', 'choose-a-real-password');
