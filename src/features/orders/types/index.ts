// Orders feature types -- Sprint 7
// Defined independently to respect DDD boundaries (no cross-feature imports)

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Order {
  id: string;
  user_id: string;
  address_id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface OrderFeedback {
  id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}
