
import React from 'react';
import { PRODUCTS } from '../constants';

interface MarketplaceProps {
  onBack: () => void;
}

const Marketplace: React.FC<MarketplaceProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar pb-40">
      <header className="sticky top-0 z-40 bg-background-dark/95 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={onBack}
            className="flex items-center justify-center size-10 rounded-full hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <h1 className="text-lg font-black font-display flex-1 text-center pr-1 tracking-tight">Marketplace</h1>
          <button className="relative flex items-center justify-center size-10 rounded-full hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-white">shopping_cart</span>
            <span className="absolute top-2 right-2 flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-primary"></span>
            </span>
          </button>
        </div>
        
        <div className="px-4 pb-4">
          <div className="relative flex items-center w-full h-12 rounded-2xl bg-surface-dark border border-white/5 shadow-inner px-4 overflow-hidden">
            <span className="material-symbols-outlined text-secondary-text mr-3">search</span>
            <input 
              className="peer h-full w-full bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-600" 
              placeholder="Search for gear..." 
              type="text" 
            />
          </div>
        </div>
      </header>

      <div className="sticky top-[120px] z-30 bg-background-dark/95 backdrop-blur-md py-3 shadow-md">
        <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar">
          {['All', 'Cricket', 'Football', 'Badminton', 'Tennis', 'Apparel'].map((cat, i) => (
            <button 
              key={cat}
              className={`shrink-0 h-9 px-6 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                i === 0 ? 'bg-primary text-background-dark' : 'bg-surface-dark text-gray-400 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="flex flex-col gap-8 pt-6">
        {/* Banner */}
        <section className="px-4">
          <div className="relative w-full aspect-[2/1] rounded-3xl overflow-hidden group shadow-2xl">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" 
              style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBnJluJlJV-25UrZeQMjhyPeyLuN090LFInRJy7ACOL6ZIJA1v9HRyB5dZICE_WecjRw-Aa2m5OKfyOC1yXf3F7iwbet0r-HbyVZdPewPT0JoZfV2Qt0OZm3U9onY3mvOJsPxmI8M73zdMSzQtK9IXpLE5Mv4aTOXpvI2i2RJH3Qf7HQEESSywsxpjM3PlloqVGlZ2Dl4K5v2GirskBJn_s84y_p78iwoHhsW51gzUh9BFErOkBWsDmf0_Qp-gs-S7B0hD4qcPQxhAh')` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6 w-full">
              <span className="inline-block px-2 py-1 mb-2 text-[10px] font-black text-background-dark uppercase bg-primary rounded shadow-sm">Promo</span>
              <h2 className="text-2xl font-black text-white mb-1 leading-tight font-display">Season Opener Sale</h2>
              <p className="text-gray-300 text-sm opacity-90">Up to 40% off on all professional cricket kits.</p>
            </div>
          </div>
        </section>

        {/* Product Grid */}
        <section className="px-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black font-display text-white">Popular Gear</h2>
            <button className="text-sm text-primary font-bold uppercase tracking-wider">See all</button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {PRODUCTS.map((product) => (
              <div 
                key={product.id}
                className="group relative flex flex-col bg-surface-dark rounded-2xl overflow-hidden border border-white/5 transition-all active:scale-[0.98] shadow-lg"
              >
                <div className="relative aspect-square overflow-hidden bg-white/5">
                  {product.tag && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest z-10 shadow-lg">
                      {product.tag}
                    </div>
                  )}
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" 
                  />
                  <div className="absolute top-2 right-2 size-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-primary hover:text-background-dark transition-all">
                    <span className="material-symbols-outlined text-[18px]">favorite</span>
                  </div>
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex-1 space-y-1">
                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug">{product.name}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{product.brand}</p>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-500 line-through">₹{product.originalPrice}</span>
                      <span className="text-lg font-black text-primary leading-none">₹{product.price}</span>
                    </div>
                    <button className="bg-primary/10 hover:bg-primary text-primary hover:text-background-dark size-9 rounded-xl flex items-center justify-center transition-all shadow-sm">
                      <span className="material-symbols-outlined text-[20px] font-black">add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 pb-6">
          <div className="bg-[#1c3024] rounded-3xl p-6 flex items-center justify-between border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute right-0 top-0 size-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-primary/20"></div>
            <div className="relative z-10">
              <h3 className="font-black text-white text-lg font-display">Join Pro Club</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mt-1">Get 5% extra off every order</p>
            </div>
            <button className="px-5 py-2.5 bg-white/10 text-primary font-black uppercase text-[11px] tracking-widest rounded-xl hover:bg-white/20 transition-all active:scale-95 border border-primary/20">
              Join Now
            </button>
          </div>
        </section>
      </main>

      {/* Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background-dark/95 backdrop-blur-xl border-t border-white/5 pb-10">
        <div className="flex items-center justify-between max-w-[480px] mx-auto gap-6">
          <div className="flex flex-col">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total (2 items)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">₹4,700</span>
              <span className="text-xs text-gray-500 line-through">₹6,200</span>
            </div>
          </div>
          <button className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-[#0be050] text-background-dark font-black h-14 rounded-2xl shadow-glow transition-all active:scale-95">
            <span className="uppercase tracking-widest text-base">Checkout</span>
            <span className="material-symbols-outlined font-black">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
