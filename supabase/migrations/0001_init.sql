-- NextGen Live initial schema
-- Apply in Supabase SQL editor or via Supabase CLI migrations.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  host_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('public','private')),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  template text not null default 'live',
  password_protected boolean not null default false,
  password_hash text,
  waiting_room_enabled boolean not null default true,
  locked boolean not null default false,
  max_participants int not null default 12 check (max_participants between 2 and 50),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  role text not null default 'guest' check (role in ('host','cohost','moderator','guest','viewer')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','joined','left','removed')),
  can_publish boolean not null default false,
  can_chat boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  content text not null,
  type text not null default 'message' check (type in ('message','announcement','system')),
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  duration_seconds numeric,
  storage text not null default 'local-browser',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rooms_host_id on public.rooms(host_id);
create index if not exists idx_room_members_room_id on public.room_members(room_id);
create index if not exists idx_chat_messages_room_id_created_at on public.chat_messages(room_id, created_at);
create index if not exists idx_reports_status on public.reports(status);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.recordings enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can read public-ish profile basics and update own profile.
create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Rooms: public rooms readable, hosts manage own rooms.
create policy "rooms_select_public_or_member" on public.rooms for select using (
  visibility = 'public' or host_id = auth.uid() or exists (
    select 1 from public.room_members m where m.room_id = rooms.id and m.user_id = auth.uid()
  )
);
create policy "rooms_insert_host" on public.rooms for insert to authenticated with check (host_id = auth.uid());
create policy "rooms_update_host" on public.rooms for update to authenticated using (host_id = auth.uid());

-- Room members: users can see memberships for rooms they belong to/host; insert controlled by app flow.
create policy "room_members_select" on public.room_members for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.rooms r where r.id = room_members.room_id and r.host_id = auth.uid())
);
create policy "room_members_insert_self" on public.room_members for insert to authenticated with check (user_id = auth.uid() or user_id is null);

-- Chat: room members can read/insert; basic policy - refine in production.
create policy "chat_select_room_access" on public.chat_messages for select using (
  exists (select 1 from public.rooms r where r.id = chat_messages.room_id and (r.visibility = 'public' or r.host_id = auth.uid()))
  or exists (select 1 from public.room_members m where m.room_id = chat_messages.room_id and m.user_id = auth.uid())
);
create policy "chat_insert_authenticated" on public.chat_messages for insert to authenticated with check (
  exists (select 1 from public.room_members m where m.room_id = chat_messages.room_id and m.user_id = auth.uid() and m.can_chat = true)
  or exists (select 1 from public.rooms r where r.id = chat_messages.room_id and r.host_id = auth.uid())
);

-- Recordings: owner only.
create policy "recordings_owner_select" on public.recordings for select to authenticated using (owner_id = auth.uid());
create policy "recordings_owner_insert" on public.recordings for insert to authenticated with check (owner_id = auth.uid());

-- Reports: reporter inserts, admins read/update (admin check via profile role should be added via function in hardened deployment).
create policy "reports_insert" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports_select_own" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- Audit logs: no direct client access by default.
-- Add admin-only policies using a secure role-check function before exposing.

-- Profile bootstrap trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
