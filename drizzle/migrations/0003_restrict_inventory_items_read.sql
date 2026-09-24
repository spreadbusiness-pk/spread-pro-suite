DROP POLICY IF EXISTS "inv items read" ON public.inventory_items;
CREATE POLICY "inv items read staff" ON public.inventory_items FOR SELECT TO authenticated
USING (
  (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'production') OR public.has_role(auth.uid(),'branch_manager') OR public.has_role(auth.uid(),'accountant'))
  AND public.has_branch_access(auth.uid(), branch_id)
);