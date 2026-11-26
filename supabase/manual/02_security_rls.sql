-- 02_security_rls.sql
-- NextGen Live - security helpers, triggers, RLS, and base policies.
-- SAFE: uses CREATE OR REPLACE / DROP POLICY IF EXISTS. NO DROP TABLE, NO DATA LOSS.
-- Run after 01_core_schema.sql.

begin;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Admin check: based on profiles.role, not user-editable metadata.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'
      and coalesce(p.is_blocked, false) = false
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile bootstrap on auth.users insert
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  dname text;
begin
  uname := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  if uname is null then
    uname := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  dname := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if dname is null then
    dname := uname;
  end if;

  insert into public.profiles (id, email, username, display_name, role)
  values (new.id, new.email, uname, dname, 'user')
  on conflict (id) do update
    set email = excluded.email,
        username = coalesce(public.profiles.username, excluded.username),
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Prevent role self-escalation
-- ---------------------------------------------------------------------------

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_admin(auth.uid()) then
      raise exception 'Only admins can change roles';
    end if;
  end if;

  -- Blocked users should not be able to modify their own profile via client.
  if auth.uid() = old.id and coalesce(old.is_blocked, false) = true and not public.is_admin(auth.uid()) then
    raise exception 'Blocked account cannot modify profile';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_role_escalation on public.profiles;
create trigger trg_prevent_profile_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

-- ---------------------------------------------------------------------------
-- Username history audit
-- ---------------------------------------------------------------------------

create or replace function public.log_username_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.username is distinct from old.username then
    insert into public.username_history (user_id, old_username, new_username, changed_by)
    values (new.id, old.username, new.username, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_username_change on public.profiles;
create trigger trg_log_username_change
  after update on public.profiles
  for each row execute function public.log_username_change();

-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.recordings enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.username_history enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles policies
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_select" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own_or_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin(auth.uid()) or auth.uid() = id)
  with check (public.is_admin(auth.uid()) or auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Rooms policies (base; refined in 03)
-- ---------------------------------------------------------------------------

drop policy if exists "rooms_select_public_or_member" on public.rooms;
drop policy if exists "rooms_insert_host" on public.rooms;
drop policy if exists "rooms_update_host" on public.rooms;
drop policy if exists "rooms_admin_update" on public.rooms;

create policy "rooms_select_public_or_member"
  on public.rooms
  for select
  using (
    visibility = 'public'
    or host_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (
      select 1 from public.room_members m
      where m.room_id = rooms.id and m.user_id = auth.uid()
    )
  );

create policy "rooms_insert_host"
  on public.rooms
  for insert
  to authenticated
  with check (host_id = auth.uid() and coalesce((select p.is_blocked from public.profiles p where p.id = auth.uid()), false) = false);

create policy "rooms_update_host_or_admin"
  on public.rooms
  for update
  to authenticated
  using (host_id = auth.uid() or public.is_admin(auth.uid()))
  with check (host_id = auth.uid() or public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Room members policies (base; refined in 03)
-- ---------------------------------------------------------------------------

drop policy if exists "room_members_select" on public.room_members;
drop policy if exists "room_members_insert_self" on public.room_members;
drop policy if exists "room_members_update_host" on public.room_members;

create policy "room_members_select_base"
  on public.room_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (
      select 1 from public.rooms r
      where r.id = room_members.room_id and r.host_id = auth.uid()
    )
  );

create policy "room_members_insert_base"
  on public.room_members
  for insert
  to authenticated
  with check (
    (user_id = auth.uid() and role in ('guest', 'viewer'))
    or exists (
      select 1 from public.rooms r
      where r.id = room_members.room_id and (r.host_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy "room_members_update_base"
  on public.room_members
  for update
  to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.rooms r
      where r.id = room_members.room_id and r.host_id = auth.uid()
    )
  )
  with check (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.rooms r
      where r.id = room_members.room_id and r.host_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Chat policies (base; refined in 03)
-- ---------------------------------------------------------------------------

drop policy if exists "chat_select_room_access" on public.chat_messages;
drop policy if exists "chat_insert_authenticated" on public.chat_messages;

create policy "chat_select_base"
  on public.chat_messages
  for select
  using (
    exists (
      select 1 from public.rooms r
      where r.id = chat_messages.room_id
        and (r.visibility = 'public' or r.host_id = auth.uid() or public.is_admin(auth.uid()))
    )
    or exists (
      select 1 from public.room_members m
      where m.room_id = chat_messages.room_id and m.user_id = auth.uid()
    )
  );

create policy "chat_insert_base"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = chat_messages.room_id and (r.host_id = auth.uid() or public.is_admin(auth.uid()))
    )
    or exists (
      select 1 from public.room_members m
      where m.room_id = chat_messages.room_id
        and m.user_id = auth.uid()
        and m.status in ('joined', 'approved')
        and m.can_chat = true
    )
  );

-- ---------------------------------------------------------------------------
-- Recordings policies
-- ---------------------------------------------------------------------------

drop policy if exists "recordings_owner_select" on public.recordings;
drop policy if exists "recordings_owner_insert" on public.recordings;

create policy "recordings_owner_select"
  on public.recordings
  for select
  to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()));

create policy "recordings_owner_insert"
  on public.recordings
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports policies
-- ---------------------------------------------------------------------------

drop policy if exists "reports_insert" on public.reports;
drop policy if exists "reports_select_own" on public.reports;
drop policy if exists "reports_admin_select" on public.reports;
drop policy if exists "reports_admin_update" on public.reports;

create policy "reports_insert"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "reports_select_own_or_admin"
  on public.reports
  for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_admin(auth.uid()));

create policy "reports_admin_update"
  on public.reports
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Audit logs policies
-- ---------------------------------------------------------------------------

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
drop policy if exists "audit_logs_admin_insert" on public.audit_logs;

create policy "audit_logs_admin_select"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "audit_logs_admin_insert"
  on public.audit_logs
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()) or actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Username history policies
-- ---------------------------------------------------------------------------

drop policy if exists "username_history_select_own_or_admin" on public.username_history;
create policy "username_history_select_own_or_admin"
  on public.username_history
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

commit;
