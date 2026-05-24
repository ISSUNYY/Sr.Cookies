import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  price: number;
  desc?: string;
  image_url?: string;
  category?: string;
  is_out_of_stock?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (product, quantity = 1) => set((state) => {
    const existingIndex = state.items.findIndex(item => item.product.id === product.id);
    if (existingIndex >= 0) {
      const newItems = [...state.items];
      newItems[existingIndex].quantity += quantity;
      return { items: newItems };
    }
    return { items: [...state.items, { product, quantity }] };
  }),
  removeItem: (productId) => set((state) => ({
    items: state.items.filter(item => item.product.id !== productId)
  })),
  clearCart: () => set({ items: [] }),
  getTotal: () => {
    const { items } = get();
    return items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  }
}));
