
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_size text,
  ADD COLUMN IF NOT EXISTS default_machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS die_cutting_cost numeric NOT NULL DEFAULT 0;
