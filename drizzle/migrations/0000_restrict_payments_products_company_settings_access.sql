DROP POLICY IF EXISTS "Authenticated can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can update payments" ON public.payments;

CREATE POLICY "Payments readable by authorized staff"
ON public.payments FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN public.orders o ON o.id = i.order_id
    WHERE i.id = payments.invoice_id
      AND public.has_branch_access(auth.uid(), o.branch_id)
  )
);

CREATE POLICY "Payments insert by authorized staff"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.invoices i
      JOIN public.orders o ON o.id = i.order_id
      WHERE i.id = payments.invoice_id
        AND public.has_branch_access(auth.uid(), o.branch_id)
    )
  )
);

CREATE POLICY "Payments update by authorized staff"
ON public.payments FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      JOIN public.orders o ON o.id = i.order_id
      WHERE i.id = payments.invoice_id
        AND public.has_branch_access(auth.uid(), o.branch_id)
    )
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      JOIN public.orders o ON o.id = i.order_id
      WHERE i.id = payments.invoice_id
        AND public.has_branch_access(auth.uid(), o.branch_id)
    )
  )
);

DROP POLICY IF EXISTS "products read auth" ON public.products;
CREATE POLICY "Products readable by staff"
ON public.products FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "company_settings read authenticated" ON public.company_settings;
CREATE POLICY "Company settings readable by staff"
ON public.company_settings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);