import { Outlet } from 'react-router';
import './auth.css';

export default function AuthLayout() {
  return (
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-brand">
          <img src="/Logo.png" alt="Sr. Cookies" className="auth-logo" />
        </div>
        <div className="auth-content">
          <Outlet />
        </div>
      </div>
      <div className="auth-right">
        {/* We can put a beautiful cookie image here */}
        <div className="auth-image-overlay">
          <h2>Descubra a verdadeira experiência em cookies.</h2>
          <p>Massa amanteigada, chocolate nobre e muito amor.</p>
        </div>
      </div>
    </div>
  );
}
