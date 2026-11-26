-- 04_account_management.sql
-- NextGen Live - account management, username/admin support, audit helpers.
-- SAFE: idempotent where possible. NO DROP TABLE, NO DATA LOSS.
-- Run after 03_room_permissions.sql.

begin;

-- ---------------------------------------------------------------------------
-- Profile/account columns (compatibility-safe)
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists blocked_at timestamptz;
alter table public.profiles add column if not exists blocked_reason text;
alter table public.profiles add column if not exists last_login_at timestamptz;

-- Case-insensitive username uniqueness (idempotent). May fail only if existing
-- data already contains case-insensitive duplicates; resolve duplicates manually.
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_is_blocked_idx on public.profiles (is_blocked);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Admin audit helper
-- ---------------------------------------------------------------------------

create or replace function public.log_admin_action(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
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

-- ---------------------------------------------------------------------------
-- Blocked-account safeguards
-- ---------------------------------------------------------------------------

-- Prevent blocked users from creating rooms through client policies.
drop policy if exists "rooms_insert_host" on public.rooms;
create policy "rooms_insert_host"
  on public.rooms
  for insert
  to authenticated
  with check (
    host_id = auth.uid()
    and coalesce((select p.is_blocked from public.profiles p where p.id = auth.uid()), false) = false
  );

-- Prevent blocked users from inserting chat messages through client policies.
drop policy if exists "chat_insert_authenticated" on public.chat_messages;
create policy "chat_insert_authenticated"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.rooms r
      where r.id = chat_messages.room_id
        and (r.host_id = auth.uid() or public.is_admin(auth.uid()))
    )
    or exists (
      select 1
      from public.room_members m
      where m.room_id = chat_messages.room_id
        and m.user_id = auth.uid()
        and m.status in ('joined', 'approved')
        and m.can_chat = true
        and coalesce((select p.is_blocked from public.profiles p where p.id = auth.uid()), false) = false
    )
  );

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
-- Passwords are managed by Supabase Auth (bcrypt/hash internally). Do NOT store plaintext passwords.
-- Username+password login for username-only accounts should be implemented via trusted backend:
-- backend looks up profile by username using service role, then authenticates via Supabase Auth.
-- Admin password reset must use Supabase Auth Admin API from trusted backend only.
-- Never expose service_role key to frontend.

commit;
