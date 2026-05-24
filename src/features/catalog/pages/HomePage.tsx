import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { useCartStore } from '../stores/useCartStore';
import '../styles/catalog.css';

interface Product {
  id: string;
  name: string;
  desc: string;
  price: number;
  image_url: string;
  category: 'tradicionais' | 'recheados' | 'bebidas';
  is_out_of_stock?: boolean;
}

function ProductImage({ src, alt, category }: { src: string; alt: string; category: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={`product-image-fallback ${category}`} aria-label={alt}>
        {category === 'bebidas' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="4" width="10" height="16" rx="2" />
            <line x1="7" y1="8" x2="17" y2="8" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="15" y2="16" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 8.5h.01M16 8.5h.01M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="8" cy="12" r="1" fill="currentColor" />
            <circle cx="16" cy="12" r="1" fill="currentColor" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className="product-image" 
      loading="lazy" 
      onError={() => setHasError(true)} 
    />
  );
}

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState<'todos' | 'tradicionais' | 'recheados' | 'bebidas'>('todos');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const addItem = useCartStore(state => state.addItem);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('Failed to fetch products', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const categories = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'tradicionais' as const, label: 'Tradicionais' },
    { id: 'recheados' as const, label: 'Recheados' },
    { id: 'bebidas' as const, label: 'Bebidas' },
  ];

  const filteredProducts = products.filter((p) => {
    if (activeCategory === 'todos') {
      return p.category === 'tradicionais' || p.category === 'recheados';
    }
    return p.category === activeCategory;
  });

  const categoryTitles = {
    todos: 'Todos os Cookies',
    tradicionais: 'Tradicionais',
    recheados: 'Recheados',
    bebidas: 'Bebidas',
  };

  return (
    <div className="catalog-page">
      <div className="catalog-hero">
        <h1>Nosso Cardápio</h1>
        <p>Artesanais, crocantes por fora e macios por dentro. Feitos com amor todos os dias.</p>
      </div>

      <nav className="category-nav-bar">
        <div className="category-nav-container">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-nav-item ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="category-section">
        <h2 className="category-section-title">{categoryTitles[activeCategory]}</h2>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Carregando produtos...
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <article 
                key={product.id} 
                className={`product-card ${product.is_out_of_stock ? 'is-out-of-stock' : ''} ${product.category === 'bebidas' ? 'is-beverage' : ''}`}
              >
                <div className="product-info">
                  <h3 className="product-name">{product.name}</h3>
                  <p className="product-desc">{product.desc}</p>
                  <div className="product-footer">
                    <span className="product-price">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                    </span>
                    <button 
                      className="btn-add" 
                      disabled={product.is_out_of_stock}
                      aria-label={product.is_out_of_stock ? 'Produto Esgotado' : 'Adicionar ao carrinho'}
                      onClick={() => addItem(product)}
                    >
                      {product.is_out_of_stock ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="product-image-container">
                  <ProductImage src={product.image_url} alt={product.name} category={product.category} />
                  {product.is_out_of_stock && (
                    <div className="badge-out-of-stock">
                      <span>Esgotado</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
