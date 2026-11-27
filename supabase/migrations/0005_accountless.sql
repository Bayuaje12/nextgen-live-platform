-- 0005_accountless.sql
-- Accountless guest session and room credential foundation.
-- SAFE: additive/non-destructive where possible. NO DROP TABLE, NO DATA LOSS.
-- Do NOT execute automatically in production without review.

begin;

create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null unique,
  display_name text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_sessions_expires_at_idx on public.guest_sessions (expires_at);
create index if not exists guest_sessions_revoked_at_idx on public.guest_sessions (revoked_at);

create table if not exists public.room_credentials (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  guest_session_id uuid references public.guest_sessions(id) on delete set null,
  role text not null check (role in ('host','cohost','moderator','guest','viewer')),
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists room_credentials_room_id_idx on public.room_credentials (room_id);
create index if not exists room_credentials_guest_session_id_idx on public.room_credentials (guest_session_id);

-- Room members: allow guest-session based identity without requiring auth.users.
alter table public.room_members add column if not exists guest_session_id uuid references public.guest_sessions(id) on delete set null;
alter table public.room_members add column if not exists display_name text;
create index if not exists room_members_guest_session_id_idx on public.room_members (guest_session_id);

-- Chat messages: allow guest-session based identity.
alter table public.chat_messages add column if not exists guest_session_id uuid references public.guest_sessions(id) on delete set null;
create index if not exists chat_messages_guest_session_id_idx on public.chat_messages (guest_session_id);

-- Rooms: optional owner guest session for accountless host.
alter table public.rooms alter column host_id drop not null;
alter table public.rooms add column if not exists owner_guest_session_id uuid references public.guest_sessions(id) on delete set null;
alter table public.rooms add column if not exists room_code text;
create index if not exists rooms_room_code_idx on public.rooms (room_code);

-- Disable RLS on guest/session tables by default for backend-only access patterns.
-- Backend must use service role and enforce authorization. Do not expose service role to frontend.
alter table public.guest_sessions enable row level security;
alter table public.room_credentials enable row level security;

-- No permissive policies added: backend service role only.

commit;
