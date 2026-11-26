-- Hardening migration: add admin helper, tighten policies, and add constraints.
-- Non-destructive: creates/replaces policies and functions where safe.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- Reports: admins can read/update
drop policy if exists "reports_admin_select" on public.reports;
create policy "reports_admin_select" on public.reports
  for select to authenticated
  using (public.is_admin(auth.uid()) or reporter_id = auth.uid());

drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update to authenticated
  using (public.is_admin(auth.uid()));

-- Audit logs: admins only
drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select" on public.audit_logs
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "audit_logs_admin_insert" on public.audit_logs;
create policy "audit_logs_admin_insert" on public.audit_logs
  for insert to authenticated
  with check (public.is_admin(auth.uid()) or actor_id = auth.uid());

-- Profiles: prevent self-escalation to admin via direct update
-- Enforce with trigger rather than policy-only logic.
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
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_role_escalation on public.profiles;
create trigger trg_prevent_profile_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_role_escalation();

-- Rooms: allow admins to manage any room
drop policy if exists "rooms_admin_update" on public.rooms;
create policy "rooms_admin_update" on public.rooms
  for update to authenticated
  using (host_id = auth.uid() or public.is_admin(auth.uid()));

-- Room members: tighten insert - authenticated user can insert self; host/admin can manage
drop policy if exists "room_members_insert_self" on public.room_members;
create policy "room_members_insert_self" on public.room_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.rooms r where r.id = room_members.room_id and (r.host_id = auth.uid() or public.is_admin(auth.uid())))
  );

drop policy if exists "room_members_update_host" on public.room_members;
create policy "room_members_update_host" on public.room_members
  for update to authenticated
  using (
    exists (select 1 from public.rooms r where r.id = room_members.room_id and (r.host_id = auth.uid() or public.is_admin(auth.uid())))
  );

-- Chat: members or public room participants (basic); refine with membership checks for private rooms in app layer.
drop policy if exists "chat_select_room_access" on public.chat_messages;
create policy "chat_select_room_access" on public.chat_messages
  for select using (
    exists (select 1 from public.rooms r where r.id = chat_messages.room_id and r.visibility = 'public')
    or exists (select 1 from public.room_members m where m.room_id = chat_messages.room_id and m.user_id = auth.uid())
    or exists (select 1 from public.rooms r where r.id = chat_messages.room_id and r.host_id = auth.uid())
    or public.is_admin(auth.uid())
  );
