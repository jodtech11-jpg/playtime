
import React from 'react';

interface MembershipProps {
  onBack: () => void;
}

const Membership: React.FC<MembershipProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-full bg-background-dark overflow-y-auto no-scrollbar pb-32">
       <header className="sticky top-0 z-50 flex items-center bg-background-dark/95 backdrop-blur-md p-4 pb-3 justify-between border-b border-white/5">
        <button 
          onClick={onBack}
          className="flex items-center justify-center size-10 rounded-full hover:bg-white/5 transition-colors"
        >
          <span className="material-symbols-outlined text-white">arrow_back</span>
        </button>
        <h2 className="text-white text-lg font-black font-display tracking-tight flex-1 text-center pr-10">Unlock Play Time Pro</h2>
      </header>

      <div className="px-4 py-8 space-y-10">
        <div className="flex items-center justify-between bg-surface-dark border border-white/5 p-5 rounded-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 size-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
          <div className="relative z-10">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Current Plan</p>
            <h3 className="text-white text-xl font-black font-display tracking-tight">Free Member</h3>
          </div>
          <div className="flex h-9 items-center justify-center gap-x-2 rounded-2xl bg-white/5 px-5 border border-white/5 shadow-inner">
            <span className="size-2 rounded-full bg-gray-600"></span>
            <p className="text-white text-xs font-black uppercase tracking-widest">Active</p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-white tracking-tight text-3xl font-black font-display leading-tight">Choose Your Game</h2>
          <p className="text-gray-400 font-bold text-sm leading-relaxed opacity-80">Level up your sports experience with exclusive perks.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Starter Plan */}
          <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-surface-dark p-6 relative overflow-hidden shadow-2xl transition-all hover:border-primary/20">
            <div className="space-y-1">
              <h1 className="text-gray-400 text-xl font-black font-display uppercase tracking-widest opacity-80">Starter</h1>
              <p className="flex items-baseline gap-2 text-white mt-4">
                <span className="text-4xl font-black tracking-tighter">₹499</span>
                <span className="text-gray-500 text-base font-bold">/mo</span>
              </p>
            </div>
            <div className="space-y-4">
              {[
                '2 Bookings/week',
                'Standard Support',
                'Basic Analytics'
              ].map((perk) => (
                <div key={perk} className="flex gap-4 items-center text-gray-300 text-sm font-bold tracking-tight">
                  <span className="material-symbols-outlined text-primary text-xl font-black">check_circle</span>
                  {perk}
                </div>
              ))}
            </div>
            <button className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95">
              Select Starter
            </button>
          </div>

          {/* Pro Athlete Plan */}
          <div className="flex flex-col gap-6 rounded-3xl border-2 border-primary bg-surface-dark p-6 relative overflow-hidden shadow-glow">
            <div className="absolute top-0 right-0 bg-primary text-background-dark text-[10px] font-black px-5 py-2.5 rounded-bl-3xl z-20 shadow-lg tracking-widest">
                BEST VALUE
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50"></div>
            
            <div className="space-y-1 relative z-10">
              <h1 className="text-white text-xl font-black font-display flex items-center gap-2 uppercase tracking-widest">
                Pro Athlete
                <span className="material-symbols-outlined text-primary text-2xl animate-bounce">bolt</span>
              </h1>
              <p className="flex items-baseline gap-2 text-white mt-4">
                <span className="text-4xl font-black tracking-tighter">₹999</span>
                <span className="text-gray-500 text-base font-bold">/mo</span>
              </p>
            </div>
            <div className="space-y-4 relative z-10">
              {[
                'Unlimited Bookings',
                'Priority Slot Access',
                '10% Discount on Turfs',
                'Free Cancellation'
              ].map((perk) => (
                <div key={perk} className="flex gap-4 items-center text-white text-sm font-black tracking-tight">
                  <span className="material-symbols-outlined text-primary text-xl font-black shadow-primary/20">check_circle</span>
                  {perk}
                </div>
              ))}
            </div>
            <button className="w-full bg-primary hover:bg-green-400 text-background-dark font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-glow relative z-10 transition-all active:scale-95">
              Select Pro
            </button>
          </div>
        </div>

        <section>
          <h3 className="text-white font-black font-display text-xl mb-6">Why Go Premium?</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: 'Priority Access', desc: 'Book slots 24h before everyone else.', icon: 'calendar_clock', color: 'bg-blue-500/20 text-blue-400' },
              { title: 'Save More', desc: 'Flat 10% off on all weekend bookings.', icon: 'savings', color: 'bg-purple-500/20 text-purple-400' },
              { title: 'Community', desc: 'Access to exclusive tournaments.', icon: 'groups', color: 'bg-orange-500/20 text-orange-400' },
              { title: 'Pro Support', desc: 'Dedicated line for instant help.', icon: 'support_agent', color: 'bg-primary/20 text-primary' }
            ].map((item) => (
              <div key={item.title} className="bg-surface-dark p-5 rounded-3xl border border-white/5 flex flex-col gap-3 shadow-xl h-full">
                <div className={`size-10 rounded-2xl flex items-center justify-center ${item.color} shadow-inner`}>
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                </div>
                <div>
                  <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 leading-snug">{item.title}</h4>
                  <p className="text-gray-500 text-[10px] font-bold leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="relative overflow-hidden rounded-3xl bg-[#28392e] p-8 shadow-2xl border border-white/5">
            <div className="absolute -right-4 -top-4 size-32 bg-primary/20 blur-3xl rounded-full"></div>
            <div className="relative z-10 flex gap-5">
              <div className="size-12 shrink-0 overflow-hidden rounded-full border-2 border-primary/30">
                <img className="size-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDeUnAzDOF4y7lGcN-GsZBNLDo-ejqlRRhr89KXOjjqC9w0S2uA1YLAKEvUfTCKidcIwTRFyKTYvEe1tlP-ZkeN4EtKzkM1A8go3iCJaGKHP4sMAISjobTZ5HQBLfFkSQfH6DomKur9aNYJxytwtTVH2qqpO4F0sDqofZGC2WlG85mrHeYwGoDmWlWCf0NlQTyKYuTwTXv4zLdroRbRdYEJ1or9ctqcVRNdDFhmDCZcUX2P5rzw9zEYCugmz6GwVRVZLUwWDWtLpeoM" alt="" />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold leading-relaxed text-gray-200 italic tracking-tight">"Since joining Pro, I get the best turf slots every weekend in Chennai. Totally worth it!"</p>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">— Vijay, Chennai</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Membership;
