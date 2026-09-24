DROP POLICY IF EXISTS "bom read" ON public.product_inventory_bom;
CREATE POLICY "bom read staff" ON public.product_inventory_bom
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'production')
  OR public.has_role(auth.uid(), 'branch_manager')
);

DROP POLICY IF EXISTS "stock mov read" ON public.stock_movements;
CREATE POLICY "stock mov read staff" ON public.stock_movements
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'production')
  OR public.has_role(auth.uid(), 'branch_manager')
  OR public.has_role(auth.uid(), 'accountant')
);

DROP POLICY IF EXISTS "transport read auth" ON public.transport_rates;
CREATE POLICY "transport read staff" ON public.transport_rates
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'production')
  OR public.has_role(auth.uid(), 'branch_manager')
  OR public.has_role(auth.uid(), 'accountant')
  OR public.has_role(auth.uid(), 'sales')
);