
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'approved';

DO $$ BEGIN
  CREATE TYPE public.production_status AS ENUM (
    'pending','ctp_plate_making','paper_cutting','printing',
    'finishing','binding','packing','ready_for_delivery','delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS public.production_job_seq START 1;

CREATE TABLE IF NOT EXISTS public.production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_no text UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.production_status NOT NULL DEFAULT 'pending',
  assigned_machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  special_instructions text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_jobs TO authenticated;
GRANT ALL ON public.production_jobs TO service_role;
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read production" ON public.production_jobs;
CREATE POLICY "auth read production" ON public.production_jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth insert production" ON public.production_jobs;
CREATE POLICY "auth insert production" ON public.production_jobs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth update production" ON public.production_jobs;
CREATE POLICY "auth update production" ON public.production_jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth delete production" ON public.production_jobs;
CREATE POLICY "auth delete production" ON public.production_jobs FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.generate_job_no()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.job_no IS NULL OR NEW.job_no = '' THEN
    NEW.job_no := 'JOB-' || LPAD(nextval('public.production_job_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prod_job_no ON public.production_jobs;
CREATE TRIGGER trg_prod_job_no BEFORE INSERT ON public.production_jobs
FOR EACH ROW EXECUTE FUNCTION public.generate_job_no();

DROP TRIGGER IF EXISTS trg_prod_updated ON public.production_jobs;
CREATE TRIGGER trg_prod_updated BEFORE UPDATE ON public.production_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_production_job_on_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  machine_id uuid;
BEGIN
  IF NEW.status::text = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT EXISTS (SELECT 1 FROM public.production_jobs WHERE order_id = NEW.id) THEN
      SELECT p.default_machine_id INTO machine_id
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id AND p.default_machine_id IS NOT NULL
      LIMIT 1;
      INSERT INTO public.production_jobs (order_id, status, assigned_machine_id)
      VALUES (NEW.id, 'pending', machine_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_create_prod_job ON public.orders;
CREATE TRIGGER trg_create_prod_job AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.create_production_job_on_approval();

CREATE OR REPLACE FUNCTION public.sync_order_status_from_production()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  new_status public.order_status;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  new_status := CASE NEW.status::text
    WHEN 'pending' THEN 'approved'::public.order_status
    WHEN 'ctp_plate_making' THEN 'plate_making'::public.order_status
    WHEN 'paper_cutting' THEN 'cutting'::public.order_status
    WHEN 'printing' THEN 'printing'::public.order_status
    WHEN 'finishing' THEN 'lamination'::public.order_status
    WHEN 'binding' THEN 'binding'::public.order_status
    WHEN 'packing' THEN 'packing'::public.order_status
    WHEN 'ready_for_delivery' THEN 'ready'::public.order_status
    WHEN 'delivered' THEN 'delivered'::public.order_status
    ELSE NULL
  END;
  IF new_status IS NOT NULL THEN
    UPDATE public.orders SET status = new_status WHERE id = NEW.order_id AND status IS DISTINCT FROM new_status;
  END IF;
  IF NEW.status::text = 'delivered' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_order_status ON public.production_jobs;
CREATE TRIGGER trg_sync_order_status AFTER INSERT OR UPDATE OF status ON public.production_jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_from_production();
