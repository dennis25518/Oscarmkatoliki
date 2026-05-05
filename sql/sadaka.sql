-- ============================================================
-- Sadaka (Donations) Table
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.sadaka (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL for anonymous/guest donors
  user_id          UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_name       TEXT,                          -- optional: for guest or display
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency         TEXT          NOT NULL DEFAULT 'TZS',
  network_name     TEXT          NOT NULL,        -- e.g. M-Pesa, Airtel Money
  phone_number     TEXT          NOT NULL,        -- normalized: 255XXXXXXXXX
  order_reference  TEXT          NOT NULL UNIQUE, -- ClickPesa orderReference (DONxxx)
  message          TEXT,                          -- optional prayer/thank-you note
  status           TEXT          NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('pending','completed','failed')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_sadaka_user_id
  ON public.sadaka (user_id);

CREATE INDEX IF NOT EXISTS idx_sadaka_created_at
  ON public.sadaka (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sadaka_order_reference
  ON public.sadaka (order_reference);

-- 3. Enable Row Level Security
ALTER TABLE public.sadaka ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Authenticated users can see their own donations
CREATE POLICY "Users can view own donations"
  ON public.sadaka
  FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users (and service role) can insert donations
CREATE POLICY "Authenticated users can record donations"
  ON public.sadaka
  FOR INSERT
  WITH CHECK (
    -- logged-in user recording their own donation
    auth.uid() = user_id
    -- OR guest donation (user_id IS NULL) – allowed via service role / anon
    OR user_id IS NULL
  );

-- Service role only update (for status corrections)
-- No public UPDATE policy – manage via Supabase dashboard or server-side code

-- 5. Summary view: total donations per month (useful for admin dashboard)
CREATE OR REPLACE VIEW public.sadaka_monthly_summary AS
SELECT
  DATE_TRUNC('month', created_at)  AS month,
  COUNT(*)                          AS total_donations,
  SUM(amount)                       AS total_amount,
  currency
FROM public.sadaka
WHERE status = 'completed'
GROUP BY 1, 4
ORDER BY 1 DESC;

-- 6. Summary view: total per network
CREATE OR REPLACE VIEW public.sadaka_by_network AS
SELECT
  network_name,
  COUNT(*)    AS total_donations,
  SUM(amount) AS total_amount
FROM public.sadaka
WHERE status = 'completed'
GROUP BY network_name
ORDER BY total_amount DESC;
