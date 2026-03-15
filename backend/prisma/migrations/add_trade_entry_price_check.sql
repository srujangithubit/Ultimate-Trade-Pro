ALTER TABLE "trades"
DROP CONSTRAINT IF EXISTS "trades_entry_price_positive";

ALTER TABLE "trades"
DROP CONSTRAINT IF EXISTS "trade_entry_price_check";

ALTER TABLE "trades"
ADD CONSTRAINT "trade_entry_price_check"
CHECK (entry_price > 0) NOT VALID;
