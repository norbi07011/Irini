
import React, { useContext, useEffect, useState } from 'react';
import { LanguageContext, OrdersContext } from '../index';
import { TRANSLATIONS } from '../constants';
import { Order, DELIVERY_CONFIG } from '../types';

interface OrderConfirmationProps {
  orderId: string;
  onBackToMenu: () => void;
  onTrackOrder: () => void;
}

const OrderConfirmationView: React.FC<OrderConfirmationProps> = ({ orderId, onBackToMenu, onTrackOrder }) => {
  const langCtx = useContext(LanguageContext);
  const ordersCtx = useContext(OrdersContext);
  const [order, setOrder] = useState<Order | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [statusChanged, setStatusChanged] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);

  if (!langCtx || !ordersCtx) return null;
  const { language } = langCtx;
  const t = TRANSLATIONS[language];

  useEffect(() => {
    const foundOrder = ordersCtx.orders.find(o => o.id === orderId);
    if (foundOrder) {
      // Check if status changed
      if (order && order.status !== foundOrder.status) {
        console.log('🔄 Status changed:', order.status, '→', foundOrder.status);
        setPreviousStatus(order.status);
        setStatusChanged(true);
        // Hide notification after 3 seconds
        setTimeout(() => setStatusChanged(false), 3000);
      }
      setOrder(foundOrder);
    } else {
      console.log('❌ Order not found:', orderId, 'Available orders:', ordersCtx.orders.length);
    }
  }, [orderId, ordersCtx.orders]);

  // Separate useEffect for confetti (runs only once)
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!order) {
    return (
      <section className="min-h-screen py-24 px-4 bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{language === 'pl' ? 'Ładowanie zamówienia...' : 'Bestelling laden...'}</p>
        </div>
      </section>
    );
  }

  const estimatedTime = order.delivery.type === 'delivery' 
    ? DELIVERY_CONFIG.estimatedDeliveryMinutes 
    : DELIVERY_CONFIG.estimatedPickupMinutes;

  const estimatedReadyTime = new Date(new Date(order.createdAt).getTime() + estimatedTime * 60000);
  const formattedTime = estimatedReadyTime.toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'pl-PL', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <section className="min-h-screen py-24 px-4 bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">
      {/* Status Changed Notification */}
      {statusChanged && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-reveal">
          <div className="glass px-8 py-4 rounded-2xl border border-blue-500 bg-blue-50 shadow-2xl flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center animate-pulse">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-blue-800">
                {language === 'pl' ? '🎉 Status zaktualizowany!' : '🎉 Status bijgewerkt!'}
              </div>
              <div className="text-sm text-blue-600">
                {language === 'pl' ? 'Twoje zamówienie jest w drodze' : 'Je bestelling is onderweg'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ['#D4AF37', '#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4'][Math.floor(Math.random() * 5)],
                width: `${5 + Math.random() * 10}px`,
                height: `${5 + Math.random() * 10}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-12 animate-reveal">
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-gray-800">
            {t.orderConfirmed}
          </h1>
          <p className="text-gray-600 text-lg">
            {language === 'pl' 
              ? 'Dziękujemy za zamówienie!'
              : 'Bedankt voor je bestelling!'
            }
          </p>
          {/* Email confirmation notice */}
          <div className="mt-6 inline-flex items-center gap-3 px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-full">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-green-400 text-sm font-medium">
              {language === 'pl' 
                ? `Potwierdzenie wysłane na: ${order.customer.email}`
                : `Bevestiging verzonden naar: ${order.customer.email}`
              }
            </span>
          </div>
        </div>

        {/* Order Details Card */}
        <div className="glass rounded-3xl p-8 border border-blue-200 bg-white/80 mb-8 animate-reveal stagger-1">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-300">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">{t.orderNumber}</div>
              <div className="text-2xl font-mono font-bold text-blue-600">{order.id}</div>
            </div>
            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
              order.payment.status === 'paid' 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
            }`}>
              {order.payment.status === 'paid' 
                ? (language === 'pl' ? '✓ Opłacone' : '✓ Betaald')
                : (language === 'pl' ? 'Płatność przy odbiorze' : 'Betalen bij bezorging')
              }
            </div>
          </div>

          {/* Dynamic Timeline based on order.status */}
          <div className="space-y-6 mb-8">
            {/* Step 1: Order Received - Always completed */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-green-500">✓</span>
              </div>
              <div>
                <div className="font-bold text-gray-800">{language === 'pl' ? 'Zamówienie przyjęte' : 'Bestelling ontvangen'}</div>
                <div className="text-sm text-gray-600">
                  {new Date(order.createdAt).toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Step 2: Preparing */}
            <div className={`flex items-start gap-4 ${['pending'].includes(order.status) ? 'opacity-50' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                order.status === 'preparing' 
                  ? 'bg-blue-100 border border-blue-300 animate-pulse' 
                  : ['ready', 'delivery', 'completed'].includes(order.status)
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-gray-200 border border-gray-300'
              }`}>
                <span className={
                  order.status === 'preparing'
                    ? 'text-blue-600'
                    : ['ready', 'delivery', 'completed'].includes(order.status)
                    ? 'text-green-500'
                    : 'text-gray-400'
                }>
                  {['ready', 'delivery', 'completed'].includes(order.status) ? '✓' : '🍳'}
                </span>
              </div>
              <div>
                <div className="font-bold text-gray-800">{language === 'pl' ? 'Przygotowywanie' : 'In voorbereiding'}</div>
                <div className="text-sm text-gray-600">
                  {order.status === 'preparing' 
                    ? (language === 'pl' ? 'W kuchni...' : 'In de keuken...')
                    : ['ready', 'delivery', 'completed'].includes(order.status)
                    ? (language === 'pl' ? '✓ Gotowe' : '✓ Klaar')
                    : (language === 'pl' ? 'Oczekuje' : 'Wachten')
                  }
                </div>
              </div>
            </div>

            {/* Step 3: Ready (pickup) or Out for Delivery */}
            <div className={`flex items-start gap-4 ${!['ready', 'delivery', 'completed'].includes(order.status) ? 'opacity-50' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                (order.status === 'ready' && order.delivery.type === 'pickup') || order.status === 'delivery'
                  ? 'bg-blue-100 border border-blue-300 animate-pulse'
                  : ['ready', 'delivery', 'completed'].includes(order.status) && order.delivery.type === 'delivery'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : order.status === 'completed' && order.delivery.type === 'pickup'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-gray-200 border border-gray-300'
              }`}>
                <span className={
                  (order.status === 'ready' && order.delivery.type === 'pickup') || order.status === 'delivery'
                    ? 'text-blue-600'
                    : ['ready', 'delivery', 'completed'].includes(order.status)
                    ? 'text-green-500'
                    : 'text-gray-400'
                }>
                  {['ready', 'delivery', 'completed'].includes(order.status) && !(order.status === 'delivery')
                    ? '✓' 
                    : order.delivery.type === 'delivery' ? '🚗' : '🏪'
                  }
                </span>
              </div>
              <div>
                <div className="font-bold text-gray-800">
                  {order.delivery.type === 'delivery' 
                    ? (order.status === 'delivery' 
                      ? (language === 'pl' ? 'W drodze do Ciebie!' : 'Onderweg naar jou!')
                      : ['ready', 'completed'].includes(order.status)
                      ? (language === 'pl' ? '✓ W drodze' : '✓ Onderweg')
                      : (language === 'pl' ? 'Dostawa' : 'Bezorging'))
                    : (order.status === 'ready'
                      ? (language === 'pl' ? 'Gotowe do odbioru!' : 'Klaar voor afhalen!')
                      : order.status === 'completed'
                      ? (language === 'pl' ? '✓ Gotowe' : '✓ Klaar')
                      : (language === 'pl' ? 'Odbiór osobisty' : 'Afhalen'))
                  }
                </div>
                <div className="text-sm text-gray-600">
                  {order.delivery.type === 'delivery'
                    ? (order.status === 'delivery'
                      ? (order.estimatedDeliveryTime
                        ? (language === 'pl' 
                          ? `Przybędzie około: ${new Date(order.estimatedDeliveryTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
                          : `Aankomst rond: ${new Date(order.estimatedDeliveryTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`)
                        : (language === 'pl' ? 'Kurier już jedzie!' : 'Bezorger is onderweg!'))
                      : ['ready', 'completed'].includes(order.status)
                      ? (language === 'pl' ? 'Zrealizowano' : 'Voltooid')
                      : `${t.estimatedTime}: ~${formattedTime}`)
                    : (order.status === 'ready'
                      ? (language === 'pl' ? 'Możesz odebrać!' : 'Kan worden opgehaald!')
                      : order.status === 'completed'
                      ? (language === 'pl' ? 'Odebrano' : 'Opgehaald')
                      : `${t.estimatedTime}: ~${formattedTime}`)
                  }
                </div>
              </div>
            </div>

            {/* Step 4: Completed/Delivered */}
            <div className={`flex items-start gap-4 ${order.status !== 'completed' ? 'opacity-50' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                order.status === 'completed'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-gray-200 border border-gray-300'
              }`}>
                <span className={order.status === 'completed' ? 'text-green-500' : 'text-gray-400'}>
                  {order.status === 'completed' ? '✓' : '🍽️'}
                </span>
              </div>
              <div>
                <div className="font-bold text-gray-800">
                  {order.status === 'completed'
                    ? (order.delivery.type === 'delivery'
                      ? (language === 'pl' ? '✓ Dostarczone!' : '✓ Afgeleverd!')
                      : (language === 'pl' ? '✓ Odebrane!' : '✓ Opgehaald!'))
                    : (order.delivery.type === 'delivery'
                      ? (language === 'pl' ? 'Dostarczone' : 'Afgeleverd')
                      : (language === 'pl' ? 'Odebrane' : 'Opgehaald'))
                  }
                </div>
                <div className="text-sm text-gray-600">
                  {order.status === 'completed'
                    ? (language === 'pl' ? 'Smacznego! 🎉' : 'Eet smakelijk! 🎉')
                    : (language === 'pl' ? 'Oczekuje' : 'Wachten')
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Tracking Info - shown when delivery is in progress */}
          {order.status === 'delivery' && order.deliveryDepartedAt && (
            <div className="mt-6 p-6 rounded-2xl bg-purple-50 border border-purple-200 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🚗</span>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-purple-800">
                    {language === 'pl' ? 'Twoje zamówienie jest w drodze!' : 'Je bestelling is onderweg!'}
                  </div>
                  <div className="text-sm text-purple-600">
                    {language === 'pl' 
                      ? `Wyjazd: ${new Date(order.deliveryDepartedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
                      : `Vertrokken: ${new Date(order.deliveryDepartedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                    }
                  </div>
                </div>
                {order.estimatedDeliveryTime && (
                  <div className="text-right">
                    <div className="text-xs text-purple-600 uppercase tracking-wider">
                      {language === 'pl' ? 'Przybędzie' : 'Aankomst'}
                    </div>
                    <div className="text-2xl font-bold text-purple-800">
                      ~{new Date(order.estimatedDeliveryTime).toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery/Pickup Info */}
          <div className="p-6 rounded-2xl bg-blue-50 border border-blue-200">
            {order.delivery.type === 'delivery' ? (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <span>📍</span>
                  <span>{t.deliveryAddress}</span>
                </div>
                <div className="font-bold text-lg text-gray-800">
                  {order.customer.address}
                </div>
                <div className="text-gray-600">
                  {order.customer.postalCode} {order.customer.city}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <span>🏪</span>
                  <span>{t.pickupAddress}</span>
                </div>
                <div className="font-bold text-lg text-gray-800">
                  Weimarstraat 174
                </div>
                <div className="text-gray-600">
                  2562 HD Den Haag
                </div>
              </>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="glass rounded-3xl p-8 border border-blue-200 bg-white/80 mb-8 animate-reveal stagger-2">
          <h3 className="text-lg font-bold mb-6 text-gray-800">{t.orderSummary}</h3>
          <div className="space-y-3 mb-6">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-gray-600">{item.quantity}x {item.name}</span>
                <span className="text-gray-800">€{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-300 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t.subtotal}</span>
              <span className="text-gray-800">€{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t.deliveryFee}</span>
              <span className={order.deliveryFee === 0 ? 'text-green-500' : 'text-gray-800'}>
                {order.deliveryFee === 0 ? 'Gratis' : `€${order.deliveryFee.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-xl font-bold pt-4 border-t border-gray-300">
              <span className="text-gray-800">{t.total}</span>
              <span className="blue-gradient">€{order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 animate-reveal stagger-3">
          <button
            onClick={onBackToMenu}
            className="flex-1 py-5 border border-gray-300 rounded-2xl font-bold uppercase tracking-widest hover:bg-gray-100 transition-all text-gray-800"
          >
            {t.backToMenu}
          </button>
          <button
            onClick={onTrackOrder}
            className="flex-1 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
          >
            {t.trackOrder}
          </button>
        </div>

        {/* Contact Info */}
        <div className="mt-12 text-center text-gray-600 text-sm">
          <p>{language === 'pl' ? 'Pytania?' : 'Vragen?'} <a href="tel:+31703456789" className="text-blue-600 hover:underline">+31 70 345 67 89</a></p>
        </div>
      </div>

      {/* CSS for confetti animation */}
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti 3s ease-in-out forwards;
        }
      `}</style>
    </section>
  );
};

export default OrderConfirmationView;
