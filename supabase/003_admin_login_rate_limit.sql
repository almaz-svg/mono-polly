-- Tier B fix: lock out admin login after repeated failed attempts.
-- verify_admin_login is callable directly via the anon key (supabase.rpc),
-- so nothing before this stopped an unlimited password-guessing loop
-- straight from devtools/curl. Client-side throttling can't fix that —
-- it has to live in the RPC itself.
--
-- Run this once in the Supabase SQL Editor, after 001_rls_and_secrets.sql.
-- Safe to re-run.

alter table admins add column if not exists failed_attempts int not null default 0;
alter table admins add column if not exists locked_until timestamptz;

create or replace function verify_admin_login(p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin admins%rowtype;
begin
  select * into v_admin from admins where username = p_username;
  if not found then
    return false;
  end if;

  -- Locked: don't touch the counters, don't even compare the password.
  -- (Comparing here would let an attacker keep resetting/extending their
  -- own lockout by hammering the endpoint during the window.)
  if v_admin.locked_until is not null and v_admin.locked_until > now() then
    return false;
  end if;

  if v_admin.password = extensions.crypt(p_password, v_admin.password) then
    update admins set failed_attempts = 0, locked_until = null where id = v_admin.id;
    return true;
  end if;

  update admins
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
    where id = v_admin.id;
  return false;
end;
$$;

revoke all on function verify_admin_login(text, text) from public;
grant execute on function verify_admin_login(text, text) to anon, authenticated;
