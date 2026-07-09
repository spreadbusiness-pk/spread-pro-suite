
-- Tighten customers UPDATE: admin or creator only
DROP POLICY IF EXISTS "customers update authenticated" ON public.customers;
CREATE POLICY "customers update admin or creator"
ON public.customers
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- Tighten customers SELECT: only staff (users with an assigned role) can read
DROP POLICY IF EXISTS "customers read authenticated" ON public.customers;
CREATE POLICY "customers read staff"
ON public.customers
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Tighten profiles SELECT: own profile, or admin
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;
CREATE POLICY "profiles read self or admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin(auth.uid()));
