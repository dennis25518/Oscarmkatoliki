-- ============================================================
-- Add is_preferred column to payment_methods
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE public.payment_methods
ADD COLUMN
IF NOT EXISTS is_preferred BOOLEAN NOT NULL DEFAULT false;

-- Make the first existing method preferred for every user that has methods
UPDATE public.payment_methods pm
SET is_preferred
= true
WHERE pm.id IN
(
  SELECT DISTINCT ON
(user_id) id
  FROM public.payment_methods
  ORDER BY user_id, created_at ASC
);
