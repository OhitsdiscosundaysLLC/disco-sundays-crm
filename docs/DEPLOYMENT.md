# Deployment

Last updated: 2026-09-23

## Current state (Phase 0)

- **GitHub**: no repository connected to this session yet. Project exists
  only as a local git repo in the build workspace. See `DECISIONS.md` D-001.
- **Vercel**: 0 teams and 0 projects visible — nothing to deploy to yet.
- **Supabase**: connected and live — project `nrmdcwezgdeiwcebbdcj`,
  region us-west-2.

Deployment work starts in earnest in Phase 1, once a GitHub repo exists for
Vercel to build from.

## Target setup (Phase 1)

1. Push this repository to GitHub (Disco Sundays' org/account).
2. Create a Vercel project from that GitHub repo (`apps/web` as the root once
   the Next.js app exists).
3. Configure Vercel environment variables per `.env.example` — Production and
   Preview environments at minimum; secrets only ever entered in Vercel's
   env var UI, never committed.
4. Every push to `main` deploys to Production; every PR gets a Preview
   deployment against the same Supabase project (or a Supabase branch, once
   branching is adopted — see below) so changes are reviewable before merge.
5. Supabase migrations are applied via `supabase db push` (or the Supabase
   MCP `apply_migration` tool, as used in Phase 0) as part of the release
   process — schema changes ship with the code that depends on them, in the
   same PR.

## Environments

| Environment | Vercel | Supabase |
|---|---|---|
| Production | `main` branch → production deployment | the connected project, production data only |
| Preview | PR deployments | same project initially; move to Supabase branching once schema changes become frequent enough to need isolation |
| Local dev | `next dev` | Supabase local stack (`supabase start`) or a dev branch |

## Backup / recovery (spec §49)

- **Database**: Supabase manages automated backups (point-in-time recovery
  availability depends on the project's plan — confirmed and documented here
  once the plan is set; not assumed). Migrations are also fully reproducible
  from `/supabase/migrations`, so schema can always be rebuilt from source
  control independent of backups.
- **Storage**: Supabase Storage is not covered by DB point-in-time recovery —
  gallery/project media needs its own backup consideration once real media
  volume exists (Phase 4 follow-up, documented here when decided).
- **Source control**: GitHub is the source of truth for application code and
  migrations; nothing important lives only on a laptop or only in this build
  workspace.
- **Recovery process**: documented step-by-step once the production
  environment actually exists (Phase 1) — a recovery runbook written against
  a hypothetical deployment isn't verifiable and won't be trusted when it's
  actually needed.

## CI (introduced Phase 1)

Minimum bar before it's "deployed": typecheck, lint, and the automated test
suite (spec §57) run on every PR; a failing check blocks merge to `main`.
