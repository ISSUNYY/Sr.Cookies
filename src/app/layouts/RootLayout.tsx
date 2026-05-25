import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router';
import { useCartStore } from '@/features/catalog/stores/useCartStore';
import { simulateMpWebhookNotification } from '@/features/orders/services/mpService';
import { useAuth } from '@/features/auth/providers/AuthProvider';
import { signOut, updateProfile } from '@/features/auth/services/authService';
import './layout.css';

export default function RootLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, profile, refreshProfile, user, isLoading } = useAuth();
  const items = useCartStore(state => state.items);
  const cartItemsCount = items.reduce((total, item) => total + item.quantity, 0);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  
  // Header scrolled state & User menu toggle state
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Phone Barrier State for Google Sign-in users missing phone number
  const [barrierPhone, setBarrierPhone] = useState('');
  const [barrierError, setBarrierError] = useState<string | null>(null);
  const [barrierSaving, setBarrierSaving] = useState(false);

  // Simple mask for cell phone format (XX) XXXXX-XXXX
  const handleBarrierPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 7) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setBarrierPhone(value);
  };

  const handleBarrierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = barrierPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setBarrierError('Por favor, insira um celular válido.');
      return;
    }

    setBarrierSaving(true);
    setBarrierError(null);

    try {
      if (user) {
        await updateProfile(user.id, { phone: barrierPhone });
        if (refreshProfile) {
          await refreshProfile();
        }
      }
    } catch (err) {
      setBarrierError(err instanceof Error ? err.message : 'Falha ao salvar. Tente novamente.');
    } finally {
      setBarrierSaving(false);
    }
  };

  const showPhoneBarrier = !isLoading && isAuthenticated && profile && !profile.phone;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('[RootLayout] Error signing out:', err);
    }
  };

  // Scroll listener for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click-outside listener to close the user menu dropdown
  useEffect(() => {
    if (!showMenu) return;
    const closeMenu = () => setShowMenu(false);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [showMenu]);

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
      <header className={`main-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="header-container">
          <Link to="/" className="header-logo">
            <img src="/images/Logo.png" alt="Sr. Cookies" />
          </Link>
          
          <div className="header-actions">
            {isAuthenticated ? (
              <div className="user-menu-container">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="user-menu-trigger"
                  aria-label="Menu do usuário"
                  aria-expanded={showMenu}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                </button>

                {showMenu && (
                  <div className="user-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                    <div className="user-menu-header">
                      <span className="user-menu-name">
                        Olá, {profile?.name || user?.user_metadata?.name || 'Cliente'}
                      </span>
                      <span className="user-menu-email">
                        {user?.email?.includes('@srcookies.com') ? profile?.phone || 'Cliente Autenticado' : user?.email}
                      </span>
                    </div>
                    
                    <div className="user-menu-divider" />
                    
                    {profile?.role === 'admin' && (
                      <Link 
                        to="/admin" 
                        className="user-menu-item admin"
                        onClick={() => setShowMenu(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="9"></rect>
                          <rect x="14" y="3" width="7" height="5"></rect>
                          <rect x="14" y="12" width="7" height="9"></rect>
                          <rect x="3" y="16" width="7" height="5"></rect>
                        </svg>
                        Painel Admin
                      </Link>
                    )}

                    <button 
                      onClick={() => {
                        setShowMenu(false);
                        handleLogout();
                      }} 
                      className="user-menu-item logout"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Sair
                    </button>
                  </div>
                )}
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

      {showPhoneBarrier && (
        <div className="phone-barrier-overlay">
          <div className="phone-barrier-card">
            <h2>Só mais um detalhe</h2>
            <p>Insira seu WhatsApp para receber as atualizações de rastreamento do seu pedido.</p>
            
            <form onSubmit={handleBarrierSubmit} className="phone-barrier-form">
              {barrierError && <div className="barrier-error">{barrierError}</div>}
              
              <div className="form-group">
                <input
                  required
                  type="text"
                  placeholder="(XX) XXXXX-XXXX"
                  value={barrierPhone}
                  onChange={handleBarrierPhoneChange}
                  className="form-input"
                  style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}
                />
              </div>

              <button type="submit" className="btn-primary" disabled={barrierSaving}>
                {barrierSaving ? <div className="ifood-loader-spinner"></div> : 'Salvar e Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
