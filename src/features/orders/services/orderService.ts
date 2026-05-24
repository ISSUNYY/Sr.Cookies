import { supabase } from '@shared/lib/supabase';

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  shipping_address: unknown;
  created_at: string;
  order_items?: Array<{
    id: string;
    quantity: number;
    price: number;
    products?: {
      name: string;
    } | null;
  }>;
}

export const createOrder = async (
  userId: string,
  items: OrderItemInput[],
  address: unknown,
  total: number
): Promise<Order> => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      total_amount: total,
      shipping_address: address,
      status: 'PENDING'
    })
    .select()
    .single();

  if (orderError) throw orderError;
  if (!order) throw new Error('Order creation failed');

  const orderItemsData = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsData);

  if (itemsError) throw itemsError;

  return order;
};

export const getOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        quantity,
        price,
        products (
          name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updateOrderStatus = async (orderId: string, status: string): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        quantity,
        price,
        products (
          name
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
};

export interface StatusHistoryEntry {
  id: string;
  order_id: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export const getOrderStatusHistory = async (orderId: string): Promise<StatusHistoryEntry[]> => {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const submitOrderFeedback = async (
  orderId: string,
  rating: number,
  comment: string
): Promise<void> => {
  const { error } = await supabase
    .from('order_feedbacks')
    .upsert({
      order_id: orderId,
      rating,
      comment: comment || null,
    }, { onConflict: 'order_id' });

  if (error) throw error;
};

export const getOrderFeedback = async (orderId: string) => {
  const { data, error } = await supabase
    .from('order_feedbacks')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

