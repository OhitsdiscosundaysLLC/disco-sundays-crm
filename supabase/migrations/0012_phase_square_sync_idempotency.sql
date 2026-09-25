-- Square read-sync adapter support
-- Disco Sundays CRM
-- Adds the missing idempotency index on refunds.provider_refund_id so the
-- new Square sync (apps/web/lib/integrations/square/sync.ts) can be re-run
-- safely without creating duplicate refund rows on each pass — same pattern
-- already used for payments.provider_transaction_id and
-- bookings.external_square_booking_id (0006_phase3_services_bookings_payments.sql).

create unique index refunds_provider_refund_id_key on public.refunds (provider_refund_id) where provider_refund_id is not null;
