import { Outlet, Link } from 'react-router';
import './layout.css';

export default function RootLayout() {
  return (
    <div className="root-layout">
      <header className="main-header">
        <div className="header-container">
          <Link to="/" className="header-logo">
            <img src="/images/Logo.png" alt="Sr. Cookies" />
          </Link>
          
          <div className="header-actions">
            <Link to="/auth/login" className="login-link">Entrar</Link>
            <button className="cart-button" aria-label="Carrinho">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span className="cart-badge">0</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
