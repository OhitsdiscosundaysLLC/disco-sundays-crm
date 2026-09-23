# Security

Last updated: 2026-09-23

## 1. Secrets

Never in frontend code or `NEXT_PUBLIC_*` variables:
Supabase service-role key, Square access token + webhook signature key,
Shopify API secret/access token/webhook secret, Base44 API key.

These live only as Vercel server-side environment variables (and, for values
the app itself needs to read/rotate at runtime, optionally in Supabase
Vault). `.env.example` documents every variable and marks each as
public/server-only. See that file for the full list.

## 2. AuthN / AuthZ

- **Authentication**: Supabase Auth. Staff sign in with email/password (or
  magic link — decided in Phase 1); no staff account exists without a
  corresponding `profiles` row (auto-created by trigger, see `DATABASE.md`).
- **Authorization**: two enforced layers, both mandatory —
  1. **Server-side**: every API route/server action checks the caller's role
     and the `role_permissions` matrix before performing an operation.
  2. **Database (RLS)**: every table with business data has RLS enabled;
     policies call `has_permission(role, resource, action)`. This is the
     backstop if an API check is ever missing or wrong — the database itself
     refuses the query.
- UI-level hiding (nav items, buttons) is a UX convenience only, never treated
  as a security boundary.
- New roles are added by extending the `user_role` enum (additive, safe) plus
  rows in `role_permissions` — no code change required to grant a new role
  access to an existing resource.

## 3. Public surfaces

- `/join` (public registration): only ever writes to `customers`/`leads`/
  `activities` through a narrow server action with strict validation; the
  anon key's RLS grants **no** read access to the customers table and no
  write access to anything else. Duplicate-prevention logic (see
  `DATABASE.md`) runs server-side before any insert.
- `/gallery/[slug]` and `/embed/gallery/[id]`: RLS/policy only exposes a
  gallery row when `published = true` and the visibility/password/expiry
  rules in `gallery_access` are satisfied at request time — not just at
  link-generation time. Private-bucket media is served via short-TTL signed
  URLs generated server-side, never a public bucket URL.
- `/r/[code]`: read-only lookup of a referral code → redirect; no customer
  data exposed in the response.

## 4. Webhooks

Square and Shopify webhook routes:
1. Verify provider signature before touching the payload.
2. Look up `(provider, provider_event_id)` in `webhook_events` — if already
   `processed`, return 200 and do nothing (idempotency).
3. Record the event, process it, record success/failure.
4. Failures are retried safely (provider's own retry, plus an internal
   reprocess path for `status = 'failed'` rows) — never silently dropped.
5. An internal webhook/event log is visible to admins in Settings.

## 5. Audit logging

Sensitive actions (customer delete/merge, payment changes, reward issuance/
adjustment, membership changes, gallery access changes, staff permission
changes, integration changes) write to `audit_logs` with actor, action,
entity, entity id, and metadata. Audit logs are insert-only from the app's
perspective (no update/delete policy granted to any app role).

## 6. Media upload security (spec §48)

- Allowlist of accepted MIME types (images/video only for galleries); the
  allowlist is checked against actual content, not just the filename
  extension.
- File size limits enforced both client-side (fast feedback) and server-side
  (authoritative).
- Uploaded files are stored under a generated identifier
  (`{asset_id}.{ext}`), never the user-supplied filename, and never in a
  location that could be executed.
- Storage buckets: `gallery-public` is public-read only for published,
  public galleries; `gallery-private` has no public access — everything
  through signed URLs. Project/customer document buckets default private.

## 7. Data safety

- Soft delete (`deleted_at`) on recoverable business records (spec §37);
  hard delete reserved for genuinely disposable data with a documented
  retention window (e.g. raw webhook payloads).
- No destructive migration runs against the connected Supabase project
  without being additive-first and explained before execution (spec §59).
  Since the project is currently empty, Phase 0's migration is purely
  additive by construction.
- Demo/test data, when used in development, is never written to the
  production project — kept in a local/dev branch instead (spec §58).

## 8. Phase 0 hardening pass (applied)

`supabase/migrations/0002_harden_foundation.sql` fixed everything the
Supabase security/performance advisors flagged after `0001_foundation.sql`:
mutable `search_path` on `set_updated_at`, `handle_new_user` being directly
callable via RPC (revoked entirely — it's trigger-only), RLS policies
re-evaluating `auth.*()` per row instead of once per query, and an unindexed
FK on `audit_logs.actor_id`. Two residual advisor warnings are accepted,
not bugs:
- `auth_role()` / `has_permission()` remain executable by the `authenticated`
  role by design — RLS policies for signed-in users require it, and the
  information they expose (which permissions a role has) isn't sensitive.
- `public.rls_auto_enable()` is a function this project didn't create — it
  was present on the Supabase project before Phase 0 started (platform-
  provided). Left untouched rather than modifying something outside this
  migration's scope without understanding its purpose.

## 9. Credential intake protocol

Standing rule (2026-09-23): credentials are never requested or pasted into
chat. When a phase reaches the point of needing a real credential (Square
access token, Shopify Admin API token, Base44 API key, etc.), the request to
the user states, for that credential: which platform it comes from, exactly
where in that platform's dashboard to generate it, the permissions/scopes it
needs, whether it's a test/sandbox or production credential, the exact
environment variable name the current implementation expects, and where it
gets stored (Vercel project environment variables, scoped server-only —
never committed, never in a screenshot or doc). The user enters it directly
into Vercel (or the relevant secret store), not into this conversation.

## 10. Production safety default

Every system this project touches — Shopify, Square, Supabase, Vercel,
GitHub, Base44, n8n, Effsight — is treated as potentially live production.
Default posture is **read first, modify later**: inspect before changing,
state what was found and what's about to change, note whether it's
reversible, and get explicit approval before anything destructive or
production-affecting (deleting data, disconnecting an integration,
overwriting existing production config, touching Base44/n8n/Effsight,
changing Shopify or Square configuration). This is stricter than "ask only
when necessary" for genuinely risky operations — routine additive work
(new tables, new code, new docs) proceeds without asking, per RULE 6.

## 11. Error handling

Technical errors are logged server-side with enough detail to debug; user-
facing messages never include stack traces, internal paths, or secret
values (spec §44).
