
-- 1) Revoke anon EXECUTE from SECURITY DEFINER function has_branch_access
REVOKE ALL ON FUNCTION public.has_branch_access(uuid, uuid) FROM PUBLIC, anon;

-- 2) Invoices: branch-scoped SELECT + UPDATE (via linked order)
DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated can insert invoices" ON public.invoices;

CREATE POLICY "Invoices readable by branch staff"
ON public.invoices FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = invoices.order_id
    AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
));

CREATE POLICY "Invoices insert by branch staff"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = invoices.order_id
      AND (public.is_admin(auth.uid())
           OR public.has_role(auth.uid(), 'accountant'::app_role)
           OR public.has_branch_access(auth.uid(), o.branch_id))
  )
);

CREATE POLICY "Invoices update by admin/accountant or branch staff"
ON public.invoices FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = invoices.order_id
      AND public.has_branch_access(auth.uid(), o.branch_id)
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = invoices.order_id
      AND public.has_branch_access(auth.uid(), o.branch_id)
  )
);

-- 3) Production jobs: branch-scoped writes via linked order
DROP POLICY IF EXISTS "auth read production" ON public.production_jobs;
DROP POLICY IF EXISTS "auth insert production" ON public.production_jobs;
DROP POLICY IF EXISTS "auth update production" ON public.production_jobs;
DROP POLICY IF EXISTS "auth delete production" ON public.production_jobs;

CREATE POLICY "Production jobs readable by branch staff"
ON public.production_jobs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = production_jobs.order_id
    AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
));

CREATE POLICY "Production jobs insert by branch staff"
ON public.production_jobs FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = production_jobs.order_id
    AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
));

CREATE POLICY "Production jobs update by branch staff"
ON public.production_jobs FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = production_jobs.order_id
    AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = production_jobs.order_id
    AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
));

CREATE POLICY "Production jobs delete by admins only"
ON public.production_jobs FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- 4) storage.objects: add UPDATE policy for order-files bucket mirroring other order-files checks
DROP POLICY IF EXISTS "order-files staff update" ON storage.objects;
CREATE POLICY "order-files staff update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'order-files' AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(objects.name, '/', 1)
      AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
  )
)
WITH CHECK (
  bucket_id = 'order-files' AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(objects.name, '/', 1)
      AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
  )
);
