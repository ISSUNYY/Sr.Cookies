import '../styles/catalog.css';

const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Sir Cookie',
    desc: 'Massa tradicional amanteigada, com pedaços generosos de chocolate nobre ao leite e finalizado com uma pitada de flor de sal. Aquele básico bem feito!',
    price: 13.90,
    image: '/images/Cookie - Sir Cookie.jpg'
  },
  {
    id: '2',
    name: 'Dueto',
    desc: 'Massa de cacau bem estruturada, com muitos pedaços de chocolate branco nobre e meio amargo Hershey\'s, criando um equilíbrio profundo e irresistível.',
    price: 14.90,
    image: '/images/Cookie - Dueto.jpg'
  },
  {
    id: '3',
    name: 'Nutella',
    desc: 'Massa amanteigada tradicional, recheada com muita Nutella e finalizada com pedaços selecionados de chocolate ao leite. Um clássico feito para quem busca sabor em cada mordida.',
    price: 15.90,
    image: '/images/Cookie - Nutella.jpg'
  },
  {
    id: '4',
    name: 'Red Velvet',
    desc: 'Massa Red super amanteigada, Recheada com ganache cream cheese de chocolate branco e finalizada com pedacinhos de chocolate branco. Uma combinação perfeita para quem ama sabores intensos e elegantes.',
    price: 15.90,
    image: '/images/Logo.png' // Usando logo como fallback temporario
  },
  {
    id: '5',
    name: 'Kinder Bueno',
    desc: 'Massa amanteigada tradicional ganha vida com muito recheio de creme de Kinder Bueno Original, finalizada com chocolates branco e ao leite.',
    price: 19.90,
    image: '/images/Cookie - Kinder Bueno.jpg'
  },
  {
    id: '6',
    name: 'Kitkat',
    desc: 'Um cookie sensacional com o toque especial e a crocância do famoso chocolate Kitkat.',
    price: 16.90,
    image: '/images/Cookie - Kitkat.jpg'
  },
  {
    id: '7',
    name: 'Kitkat duo',
    desc: 'Nosso cookie de Kitkat, porém agora na versão duo, com a massa de cacau e tradicional, e o recheio do kitkat branco e ao leite.',
    price: 17.90,
    image: '/images/Cookie - Kitkat duo.jpg'
  }
];

export default function HomePage() {
  return (
    <div className="catalog-page">
      <div className="catalog-hero">
        <h1>Nosso Cardápio</h1>
        <p>Artesanais, crocantes por fora e macios por dentro. Feitos com amor todos os dias.</p>
      </div>

      <div className="products-grid">
        {MOCK_PRODUCTS.map((product) => (
          <article key={product.id} className="product-card">
            <div className="product-image-container">
              <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
            </div>
            <div className="product-info">
              <h2 className="product-name">{product.name}</h2>
              <p className="product-desc">{product.desc}</p>
              <div className="product-footer">
                <span className="product-price">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                </span>
                <button className="btn-add" aria-label="Adicionar ao carrinho">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
