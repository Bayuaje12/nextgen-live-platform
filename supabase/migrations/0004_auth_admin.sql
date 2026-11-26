-- Migration 0004: username-based auth support, account status, admin management.
-- Non-destructive and compatible with existing users.

alter table public.profiles
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists last_login_at timestamptz;

-- Case-insensitive username uniqueness. Existing username unique constraint remains;
-- this prevents case-variant duplicates.
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_is_blocked_idx on public.profiles (is_blocked);
create index if not exists profiles_role_idx on public.profiles (role);

-- Admin audit log helper (server/service role may also insert directly).
create or replace function public.log_admin_action(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (p_actor_id, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.log_admin_action(uuid, text, text, text, jsonb) from public;
grant execute on function public.log_admin_action(uuid, text, text, text, jsonb) to authenticated;

-- Admins can read all profiles for account management.
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select to authenticated
  using (public.is_admin(auth.uid()) or auth.uid() = id);

-- Admins can update profiles for account management (role escalation still guarded by trigger).
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.is_admin(auth.uid()) or auth.uid() = id);

-- Ensure blocked users cannot self-update sensitive fields through normal client; backend uses service role.
-- Keep existing policies but admin/server paths handle blocks.

-- Audit logs: admins can read.
drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select" on public.audit_logs
  for select to authenticated
  using (public.is_admin(auth.uid()));
