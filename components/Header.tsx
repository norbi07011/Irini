
import React, { useContext, useState, useEffect } from 'react';
import { LanguageContext, CartContext } from '../index';
import { LANGUAGES, TRANSLATIONS } from '../constants';
import { View } from '../types';

interface HeaderProps {
  onCartOpen: () => void;
  activeView: View;
  setView: (v: View) => void;
}

const Header: React.FC<HeaderProps> = ({ onCartOpen, activeView, setView }) => {
  const langCtx = useContext(LanguageContext);
  const cartCtx = useContext(CartContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

  if (!langCtx || !cartCtx) return null;
  const { language, setLanguage, isRTL } = langCtx;
  const t = TRANSLATIONS[language];

  const navItems: { id: View; label: string }[] = [
    { id: 'home', label: t.home || 'Home' },
    { id: 'menu', label: t.ourMenu },
    { id: 'reservations', label: t.reservationNav || 'Reserveren' },
    { id: 'about', label: t.aboutUs },
    { id: 'contact', label: t.contact }
  ];

  const handleNavClick = (view: View) => {
    setView(view);
    setIsMenuOpen(false);
  };

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        scrolled ? 'py-4' : 'py-6'
      }`}
    >
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-500`}>
        {/* Usunięto overflow-hidden z tego kontenera, aby dropdown był widoczny */}
        <div className={`glass border border-blue-200/50 rounded-3xl md:rounded-[2.5rem] px-6 h-16 md:h-20 flex items-center justify-between shadow-xl shadow-blue-500/10 relative z-20`}>
          
          {/* Subtle sheen animation - teraz w osobnym kontenerze z overflow-hidden */}
          <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.15] to-transparent -translate-x-full animate-[sheen_10s_infinite]" />
          </div>

          {/* Logo */}
          <button 
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 group relative z-10"
          >
            <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-[15deg] group-hover:scale-110 shadow-[0_8px_25px_-5px_rgba(0,102,204,0.3)] group-hover:shadow-[0_12px_35px_-5px_rgba(0,102,204,0.5)] overflow-hidden p-1">
              <img src="/logo.jpeg" alt="Greek Irini" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl md:text-2xl font-serif tracking-widest uppercase hidden xs:block text-gray-900 font-bold">
              Greek <span className="blue-gradient">Irini</span>
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-12 rtl:space-x-reverse">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`text-[11px] font-bold uppercase tracking-[0.3em] transition-all duration-300 hover:text-blue-600 relative py-2 group/nav ${
                  activeView === item.id ? 'text-blue-600' : 'text-gray-800'
                }`}
              >
                {item.label}
                <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-600 to-blue-700 transition-transform duration-500 origin-left shadow-[0_0_8px_rgba(0,102,204,0.5)] ${
                  activeView === item.id ? 'scale-x-100' : 'scale-x-0 group-hover/nav:scale-x-100 opacity-50'
                }`} />
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-4 relative z-10">
            {/* Lang Switcher (Desktop) */}
            <div className="hidden sm:block relative group">
              <button className="flex items-center gap-2 px-4 py-2 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-zinc-800/50">
                <span className="text-base">{LANGUAGES.find(l => l.code === language)?.flag}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{language}</span>
              </button>
              
              {/* Invisible bridge to maintain hover when moving to dropdown */}
              <div className="absolute top-full left-0 right-0 h-2 bg-transparent" />
              
              {/* Dropdown Menu */}
              <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50`}>
                <div className="w-56 bg-white border border-gray-200 rounded-3xl py-3 shadow-2xl">
                  <div className="px-4 py-2 mb-2 border-b border-gray-100">
                    <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-zinc-500">Select Language</span>
                  </div>
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLanguage(l.code)}
                      className={`w-full flex items-center justify-between px-5 py-3 text-xs hover:bg-blue-50 transition-all cursor-pointer ${
                        language === l.code ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span>{l.flag}</span>
                        <span className="tracking-wide">{l.name}</span>
                      </div>
                      {language === l.code && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(0,102,204,0.6)]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart */}
            <button 
              onClick={onCartOpen}
              className="relative p-3 rounded-2xl hover:bg-white/5 transition-all group border border-transparent hover:border-zinc-800/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 group-hover:text-gold-400 transition-all group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCtx.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-reveal">
                  {cartCtx.itemCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="md:hidden w-12 h-12 rounded-2xl glass border border-zinc-800/50 flex flex-col items-center justify-center gap-1.5 active:scale-90 transition-transform group"
              aria-label="Toggle menu"
            >
              <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-4 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0' : 'group-hover:w-6'}`} />
              <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Full-screen Overlay */}
      <div 
        className={`fixed inset-0 z-10 md:hidden transition-all duration-700 ease-in-out ${
          isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
        <div 
          className="absolute inset-0 bg-zinc-950/80 backdrop-blur-3xl"
          onClick={() => setIsMenuOpen(false)}
        />
        
        <div className="absolute top-0 right-0 w-[80%] h-[40%] bg-gold-400/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2 animate-pulse pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[80%] h-[40%] bg-zinc-800/20 blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none" />

        <div className="relative h-full flex flex-col px-10 pt-24 pb-10 overflow-y-auto overflow-x-hidden">
          <div className="space-y-8 flex-shrink-0">
            {navItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`mobile-nav-item block w-full text-left group`}
                style={{ animationDelay: `${(index + 1) * 0.1}s` }}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-4xl md:text-5xl font-serif font-bold tracking-tight transition-all duration-500 ${
                    activeView === item.id ? 'text-gold-400 translate-x-4' : 'text-white group-hover:text-gold-400 group-hover:translate-x-4'
                  }`}>
                    {item.label}
                  </span>
                  {activeView === item.id && (
                    <div className="w-12 h-px bg-gradient-to-r from-blue-600 to-blue-700 animate-reveal" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-12 space-y-8 flex-shrink-0">
            <div className="mobile-nav-item" style={{ animationDelay: '0.4s' }}>
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-zinc-500 block mb-6">Change Language</span>
              <div className="flex flex-wrap gap-4">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-5 py-3 rounded-2xl glass border transition-all ${
                      language === l.code ? 'border-gold-400 gold-gradient' : 'border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span className="text-xl">{l.flag}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{l.code}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mobile-nav-item pt-10 border-t border-white/5" style={{ animationDelay: '0.5s' }}>
               <div className="flex items-center gap-6">
                  {['FB', 'IG', 'TW'].map(s => (
                    <span key={s} className="text-[10px] font-bold text-zinc-500 hover:text-gold-400 transition-colors cursor-pointer tracking-[0.2em]">{s}</span>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sheen {
          0% { transform: translateX(-100%); }
          20% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </header>
  );
};

export default Header;
