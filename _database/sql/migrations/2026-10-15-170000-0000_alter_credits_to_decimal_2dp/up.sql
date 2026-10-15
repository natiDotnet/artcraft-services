-- Alter wallets and wallet_ledger_entries to support 2 decimal point credits (rust_decimal)
ALTER TABLE wallets
  MODIFY COLUMN banked_credits DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN monthly_credits DECIMAL(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE wallet_ledger_entries
  MODIFY COLUMN credits_delta DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN banked_credits_before DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN banked_credits_after DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN monthly_credits_before DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN monthly_credits_after DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
