-- =============================================
-- Migration: Enable RLS on ALL tables + Security Policies
-- Sr. Cookies - Security Hardening
-- Fixes: CRITICAL advisories from Supabase Dashboard
-- =============================================

-- ========================================
-- 1. ORDERS TABLE — Enable RLS + Policies
-- ========================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own orders
CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view ALL orders (needed for dashboard)
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update any order (status changes)
CREATE POLICY "Admins can update any order"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Service role (backend webhook) can update orders without restriction
-- This is handled by the service_role key which bypasses RLS

-- ========================================
-- 2. ORDER_ITEMS TABLE — Enable RLS + Policies
-- ========================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Users can read their own order items (via orders FK)
CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

-- Users can insert items for their own orders
CREATE POLICY "Users can insert own order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

-- Admins can view all order items
CREATE POLICY "Admins can view all order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ========================================
-- 3. ORDER_STATUS_HISTORY — Enable RLS + Policies
-- ========================================
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Users can view status history for their own orders (tracking page)
CREATE POLICY "Users can view own order status history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid()
    )
  );

-- Admins can view all status history
CREATE POLICY "Admins can view all order status history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Allow anonymous read for tracking page (shared via WhatsApp link)
CREATE POLICY "Anyone can view order status by order_id"
  ON public.order_status_history FOR SELECT
  TO anon
  USING (true);

-- ========================================
-- 4. ORDER_FEEDBACKS — Enable RLS + Policies
-- ========================================
ALTER TABLE public.order_feedbacks ENABLE ROW LEVEL SECURITY;

-- Users can view feedback for their own orders
CREATE POLICY "Users can view own order feedback"
  ON public.order_feedbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_feedbacks.order_id AND orders.user_id = auth.uid()
    )
  );

-- Users can create/update feedback for their own orders
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

-- Admins can view all feedbacks
CREATE POLICY "Admins can view all order feedbacks"
  ON public.order_feedbacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ========================================
-- 5. SETTINGS TABLE — Enable RLS + Policies
-- ========================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (store config for delivery calc)
CREATE POLICY "Anyone can read settings"
  ON public.settings FOR SELECT
  TO public
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can modify settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ========================================
-- 6. PROFILES TABLE — Enable RLS + Policies
-- ========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile (name, phone only — role is protected by trigger)
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
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ========================================
-- 7. ADDRESSES TABLE — Enable RLS + Policies
-- ========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'addresses') THEN
    EXECUTE 'ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY';
    
    -- Users can view their own addresses
    EXECUTE '
      CREATE POLICY "Users can view own addresses"
        ON public.addresses FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id)
    ';
    
    -- Users can insert their own addresses
    EXECUTE '
      CREATE POLICY "Users can insert own addresses"
        ON public.addresses FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id)
    ';
    
    -- Users can update their own addresses
    EXECUTE '
      CREATE POLICY "Users can update own addresses"
        ON public.addresses FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
    
    -- Users can delete their own addresses
    EXECUTE '
      CREATE POLICY "Users can delete own addresses"
        ON public.addresses FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id)
    ';
  END IF;
END $$;

-- ========================================
-- 8. FIX: Restrict product modification to ADMIN only
-- ========================================
DROP POLICY IF EXISTS "Allow authenticated users to modify products" ON public.products;

CREATE POLICY "Only admins can modify products"
  ON public.products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ========================================
-- 9. FIX: Restrict storage bucket to admin only
-- ========================================
DROP POLICY IF EXISTS "Authenticated users can upload to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from product-images" ON storage.objects;

CREATE POLICY "Only admins can upload to product-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update product-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete from product-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ========================================
-- 10. SECURITY: Protect role column from self-escalation
-- ========================================
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent non-admin users from changing their own role
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Permission denied: only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON public.profiles;

CREATE TRIGGER trigger_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- ========================================
-- 11. FIX: Add search_path to existing trigger function
-- ========================================
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.order_status_history (order_id, status, notes)
        VALUES (
            NEW.id, 
            NEW.status, 
            CASE 
                WHEN NEW.status = 'PENDING' THEN 'Pedido criado e aguardando confirmação de pagamento.'
                WHEN NEW.status = 'PAID' THEN 'Pagamento confirmado! Seu pedido entrou na fila de produção.'
                WHEN NEW.status = 'PREPARING' THEN 'Seus cookies entraram no forno! Preparando com carinho.'
                WHEN NEW.status = 'OUT_FOR_DELIVERY' THEN 'Cookies quentinhos saindo! O entregador já está a caminho.'
                WHEN NEW.status = 'DELIVERED' THEN 'Entregue! Hora de saborear o melhor cookie da sua vida.'
                WHEN NEW.status = 'CANCELLED' THEN 'Pedido cancelado.'
                ELSE 'Status atualizado para ' || NEW.status
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
