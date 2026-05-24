import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router';
import { useCartStore } from '@/features/catalog/stores/useCartStore';
import { simulateMpWebhookNotification } from '@/features/orders/services/mpService';
import './layout.css';

export default function RootLayout() {
  const navigate = useNavigate();
  const items = useCartStore(state => state.items);
  const cartItemsCount = items.reduce((total, item) => total + item.quantity, 0);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('collection_status') || params.get('status');
    const orderId = params.get('external_reference');
    const paymentIdStr = params.get('collection_id') || params.get('payment_id');

    if (status === 'approved' && orderId) {
      const processSuccessRedirect = async () => {
        try {
          const paymentId = paymentIdStr ? parseInt(paymentIdStr, 10) : Math.floor(1000000000 + Math.random() * 900000000);
          
          await simulateMpWebhookNotification(orderId, paymentId, 'approved');
          
          useCartStore.getState().clearCart();
          
          setPaymentSuccessMessage('🍪 Seu pagamento foi aprovado! Redirecionando para o acompanhamento...');
          
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Redirect to tracking page after a short delay
          setTimeout(() => {
            setPaymentSuccessMessage(null);
            navigate(`/track/${orderId}`);
          }, 2000);
        } catch (err) {
          console.error('[RootLayout] Error handling payment success redirect:', err);
        }
      };

      processSuccessRedirect();
    }
  }, [navigate]);

  return (
    <div className="root-layout">
      <header className="main-header">
        <div className="header-container">
          <Link to="/" className="header-logo">
            <img src="/images/Logo.png" alt="Sr. Cookies" />
          </Link>
          
          <div className="header-actions">
            <Link to="/auth/login" className="login-link">Entrar</Link>
            <Link to="/cart" className="cart-button" aria-label="Carrinho">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              {cartItemsCount > 0 && <span className="cart-badge">{cartItemsCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {paymentSuccessMessage && (
        <div className="payment-success-toast">
          <div className="toast-content">
            <div className="toast-icon-container">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span>{paymentSuccessMessage}</span>
          </div>
          <button className="btn-close-toast" onClick={() => setPaymentSuccessMessage(null)} aria-label="Fechar aviso">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
