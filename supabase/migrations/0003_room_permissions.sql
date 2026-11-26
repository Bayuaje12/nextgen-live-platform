-- Migration 0003: stricter room permission and private-room isolation.
-- Non-destructive.

-- Helper: is room host or admin
create or replace function public.is_room_host(room_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r where r.id = room_uuid and (r.host_id = uid or public.is_admin(uid))
  );
$$;

revoke all on function public.is_room_host(uuid, uuid) from public;
grant execute on function public.is_room_host(uuid, uuid) to authenticated;

-- Helper: active approved/joined member
create or replace function public.is_active_room_member(room_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = room_uuid
      and m.user_id = uid
      and m.status in ('joined', 'approved')
  );
$$;

revoke all on function public.is_active_room_member(uuid, uuid) from public;
grant execute on function public.is_active_room_member(uuid, uuid) to authenticated;

-- Prevent room member self-escalation / unsafe self-updates.
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
  -- Host/admin can manage members.
  if public.is_room_host(new.room_id, actor) then
    -- Even host should not create another host via this table except controlled transfer flow; block direct host assignment.
    if new.role = 'host' and (old.role is distinct from 'host') then
      raise exception 'Host transfer must use controlled flow';
    end if;
    return new;
  end if;

  -- Non-hosts cannot change role/status/capabilities for others.
  if old.user_id is distinct from actor then
    raise exception 'Not authorized to modify this member';
  end if;

  -- Member can only update limited self fields (e.g. leave). No role/status escalation.
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
  for each row execute procedure public.prevent_room_member_escalation();

-- Tighten chat select for private rooms: only active members/host/admin.
drop policy if exists "chat_select_room_access" on public.chat_messages;
create policy "chat_select_room_access" on public.chat_messages
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = chat_messages.room_id
        and (
          (r.visibility = 'public' and r.status <> 'ended')
          or r.host_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    )
    or public.is_active_room_member(chat_messages.room_id, auth.uid())
  );

-- Tighten chat insert: only active members with can_chat or host/admin.
drop policy if exists "chat_insert_authenticated" on public.chat_messages;
create policy "chat_insert_authenticated" on public.chat_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = chat_messages.room_id and (r.host_id = auth.uid() or public.is_admin(auth.uid()))
    )
    or exists (
      select 1 from public.room_members m
      where m.room_id = chat_messages.room_id
        and m.user_id = auth.uid()
        and m.status in ('joined','approved')
        and m.can_chat = true
    )
  );

-- Room members select: restrict private room member visibility to members/host/admin.
drop policy if exists "room_members_select" on public.room_members;
create policy "room_members_select" on public.room_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_room_host(room_id, auth.uid())
    or (
      public.is_active_room_member(room_id, auth.uid())
      and exists (select 1 from public.rooms r where r.id = room_members.room_id)
    )
  );

-- Prevent non-hosts from inserting arbitrary roles; only self as guest/viewer pending/joined or host/admin managed insert.
drop policy if exists "room_members_insert_self" on public.room_members;
create policy "room_members_insert_self" on public.room_members
  for insert to authenticated
  with check (
    (
      user_id = auth.uid()
      and role in ('guest','viewer')
      and status in ('pending','joined','approved')
    )
    or public.is_room_host(room_id, auth.uid())
  );
