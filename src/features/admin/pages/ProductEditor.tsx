import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { supabase } from '@/shared/lib/supabase';
import { adminService } from '../services/adminService';
import '../styles/admin.css';

export default function ProductEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    desc: '',
    price: '',
    category: 'tradicionais',
    is_out_of_stock: false,
    image: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing && id) {
      async function fetchProduct() {
        try {
          const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
          if (error) throw error;
          if (data) {
            setFormData({
              name: data.name,
              desc: data.desc,
              price: data.price.toString(),
              category: data.category,
              is_out_of_stock: data.is_out_of_stock,
              image: data.image,
            });
            if (data.image) {
              setImagePreview(data.image);
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load product');
        } finally {
          setIsLoading(false);
        }
      }
      fetchProduct();
    }
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      let imageUrl = formData.image;
      
      if (selectedFile) {
        imageUrl = await adminService.uploadProductImage(selectedFile);
      }

      const payload = {
        ...formData,
        image: imageUrl,
        price: parseFloat(formData.price),
      };

      if (isEditing) {
        const { error } = await supabase.from('products').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
      }
      
      navigate('/admin/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="admin-editor-page">Carregando dados do produto...</div>;
  }

  return (
    <div className="admin-editor-page">
      <header className="admin-header">
        <h1>{isEditing ? 'Editar Produto' : 'Novo Produto'}</h1>
      </header>

      {error && <div className="error-message mb-4">{error}</div>}

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Nome do Produto</label>
          <input
            id="name"
            name="name"
            type="text"
            className="form-control"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="desc">Descrição</label>
          <textarea
            id="desc"
            name="desc"
            className="form-control"
            value={formData.desc}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="price">Preço (R$)</label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            className="form-control"
            value={formData.price}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="category">Categoria</label>
          <select
            id="category"
            name="category"
            className="form-control"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="tradicionais">Tradicionais</option>
            <option value="recheados">Recheados</option>
            <option value="bebidas">Bebidas</option>
          </select>
        </div>

        <div className="form-group">
          <label>Imagem do Produto</label>
          <div className="file-upload-container">
            <label className="file-upload-label">
              <span className="file-upload-icon">📸</span>
              <span>Clique para selecionar uma imagem</span>
              <input
                type="file"
                accept="image/*"
                className="file-upload-input"
                onChange={handleImageChange}
              />
            </label>
          </div>
          {imagePreview && (
            <div className="file-preview">
              <img src={imagePreview} alt="Preview" />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              name="is_out_of_stock"
              type="checkbox"
              className="checkbox-input"
              checked={formData.is_out_of_stock}
              onChange={handleChange}
            />
            Marcar como Esgotado
          </label>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => navigate('/admin/products')}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Produto'}
          </button>
        </div>
      </form>
    </div>
  );
}
