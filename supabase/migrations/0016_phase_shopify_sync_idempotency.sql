-- Shopify product sync support (D-032)
-- Disco Sundays CRM
-- services.shopify_product_id existed with no unique index, unlike its
-- Square counterpart (services_square_id_key). Without this, a repeated
-- Shopify product sync could create duplicate service rows for the same
-- Shopify product. Checked for existing duplicate non-null values first
-- (none found, 0 of 66 services currently have a shopify_product_id set)
-- before applying — same idempotency pattern as every other provider-ID
-- index in this project (0006, 0012).

create unique index services_shopify_id_key on public.services (shopify_product_id) where deleted_at is null and shopify_product_id is not null;
