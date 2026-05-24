import { supabase } from '@shared/lib/supabase';

export interface StoreSettings {
  store_address: string;
  store_latitude: number;
  store_longitude: number;
  delivery_rate_per_km: number;
  delivery_base_fee: number;
}

export const getStoreSettings = async (): Promise<StoreSettings> => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;

    // Default values if table is empty or missing keys
    const settingsMap: Record<string, string> = {
      store_address: 'Av. Rui Barbosa, Centro, Macaé, RJ',
      store_latitude: '-22.3755',
      store_longitude: '-41.7766',
      delivery_rate_per_km: '1.00',
      delivery_base_fee: '3.00',
    };

    if (data && data.length > 0) {
      data.forEach((row: { key: string; value: string }) => {
        settingsMap[row.key] = row.value;
      });
    }

    return {
      store_address: settingsMap.store_address,
      store_latitude: parseFloat(settingsMap.store_latitude) || -22.3755,
      store_longitude: parseFloat(settingsMap.store_longitude) || -41.7766,
      delivery_rate_per_km: parseFloat(settingsMap.delivery_rate_per_km) || 1.00,
      delivery_base_fee: parseFloat(settingsMap.delivery_base_fee) || 3.00,
    };
  } catch (error) {
    console.error('[settingsService] Failed to load store settings:', error);
    // Return fallback settings
    return {
      store_address: 'Av. Rui Barbosa, Centro, Macaé, RJ',
      store_latitude: -22.3755,
      store_longitude: -41.7766,
      delivery_rate_per_km: 1.00,
      delivery_base_fee: 3.00,
    };
  }
};

export const updateStoreSettings = async (settings: StoreSettings): Promise<void> => {
  const rows = [
    { key: 'store_address', value: settings.store_address },
    { key: 'store_latitude', value: settings.store_latitude.toString() },
    { key: 'store_longitude', value: settings.store_longitude.toString() },
    { key: 'delivery_rate_per_km', value: settings.delivery_rate_per_km.toString() },
    { key: 'delivery_base_fee', value: settings.delivery_base_fee.toString() },
  ];

  for (const row of rows) {
    const { error } = await supabase
      .from('settings')
      .upsert(row, { onConflict: 'key' });
    if (error) throw error;
  }
};
