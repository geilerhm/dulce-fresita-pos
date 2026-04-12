/** Shared model interfaces — single source of truth */

export interface Product {
  id: string;
  ref: string;
  name: string;
  price: number;
  image_url?: string;
  icon?: string;
  category_slug?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface OrderItem {
  id: string;
  order_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string | null;
}

export interface Order {
  id: string;
  order_number: number;
  order_type: "local" | "delivery";
  customer_name: string;
  customer_phone: string | null;
  delivery_address: string | null;
  scheduled_time: string | null;
  status: string;
  payment_method: string;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  items?: OrderItem[];
}
