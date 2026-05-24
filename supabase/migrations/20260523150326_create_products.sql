-- Create products table
CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    "desc" TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    is_out_of_stock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert mock products
INSERT INTO public.products (name, "desc", price, category, image_url, is_out_of_stock) VALUES
('Cookie - Sir Cookie', 'Massa tradicional amanteigada, com pedaços generosos de chocolate nobre ao leite e finalizado com uma pitada de flor de sal. Aquele básico bem feito!', 14.90, 'tradicionais', '/images/Cookie - Sir Cookie.jpg', false),
('Cookie - Dueto', 'Massa de cacau bem estruturada, com muitos pedaços de chocolate branco nobre e meio amargo Hershey''s, criando um equilíbrio profundo e irresistível.', 15.90, 'tradicionais', '/images/Cookie - Dueto.jpg', false),
('Cookie - Red Velvet II', 'Massa Red super amanteigada, agora com pedaços de chocolate branco nobre. Uma combinação perfeita para quem ama sabores intensos e elegantes.', 16.90, 'tradicionais', 'https://images.unsplash.com/photo-1618923850107-d1a234d7a73a?auto=format&fit=crop&w=400&q=80', false),
('Cookie - Nutella', 'Massa amanteigada tradicional, recheada com muita Nutella e finalizada com pedaços selecionados de chocolate ao leite. Um clássico feito para quem busca sabor in cada mordida.', 15.90, 'recheados', '/images/Cookie - Nutella.jpg', false),
('Cookie - Kinder Bueno', 'Massa amanteigada tradicional ganha vida com muito recheio de creme de Kinder Bueno Original, finalizada com chocolates branco e ao leite. Uma explosão de sabor que virou o queridinho do momento.', 20.90, 'recheados', '/images/Cookie - Kinder Bueno.jpg', true),
('Cookie - Kitkat', 'Um cookie sensacional com o toque especial e a crocância do famoso chocolate Kitkat.', 16.90, 'recheados', '/images/Cookie - Kitkat.jpg', false),
('Cookie - Kitkat duo', 'Nosso cookie de Kitkat, porém agora na versão duo, com a massa de cacau e tradicional, e o recheio do kitkat branco e ao leite, combinando os sabores para uma nova experiência.', 16.90, 'recheados', '/images/Cookie - Kitkat duo.jpg', false),
('Coca-cola Lata', 'Coca-cola lata 350ml', 6.00, 'bebidas', '/images/Coca-cola Lata.png', false),
('Coca-Cola zero lata', 'Coca-Cola lata 350ml', 6.00, 'bebidas', '/images/Coca-cola Lata.png', false),
('H20', 'H20 500ml', 7.00, 'bebidas', '/images/Agua c gas.png', false),
('Agua s gás', 'agua sem gás 500ml', 2.60, 'bebidas', '/images/Agua c gas.png', false),
('Agua c gás', 'agua com gás 500ml', 3.20, 'bebidas', '/images/Agua c gas.png', false);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow public read access to products
CREATE POLICY "Allow public read access on products"
ON public.products
FOR SELECT
TO public
USING (true);

-- Allow authenticated users to insert/update/delete products
CREATE POLICY "Allow authenticated users to modify products"
ON public.products
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
CREATE POLICY "Public read access to product-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload to product-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete from product-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
