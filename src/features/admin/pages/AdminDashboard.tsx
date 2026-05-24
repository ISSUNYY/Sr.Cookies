import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/shared/lib/supabase';
import '../styles/admin.css';

interface Product {
  id: string;
  name: string;
  desc: string;
  price: number;
  image: string;
  category: string;
  is_out_of_stock: boolean;
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Gerenciar Produtos</h1>
        <button className="btn-primary" onClick={() => navigate('/admin/products/new')}>
          + Novo Produto
        </button>
      </header>

      <main className="admin-main">
        {isLoading ? (
          <div className="loading-state">Carregando produtos...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">Nenhum produto encontrado.</div>
        ) : (
          <div className="admin-products-table-container">
            <table className="admin-products-table">
              <thead>
                <tr>
                  <th>Imagem</th>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <img src={product.image} alt={product.name} className="admin-product-img" />
                    </td>
                    <td>{product.name}</td>
                    <td className="capitalize">{product.category}</td>
                    <td>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                    </td>
                    <td>
                      <span className={`stock-badge ${product.is_out_of_stock ? 'out' : 'in'}`}>
                        {product.is_out_of_stock ? 'Esgotado' : 'Em Estoque'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" onClick={() => navigate(`/admin/products/${product.id}/edit`)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
