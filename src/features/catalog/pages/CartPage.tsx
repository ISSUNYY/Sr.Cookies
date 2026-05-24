import { Link } from 'react-router';
import { useCartStore } from '../stores/useCartStore';
import '../styles/cart.css';

export default function CartPage() {
  const { items, removeItem, addItem, getTotal } = useCartStore();
  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="cart-empty-state">
        <div className="cart-empty-content">
          <div className="cart-empty-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              <circle cx="12" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="8" r="1" fill="currentColor" />
              <circle cx="10" cy="7" r="1" fill="currentColor" />
            </svg>
          </div>
          <h2>Seu carrinho está vazio.</h2>
          <p>Que tal adoçar o seu dia com alguns de nossos maravilhosos cookies artesanais, fresquinhos e crocantes?</p>
          <Link to="/" className="btn-primary">
            Ver Cardápio
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      {/* Step Flow Header */}
      <div className="cart-flow-steps">
        <div className="cart-flow-step active">
          <span className="cart-flow-step-num">1</span>
          <span>Carrinho</span>
        </div>
        <div className="cart-flow-separator"></div>
        <div className="cart-flow-step">
          <span className="cart-flow-step-num">2</span>
          <span>Finalizar</span>
        </div>
      </div>

      <div className="cart-header">
        <h1>Seu Carrinho</h1>
      </div>

      <div className="cart-content">
        <div className="cart-items-list">
          {items.map((item) => (
            <div key={item.product.id} className="cart-item">
              <div className="cart-item-image">
                <img src={item.product.image_url} alt={item.product.name} />
              </div>
              <div className="cart-item-details">
                <h3>{item.product.name}</h3>
                <p className="cart-item-price">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.product.price)}
                </p>
              </div>
              <div className="cart-item-actions">
                <div className="quantity-controls">
                  <button 
                    className="btn-qty" 
                    onClick={() => {
                      if (item.quantity > 1) {
                        addItem(item.product, -1);
                      } else {
                        removeItem(item.product.id);
                      }
                    }}
                    aria-label="Diminuir quantidade"
                  >
                    -
                  </button>
                  <span className="qty-value">{item.quantity}</span>
                  <button 
                    className="btn-qty" 
                    onClick={() => addItem(item.product, 1)}
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
                <button 
                  className="btn-remove" 
                  onClick={() => removeItem(item.product.id)}
                  aria-label="Remover item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Remover
                </button>
              </div>
              <div className="cart-item-total">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.product.price * item.quantity)}
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h2>Resumo do Pedido</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
          </div>
          <div className="summary-row">
            <span>Entrega</span>
            <span style={{ color: '#4caf50', fontWeight: 'bold' }}>Grátis</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
          </div>
          <Link to="/checkout" className="btn-checkout">
            <span>Finalizar Compra</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link to="/" className="btn-continue">
            Continuar Comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
