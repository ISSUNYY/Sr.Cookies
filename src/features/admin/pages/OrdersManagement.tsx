import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus, type Order } from '@/features/orders/services/orderService';
import '../styles/admin.css';
import '../styles/orders.css';

export default function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await getOrders();
        setOrders(data);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      // Update local state
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Erro ao atualizar status do pedido.');
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'PENDING': return 'badge-pending';
      case 'PAID': return 'badge-preparing';
      case 'PREPARING': return 'badge-preparing';
      case 'OUT_FOR_DELIVERY': return 'badge-delivery';
      case 'DELIVERED': return 'badge-delivered';
      default: return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'PENDING': return 'Pendente';
      case 'PAID': return 'Pago';
      case 'PREPARING': return 'Preparando';
      case 'OUT_FOR_DELIVERY': return 'Em Rota';
      case 'DELIVERED': return 'Entregue';
      default: return status;
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'pix': return '⚡ Pix';
      case 'applepay': return '🍎 Apple Pay';
      case 'googlepay': return '🤖 Google Pay';
      case 'credito_app': return '💳 Crédito (Online)';
      case 'dinheiro': return '💵 Dinheiro';
      case 'credito_entrega': return '💳 Crédito (Na entrega)';
      case 'debito_entrega': return '💳 Débito (Na entrega)';
      default: return '💳 Cartão';
    }
  };

  return (
    <div className="orders-management">
      <header className="dashboard-header">
        <h1>Gestão de Pedidos</h1>
        <p>Acompanhe e atualize os status dos pedidos em tempo real. Clique em um pedido para expandir os detalhes.</p>
      </header>

      {isLoading ? (
        <div className="loading-state">Carregando pedidos...</div>
      ) : (
        <div className="dashboard-card" style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>ID do Pedido</th>
                <th>Data</th>
                <th>Forma de Pagamento</th>
                <th>Total</th>
                <th>Status Atual</th>
                <th>Ações (Mudar Status)</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const isExpanded = !!expandedOrders[order.id];
                const addressObj = order.shipping_address as {
                  paymentMethod?: string;
                  street?: string;
                  number?: string;
                  neighborhood?: string;
                  zipCode?: string;
                  complement?: string;
                  deliveryDistanceKm?: number;
                  deliveryFeeCharged?: number;
                  changeRequired?: string;
                  changeForAmount?: string;
                } | null;
                
                return (
                  <tr key={order.id} style={{ borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb' }}>
                    <td>
                      <button 
                        type="button"
                        onClick={() => toggleOrderExpand(order.id)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #d1d5db', background: '#fff' }}
                        aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </td>
                    <td className="font-mono text-sm" onClick={() => toggleOrderExpand(order.id)} style={{ cursor: 'pointer' }}>
                      {order.id.split('-')[0]}...
                    </td>
                    <td>{new Date(order.created_at).toLocaleString('pt-BR')}</td>
                    <td className="font-semibold text-sm">
                      {getPaymentMethodLabel(addressObj?.paymentMethod)}
                    </td>
                    <td className="font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td>
                      <select 
                        className="status-select"
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      >
                        <option value="PENDING">Pendente</option>
                        <option value="PAID">Pago</option>
                        <option value="PREPARING">Preparando</option>
                        <option value="OUT_FOR_DELIVERY">Em Rota</option>
                        <option value="DELIVERED">Entregue</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {orders.map(order => {
                const isExpanded = !!expandedOrders[order.id];
                if (!isExpanded) return null;
                const addressObj = order.shipping_address as {
                  paymentMethod?: string;
                  street?: string;
                  number?: string;
                  neighborhood?: string;
                  zipCode?: string;
                  complement?: string;
                  deliveryDistanceKm?: number;
                  deliveryFeeCharged?: number;
                  changeRequired?: string;
                  changeForAmount?: string;
                } | null;
                
                return (
                  <tr key={`${order.id}-details`} style={{ backgroundColor: '#fdfdfd' }}>
                    <td></td>
                    <td colSpan={6} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', width: '100%' }}>
                        
                        {/* 🏠 Detalhes do Endereço de Entrega */}
                        <div>
                          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                            📍 Endereço de Entrega
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.92rem', color: '#374151', lineHeight: '1.5' }}>
                            <strong>Rua:</strong> {addressObj?.street}, {addressObj?.number}<br />
                            <strong>Bairro:</strong> {addressObj?.neighborhood} | <strong>CEP:</strong> {addressObj?.zipCode}<br />
                            <strong>Complemento/Referência:</strong> {addressObj?.complement || 'Nenhum'}<br />
                            <strong>Distância da Loja:</strong> {addressObj?.deliveryDistanceKm ? `${addressObj.deliveryDistanceKm} km` : 'Coordenadas via GPS'}<br />
                            <strong>Taxa de Entrega Cobrada:</strong> {addressObj?.deliveryFeeCharged ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(addressObj.deliveryFeeCharged) : 'R$ 0,00'}
                          </p>
                        </div>

                        {/* 🍪 Itens do Pedido */}
                        <div>
                          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                            🍪 Itens do Pedido
                          </h4>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.92rem', color: '#374151', lineHeight: '1.5' }}>
                            {order.order_items?.map((item) => (
                              <li key={item.id}>
                                <strong>{item.quantity}x</strong> {item.products?.name || 'Cookie'} — {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)} (unid)
                              </li>
                            ))}
                            {(!order.order_items || order.order_items.length === 0) && (
                              <li style={{ color: '#9ca3af', listStyleType: 'none', marginLeft: '-1.25rem' }}>Itens indisponíveis.</li>
                            )}
                          </ul>
                        </div>

                        {/* 💵 Detalhes de Pagamento e Observações */}
                        <div>
                          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                            💵 Observações do Pagamento
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.92rem', color: '#374151' }}>
                            <strong>Método:</strong> {getPaymentMethodLabel(addressObj?.paymentMethod)}<br />
                            {addressObj?.paymentMethod === 'dinheiro' && (
                              <>
                                <strong>Precisa de troco?</strong> {addressObj?.changeRequired || 'Não'}<br />
                                {addressObj?.changeRequired === 'Sim' && (
                                  <strong style={{ color: '#ea1d2c', backgroundColor: 'rgba(234, 29, 44, 0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.25rem' }}>
                                    💵 Levar troco para R$ {addressObj?.changeForAmount}
                                  </strong>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                        
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center">Nenhum pedido encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
