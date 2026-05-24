import { useState, useEffect } from 'react';
import { getOrders, type Order } from '@/features/orders/services/orderService';
import { 
  getStoreSettings, 
  updateStoreSettings, 
  type StoreSettings 
} from '@/features/admin/services/settingsService';
import '../styles/admin.css';

export default function DashboardOverview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Settings State
  const [settings, setSettings] = useState<StoreSettings>({
    store_address: '',
    store_latitude: -22.3755,
    store_longitude: -41.7766,
    delivery_rate_per_km: 1.00,
    delivery_base_fee: 3.00,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    const fetchOrdersAndSettings = async () => {
      try {
        const ordersData = await getOrders();
        setOrders(ordersData);
        
        const settingsData = await getStoreSettings();
        setSettings(settingsData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrdersAndSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsMessage(null);

    try {
      // 1. Geocode store address using Nominatim OpenStreetMap API to fetch precise coordinates
      const query = `${settings.store_address}, Macaé, RJ, Brasil`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      
      let lat = settings.store_latitude;
      let lon = settings.store_longitude;

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lon = parseFloat(data[0].lon);
          console.log('[DashboardOverview] Geocoded Store coordinates:', lat, lon);
        }
      }

      const updated = {
        ...settings,
        store_latitude: lat,
        store_longitude: lon,
      };

      // 2. Persist in Supabase
      await updateStoreSettings(updated);
      setSettings(updated);
      
      setSettingsMessage({ 
        text: 'Configurações de entrega salvas com sucesso no banco de dados!', 
        isError: false 
      });
      setTimeout(() => setSettingsMessage(null), 4000);
    } catch {
      setSettingsMessage({ 
        text: 'Falha ao salvar configurações no banco de dados.', 
        isError: true 
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

  const stats = [
    { title: 'Faturamento Mensal', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue), change: '+0.0%', isPositive: true, icon: '💰', color: 'blue' },
    { title: 'Pedidos Concluídos', value: orders.filter(o => o.status === 'DELIVERED').length.toString(), change: '+0.0%', isPositive: true, icon: '🛍️', color: 'green' },
    { title: 'Ticket Médio', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket), change: '0.0%', isPositive: true, icon: '📈', color: 'orange' },
  ];

  const topProducts = [
    { rank: 1, name: 'Cookie Tradicional', sales: '1.240 uni' },
    { rank: 2, name: 'Cookie Nutella', sales: '985 uni' },
    { rank: 3, name: 'Cookie Red Velvet', sales: '740 uni' },
    { rank: 4, name: 'Cookie Pistache', sales: '450 uni' },
  ];

  if (isLoading) {
    return (
      <div className="dashboard-overview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6b7280', fontSize: '1.25rem' }}>
        <span>Carregando painel de controle...</span>
      </div>
    );
  }

  return (
    <div className="dashboard-overview">
      <header className="dashboard-header">
        <h1>Visão Geral</h1>
        <p>Acompanhe o desempenho da sua loja hoje.</p>
      </header>

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="stat-title">{stat.title}</div>
            <div className="stat-value">{stat.value}</div>
            <div className={`stat-change ${stat.isPositive ? 'positive' : 'negative'}`}>
              {stat.isPositive ? '↑' : '↓'} {stat.change} vs mês anterior
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        {/* Sales Performance Graphic */}
        <div className="dashboard-card">
          <h2>Desempenho de Vendas</h2>
          <div style={{ height: '250px', display: 'flex', alignItems: 'flex-end', gap: '1rem', paddingTop: '2rem' }}>
            {[40, 65, 45, 80, 55, 90, 75].map((height, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '100%', height: `${height}%`, backgroundColor: '#eff6ff', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${height * 0.7}%`, backgroundColor: 'var(--color-primary)', borderRadius: '4px 4px 0 0' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Delivery Configuration Panel */}
        <div className="dashboard-card">
          <h2>Configuração de Entrega</h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.25rem' }}>
            Defina o endereço da sua loja física e os coeficientes de cobrança por quilômetro (KM).
          </p>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="admin-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4b5563' }}>Endereço Base da Loja (Em Macaé)</label>
              <input 
                required
                type="text" 
                className="admin-input"
                placeholder="Ex: Av. Rui Barbosa, 123, Centro"
                value={settings.store_address}
                onChange={e => setSettings({ ...settings, store_address: e.target.value })}
                style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="admin-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4b5563' }}>Valor por Quilômetro (R$ / KM)</label>
                <input 
                  required
                  type="number" 
                  step="0.05"
                  min="0"
                  className="admin-input"
                  placeholder="Ex: 1.00"
                  value={settings.delivery_rate_per_km}
                  onChange={e => setSettings({ ...settings, delivery_rate_per_km: parseFloat(e.target.value) || 0 })}
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
                />
              </div>

              <div className="admin-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4b5563' }}>Taxa Mínima de Entrega (R$)</label>
                <input 
                  required
                  type="number" 
                  step="0.05"
                  min="0"
                  className="admin-input"
                  placeholder="Ex: 3.00"
                  value={settings.delivery_base_fee}
                  onChange={e => setSettings({ ...settings, delivery_base_fee: parseFloat(e.target.value) || 0 })}
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic', background: '#f3f4f6', padding: '0.6rem', borderRadius: '4px' }}>
              Coordenadas atuais da loja: Lat: {settings.store_latitude.toFixed(4)} | Lon: {settings.store_longitude.toFixed(4)}
            </div>

            {settingsMessage && (
              <div style={{ 
                padding: '0.75rem', 
                borderRadius: '6px', 
                fontSize: '0.85rem',
                fontWeight: 500,
                backgroundColor: settingsMessage.isError ? '#fef2f2' : '#f0fdf4',
                color: settingsMessage.isError ? '#991b1b' : '#166534',
                border: `1px solid ${settingsMessage.isError ? '#fee2fee' : '#bbf7d0'}`
              }}>
                {settingsMessage.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSavingSettings}
              className="btn-admin-primary"
              style={{ 
                padding: '0.75rem 1.25rem', 
                backgroundColor: 'var(--color-primary)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 700, 
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </form>
        </div>

        {/* Best-selling rankings */}
        <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
          <h2>Mais Vendidos</h2>
          <div className="ranking-list">
            {topProducts.map((prod) => (
              <div key={prod.rank} className="ranking-item">
                <div className="ranking-info">
                  <span className="ranking-rank">{prod.rank}</span>
                  <span className="ranking-name">{prod.name}</span>
                </div>
                <span className="ranking-sales">{prod.sales}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
