ALTER TABLE developer_api_keys
  ADD COLUMN last_synced_spend DOUBLE NOT NULL DEFAULT 0.0 AFTER maybe_description,
  ADD COLUMN total_spend DOUBLE NOT NULL DEFAULT 0.0 AFTER last_synced_spend;
