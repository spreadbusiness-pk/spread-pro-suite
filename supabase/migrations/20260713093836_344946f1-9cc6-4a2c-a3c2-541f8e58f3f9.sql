
-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.inventory_category AS ENUM (
    'paper','ctp_plates','ink','lamination','finishing','binding','packaging','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('in','out','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) inventory_items
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.inventory_category NOT NULL,
  name text NOT NULL,
  brand text,
  size text,
  paper_gsm numeric,
  paper_type text,
  unit text NOT NULL DEFAULT 'pcs',
  opening_stock numeric NOT NULL DEFAULT 0,
  current_stock numeric NOT NULL DEFAULT 0,
  minimum_stock numeric NOT NULL DEFAULT 0,
  purchase_rate numeric NOT NULL DEFAULT 0,
  supplier text,
  remarks text,
  active boolean NOT NULL DEFAULT true,
  -- future-ready
  branch_id uuid,
  batch_number text,
  barcode text,
  qr_code text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier ON public.inventory_items(supplier);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv items read" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv items admin write" ON public.inventory_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_inv_items_updated
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) stock_movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type public.stock_movement_type NOT NULL,
  quantity numeric NOT NULL CHECK (quantity <> 0),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_type text,      -- 'manual','production_job','purchase','order', etc.
  reference_id uuid,
  reference_no text,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_mov_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_ref ON public.stock_movements(reference_type, reference_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock mov read" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock mov admin write" ON public.stock_movements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 4) product_inventory_bom (future-ready)
CREATE TABLE IF NOT EXISTS public.product_inventory_bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  qty_per_unit numeric NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, inventory_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_inventory_bom TO authenticated;
GRANT ALL ON public.product_inventory_bom TO service_role;
ALTER TABLE public.product_inventory_bom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bom read" ON public.product_inventory_bom FOR SELECT TO authenticated USING (true);
CREATE POLICY "bom admin write" ON public.product_inventory_bom FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 5) Recompute current_stock from movements
CREATE OR REPLACE FUNCTION public.recompute_item_stock(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opening numeric;
  delta numeric;
BEGIN
  SELECT opening_stock INTO opening FROM public.inventory_items WHERE id = _item_id;
  IF opening IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(
    CASE movement_type
      WHEN 'in' THEN quantity
      WHEN 'out' THEN -quantity
      WHEN 'adjustment' THEN quantity
    END
  ), 0) INTO delta FROM public.stock_movements WHERE item_id = _item_id;
  UPDATE public.inventory_items SET current_stock = COALESCE(opening,0) + COALESCE(delta,0)
    WHERE id = _item_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_stock_mov_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_item_stock(OLD.item_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_item_stock(NEW.item_id);
  IF TG_OP = 'UPDATE' AND NEW.item_id IS DISTINCT FROM OLD.item_id THEN
    PERFORM public.recompute_item_stock(OLD.item_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stock_mov_recompute ON public.stock_movements;
CREATE TRIGGER trg_stock_mov_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.trg_stock_mov_recompute();

-- Also recompute when opening_stock changes
CREATE OR REPLACE FUNCTION public.trg_inv_item_opening()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.current_stock := NEW.opening_stock;
    RETURN NEW;
  ELSIF NEW.opening_stock IS DISTINCT FROM OLD.opening_stock THEN
    -- recompute after update using new opening
    PERFORM public.recompute_item_stock(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_inv_item_opening_ins ON public.inventory_items;
CREATE TRIGGER trg_inv_item_opening_ins
BEFORE INSERT ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.trg_inv_item_opening();

DROP TRIGGER IF EXISTS trg_inv_item_opening_upd ON public.inventory_items;
CREATE TRIGGER trg_inv_item_opening_upd
AFTER UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.trg_inv_item_opening();

-- 6) Auto-deduct on production job completion (status = 'delivered')
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_production()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  IF NEW.status::text <> 'delivered' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'delivered' THEN RETURN NEW; END IF;

  -- prevent double-deduction
  IF EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE reference_type = 'production_job' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT bom.inventory_item_id, SUM(bom.qty_per_unit * oi.quantity) AS qty
    FROM public.order_items oi
    JOIN public.product_inventory_bom bom ON bom.product_id = oi.product_id
    WHERE oi.order_id = NEW.order_id
    GROUP BY bom.inventory_item_id
  LOOP
    IF r.qty > 0 THEN
      INSERT INTO public.stock_movements(
        item_id, movement_type, quantity, reference_type, reference_id, reference_no, reason
      ) VALUES (
        r.inventory_item_id, 'out', r.qty, 'production_job', NEW.id, NEW.job_no,
        'Auto-deducted on production completion'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prod_job_deduct_inventory ON public.production_jobs;
CREATE TRIGGER trg_prod_job_deduct_inventory
AFTER INSERT OR UPDATE OF status ON public.production_jobs
FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_on_production();
