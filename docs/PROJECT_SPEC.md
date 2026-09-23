# Disco Sundays CRM / Business Operating System — Project Spec

Status: Phase 0 (Discovery & Architecture)
Last updated: 2026-09-23

## 1. What this is

The Disco Sundays CRM ("DSBOS") is the operating system for Disco Sundays LLC, a
creative platform / media infrastructure business (studio services, artist
development, recording, mixing, photography, memberships, courses, referrals,
rewards, and other creative services). It is a real production system, built in
phases, not a demo.

It is **not** a generic CRM. Its data model and workflows are built around how
Disco Sundays actually operates: customers who book studio/creative services
through Square, buy through Shopify, receive delivered media through galleries,
refer other customers, and earn rewards.

## 2. Business model this system supports

- Studio services, artist development, recording, mixing, creative/photography
  services, media projects
- Memberships and courses
- Referrals and a rewards ledger
- Project delivery via a first-party gallery system (replacing Effsight)

The service catalog is data, not code — new service lines must not require a
schema change.

## 3. Existing ecosystem (do not break, migrate gradually)

| System | Current role | CRM relationship |
|---|---|---|
| Shopify | Public storefront, products, orders, some customers | Stays the storefront. CRM syncs customers/orders in. |
| Square | Bookings, services, payments, customers, calendar | Stays primary booking/payment system during migration. CRM syncs in. |
| Base44 | Referral + rewards + application functionality | CRM absorbs this over time. Not deleted until migration verified. |
| n8n | Automation | Reduced over time in favor of native CRM automation. Not blindly recreated. |
| Effsight | Embedded photo galleries on the website | Replaced by the CRM's own gallery system, after proving it out (Phase 4 + testing). |

See `INTEGRATIONS.md` for the technical integration design and current
connection status of each.

## 4. Primary navigation

Dashboard · Customers · Leads · Bookings · Services · Projects · Galleries ·
Memberships · Referrals · Rewards · Payments · Tasks · Reports · Team · Settings

Navigation items are filtered by role/permission (see `SECURITY.md`).

## 5. Roles (minimum set, extensible)

Owner, Admin, Manager, Staff, Photographer, Engineer, Finance, Marketing.

Authorization is enforced server-side and at the database level (Postgres RLS),
never only by hiding UI. See `SECURITY.md` and `DATABASE.md`.

## 6. Non-negotiable rules carried from the master spec

1. No generic CRM rename — model the real business.
2. No fake functionality, no fake data standing in for real features, no
   "coming soon" screens for in-scope work. Missing credentials get real
   integration architecture plus documented required env vars, not a stub.
3. Don't destroy Shopify/Square/Base44/n8n/Effsight — migrate gradually.
4. Supabase/Postgres is the system of record. No localStorage-as-database.
5. Security first: no secrets in frontend code, RBAC enforced server-side +
   DB-level.
6. Reasonable engineering decisions are made and documented (`DECISIONS.md`),
   not punted back as questions, unless they affect money, customer data,
   existing integrations, or can't be safely inferred.
7. Built in controlled phases; each phase is verified before the next starts.
8. Project memory is kept current in `/docs`.

## 7. Build phases

0. Discovery & architecture (this phase)
1. Foundation — Next.js app, auth, roles/permissions, layout, nav, settings shell
2. CRM — customers, leads, timeline, tags, notes
3. Services / bookings / payments + Square integration architecture
4. Gallery system (high priority — Effsight replacement)
5. Shopify integration
6. Memberships
7. Referrals & rewards
8. Base44 migration
9. Automation engine / n8n reduction
10. Reporting
11. Production hardening

Full technical detail for each phase lives in `ARCHITECTURE.md` and
`DATABASE.md`. Phase completion criteria: tests pass, DB integrity checked,
auth checked, responsive UI checked, security checked, existing functionality
still works.

## 8. Success definition

A customer can register at `/join` → book through Square → CRM records the
booking → pay via Square/Shopify → CRM records payment → a project is created
→ staff deliver a gallery → the gallery embeds live on Shopify → the customer
refers someone → CRM tracks the referral and issues a reward — and every one
of those events is visible, in order, on that customer's profile timeline.
