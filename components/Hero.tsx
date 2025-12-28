
import React, { useContext } from 'react';
import { LanguageContext } from '../index';
import { TRANSLATIONS } from '../constants';
import { View } from '../types';

interface HeroProps {
  onOrderClick: () => void;
  onAboutClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onOrderClick, onAboutClick }) => {
  const langCtx = useContext(LanguageContext);
  if (!langCtx) return null;
  const t = TRANSLATIONS[langCtx.language];

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img 
          src="/okładka strony home.png" 
          alt="Authentic Greek Food"
          className="w-full h-full object-cover opacity-70 scale-105 transition-transform duration-[20s] ease-out group-hover:scale-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-zinc-950/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold-400/30 glass">
          <span className="w-2 h-2 rounded-full gold-bg animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-gold-400">Authentic Greek Kitchen</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif font-bold mb-8 leading-[0.9] tracking-tight">
          {t.heroTitle.split(' ').map((word, i) => (
            <span key={i} className={i === 1 ? 'gold-gradient block sm:inline' : 'block sm:inline mr-4 rtl:ml-4'}>
              {word}{' '}
            </span>
          ))}
        </h1>

        <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
          {t.heroSub}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <button 
            onClick={onOrderClick}
            className="group relative px-12 py-5 bg-gold-400 overflow-hidden rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(212,175,55,0.4)]"
          >
            <div className="absolute inset-0 gold-bg opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative text-zinc-950 font-bold uppercase tracking-widest text-xs">{t.orderNow}</span>
          </button>
          
          <button 
            onClick={onAboutClick}
            className="px-12 py-5 rounded-full border border-zinc-700 hover:border-zinc-500 glass transition-all uppercase tracking-widest text-xs font-medium"
          >
            {t.aboutUs}
          </button>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
        <div className="w-6 h-10 border-2 border-zinc-800 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 gold-bg rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
