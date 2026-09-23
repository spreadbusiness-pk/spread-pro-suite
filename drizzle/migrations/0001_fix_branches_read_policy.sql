DROP POLICY IF EXISTS "branches read staff" ON public.branches;
CREATE POLICY "branches read staff" ON public.branches
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_branches ub
    WHERE ub.user_id = auth.uid() AND ub.branch_id = branches.id
  )
);