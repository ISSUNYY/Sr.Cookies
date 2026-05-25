import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router';
import { useCartStore } from '@/features/catalog/stores/useCartStore';
import { simulateMpWebhookNotification } from '@/features/orders/services/mpService';
import { useAuth } from '@/features/auth/providers/AuthProvider';
import { signOut } from '@/features/auth/services/authService';
import './layout.css';

export default function RootLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, profile, user } = useAuth();
  const items = useCartStore(state => state.items);
  const cartItemsCount = items.reduce((total, item) => total + item.quantity, 0);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('[RootLayout] Error signing out:', err);
    }
  };

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
          
          setPaymentSuccessMessage('Pagamento aprovado. Redirecionando...');
          
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
          
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {isAuthenticated ? (
              <div className="user-profile-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="welcome-text" style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  Olá, <strong style={{ color: 'var(--color-text)' }}>{profile?.name || user?.user_metadata?.name || 'Cliente'}</strong>
                </span>
                
                {profile?.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    className="admin-badge-nav" 
                    style={{
                      background: 'rgba(173, 127, 96, 0.1)',
                      border: '1px solid rgba(173, 127, 96, 0.3)',
                      color: 'var(--color-primary)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      textDecoration: 'none',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(173, 127, 96, 0.18)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(173, 127, 96, 0.1)'}
                  >
                    Painel Admin
                  </Link>
                )}

                <button 
                  onClick={handleLogout} 
                  className="logout-button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e74c3c',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    transition: 'opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link to="/auth/login" className="login-link">Entrar</Link>
            )}

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
