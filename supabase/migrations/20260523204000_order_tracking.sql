-- =============================================
-- Migration: Order Tracking & Feedback System
-- Sr. Cookies - Sprint 7
-- =============================================

-- 1. Order Status History Table
-- Tracks every status transition with timestamps
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Public read access for tracking via order ID
ALTER TABLE public.order_status_history DISABLE ROW LEVEL SECURITY;

-- Index for fast lookups by order
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
  ON public.order_status_history(order_id);

-- 2. Order Feedbacks Table
-- Stores customer ratings and comments
CREATE TABLE IF NOT EXISTS public.order_feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.order_feedbacks DISABLE ROW LEVEL SECURITY;

-- Unique constraint: one feedback per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_feedbacks_order_id 
  ON public.order_feedbacks(order_id);

-- 3. Trigger: Auto-log status changes
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to allow re-run
DROP TRIGGER IF EXISTS trigger_order_status_change ON public.orders;

CREATE TRIGGER trigger_order_status_change
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();

-- 4. Add phone column to orders if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_phone TEXT;
    END IF;
END $$;
