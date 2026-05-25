import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCartStore } from '../stores/useCartStore';
import { useAuth } from '@/features/auth/providers/AuthProvider';
import { createOrder } from '@/features/orders/services/orderService';
import { 
  createMpPreference, 
  simulateMpWebhookNotification 
} from '@/features/orders/services/mpService';
import { 
  getStoreSettings, 
  type StoreSettings 
} from '@/features/admin/services/settingsService';
import '../styles/checkout.css';
import '../styles/cart.css';

type PaymentCategory = 'app' | 'delivery';
type PaymentMethod = 'applepay' | 'googlepay' | 'pix' | 'credito_app' | 'dinheiro' | 'credito_entrega' | 'debito_entrega';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { items, getTotal, clearCart } = useCartStore();

  // Redirect guest users to login page automatically with checkout destination stored
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth/login', { state: { from: { pathname: '/checkout' } } });
    }
  }, [isLoading, isAuthenticated, navigate]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Categorias de Pagamento
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>('app');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  // GPS geolocation states
  const [isLocating, setIsLocating] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');
  const [gpsError, setGpsError] = useState('');

  // Form states
  const [address, setAddress] = useState({
    street: '',
    number: '',
    neighborhood: '',
    zipCode: '',
    city: 'Macaé',
    state: 'RJ',
    complement: '',
  });

  // Dynamic delivery calculations
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_address: 'Av. Rui Barbosa, Centro, Macaé, RJ',
    store_latitude: -22.3755,
    store_longitude: -41.7766,
    delivery_rate_per_km: 1.00,
    delivery_base_fee: 3.00,
  });
  const [deliveryDistance, setDeliveryDistance] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(3.00);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  // Cash change state
  const [needChange, setNeedChange] = useState(false);
  const [changeAmount, setChangeAmount] = useState('');

  // Mercado Pago variables
  const [pixData, setPixData] = useState<{ id: number; qr_code: string } | null>(null);
  const [mpPreferenceLink, setMpPreferenceLink] = useState<string | null>(null);
  const [isWaitingMpPayment, setIsWaitingMpPayment] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load store settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getStoreSettings();
        setStoreSettings(data);
        setDeliveryFee(data.delivery_base_fee);
      } catch (err) {
        console.error('Failed to load store settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Haversine distance calculator
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Triggers geocoding when typed address is changed
  useEffect(() => {
    const geocodeTypedAddress = async () => {
      if (!address.street || !address.number || !address.neighborhood) return;
      if (address.street.length < 3 || address.neighborhood.length < 3) return;

      setIsCalculatingFee(true);
      try {
        const query = `${address.street}, ${address.number}, ${address.neighborhood}, Macaé, RJ, Brasil`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          
          const dist = calculateHaversineDistance(
            storeSettings.store_latitude,
            storeSettings.store_longitude,
            lat,
            lon
          );
          
          setDeliveryDistance(dist);
          const calculated = dist * storeSettings.delivery_rate_per_km;
          const finalFee = Math.max(calculated, storeSettings.delivery_base_fee);
          
          setDeliveryFee(finalFee);
          setGpsError('');
        }
      } catch {
        console.warn('[CheckoutPage] Nominatim geocoding failed, using base delivery fee.');
      } finally {
        setIsCalculatingFee(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      geocodeTypedAddress();
    }, 1200);

    return () => clearTimeout(delayDebounce);
  }, [address.street, address.number, address.neighborhood, storeSettings]);

  // Early return placed AFTER all hooks to adhere strictly to React Rules of Hooks
  if (isLoading) {
    return (
      <div className="checkout-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="ifood-loader-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)', borderLeftColor: 'transparent' }}></div>
      </div>
    );
  }

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  // Handle browser Geolocation
  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocalização não é suportada por este navegador.');
      return;
    }

    setIsLocating(true);
    setGpsError('');
    setGpsMessage('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Fetch reverse geocoding from free Nominatim API
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          if (!response.ok) throw new Error();
          const data = await response.json();
          
          if (data && data.address) {
            const addr = data.address;
            setAddress(prev => ({
              ...prev,
              street: addr.road || addr.pedestrian || addr.suburb || '',
              neighborhood: addr.suburb || addr.neighbourhood || addr.city_district || '',
              zipCode: addr.postcode ? addr.postcode.replace(/\D/g, '') : '',
              city: 'Macaé',
              state: 'RJ'
            }));
            
            // Calculate distance based on GPS coords
            const dist = calculateHaversineDistance(
              storeSettings.store_latitude,
              storeSettings.store_longitude,
              latitude,
              longitude
            );
            
            setDeliveryDistance(dist);
            const calculated = dist * storeSettings.delivery_rate_per_km;
            const finalFee = Math.max(calculated, storeSettings.delivery_base_fee);
            setDeliveryFee(finalFee);

            // Check if user is out of Macaé coordinates
            const isInsideMacae = (latitude >= -22.45 && latitude <= -22.30) && (longitude >= -41.90 && longitude <= -41.70);
            if (!isInsideMacae) {
              setGpsMessage('Preenchemos o endereço do seu GPS, mas por favor confirme os dados.');
            } else {
              setGpsMessage('Endereço preenchido com base no GPS!');
            }
          }
        } catch {
          setGpsError('Não foi possível obter endereço via satélite. Por favor digite manualmente.');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Permissão de localização negada. Digite seu endereço.');
        } else {
          setGpsError('Sinal de GPS fraco. Por favor digite seu endereço.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCopyPix = () => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Form checkout submission
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMsg('');
    setPixData(null);
    setMpPreferenceLink(null);

    try {
      if (!user) {
        throw new Error('Você precisa estar logado para finalizar a compra.');
      }

      // Build rich metadata for delivery_address/shipping_address JSONB column
      const shippingAddressData = {
        street: address.street,
        number: address.number,
        neighborhood: address.neighborhood,
        zipCode: address.zipCode,
        city: 'Macaé',
        state: 'RJ',
        complement: address.complement,
        deliveryType: 'entrega', // Always delivery
        paymentCategory: paymentCategory,
        paymentMethod: paymentMethod,
        changeRequired: needChange ? 'Sim' : 'Não',
        changeForAmount: needChange ? changeAmount : 'Não necessário',
        deliveryDistanceKm: deliveryDistance ? parseFloat(deliveryDistance.toFixed(2)) : 0,
        deliveryFeeCharged: parseFloat(deliveryFee.toFixed(2))
      };

      const orderItems = items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price
      }));

      const finalAmount = getTotal() + deliveryFee;

      // 1. Create order in Supabase with dynamic delivery fee factored in
      const order = await createOrder(user.id, orderItems, shippingAddressData, finalAmount);
      setActiveOrderId(order.id);

      if (paymentCategory === 'delivery') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        clearCart();
        navigate(`/track/${order.id}`);
      } 
      else {
        const mappedItems = items.map(i => ({
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity
        }));
        
        // Add delivery fee as an item for Mp checkout transparently
        mappedItems.push({
          name: 'Taxa de Entrega',
          price: parseFloat(deliveryFee.toFixed(2)),
          quantity: 1
        });

        const preference = await createMpPreference(order.id, finalAmount, mappedItems);
        const redirectUrl = preference.init_point || preference.sandbox_init_point;
        setMpPreferenceLink(redirectUrl);
        setIsWaitingMpPayment(true);
        setIsProcessing(false);

        if (preference.isSandboxSimulated) {
          // Opção B: Offline Payment Simulator
          // Automatically simulates the payment as approved on Supabase, clears cart, and redirects to tracking
          // after 2.5 seconds, avoiding any 404 page errors when the SDK backend server is not active.
          setTimeout(async () => {
            try {
              const paymentId = Math.floor(1000000000 + Math.random() * 900000000);
              await simulateMpWebhookNotification(order.id, paymentId, 'approved');
              clearCart();
              navigate(`/track/${order.id}`);
            } catch (err) {
              console.error('Failed to simulate offline payment redirect:', err);
            }
          }, 2500);
        } else {
          // ALWAYS redirect in the same tab to prevent pop-up blocker issues on both desktop and mobile
          // This also avoids strict browser restrictions (CORS/CSP) on newly opened async windows
          window.location.href = redirectUrl;
        }
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro inesperado.';
      setErrorMsg(msg);
      setIsProcessing(false);
    }
  };

  const handleConfirmPixOrCard = async () => {
    if (!activeOrderId) return;
    setIsProcessing(true);

    try {
      const paymentId = pixData?.id || Math.floor(1000000000 + Math.random() * 900000000);
      await simulateMpWebhookNotification(activeOrderId, paymentId, 'approved');
      
      clearCart();
      navigate(`/track/${activeOrderId}`);
    } catch {
      setErrorMsg('Falha ao registrar notificação de pagamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedAmount = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="checkout-page">
      {/* Step Flow Header */}
      <div className="cart-flow-steps" style={{ marginTop: '0rem', marginBottom: '2.5rem' }}>
        <div className="cart-flow-step">
          <span className="cart-flow-step-num">1</span>
          <span>Carrinho</span>
        </div>
        <div className="cart-flow-separator"></div>
        <div className="cart-flow-step active">
          <span className="cart-flow-step-num">2</span>
          <span>Finalizar</span>
        </div>
      </div>

      <div className="checkout-header-ifood">
        <button onClick={() => navigate('/cart')} className="btn-back-sacola" aria-label="Voltar para carrinho">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Finalizar</h1>
      </div>

      <div className="checkout-content">
        <form className="checkout-form" onSubmit={handleCheckout}>
          {/* Card 1: Address */}
          <div className="ifood-card">
            <h2 className="ifood-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Endereço de Entrega
            </h2>

            {/* GPS geolocation button */}
            <div className="gps-btn-container">
              <button 
                type="button" 
                className="btn-gps" 
                onClick={handleGPSLocation} 
                disabled={isLocating || isWaitingMpPayment}
              >
                {isLocating ? (
                  <>
                    <div className="ifood-loader-spinner"></div>
                    <span>Buscando GPS...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                    </svg>
                    <span>Usar minha localização atual</span>
                  </>
                )}
              </button>

              {gpsMessage && <div className="gps-warning-alert">{gpsMessage}</div>}
              {gpsError && <div className="gps-error-alert">{gpsError}</div>}
            </div>

            {/* Address Form Inputs */}
            <div className="ifood-form-grid">
              <div className="ifood-input-group">
                <label>Rua / Logradouro</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ex: Rua Internacional" 
                  value={address.street} 
                  onChange={e => setAddress({...address, street: e.target.value})} 
                />
              </div>
              <div className="ifood-input-group">
                <label>Número</label>
                <input 
                  required 
                  type="text" 
                  placeholder="123" 
                  value={address.number} 
                  onChange={e => setAddress({...address, number: e.target.value})} 
                />
              </div>
              <div className="ifood-input-group">
                <label>Bairro</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ex: Granja dos Cavaleiros" 
                  value={address.neighborhood} 
                  onChange={e => setAddress({...address, neighborhood: e.target.value})} 
                />
              </div>
              <div className="ifood-input-group">
                <label>CEP</label>
                <input 
                  required 
                  type="text" 
                  placeholder="27930-070" 
                  value={address.zipCode} 
                  onChange={e => setAddress({...address, zipCode: e.target.value})} 
                />
              </div>
              <div className="ifood-input-group full-width">
                <label>Complemento / Ponto de Referência</label>
                <input 
                  type="text" 
                  placeholder="Apto, bloco, portão, etc." 
                  value={address.complement} 
                  onChange={e => setAddress({...address, complement: e.target.value})} 
                />
              </div>
            </div>
          </div>

          {/* Card 2: Payments iFood Style */}
          <div className="ifood-card">
            <h2 className="ifood-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              Forma de Pagamento
            </h2>

            <div className="ifood-payment-tabs">
              <button 
                type="button" 
                className={`ifood-payment-tab-btn ${paymentCategory === 'app' ? 'active' : ''}`}
                onClick={() => {
                  setPaymentCategory('app');
                  setPaymentMethod('pix');
                }}
                disabled={isWaitingMpPayment}
              >
                Pagar pelo App
              </button>
              <button 
                type="button" 
                className={`ifood-payment-tab-btn ${paymentCategory === 'delivery' ? 'active' : ''}`}
                onClick={() => {
                  setPaymentCategory('delivery');
                  setPaymentMethod('dinheiro');
                }}
                disabled={isWaitingMpPayment}
              >
                Pagar na Entrega
              </button>
            </div>

            {paymentCategory === 'app' ? (
              /* Online Payments (Apple Pay, Google Pay, Pix, Cartão de crédito) */
              <div className="ifood-payment-options">
                {/* Apple Pay */}
                <div 
                  className={`ifood-payment-option ${paymentMethod === 'applepay' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('applepay');
                    setPixData(null);
                  }}
                >
                  <div className="ifood-payment-option-details">
                    <div className="ifood-payment-option-icon">
                      <svg width="28" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#000' }}>
                        <path d="M2.15 4.318a42.16 42.16 0 0 0-.454.003c-.15.005-.303.013-.452.04a1.44 1.44 0 0 0-1.06.772c-.07.138-.114.278-.14.43-.028.148-.037.3-.04.45A10.2 10.2 0 0 0 0 6.222v11.557c0 .07.002.138.003.207.004.15.013.303.04.452.027.15.072.291.142.429a1.436 1.436 0 0 0 .63.63c.138.07.278.115.43.142.148.027.3.036.45.04l.208.003h20.194l.207-.003c.15-.004.303-.013.452-.04.15-.027.291-.071.428-.141a1.432 1.432 0 0 0 .631-.631c.07-.138.115-.278.141-.43.027-.148.036-.3.04-.45.002-.07.003-.138.003-.208l.001-.246V6.221c0-.07-.002-.138-.004-.207a2.995 2.995 0 0 0-.04-.452 1.446 1.446 0 0 0-1.2-1.201 3.022 3.022 0 0 0-.452-.04 10.448 10.448 0 0 0-.453-.003zm0 .512h19.942c.066 0 .131.002.197.003.115.004.25.01.375.032.109.02.2.05.287.094a.927.927 0 0 1 .407.407.997.997 0 0 1 .094.288c.022.123.028.258.031.374.002.065.003.13.003.197v11.552c0 .065 0 .13-.003.196-.003.115-.009.25-.032.375a.927.927 0 0 1-.5.693 1.002 1.002 0 0 1-.286.094 2.598 2.598 0 0 1-.373.032l-.2.003H1.906c-.066 0-.133-.002-.196-.003a2.61 2.61 0 0 1-.375-.032c-.109-.02-.2-.05-.288-.094a.918.918 0 0 1-.406-.407 1.006 1.006 0 0 1-.094-.288 2.531 2.531 0 0 1-.032-.373 9.588 9.588 0 0 1-.002-.197V6.224c0-.065 0-.131.002-.197.004-.114.01-.248.032-.375.02-.108.05-.199.094-.287a.925.925 0 0 1 .407-.406 1.03 1.03 0 0 1 .287-.094c.125-.022.26-.029.375-.032.065-.002.131-.002.196-.003zm4.71 3.7c-.3.016-.668.199-.88.456-.191.22-.36.58-.316.918.338.03.675-.169.888-.418.205-.258.345-.603.308-.955zm2.207.42v5.493h.852v-1.877h1.18c1.078 0 1.835-.739 1.835-1.812 0-1.07-.742-1.805-1.808-1.805zm.852.719h.982c.739 0 1.161.396 1.161 1.089 0 .692-.422 1.092-1.164 1.092h-.979zm-3.154.3c-.45.01-.83.28-1.05.28-.235 0-.593-.264-.981-.257a1.446 1.446 0 0 0-1.23.747c-.527.908-.139 2.255.374 2.995.249.366.549.769.944.754.373-.014.52-.242.973-.242.454 0 .586.242.98.235.41-.007.667-.366.915-.733.286-.417.403-.82.41-.841-.007-.008-.79-.308-.797-1.209-.008-.754.615-1.113.644-1.135-.352-.52-.9-.578-1.09-.593a1.123 1.123 0 0 0-.092-.002zm8.204.397c-.99 0-1.606.533-1.652 1.256h.777c.072-.358.369-.586.845-.586.502 0 .803.266.803.711v.309l-1.097.064c-.951.054-1.488.484-1.488 1.184 0 .72.548 1.207 1.332 1.207.526 0 1.032-.281 1.264-.727h.019v.659h.788v-2.76c0-.803-.62-1.317-1.591-1.317zm1.94.072l1.446 4.009c0 .003-.073.24-.073.247-.125.41-.33.571-.711.571-.069 0-.206 0-.267-.015v.666c.06.011.267.019.335.019.83 0 1.226-.312 1.568-1.283l1.5-4.214h-.868l-1.012 3.259h-.015l-1.013-3.26zm-1.167 2.189v.316c0 .521-.45.917-1.024.917-.442 0-.731-.228-.731-.579 0-.342.278-.56.769-.593z" />
                      </svg>
                    </div>
                    <div className="ifood-payment-option-text">
                      <span className="ifood-payment-option-title">Apple Pay</span>
                      <span className="ifood-payment-option-subtitle">Pague com segurança</span>
                    </div>
                  </div>
                  <div className="ifood-radio-circle"></div>
                </div>

                {/* Google Pay */}
                <div 
                  className={`ifood-payment-option ${paymentMethod === 'googlepay' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('googlepay');
                    setPixData(null);
                  }}
                >
                  <div className="ifood-payment-option-details">
                    <div className="ifood-payment-option-icon">
                      <svg width="28" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#000' }}>
                        <path d="M3.963 7.235A3.963 3.963 0 00.422 9.419a3.963 3.963 0 000 3.559 3.963 3.963 0 003.541 2.184c1.07 0 1.97-.352 2.627-.957.748-.69 1.18-1.71 1.18-2.916a4.722 4.722 0 00-.07-.806H3.964v1.526h2.14a1.835 1.835 0 01-.79 1.205c-.356.241-.814.379-1.35.379-1.034 0-1.911-.697-2.225-1.636a2.375 2.375 0 010-1.517c.314-.94 1.191-1.636 2.225-1.636a2.152 2.152 0 011.52.594l1.132-1.13a3.808 3.808 0 00-2.652-1.033zm6.501.55v6.9h.886V11.89h1.465c.603 0 1.11-.196 1.522-.588a1.911 1.911 0 00.635-1.464 1.92 1.92 0 00-.635-1.456 2.125 2.125 0 00-1.522-.598zm2.427.85a1.156 1.156 0 01.823.365 1.176 1.176 0 010 1.686 1.171 1.171 0 01-.877.357H11.35V8.635h1.487a1.156 1.156 0 01.054 0zm4.124 1.175c-.842 0-1.477.308-1.907.925l.781.491c.288-.417.68-.626 1.175-.626a1.255 1.255 0 01.856.323 1.009 1.009 0 01.366.785v.202c-.34-.193-.774-.289-1.3-.289-.617 0-1.11.145-1.479.434-.37.288-.554.677-.554 1.165a1.476 1.476 0 00.525 1.156c.35.308.785.463 1.305.463.61 0 1.098-.27 1.465-.81h.038v.655h.848v-2.909c0-.61-.19-1.09-.568-1.44-.38-.35-.896-.525-1.551-.525zm2.263.154l1.946 4.422-1.098 2.38h.915L24 9.963h-.965l-1.368 3.391h-.02l-1.406-3.39zm-2.146 2.368c.494 0 .88.11 1.156.33 0 .372-.147.696-.44.973a1.413 1.413 0 01-.997.414 1.081 1.081 0 01-.69-.232.708.708 0 01-.293-.578c0-.257.12-.47.363-.647.24-.173.54-.26.9-.26Z"/>
                      </svg>
                    </div>
                    <div className="ifood-payment-option-text">
                      <span className="ifood-payment-option-title">Google Pay</span>
                      <span className="ifood-payment-option-subtitle">Pague com segurança</span>
                    </div>
                  </div>
                  <div className="ifood-radio-circle"></div>
                </div>

                {/* Pix */}
                <div 
                  className={`ifood-payment-option ${paymentMethod === 'pix' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('pix');
                    setPixData(null);
                  }}
                >
                  <div className="ifood-payment-option-details">
                    <div className="ifood-payment-option-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: '#32BCAD' }}>
                        <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" fill="currentColor"/>
                      </svg>
                    </div>
                    <div className="ifood-payment-option-text">
                      <span className="ifood-payment-option-title">Pix</span>
                      <span className="ifood-payment-option-subtitle">Aprovação instantânea</span>
                    </div>
                  </div>
                  <div className="ifood-radio-circle"></div>
                </div>

                {/* Cartão de crédito */}
                <div 
                  className={`ifood-payment-option ${paymentMethod === 'credito_app' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('credito_app');
                    setPixData(null);
                  }}
                >
                  <div className="ifood-payment-option-details">
                    <div className="ifood-payment-option-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                        <rect x="5" y="14" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.8" />
                        <circle cx="16" cy="15" r="1.5" fill="currentColor" opacity="0.6" />
                        <circle cx="18" cy="15" r="1.5" fill="currentColor" opacity="0.6" />
                      </svg>
                    </div>
                    <div className="ifood-payment-option-text">
                      <span className="ifood-payment-option-title">Cartão de crédito</span>
                      <span className="ifood-payment-option-subtitle">Aprovação imediata</span>
                    </div>
                  </div>
                  <div className="ifood-radio-circle"></div>
                </div>
              </div>
            ) : (
              /* Offline Payments (Dinheiro, Cartão de crédito, Cartão de débito) */
              <div className="ifood-payment-options">
                {/* Dinheiro */}
                <div 
                  className={`ifood-payment-option ${paymentMethod === 'dinheiro' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('dinheiro')}
                >
                  <div className="ifood-payment-option-details">
                    <div className="ifood-payment-option-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4caf50' }}>
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="6" y1="12" x2="6.01" y2="12" />
                        <line x1="18" y1="12" x2="18.01" y2="12" />
                      </svg>
                    </div>
                    <div className="ifood-payment-option-text">
                      <span className="ifood-payment-option-title">Dinheiro</span>
                      <span className="ifood-payment-option-subtitle">Pague em cédulas ao entregador</span>
                    </div>
                  </div>
                  <div className="ifood-radio-circle"></div>
                </div>

                {/* Cartão de crédito (Maquininha) */}
                <div 
                  className={`ifood-payment-option ${paymentMethod === 'credito_entrega' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('credito_entrega')}
                >
                  <div className="ifood-payment-option-details">
                    <div className="ifood-payment-option-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                        <rect x="5" y="14" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.8" />
                        <circle cx="16" cy="15" r="1.5" fill="currentColor" opacity="0.6" />
                        <circle cx="18" cy="15" r="1.5" fill="currentColor" opacity="0.6" />
                      </svg>
                    </div>
                    <div className="ifood-payment-option-text">
                      <span className="ifood-payment-option-title">Cartão de crédito</span>
                      <span className="ifood-payment-option-subtitle">Pague na maquininha do entregador</span>
                    </div>
                  </div>
                  <div className="ifood-radio-circle"></div>
                </div>

                {/* Cartão de débito (Maquininha) */}
                <div 
                  className={`ifood-payment-option ${paymentMethod === 'debito_entrega' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('debito_entrega')}
                >
                  <div className="ifood-payment-option-details">
                    <div className="ifood-payment-option-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                        <rect x="5" y="14" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.8" />
                        <circle cx="16" cy="15" r="1.5" fill="currentColor" opacity="0.6" />
                        <circle cx="18" cy="15" r="1.5" fill="currentColor" opacity="0.6" />
                      </svg>
                    </div>
                    <div className="ifood-payment-option-text">
                      <span className="ifood-payment-option-title">Cartão de débito</span>
                      <span className="ifood-payment-option-subtitle">Pague na maquininha do entregador</span>
                    </div>
                  </div>
                  <div className="ifood-radio-circle"></div>
                </div>
              </div>
            )}

            {/* Troco Conditional Block for Dinheiro */}
            {paymentCategory === 'delivery' && paymentMethod === 'dinheiro' && (
              <div className="ifood-change-box">
                <label className="ifood-change-toggle">
                  <input 
                    type="checkbox" 
                    checked={needChange} 
                    onChange={e => setNeedChange(e.target.checked)} 
                  />
                  <span>Preciso de troco</span>
                </label>
                {needChange && (
                  <div className="ifood-input-group" style={{ marginTop: '0.5rem', animation: 'fade-in-up 0.2s' }}>
                    <label>Troco para quanto?</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="Ex: R$ 50,00 ou R$ 100,00" 
                      value={changeAmount} 
                      onChange={e => setChangeAmount(e.target.value)} 
                    />
                  </div>
                )}
              </div>
            )}

            {/* Pix copy paste instruction box */}
            {paymentMethod === 'pix' && pixData && (
              <div className="payment-instruction-box" style={{ borderColor: 'var(--color-primary)', background: 'rgba(173, 127, 96, 0.04)' }}>
                <div className="payment-instruction-header" style={{ color: 'var(--color-primary)', fontSize: '0.98rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Código Pix gerado com sucesso!
                </div>
                <p className="payment-instruction-text">
                  Escaneie o QR Code abaixo ou copie a chave Pix. Após concluir o pagamento no seu banco, confirme clicando no botão verde abaixo.
                </p>
                <div className="pix-qr-container">
                  <div className="pix-qr-code">
                    <svg width="130" height="130" viewBox="0 0 100 100" fill="none">
                      <rect x="0" y="0" width="25" height="25" stroke="var(--color-text)" strokeWidth="6" />
                      <rect x="6" y="6" width="13" height="13" fill="var(--color-text)" />
                      <rect x="75" y="0" width="25" height="25" stroke="var(--color-text)" strokeWidth="6" />
                      <rect x="81" y="6" width="13" height="13" fill="var(--color-text)" />
                      <rect x="0" y="75" width="25" height="25" stroke="var(--color-text)" strokeWidth="6" />
                      <rect x="6" y="81" width="13" height="13" fill="var(--color-text)" />
                      <rect x="35" y="5" width="10" height="10" fill="var(--color-text)" />
                      <rect x="55" y="15" width="10" height="5" fill="var(--color-text)" />
                      <rect x="40" y="30" width="15" height="15" fill="var(--color-text)" />
                      <rect x="65" y="35" width="10" height="10" fill="var(--color-text)" />
                      <rect x="80" y="50" width="15" height="15" fill="var(--color-text)" />
                    </svg>
                  </div>
                  
                  <div className="pix-copy-box">
                    <span className="pix-key-input">{pixData.qr_code}</span>
                    <button type="button" className="pix-copy-btn" onClick={handleCopyPix}>
                      Copiar
                    </button>
                  </div>
                  {copySuccess && (
                    <div className="copy-success-badge">
                      Código copiado com sucesso!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Waiting Online Payment simulated info box */}
            {(paymentMethod === 'credito_app' || paymentMethod === 'applepay' || paymentMethod === 'googlepay') && isWaitingMpPayment && mpPreferenceLink && (
              <div className="payment-instruction-box" style={{ borderColor: 'var(--color-primary)', background: 'rgba(173, 127, 96, 0.04)' }}>
                <div className="payment-instruction-header">
                  <div className="ifood-loader-spinner" style={{ borderTopColor: 'var(--color-primary)' }}></div>
                  Redirecionando para o pagamento seguro...
                </div>
                <p className="payment-instruction-text">
                  Você está sendo redirecionado para o Mercado Pago. Se a página de pagamento não abrir ou você precisar reabri-la, use o botão abaixo.
                </p>
                <p className="payment-instruction-text" style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.35rem' }}>
                  ⚠️ <strong>Dica:</strong> Se a tela de pagamento ficar em branco, certifique-se de desativar bloqueadores de anúncios (AdBlock) temporariamente para permitir a validação de segurança do Mercado Pago.
                </p>
                <div style={{ marginTop: '0.5rem' }}>
                  <a href={mpPreferenceLink} className="btn-gps" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                    Ir para o Pagamento Seguro
                  </a>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="error-message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Pricing Summary */}
          <div className="ifood-card">
            <h2 className="ifood-card-title" style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              Resumo de Valores
            </h2>
            <div className="ifood-summary-row">
              <span>Subtotal</span>
              <span>{formattedAmount(getTotal())}</span>
            </div>
            <div className="ifood-summary-row">
              <span>Taxa de Entrega</span>
              <span>
                {isCalculatingFee ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Calculando...</span>
                ) : (
                  formattedAmount(deliveryFee)
                )}
              </span>
            </div>
            <div className="ifood-summary-row total">
              <span>Total</span>
              <span>{formattedAmount(getTotal() + deliveryFee)}</span>
            </div>
          </div>

          {/* Action trigger button */}
          {isWaitingMpPayment ? (
            <button 
              type="button" 
              className="btn-ifood-order" 
              style={{ backgroundColor: '#4caf50' }}
              onClick={handleConfirmPixOrCard}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="ifood-loader-spinner"></div>
                  <span>Confirmando pagamento...</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Confirmar Pagamento</span>
                </>
              )}
            </button>
          ) : (
            <button type="submit" className="btn-ifood-order" disabled={isProcessing || isCalculatingFee}>
              {isProcessing ? (
                <>
                  <div className="ifood-loader-spinner"></div>
                  <span>Finalizando pedido...</span>
                </>
              ) : (
                <>
                  <span>Finalizar Pedido • {formattedAmount(getTotal() + deliveryFee)}</span>
                </>
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
