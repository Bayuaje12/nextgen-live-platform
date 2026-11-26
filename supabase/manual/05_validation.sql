-- 05_validation.sql
-- NextGen Live - read-only validation checks.
-- SAFE: SELECT-only. NO DATA MODIFICATION.
-- Run after 04_account_management.sql.

-- Required tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles', 'rooms', 'room_members', 'chat_messages',
    'recordings', 'reports', 'audit_logs', 'username_history'
  )
order by table_name;

-- Required profile columns
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'id','email','username','display_name','role','is_blocked',
    'blocked_at','blocked_reason','last_login_at','created_at','updated_at'
  )
order by column_name;

-- RLS enabled
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles','rooms','room_members','chat_messages',
    'recordings','reports','audit_logs','username_history'
  )
order by tablename;

-- Key functions
select n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin', 'is_room_host', 'is_active_room_member',
    'handle_new_user', 'prevent_profile_role_escalation',
    'log_username_change', 'prevent_room_member_escalation',
    'log_admin_action'
  )
order by p.proname, args;

-- Policies
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','rooms','room_members','chat_messages',
    'recordings','reports','audit_logs','username_history'
  )
order by tablename, policyname;

-- Indexes (username uniqueness and key lookups)
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('profiles','rooms','room_members','chat_messages','audit_logs','username_history')
order by tablename, indexname;

-- Triggers
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('profiles','room_members','auth.users')
order by table_name, trigger_name;
