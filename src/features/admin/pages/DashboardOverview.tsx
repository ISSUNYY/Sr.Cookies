import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus, type Order } from '@/features/orders/services/orderService';
import { 
  getStoreSettings, 
  updateStoreSettings, 
  type StoreSettings 
} from '@/features/admin/services/settingsService';
import '../styles/admin.css';
import '../styles/orders.css';

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
    
    // Poll for new active orders every 15 seconds so shop owners stay notified in real time
    const interval = setInterval(async () => {
      try {
        const ordersData = await getOrders();
        setOrders(ordersData);
      } catch (err) {
        console.error('[DashboardOverview] Error polling orders:', err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      // Immediately reflect status update in the local orders list
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error('[DashboardOverview] Failed to update status:', error);
      alert('Erro ao atualizar status do pedido.');
    }
  };

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
        text: 'Configuracoes de entrega salvas com sucesso no banco de dados!', 
        isError: false 
      });
      setTimeout(() => setSettingsMessage(null), 4000);
    } catch {
      setSettingsMessage({ 
        text: 'Falha ao salvar configuracoes no banco de dados.', 
        isError: true 
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'PENDING': return 'Pendente';
      case 'PAID': return 'Confirmado';
      case 'PREPARING': return 'Em Preparo';
      case 'OUT_FOR_DELIVERY': return 'Em Rota';
      case 'DELIVERED': return 'Entregue';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'pix': return 'Pix';
      case 'applepay': return 'Apple Pay';
      case 'googlepay': return 'Google Pay';
      case 'credito_app': return 'Credito Online';
      case 'dinheiro': return 'Dinheiro';
      case 'credito_entrega': return 'Credito na entrega';
      case 'debito_entrega': return 'Debito na entrega';
      default: return 'Cartao';
    }
  };

  const getNextStatus = (currentStatus: string, paymentCategory?: string): { status: string; label: string } | null => {
    switch (currentStatus) {
      case 'PENDING':
        if (paymentCategory === 'app') {
          return { status: 'PREPARING', label: 'Confirmar & Iniciar Preparo' };
        }
        return { status: 'PAID', label: 'Confirmar Pagamento' };
      case 'PAID': 
        return { status: 'PREPARING', label: 'Iniciar Preparo' };
      case 'PREPARING': 
        return { status: 'OUT_FOR_DELIVERY', label: 'Despachar para Entrega' };
      case 'OUT_FOR_DELIVERY': 
        return { status: 'DELIVERED', label: 'Concluir Entrega' };
      default: 
        return null;
    }
  };

  const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

  const stats = [
    { title: 'Faturamento Mensal', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue), change: '+0.0%', isPositive: true },
    { title: 'Pedidos Concluidos', value: orders.filter(o => o.status === 'DELIVERED').length.toString(), change: '+0.0%', isPositive: true },
    { title: 'Ticket Medio', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket), change: '0.0%', isPositive: true },
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

  const activeOrders = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');

  return (
    <div className="dashboard-overview">
      <header className="dashboard-header">
        <h1>Visao Geral</h1>
        <p>Acompanhe o desempenho da sua loja hoje.</p>
      </header>

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card" style={{ borderLeft: '4px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div className="stat-title" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.title}
            </div>
            <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', margin: '0.2rem 0' }}>
              {stat.value}
            </div>
            <div className={`stat-change ${stat.isPositive ? 'positive' : 'negative'}`} style={{ fontSize: '0.78rem', fontWeight: 600 }}>
              {stat.isPositive ? '↑' : '↓'} {stat.change} vs mes anterior
            </div>
          </div>
        ))}
      </div>

      {/* Pedidos em Aberto (Controle Rapido) */}
      <div className="dashboard-card" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Pedidos em Aberto
            <span style={{ 
              fontSize: '0.78rem', 
              padding: '0.2rem 0.6rem', 
              backgroundColor: 'var(--color-primary)', 
              color: 'white', 
              borderRadius: '9999px',
              fontWeight: 800,
              verticalAlign: 'middle'
            }}>
              {activeOrders.length}
            </span>
          </h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Monitoramento de fila ativa em tempo real
          </span>
        </div>

        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: '#faf9f6' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Codigo</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horario</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Produtos</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observacao</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagamento</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map(order => {
                const addressObj = order.shipping_address as {
                  paymentCategory?: 'app' | 'delivery';
                  paymentMethod?: string;
                  street?: string;
                  number?: string;
                  neighborhood?: string;
                  complement?: string;
                  observations?: string;
                  changeRequired?: string;
                  changeForAmount?: string;
                } | null;

                const isPrepaid = addressObj?.paymentCategory === 'app';
                const nextStep = getNextStatus(order.status, addressObj?.paymentCategory);
                
                const timeString = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      #{order.id.split('-')[0].toUpperCase()}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      {timeString}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                      <strong style={{ display: 'block', fontWeight: 600 }}>{order.order_items?.[0] ? 'Cliente' : 'Cliente'}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Macaé, RJ</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--color-text)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.order_items?.map(i => `${i.quantity}x ${i.products?.name || 'Cookie'}`).join(', ') || 'Sem itens'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: addressObj?.observations ? '#b45309' : 'var(--color-text-muted)', fontStyle: addressObj?.observations ? 'italic' : 'normal' }}>
                      {addressObj?.observations ? addressObj.observations : 'Nenhuma'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                      <span className={`payment-cat-pill ${isPrepaid ? 'prepaid' : 'delivery'}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
                        {isPrepaid ? 'Pago' : 'A cobrar'}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                        {getPaymentMethodLabel(addressObj?.paymentMethod)}
                        {addressObj?.paymentMethod === 'dinheiro' && addressObj?.changeRequired === 'Sim' ? ` (Troco R$ ${addressObj.changeForAmount})` : ''}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`status-badge badge-${order.status.toLowerCase() === 'out_for_delivery' ? 'delivery' : order.status.toLowerCase()}`} style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        {nextStep ? (
                          <button
                            type="button"
                            className="btn-advance-status"
                            onClick={() => handleStatusChange(order.id, nextStep.status)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', fontWeight: 700 }}
                          >
                            {nextStep.label}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Concluido</span>
                        )}
                        
                        <select
                          className="status-select"
                          aria-label="Acoes manuais de status"
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          style={{ padding: '0.35rem', fontSize: '0.75rem', minWidth: '90px', borderRadius: '4px', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                        >
                          <option value="PENDING">Pendente</option>
                          <option value="PAID">Confirmado</option>
                          <option value="PREPARING">Preparando</option>
                          <option value="OUT_FOR_DELIVERY">Em Rota</option>
                          <option value="DELIVERED">Entregue</option>
                          <option value="CANCELLED">Cancelar</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {activeOrders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
                    Nenhum pedido em aberto no momento. Excelente trabalho!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Delivery Configuration Panel */}
        <div className="dashboard-card">
          <h2>Configuracao de Entrega</h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.25rem' }}>
            Defina o endereco da sua loja fisica e os coeficientes de cobranca por quilometro (KM).
          </p>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="admin-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4b5563' }}>Endereco Base da Loja (Em Macae)</label>
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
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4b5563' }}>Valor por Quilometro (R$ / KM)</label>
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
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4b5563' }}>Taxa Minima de Entrega (R$)</label>
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
              {isSavingSettings ? 'Salvando...' : 'Salvar Configuracoes'}
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
