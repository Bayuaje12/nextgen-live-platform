-- 00_preflight.sql
-- NextGen Live - Supabase/PostgreSQL manual SQL
-- Purpose: safe preflight checks and required extensions.
-- SAFE: read-mostly / idempotent where possible. NO DROP, NO DATA LOSS.

begin;

-- Required for gen_random_uuid() on some setups; Supabase usually has pgcrypto available.
create extension if not exists pgcrypto;

-- Optional visibility checks (read-only). These SELECTs do not modify data.
select current_database() as database_name, current_user as current_user, now() as executed_at;

select n.nspname as schema_name
from pg_namespace n
where n.nspname in ('public', 'auth')
order by n.nspname;

commit;

-- Manual execution note:
-- Run this file first in Supabase SQL Editor. If pgcrypto is restricted, confirm extension availability in Supabase dashboard.
