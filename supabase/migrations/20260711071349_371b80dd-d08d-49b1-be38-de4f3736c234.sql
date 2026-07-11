
-- Enums
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','issued','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_payment_status AS ENUM ('unpaid','partial_paid','paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sequence for invoice number
CREATE SEQUENCE IF NOT EXISTS public.invoice_no_seq START 1;

-- Invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  payment_status public.invoice_payment_status NOT NULL DEFAULT 'unpaid',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  advance_payment NUMERIC(14,2) NOT NULL DEFAULT 0,
  received_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  terms TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoices_order_id_idx ON public.invoices(order_id);
CREATE INDEX invoices_status_idx ON public.invoices(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete invoices" ON public.invoices
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Auto invoice_no + auto compute remaining/payment_status
CREATE OR REPLACE FUNCTION public.generate_invoice_no()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := 'INV-' || LPAD(nextval('public.invoice_no_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.compute_invoice_balances()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  paid NUMERIC(14,2);
  total NUMERIC(14,2);
BEGIN
  paid := COALESCE(NEW.advance_payment,0) + COALESCE(NEW.received_amount,0);
  total := COALESCE(NEW.grand_total,0);
  NEW.remaining_balance := GREATEST(total - paid, 0);
  NEW.current_balance := total - paid;
  IF paid <= 0 THEN
    NEW.payment_status := 'unpaid';
  ELSIF paid >= total AND total > 0 THEN
    NEW.payment_status := 'paid';
  ELSE
    NEW.payment_status := 'partial_paid';
  END IF;
  IF NEW.payment_status = 'paid' AND NEW.status <> 'cancelled' THEN
    NEW.status := 'paid';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_invoices_no
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_no();

CREATE TRIGGER trg_invoices_balances
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.compute_invoice_balances();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
