import { supabase } from '@shared/lib/supabase';
import type { Product } from '../../catalog/types';

export const adminService = {
  async getProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching products: ${error.message}`);
    }

    return data as Product[];
  },

  async createProduct(productData: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating product: ${error.message}`);
    }

    return data as Product;
  },

  async updateProduct(id: string, productData: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating product: ${error.message}`);
    }

    return data as Product;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting product: ${error.message}`);
    }
  },

  async uploadProductImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Error uploading image: ${error.message}`);
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }
};
