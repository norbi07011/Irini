
import React, { useState, useEffect, useContext, useCallback } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Menu from './components/Menu';
import AboutView from './components/AboutView';
import ContactView from './components/ContactView';
import AdminDashboard from './components/AdminDashboard';
import CartDrawer from './components/CartDrawer';
import CheckoutView from './components/CheckoutView';
import OrderConfirmationView from './components/OrderConfirmationView';
import Footer from './components/Footer';
import GoogleReviewCard from './components/GoogleReviewCard';
import { View } from './types';
import { LanguageContext, CheckoutContext } from './index';
import { TRANSLATIONS } from './constants';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [activeView, setView] = useState<View>('home');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isChangingView, setIsChangingView] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  
  const [googleData, setGoogleData] = useState<{
    rating: number | null;
    reviews: number | null;
    lastSync: Date | null;
    isLoading: boolean;
    sources: any[];
  }>({
    rating: 5.0, 
    reviews: 545,
    lastSync: null,
    isLoading: false,
    sources: []
  });

  const langCtx = useContext(LanguageContext);
  const checkoutCtx = useContext(CheckoutContext);
  const language = langCtx?.language || 'nl';
  const t = TRANSLATIONS[language];

  const handleViewChange = (view: View) => {
    if (view === activeView || isChangingView) return;
    setIsChangingView(true);
    // Smooth transition between views
    setTimeout(() => {
      setView(view);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setTimeout(() => {
        setIsChangingView(false);
      }, 50);
    }, 400);
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    handleViewChange('checkout');
  };

  const handleOrderComplete = (orderId: string) => {
    setConfirmedOrderId(orderId);
    handleViewChange('order-confirmation');
  };

  const fetchLiveReviews = useCallback(async () => {
    setGoogleData(prev => ({ ...prev, isLoading: true }));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `SEARCH FOR 'Restaurant Irini' at Weimarstraat 174, 2562 HD Den Haag. Return JSON strictly: {"rating": number, "count": number}.`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const text = response.text || "";
      const match = text.match(/\{.*\}/s);
      if (match) {
        const data = JSON.parse(match[0]);
        setGoogleData({
          rating: data.rating || 5.0,
          reviews: data.count || 545,
          lastSync: new Date(),
          isLoading: false,
          sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
        });
      }
    } catch (e) {
      setGoogleData(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchLiveReviews();
    const interval = setInterval(fetchLiveReviews, 300000); 
    return () => clearInterval(interval);
  }, [fetchLiveReviews]);

  return (
    <div className="min-h-screen selection:bg-gold-400/30 selection:text-gold-400 bg-zinc-950 flex flex-col">
      <Header 
        onCartOpen={() => setIsCartOpen(true)} 
        activeView={activeView} 
        setView={handleViewChange} 
      />
      
      <main className={`flex-1 transition-all duration-500 ease-in-out ${isChangingView ? 'opacity-0 scale-[0.98] blur-xl' : 'opacity-100 scale-100 blur-0'}`}>
        {activeView === 'home' && (
          <div className="animate-reveal">
            <Hero onOrderClick={() => handleViewChange('menu')} onAboutClick={() => handleViewChange('about')} />
            <section id="about-preview" className="py-40 px-4 relative overflow-hidden">
               <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
                 <div className="relative group">
                    <div className="relative z-10 overflow-hidden rounded-[3.5rem] border border-zinc-800/50">
                      <img src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=1000" alt="Greek cuisine heritage" className="w-full object-cover aspect-[4/5] grayscale group-hover:grayscale-0 transition-all duration-1000" />
                    </div>
                 </div>
                 <div className="space-y-12">
                   <h2 className="text-6xl md:text-8xl font-serif font-bold leading-[1.1]">Heritage in <span className="italic gold-gradient">Every Savor</span></h2>
                   <p className="text-zinc-400 text-xl leading-relaxed font-light">Combining traditional family recipes with modern culinary craftsmanship since 1984 in Den Haag.</p>
                   <button onClick={() => handleViewChange('about')} className="group relative px-14 py-6 overflow-hidden rounded-2xl border border-zinc-800 hover:border-gold-400 transition-all active:scale-95">
                      <span className="relative text-[10px] font-bold uppercase tracking-[0.3em]">{t.aboutUs}</span>
                   </button>
                 </div>
               </div>
            </section>
            <section className="py-48 bg-zinc-950 border-t border-zinc-900">
               <div className="max-w-7xl mx-auto px-4">
                 <GoogleReviewCard 
                   rating={googleData.rating} 
                   reviews={googleData.reviews} 
                   isLoading={googleData.isLoading} 
                   onWriteReview={() => {
                     window.open('https://www.google.com/maps/place/Restaurant+Irini/@52.07532,4.2805916,21z/data=!4m16!1m7!3m6!1s0x47c5b0e074091211:0x13c8203ba4d6c277!2sSirtaki!8m2!3d52.0732918!4d4.2674365!16s%2Fg%2F1tvykyvy!3m7!1s0x47c5b10052097b33:0xee46939b90160e!8m2!3d52.0753369!4d4.2805116!9m1!1b1!16s%2Fg%2F11ms1d26zp?entry=ttu&g_ep=EgoyMDI1MTIwOS4wIKXMDSoASAFQAw%3D%3D', '_blank', 'noopener,noreferrer');
                   }} 
                   language={language} 
                   t={t} 
                 />
               </div>
            </section>
          </div>
        )}

        {activeView === 'menu' && <Menu />}
        {activeView === 'about' && <AboutView />}
        {activeView === 'contact' && <ContactView />}
        {activeView === 'admin' && <AdminDashboard />}
        {activeView === 'checkout' && (
          <CheckoutView 
            onOrderComplete={handleOrderComplete}
            onBack={() => handleViewChange('menu')}
          />
        )}
        {activeView === 'order-confirmation' && confirmedOrderId && (
          <OrderConfirmationView 
            orderId={confirmedOrderId}
            onBackToMenu={() => handleViewChange('menu')}
            onTrackOrder={() => handleViewChange('admin')}
          />
        )}
      </main>

      <Footer />
      
      {/* Hidden Dev Trigger for Staff Portal */}
      <div className="fixed bottom-4 left-4 z-[200] opacity-10 hover:opacity-100 transition-opacity">
        <button onClick={() => handleViewChange('admin')} className="text-[8px] uppercase tracking-widest bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 text-zinc-500">Staff Portal</button>
      </div>

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        onCheckout={handleCheckout}
      />
    </div>
  );
};

export default App;
