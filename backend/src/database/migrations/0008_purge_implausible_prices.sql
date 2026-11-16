-- Remove catalog prices that can't be real: zero/negative values, and WHMCS
-- feed rows where "-1.00" (TLD not sold) was stored as 1 NGN. Valid rows
-- come back on the next price sync; manual prices are left alone.
DELETE FROM "tld_prices"
WHERE "source" <> 'manual'
  AND (
    "register_price" <= 0
    OR "renewal_price" <= 0
    OR ("currency" = 'NGN' AND "register_price" < 100)
  );
