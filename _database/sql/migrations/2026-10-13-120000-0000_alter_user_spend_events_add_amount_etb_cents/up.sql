-- noinspection SqlDialectInspectionForFile
-- noinspection SqlNoDataSourceInspectionForFile
-- noinspection SqlResolveForFile

-- Add `amount_etb_cents` to `user_spend_events` for the Chapa (ETB) rail.
--
-- `amount_usd_cents` stays NOT NULL: Chapa rows carry 0 there and record
-- their signed ETB cents in the new nullable column (positive for purchases,
-- negative for refunds). This keeps the two currencies from being mixed in
-- one column -- lifetime USD sums stay unaffected, and ETB sums can be taken
-- independently.

ALTER TABLE user_spend_events
  ADD COLUMN amount_etb_cents BIGINT DEFAULT NULL AFTER amount_usd_cents;
