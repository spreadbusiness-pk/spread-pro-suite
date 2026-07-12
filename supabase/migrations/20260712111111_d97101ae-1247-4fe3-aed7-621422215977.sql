
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash','bank_transfer','cheque','jazzcash','easypaisa','online_transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference_no text,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS payments_customer_id_idx ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS payments_date_idx ON public.payments(payment_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view payments" ON public.payments;
CREATE POLICY "Authenticated can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can insert payments" ON public.payments;
CREATE POLICY "Authenticated can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can update payments" ON public.payments;
CREATE POLICY "Authenticated can update payments" ON public.payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;
CREATE POLICY "Admins can delete payments" ON public.payments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-fill customer_id from invoice->order->customer
CREATE OR REPLACE FUNCTION public.payment_fill_customer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    SELECT o.customer_id INTO NEW.customer_id
    FROM public.invoices i JOIN public.orders o ON o.id = i.order_id
    WHERE i.id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payments_fill_customer ON public.payments;
CREATE TRIGGER trg_payments_fill_customer BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payment_fill_customer();

-- Recompute invoice.received_amount from sum of payments; triggers on invoices recompute balance & payment_status
CREATE OR REPLACE FUNCTION public.recompute_invoice_received()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  target_invoice uuid;
  total numeric(14,2);
BEGIN
  target_invoice := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO total FROM public.payments WHERE invoice_id = target_invoice;
  UPDATE public.invoices SET received_amount = total WHERE id = target_invoice;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_payments_recompute ON public.payments;
CREATE TRIGGER trg_payments_recompute AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_received();
