// Cart feature types -- Sprint 4
export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
}

export interface Cart {
  items: CartItem[];
  total: number;
}
