-- =============================================
-- Migration: Fix RLS Infinite Recursion on Profiles and Orders
-- Sr. Cookies - Security & Performance Hardening
-- =============================================

-- 1. Create a SECURITY DEFINER function to check admin role
-- Since SECURITY DEFINER runs with the privileges of the definer (postgres),
-- it bypasses RLS on public.profiles and avoids any infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Re-create Profiles Policies using the non-recursive is_admin check
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile (name, phone only)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow insert on profile creation (triggered by auth signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Re-create Orders Policies
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update any order" ON public.orders;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update any order"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Re-create Order Items Policies
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. Re-create Order Status History Policies
DROP POLICY IF EXISTS "Users can view own order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Admins can view all order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Anyone can view order status by order_id" ON public.order_status_history;

CREATE POLICY "Users can view own order status history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order status history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view order status by order_id"
  ON public.order_status_history FOR SELECT
  TO public
  USING (true);

-- 6. Re-create Order Feedbacks Policies
DROP POLICY IF EXISTS "Users can view own order feedback" ON public.order_feedbacks;
DROP POLICY IF EXISTS "Users can upsert own order feedback" ON public.order_feedbacks;
DROP POLICY IF EXISTS "Users can update own order feedback" ON public.order_feedbacks;
DROP POLICY IF EXISTS "Admins can view all order feedbacks" ON public.order_feedbacks;

CREATE POLICY "Users can view own order feedback"
  ON public.order_feedbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_feedbacks.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upsert own order feedback"
  ON public.order_feedbacks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_feedbacks.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own order feedback"
  ON public.order_feedbacks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_feedbacks.order_id AND orders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_feedbacks.order_id AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order feedbacks"
  ON public.order_feedbacks FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. Re-create Settings Policies
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can modify settings" ON public.settings;

CREATE POLICY "Anyone can read settings"
  ON public.settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can modify settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 8. Re-create Products Policies
DROP POLICY IF EXISTS "Allow public read access on products" ON public.products;
DROP POLICY IF EXISTS "Only admins can modify products" ON public.products;

CREATE POLICY "Allow public read access on products"
  ON public.products FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can modify products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 9. Re-create Storage bucket policies
DROP POLICY IF EXISTS "Public read access to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete from product-images" ON storage.objects;

CREATE POLICY "Public read access to product-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "Only admins can upload to product-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    public.is_admin(auth.uid())
  );

CREATE POLICY "Only admins can update product-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    public.is_admin(auth.uid())
  );

CREATE POLICY "Only admins can delete from product-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    public.is_admin(auth.uid())
  );
