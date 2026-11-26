# Supabase CLI via GitHub Actions (Android/Termux workaround)

Supabase CLI npm install fails on Android/Termux (`Unsupported platform: android`). Use GitHub Actions (Ubuntu runner) to run the official Supabase CLI.

## Workflow

- File: `.github/workflows/supabase-migrations.yml`
- Trigger: **manual only** (`workflow_dispatch`)
- Default behavior: **inspection only** (no migrations applied)

## Required GitHub repository secrets

Configure in **GitHub Repo > Settings > Secrets and variables > Actions**:

- `SUPABASE_ACCESS_TOKEN` - Supabase personal access token
- `SUPABASE_DB_PASSWORD` - database password for project
- `SUPABASE_PROJECT_ID` - project ref (e.g. `qqsnsdwxfoqdmyiidunp`)

**Never commit these values. Never print them in logs.**

## How to run inspection

1. Push this workflow to GitHub.
2. Go to **Actions > Supabase Migration Inspection**.
3. Click **Run workflow**.
4. Leave `apply_migrations` = `false`.
5. Review job output:
   - `supabase --version`
   - `supabase link`
   - `supabase migration list` (remote state)

## Applying migrations (manual approval required)

Only after reviewing SQL and remote state:

1. In GitHub repo settings, create environment `supabase-production` and add required reviewers (recommended).
2. Re-run workflow with `apply_migrations` = `true`.
3. The `apply` job is gated by `environment: supabase-production` and only runs when explicitly requested.
4. It runs `supabase db push`.

## Safety rules

- Do **not** run `supabase db reset`.
- Do **not** apply migrations automatically.
- Do **not** use service_role key in browser.
- Review `supabase/migrations/0001_init.sql`, `0002_hardening.sql`, `0003_room_permissions.sql` before push.
- Confirm remote DB state before applying.
