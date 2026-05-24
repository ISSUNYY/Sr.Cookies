import { NavLink, Outlet } from 'react-router';
import '../styles/admin.css';

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span>🍪</span> Sr.Cookies Admin
        </div>
        
        <nav className="admin-sidebar-nav">
          <NavLink 
            to="/admin" 
            end
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
          >
            📊 Dashboard
          </NavLink>
          <NavLink 
            to="/admin/products" 
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
          >
            📦 Produtos
          </NavLink>
          <NavLink 
            to="/admin/orders" 
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
          >
            📋 Pedidos
          </NavLink>
          
          <NavLink 
            to="/" 
            className="admin-nav-link back-to-site"
          >
            ← Voltar ao Site
          </NavLink>
        </nav>
      </aside>
      
      <main className="admin-content-area">
        <Outlet />
      </main>
    </div>
  );
}
