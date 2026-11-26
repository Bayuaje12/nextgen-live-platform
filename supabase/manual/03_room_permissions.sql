-- 03_room_permissions.sql
-- NextGen Live - room permission helpers, triggers, and refined RLS policies.
-- SAFE: CREATE OR REPLACE / DROP POLICY IF EXISTS. NO DROP TABLE, NO DATA LOSS.
-- Run after 02_security_rls.sql.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_room_host(room_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = room_uuid
      and (r.host_id = uid or public.is_admin(uid))
  );
$$;

revoke all on function public.is_room_host(uuid, uuid) from public;
grant execute on function public.is_room_host(uuid, uuid) to authenticated;

create or replace function public.is_active_room_member(room_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members m
    where m.room_id = room_uuid
      and m.user_id = uid
      and m.status in ('joined', 'approved')
  );
$$;

revoke all on function public.is_active_room_member(uuid, uuid) from public;
grant execute on function public.is_active_room_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Room member self-escalation protection
-- ---------------------------------------------------------------------------

create or replace function public.prevent_room_member_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
begin
  actor := auth.uid();

  if public.is_room_host(new.room_id, actor) then
    if new.role = 'host' and (old.role is distinct from 'host') then
      raise exception 'Host transfer must use controlled flow';
    end if;
    return new;
  end if;

  if old.user_id is distinct from actor then
    raise exception 'Not authorized to modify this member';
  end if;

  if new.role is distinct from old.role then
    raise exception 'Cannot change own role';
  end if;
  if new.status not in ('left') and new.status is distinct from old.status then
    raise exception 'Cannot change own status';
  end if;
  if new.can_publish is distinct from old.can_publish or new.can_chat is distinct from old.can_chat then
    raise exception 'Cannot change own capabilities';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_room_member_escalation on public.room_members;
create trigger trg_prevent_room_member_escalation
  before update on public.room_members
  for each row execute function public.prevent_room_member_escalation();

-- ---------------------------------------------------------------------------
-- Refined room policies
-- ---------------------------------------------------------------------------

drop policy if exists "rooms_select_public_or_member" on public.rooms;
create policy "rooms_select_public_or_member"
  on public.rooms
  for select
  using (
    visibility = 'public'
    or host_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.is_active_room_member(id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Refined room_members policies
-- ---------------------------------------------------------------------------

drop policy if exists "room_members_select_base" on public.room_members;
drop policy if exists "room_members_insert_base" on public.room_members;
drop policy if exists "room_members_update_base" on public.room_members;
drop policy if exists "room_members_select" on public.room_members;
drop policy if exists "room_members_insert_self" on public.room_members;
drop policy if exists "room_members_update_host" on public.room_members;

create policy "room_members_select"
  on public.room_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_room_host(room_id, auth.uid())
    or public.is_active_room_member(room_id, auth.uid())
  );

create policy "room_members_insert"
  on public.room_members
  for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and role in ('guest', 'viewer')
      and status in ('pending', 'joined', 'approved')
    )
    or public.is_room_host(room_id, auth.uid())
  );

create policy "room_members_update"
  on public.room_members
  for update
  to authenticated
  using (
    public.is_room_host(room_id, auth.uid())
    or user_id = auth.uid()
  )
  with check (
    public.is_room_host(room_id, auth.uid())
    or user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Refined chat policies for private-room isolation
-- ---------------------------------------------------------------------------

drop policy if exists "chat_select_base" on public.chat_messages;
drop policy if exists "chat_insert_base" on public.chat_messages;
drop policy if exists "chat_select_room_access" on public.chat_messages;
drop policy if exists "chat_insert_authenticated" on public.chat_messages;

create policy "chat_select_room_access"
  on public.chat_messages
  for select
  using (
    exists (
      select 1
      from public.rooms r
      where r.id = chat_messages.room_id
        and (
          (r.visibility = 'public' and r.status <> 'ended')
          or r.host_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    )
    or public.is_active_room_member(chat_messages.room_id, auth.uid())
  );

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

commit;
