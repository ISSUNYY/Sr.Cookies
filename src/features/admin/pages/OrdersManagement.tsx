import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus, type Order } from '@/features/orders/services/orderService';
import '../styles/admin.css';
import '../styles/orders.css';

type OrderTab = 'ALL' | 'PENDING' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export default function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderTab>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchOrders = async () => {
      try {
        const data = await getOrders();
        if (active) {
          setOrders(data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[OrdersManagement] Failed to fetch orders:', error);
      }
    };

    fetchOrders();
    // Poll for new orders every 15 seconds to keep dashboard up to date
    const interval = setInterval(fetchOrders, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      // Update local state immediately for fast feedback
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error('[OrdersManagement] Failed to update status:', error);
      alert('Erro ao atualizar status do pedido.');
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
          return { status: 'PREPARING', label: 'Confirmar e Iniciar Preparo' };
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

  // Get status counts for the tabs badge count
  const getStatusCount = (tab: OrderTab) => {
    if (tab === 'ALL') return orders.length;
    if (tab === 'PENDING') {
      return orders.filter(o => o.status === 'PENDING' || o.status === 'PAID' || o.status === 'PREPARING').length;
    }
    return orders.filter(o => o.status === tab).length;
  };

  // Filter orders by active tab
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') {
      return order.status === 'PENDING' || order.status === 'PAID' || order.status === 'PREPARING';
    }
    return order.status === activeTab;
  });

  // Dynamically compute the selected active order on render
  // Falls back automatically to the first order of the filtered stream if none selected
  const hasSelectedInFiltered = filteredOrders.some(o => o.id === selectedOrderId);
  const activeOrder = hasSelectedInFiltered 
    ? (orders.find(o => o.id === selectedOrderId) || null) 
    : (filteredOrders[0] || null);

  const selectedOrderAddress = activeOrder?.shipping_address as {
    paymentCategory?: 'app' | 'delivery';
    paymentMethod?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    zipCode?: string;
    complement?: string;
    observations?: string;
    deliveryDistanceKm?: number;
    deliveryFeeCharged?: number;
    changeRequired?: string;
    changeForAmount?: string;
  } | null;

  const selectedOrderIsPrepaid = selectedOrderAddress?.paymentCategory === 'app';
  const selectedOrderNextStep = activeOrder ? getNextStatus(activeOrder.status, selectedOrderAddress?.paymentCategory) : null;

  return (
    <div className="orders-management split-layout">
      {/* Left side: Orders list (Master panel) */}
      <div className="orders-list-pane">
        <header className="pane-header">
          <h1>Pedidos</h1>
          <p>Selecione um pedido para ver detalhes e gerenciar fluxo.</p>
        </header>

        {/* Dynamic Status Tabs Filter Bar */}
        <div className="order-flow-tabs">
          {(['ALL', 'PENDING', 'OUT_FOR_DELIVERY', 'DELIVERED'] as OrderTab[]).map(tab => (
            <button
              key={tab}
              className={`order-flow-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'ALL' && 'Todos'}
              {tab === 'PENDING' && 'Pendentes'}
              {tab === 'OUT_FOR_DELIVERY' && 'Pendente de Entrega'}
              {tab === 'DELIVERED' && 'Entrega'}
              <span className="order-tab-badge">{getStatusCount(tab)}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="pane-loading">Carregando lista de pedidos...</div>
        ) : (
          <div className="orders-list-stream">
            {filteredOrders.map(order => {
              const addressObj = order.shipping_address as {
                paymentCategory?: 'app' | 'delivery';
                street?: string;
                number?: string;
                neighborhood?: string;
              } | null;
              
              const isPrepaid = addressObj?.paymentCategory === 'app';
              const isSelected = activeOrder?.id === order.id;

              return (
                <div 
                  key={order.id} 
                  className={`order-list-item-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div className="item-card-header">
                    <span className="item-card-id">#{order.id.split('-')[0].toUpperCase()}</span>
                    <span className="item-card-time">
                      {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="item-card-body">
                    <span className="item-card-items-summary">
                      {order.order_items?.map(i => `${i.quantity}x ${i.products?.name || 'Cookie'}`).join(', ') || 'Sem itens'}
                    </span>
                    <div className="item-card-meta">
                      <span className={`payment-cat-pill ${isPrepaid ? 'prepaid' : 'delivery'}`}>
                        {isPrepaid ? 'Pago no App' : 'A pagar'}
                      </span>
                      <span className="item-card-price">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="item-card-footer">
                    <span className={`status-badge-dot ${order.status.toLowerCase()}`}></span>
                    <span className="item-card-status-label">{getStatusLabel(order.status)}</span>
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="pane-empty-state">
                <span>Nenhum pedido encontrado.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side: Selected order details (Detail panel) */}
      <div className="order-details-pane">
        {activeOrder ? (
          <div className="active-order-details">
            <header className="details-pane-header">
              <div>
                <h2>Pedido #{activeOrder.id.split('-')[0].toUpperCase()}</h2>
                <span className="details-date">
                  Realizado em {new Date(activeOrder.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <span className={`status-badge badge-${activeOrder.status.toLowerCase() === 'out_for_delivery' ? 'delivery' : activeOrder.status.toLowerCase()}`}>
                {getStatusLabel(activeOrder.status)}
              </span>
            </header>

            <div className="details-pane-body">
              {/* Items Section */}
              <div className="details-section">
                <h3 className="details-section-title">Produtos</h3>
                <div className="details-items-table">
                  {activeOrder.order_items?.map(item => (
                    <div key={item.id} className="details-item-row">
                      <div className="details-item-main">
                        <span className="details-item-quantity">{item.quantity}x</span>
                        <span className="details-item-name">{item.products?.name || 'Cookie'}</span>
                      </div>
                      <span className="details-item-price">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Address Section */}
              <div className="details-section">
                <h3 className="details-section-title">Endereco de Entrega</h3>
                <div className="details-address-box">
                  <p className="address-line">
                    <strong>Rua:</strong> {selectedOrderAddress?.street || 'Nao informado'}, {selectedOrderAddress?.number || 'S/N'}
                  </p>
                  <p className="address-line">
                    <strong>Bairro:</strong> {selectedOrderAddress?.neighborhood || 'Nao informado'}
                  </p>
                  {selectedOrderAddress?.complement && (
                    <p className="address-line">
                      <strong>Referencia/Complemento:</strong> {selectedOrderAddress.complement}
                    </p>
                  )}
                  {selectedOrderAddress?.zipCode && (
                    <p className="address-line">
                      <strong>CEP:</strong> {selectedOrderAddress.zipCode}
                    </p>
                  )}
                  <div className="address-distance-info">
                    Distancia: {selectedOrderAddress?.deliveryDistanceKm ? `${selectedOrderAddress.deliveryDistanceKm} km` : 'GPS'} | Taxa de entrega: {selectedOrderAddress?.deliveryFeeCharged ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedOrderAddress.deliveryFeeCharged) : 'Gratis'}
                  </div>
                </div>
              </div>

              {/* Customer Notes / Observations */}
              {selectedOrderAddress?.observations && (
                <div className="details-section">
                  <h3 className="details-section-title">Observacao do Cliente</h3>
                  <div className="details-observation-callout">
                    "{selectedOrderAddress.observations}"
                  </div>
                </div>
              )}

              {/* Payment Section */}
              <div className="details-section">
                <h3 className="details-section-title">Pagamento</h3>
                <div className="details-payment-box">
                  <div className="payment-main-info">
                    <span className={`payment-pill ${selectedOrderIsPrepaid ? 'prepaid' : 'delivery'}`}>
                      {selectedOrderIsPrepaid ? 'Pago no Aplicativo' : 'Pagar na Entrega'}
                    </span>
                    <span className="payment-method-text">
                      Metodo: {getPaymentMethodLabel(selectedOrderAddress?.paymentMethod)}
                    </span>
                  </div>

                  {selectedOrderAddress?.paymentMethod === 'dinheiro' && selectedOrderAddress?.changeRequired === 'Sim' && (
                    <div className="details-change-alert">
                      Levar troco para R$ {selectedOrderAddress.changeForAmount}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className="details-pane-footer">
              <div className="details-price-summary">
                <span className="summary-label">Total do Pedido</span>
                <span className="summary-value">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeOrder.total_amount)}
                </span>
              </div>

              <div className="details-actions-row">
                {selectedOrderNextStep ? (
                  <button
                    type="button"
                    className="btn-advance-status-large"
                    onClick={() => handleStatusChange(activeOrder.id, selectedOrderNextStep.status)}
                  >
                    {selectedOrderNextStep.label}
                  </button>
                ) : (
                  <button type="button" className="btn-advance-status-large" disabled>
                    Pedido Concluido
                  </button>
                )}

                <div className="details-secondary-actions">
                  <select
                    className="status-select-large"
                    aria-label="Alterar status manualmente"
                    value={activeOrder.status}
                    onChange={(e) => handleStatusChange(activeOrder.id, e.target.value)}
                  >
                    <option value="PENDING">Pendente</option>
                    <option value="PAID">Confirmado (Pago)</option>
                    <option value="PREPARING">Em Preparo</option>
                    <option value="OUT_FOR_DELIVERY">Em Rota</option>
                    <option value="DELIVERED">Entregue</option>
                    <option value="CANCELLED">Cancelar Pedido</option>
                  </select>
                </div>
              </div>
            </footer>
          </div>
        ) : (
          <div className="details-placeholder">
            <span className="placeholder-icon">📋</span>
            <h3>Nenhum pedido selecionado</h3>
            <p>Selecione um pedido na barra lateral esquerda para visualizar os detalhes completos, endereco e gerenciar as etapas do fluxo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
