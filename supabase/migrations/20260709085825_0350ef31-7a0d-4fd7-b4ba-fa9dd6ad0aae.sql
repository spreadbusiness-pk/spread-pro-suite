
CREATE POLICY "order-files staff read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(name, '/', 1)
      AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
  )
);
CREATE POLICY "order-files staff write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(name, '/', 1)
      AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
  )
);
CREATE POLICY "order-files staff delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(name, '/', 1)
      AND (public.is_admin(auth.uid()) OR public.has_branch_access(auth.uid(), o.branch_id))
  )
);
