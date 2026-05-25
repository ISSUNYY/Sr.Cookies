import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import {
  getOrderById,
  getOrderStatusHistory,
  type StatusHistoryEntry,
  type Order,
} from '../services/orderService';
import TrackingProgressBar from '../components/TrackingProgressBar';
import TrackingTimeline from '../components/TrackingTimeline';
import FeedbackCard from '../components/FeedbackCard';
import '../styles/tracking.css';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  PREPARING: 'Preparando',
  OUT_FOR_DELIVERY: 'Saiu para Entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'pending',
    PAID: 'paid',
    PREPARING: 'preparing',
    OUT_FOR_DELIVERY: 'out-for-delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
  };
  return map[status] || 'pending';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [orderData, historyData] = await Promise.all([
          getOrderById(orderId),
          getOrderStatusHistory(orderId),
        ]);

        if (!orderData) {
          setNotFound(true);
        } else {
          setOrder(orderData);
          setHistory(historyData);
        }
      } catch (err) {
        console.error('[Tracking] Failed to load order:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Poll every 15 seconds for real-time updates
    const interval = setInterval(async () => {
      try {
        const [orderData, historyData] = await Promise.all([
          getOrderById(orderId),
          getOrderStatusHistory(orderId),
        ]);
        if (orderData) {
          setOrder(orderData);
          setHistory(historyData);
        }
      } catch {
        // Silently handle polling errors
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="tracking-page">
        <div className="tracking-loading">
          <div className="tracking-loading-spinner" />
          <p>Buscando seu pedido...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="tracking-page">
        <div className="tracking-not-found">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <h2>Pedido não encontrado</h2>
          <p>Verifique o link de rastreamento ou entre em contato conosco pelo WhatsApp.</p>
          <Link to="/">Voltar à Loja</Link>
        </div>
      </div>
    );
  }

  const shippingAddr = order.shipping_address as Record<string, unknown> | null;
  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  // Build WhatsApp share link
  const trackingUrl = `${window.location.origin}/track/${order.id}`;
  const whatsappMessage = encodeURIComponent(
    `*Sr. Cookies*\n\nSeu pedido foi confirmado!\n\nAcompanhe a entrega em tempo real pelo link abaixo:\n${trackingUrl}\n\nObrigado pela sua preferencia!`
  );
  const customerPhone = (shippingAddr?.phone || shippingAddr?.customerPhone) as string | undefined;
  const whatsappLink = customerPhone
    ? `https://api.whatsapp.com/send?phone=55${customerPhone.replace(/\D/g, '')}&text=${whatsappMessage}`
    : `https://api.whatsapp.com/send?text=${whatsappMessage}`;

  return (
    <div className="tracking-page">
      {/* Header */}
      <div className="tracking-header">
        <div className="tracking-header-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <h1>Acompanhe seu Pedido</h1>
        <span className="tracking-order-id">#{order.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* Progress Bar */}
      {!isCancelled && (
        <div className="tracking-card">
          <TrackingProgressBar currentStatus={order.status} />
        </div>
      )}

      {/* Order Info */}
      <div className="tracking-card">
        <h2 className="tracking-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Detalhes do Pedido
        </h2>

        <div className="order-info-grid">
          <div className="order-info-item">
            <span className="order-info-label">Status</span>
            <span className={`order-status-badge ${getStatusBadgeClass(order.status)}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <div className="order-info-item">
            <span className="order-info-label">Total</span>
            <span className="order-info-value">{formatCurrency(order.total_amount)}</span>
          </div>
          <div className="order-info-item full-width">
            <span className="order-info-label">Data do Pedido</span>
            <span className="order-info-value">{formatDateTime(order.created_at)}</span>
          </div>
          {shippingAddr && (
            <div className="order-info-item full-width">
              <span className="order-info-label">Endereço de Entrega</span>
              <span className="order-info-value">
                {shippingAddr.street as string}, {shippingAddr.number as string}
                {shippingAddr.complement ? ` - ${shippingAddr.complement}` : ''}
                {' • '}{shippingAddr.neighborhood as string}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="tracking-card">
        <h2 className="tracking-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Histórico
        </h2>
        <TrackingTimeline history={history} />
      </div>

      {/* Feedback */}
      <div className="tracking-card">
        <h2 className="tracking-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Avaliação
        </h2>
        <FeedbackCard orderId={order.id} isDelivered={isDelivered} />
      </div>

      {/* WhatsApp Share */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-whatsapp"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Compartilhar via WhatsApp
      </a>
    </div>
  );
}
