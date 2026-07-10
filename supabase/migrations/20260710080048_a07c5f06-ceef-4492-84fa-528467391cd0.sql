ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS paper_type text,
  ADD COLUMN IF NOT EXISTS paper_gsm integer;