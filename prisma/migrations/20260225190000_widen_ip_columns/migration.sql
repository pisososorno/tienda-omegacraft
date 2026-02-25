-- Widen masked IP columns from VARCHAR(45) to VARCHAR(100)
-- to safely handle masked IPv6 addresses
ALTER TABLE "orders" ALTER COLUMN "buyer_ip" TYPE VARCHAR(100);
ALTER TABLE "orders" ALTER COLUMN "terms_accepted_ip" TYPE VARCHAR(100);
