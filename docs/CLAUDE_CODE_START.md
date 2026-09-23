# Claude Code — Start Here

This is a handoff of an existing, in-progress project. Read
`docs/CLAUDE_CODE_HANDOFF.md` in full before doing anything else — it has
the complete current status, what's done, what isn't, and what's
forbidden. `docs/PROJECT_SPEC.md` is the primary product spec; the other
files in `/docs` are the architecture/database/security/integrations/
decisions record. Do not re-derive any of this from scratch.

## Do first, in order

1. **Inspect before touching anything.** Confirm: git log/branch/status,
   the Supabase project's actual current schema (`list_tables`, compare
   against `docs/DATABASE.md`), what's in `apps/web`, whether a GitHub
   remote and Vercel project already exist. Do not assume the docs are
   still 100% accurate — verify against reality and correct the docs if
   they've drifted.
2. **Get this repository onto GitHub, if it isn't already.** A private
   repo named `disco-sundays-crm` is the target (fallback:
   `disco-sundays-business-os`). If one already exists and is reachable,
   connect to it and push these 5 local commits — do not create a second
   repo, do not force-push, do not rewrite history. If no repo is
   reachable yet, tell the user the exact single action needed (create the
   repo / grant this environment access to it) and stop there — don't
   guess or fake success.
3. **Run the first real build.** `cd apps/web && npm install && npm run
   build && npm run typecheck`. This code has never been build-verified
   (see `docs/CLAUDE_CODE_HANDOFF.md` section AE for why). Fix whatever
   surfaces — that's expected work, not a sign anything was done in bad
   faith.
4. **Create one real owner account** so the app is usable: sign up a user
   via Supabase Auth, then run a one-time manual SQL update promoting that
   one `profiles` row to `role = 'owner'`. There is deliberately no
   automated path to grant `owner` — see `docs/CLAUDE_CODE_HANDOFF.md`
   section I.
5. **Then continue the build**, phase by phase, per
   `docs/PROJECT_SPEC.md` §7 and section AH of the handoff doc: Customers/
   Leads UI next (the database side of Phase 2 is already live), then
   Services/Bookings/Payments + Square, then the gallery system, and so on.
   Test, fix, document, commit at each phase boundary before moving to the
   next — don't build every phase in one uninterrupted pass.

## Standing rules (carried over, not new)

- Shopify and Square are permanent. Integrate around them; never replace,
  disconnect, or rebuild their functionality unnecessarily.
- Never ask the user to paste a secret into chat. When a credential is
  needed, name the platform, where to get it, its scope, and the exact env
  var name — the user enters it directly wherever it belongs (Vercel env
  vars, etc.).
- Read first, modify later, on every connected system. No destructive
  production action without the user's explicit approval in that
  conversation.
- Do not build fake functionality or "coming soon" screens for anything
  actually in scope. A missing integration gets real architecture plus
  honestly-documented missing credentials, not a stub that pretends to
  work.
- Keep `/docs` current: update `CHANGELOG.md` and `DECISIONS.md` as you go,
  the same way this handoff was produced.

## The prompt the user can paste into Claude Code

```
Continue the Disco Sundays CRM project from its current state. This is a
handoff, not a restart — read docs/CLAUDE_CODE_START.md and
docs/CLAUDE_CODE_HANDOFF.md first, in full, before doing anything else.

Inspect the current repository, Supabase project, and application code to
verify the handoff docs still match reality. Get the project pushed to
GitHub if it isn't already (ask me for the one exact action if you
genuinely can't do it yourself — don't guess). Then run the first real
build of apps/web and fix whatever it finds. Create one owner account so
the app is usable. Then continue implementing the next phase
(Customers/Leads UI, per docs/PROJECT_SPEC.md) and keep going
automatically through the following phases — testing, fixing, documenting,
and committing at each phase boundary — without stopping to ask me to
confirm each step.

Do not restart the project. Do not discard existing work. Do not replace
the existing architecture. Never ask me to paste secrets into chat — tell
me exactly what to get and where it goes instead. Treat Shopify, Square,
Supabase, GitHub, Vercel, Base44, n8n, and Effsight as live production
systems: read first, modify later, and stop for my explicit approval
before anything destructive or production-impacting.
```
