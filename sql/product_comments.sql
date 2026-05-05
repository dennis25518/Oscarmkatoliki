-- ============================================================
-- Product Comments Table
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create table
CREATE TABLE
IF NOT EXISTS public.product_comments
(
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid
(),
  product_id       INTEGER       NOT NULL REFERENCES public.products
(id) ON
DELETE CASCADE,
  user_id          UUID
NOT NULL REFERENCES auth.users
(id) ON
DELETE CASCADE,
  user_name        TEXT
NOT NULL,
  user_avatar      TEXT,
  rating           SMALLINT      NOT NULL CHECK
(rating BETWEEN 1 AND 5),
  body             TEXT          NOT NULL CHECK
(char_length
(body) BETWEEN 1 AND 1000),
  proof_image_url  TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW
()
);

-- 2. Indexes for fast lookups
CREATE INDEX
IF NOT EXISTS idx_product_comments_product_id
  ON public.product_comments
(product_id);

CREATE INDEX
IF NOT EXISTS idx_product_comments_user_id
  ON public.product_comments
(user_id);

-- 3. Enable Row Level Security
ALTER TABLE public.product_comments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Anyone can read comments (including guests browsing the store)
CREATE POLICY "Anyone can view comments"
  ON public.product_comments
  FOR
SELECT
    USING (true);

-- Only authenticated users can insert their own comment
CREATE POLICY "Authenticated users can post comments"
  ON public.product_comments
  FOR
INSERT
  WITH CHECK (auth.uid() =
user_id);

-- Users can only delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.product_comments
  FOR
DELETE
  USING (auth.uid
() = user_id);

-- 5. (Optional) Helpful view: average rating per product
CREATE OR REPLACE VIEW public.product_rating_summary AS
SELECT
    product_id,
    COUNT(*)                        AS total_reviews,
    ROUND(AVG(rating)
::NUMERIC, 2)  AS average_rating
FROM public.product_comments
GROUP BY product_id;

-- ============================================================
-- Storage RLS policies for Mkatoliki_products bucket
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Allow authenticated users to upload files (INSERT)
CREATE POLICY "Authenticated users can upload to Mkatoliki_products"
  ON storage.objects
  FOR
INSERT
  TO authenticated
  WITH CHECK (
bucket_id
=
'Mkatoliki_products'
);

-- Allow anyone to read/view files (SELECT) – public bucket
CREATE POLICY "Public read access for Mkatoliki_products"
  ON storage.objects
  FOR
SELECT
    TO public
  USING
(bucket_id = 'Mkatoliki_products');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update own files in Mkatoliki_products"
  ON storage.objects
  FOR
UPDATE
  TO authenticated
  USING (bucket_id = 'Mkatoliki_products' AND auth.uid() = owner);

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete own files in Mkatoliki_products"
  ON storage.objects
  FOR
DELETE
  TO authenticated
  USING (bucket_id = 'Mkatoliki_products' AND auth.uid() = owner);
