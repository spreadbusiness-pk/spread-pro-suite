
-- ============ ENUMS ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_manager';

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'new','artwork_pending','design','customer_approval','plate_making',
    'printing','cutting','lamination','uv','foiling','binding','packing',
    'ready','delivered','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ BRANCHES ============
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  address text,
  city text,
  phone text,
  whatsapp text,
  email text,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'PKR',
  status text NOT NULL DEFAULT 'active',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branches TO authenticated;
GRANT ALL ON public.user_branches TO service_role;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

-- security-definer branch access
CREATE OR REPLACE FUNCTION public.has_branch_access(_user_id uuid, _branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR _branch_id IS NULL
    OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = _user_id AND ub.branch_id = _branch_id)
$$;

CREATE POLICY "branches read staff" ON public.branches FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = id));
CREATE POLICY "branches admin write" ON public.branches FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "user_branches read self or admin" ON public.user_branches FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_branches admin write" ON public.user_branches FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Add branch_id to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- ============ PRODUCT MASTER ============
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cats read auth" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cats admin write" ON public.product_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  default_unit text NOT NULL DEFAULT 'pcs',
  default_formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products read auth" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ MACHINES ============
CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  machine_type text,
  manufacturer text,
  model text,
  colors int DEFAULT 0,
  max_sheet_size text,
  min_sheet_size text,
  speed numeric,
  setup_time numeric,
  cost_per_hour numeric NOT NULL DEFAULT 0,
  cost_per_sheet numeric NOT NULL DEFAULT 0,
  electricity_cost numeric NOT NULL DEFAULT 0,
  maintenance_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines read branch" ON public.machines FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "machines admin write" ON public.machines FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ PAPERS ============
CREATE TABLE IF NOT EXISTS public.papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  gsm int,
  sheet_size text,
  purchase_rate numeric NOT NULL DEFAULT 0,
  selling_rate numeric NOT NULL DEFAULT 0,
  current_stock numeric NOT NULL DEFAULT 0,
  minimum_stock numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papers TO authenticated;
GRANT ALL ON public.papers TO service_role;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "papers read branch" ON public.papers FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "papers admin write" ON public.papers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ CTP / FINISHING / BINDING / LABOUR / TRANSPORT ============
CREATE TABLE IF NOT EXISTS public.ctp_plates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plate_size text,
  cost numeric NOT NULL DEFAULT 0,
  supplier text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ctp_plates TO authenticated;
GRANT ALL ON public.ctp_plates TO service_role;
ALTER TABLE public.ctp_plates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctp read auth" ON public.ctp_plates FOR SELECT TO authenticated USING (true);
CREATE POLICY "ctp admin write" ON public.ctp_plates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.finishing_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'sheet',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finishing_options TO authenticated;
GRANT ALL ON public.finishing_options TO service_role;
ALTER TABLE public.finishing_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finish read auth" ON public.finishing_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "finish admin write" ON public.finishing_options FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.binding_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'book',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.binding_options TO authenticated;
GRANT ALL ON public.binding_options TO service_role;
ALTER TABLE public.binding_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bind read auth" ON public.binding_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "bind admin write" ON public.binding_options FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.labour_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_type text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'hour',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_rates TO authenticated;
GRANT ALL ON public.labour_rates TO service_role;
ALTER TABLE public.labour_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "labour read auth" ON public.labour_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "labour admin write" ON public.labour_rates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.transport_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_type text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'trip',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_rates TO authenticated;
GRANT ALL ON public.transport_rates TO service_role;
ALTER TABLE public.transport_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport read auth" ON public.transport_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "transport admin write" ON public.transport_rates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ ORDERS ============
CREATE SEQUENCE IF NOT EXISTS public.order_global_seq START 1;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quotation_ref text,
  sales_person_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date,
  priority public.order_priority NOT NULL DEFAULT 'normal',
  status public.order_status NOT NULL DEFAULT 'new',
  customer_remarks text,
  internal_notes text,
  paper_cost numeric NOT NULL DEFAULT 0,
  ctp_cost numeric NOT NULL DEFAULT 0,
  printing_cost numeric NOT NULL DEFAULT 0,
  ink_cost numeric NOT NULL DEFAULT 0,
  finishing_cost numeric NOT NULL DEFAULT 0,
  binding_cost numeric NOT NULL DEFAULT 0,
  labour_cost numeric NOT NULL DEFAULT 0,
  transport_cost numeric NOT NULL DEFAULT 0,
  misc_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  profit_pct numeric NOT NULL DEFAULT 25,
  selling_price numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read branch" ON public.orders FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "orders insert auth" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "orders update branch" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid() OR public.has_branch_access(auth.uid(), branch_id))
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid() OR public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "orders delete admin" ON public.orders FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- auto order number: SP-<BRANCHCODE>-000001
CREATE OR REPLACE FUNCTION public.generate_order_no()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  bcode text;
  nxt bigint;
BEGIN
  IF NEW.order_no IS NULL OR NEW.order_no = '' THEN
    SELECT code INTO bcode FROM public.branches WHERE id = NEW.branch_id;
    IF bcode IS NULL THEN bcode := 'HQ'; END IF;
    nxt := nextval('public.order_global_seq');
    NEW.order_no := 'SP-' || upper(bcode) || '-' || LPAD(nxt::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_no ON public.orders;
CREATE TRIGGER trg_orders_no BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.generate_order_no();

DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDER ITEMS / FILES / TIMELINE ============
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'pcs',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items follow order" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))));

CREATE TABLE IF NOT EXISTS public.order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  path text NOT NULL,
  filename text NOT NULL,
  mime text,
  size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_files TO authenticated;
GRANT ALL ON public.order_files TO service_role;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "files follow order" ON public.order_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))));

CREATE TABLE IF NOT EXISTS public.order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_timeline TO authenticated;
GRANT ALL ON public.order_timeline TO service_role;
ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeline follow order" ON public.order_timeline FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))));

-- status change → timeline entry
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_timeline(order_id, status, note, actor_id)
    VALUES (NEW.id, NEW.status, CASE WHEN TG_OP='INSERT' THEN 'Order created' ELSE 'Status updated' END, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_status ON public.orders;
CREATE TRIGGER trg_orders_status AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();
