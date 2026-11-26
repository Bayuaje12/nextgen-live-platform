-- 01_core_schema.sql
-- NextGen Live - core schema
-- SAFE: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS. NO DROP, NO DATA LOSS.
-- Run after 00_preflight.sql.

begin;

-- Profiles: linked to Supabase Auth users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  blocked_at timestamptz,
  blocked_reason text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility columns for existing databases.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists blocked_at timestamptz;
alter table public.profiles add column if not exists blocked_reason text;
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  host_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
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

alter table public.rooms add column if not exists description text;
alter table public.rooms add column if not exists visibility text not null default 'private';
alter table public.rooms add column if not exists status text not null default 'scheduled';
alter table public.rooms add column if not exists template text not null default 'live';
alter table public.rooms add column if not exists password_protected boolean not null default false;
alter table public.rooms add column if not exists password_hash text;
alter table public.rooms add column if not exists waiting_room_enabled boolean not null default true;
alter table public.rooms add column if not exists locked boolean not null default false;
alter table public.rooms add column if not exists max_participants int not null default 12;
alter table public.rooms add column if not exists scheduled_for timestamptz;
alter table public.rooms add column if not exists created_at timestamptz not null default now();
alter table public.rooms add column if not exists updated_at timestamptz not null default now();

-- Room members
create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  role text not null default 'guest' check (role in ('host', 'cohost', 'moderator', 'guest', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'joined', 'left', 'removed')),
  can_publish boolean not null default false,
  can_chat boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_members add column if not exists guest_name text;
alter table public.room_members add column if not exists role text not null default 'guest';
alter table public.room_members add column if not exists status text not null default 'pending';
alter table public.room_members add column if not exists can_publish boolean not null default false;
alter table public.room_members add column if not exists can_chat boolean not null default true;
alter table public.room_members add column if not exists created_at timestamptz not null default now();
alter table public.room_members add column if not exists updated_at timestamptz not null default now();

-- Chat messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  content text not null,
  type text not null default 'message' check (type in ('message', 'announcement', 'system')),
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists type text not null default 'message';
alter table public.chat_messages add column if not exists pinned boolean not null default false;
alter table public.chat_messages add column if not exists deleted_at timestamptz;
alter table public.chat_messages add column if not exists created_at timestamptz not null default now();

-- Recordings
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

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Username history (admin/account audit)
create table if not exists public.username_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_username text,
  new_username text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_rooms_host_id on public.rooms(host_id);
create index if not exists idx_room_members_room_id on public.room_members(room_id);
create index if not exists idx_room_members_user_id on public.room_members(user_id);
create index if not exists idx_chat_messages_room_id_created_at on public.chat_messages(room_id, created_at);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_username_history_user_id on public.username_history(user_id);

-- Case-insensitive username uniqueness. Allows existing data unless conflict exists.
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

commit;
