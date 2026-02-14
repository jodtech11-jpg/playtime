import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLandingPage } from '../hooks/useLandingPage';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { content, loading } = useLandingPage(true);

  // Scroll animations
  const heroAnimation = useScrollAnimation(0.1, true);
  const statsAnimation = useScrollAnimation(0.2);
  const featuresAnimation = useScrollAnimation(0.2);
  const mobileShowcaseAnimation = useScrollAnimation(0.2);
  const testimonialsAnimation = useScrollAnimation(0.2);
  const ctaAnimation = useScrollAnimation(0.2);

  const displayContent = content || {
    heroTitle: 'Master Your Sports Venue',
    heroSubtitle: 'With Intelligence',
    heroDescription: 'The ultimate all-in-one platform to manage bookings, memberships, staff, and real-time analytics. Empower your business with data-driven insights.',
    heroPrimaryButtonText: 'Enter Dashboard',
    heroSecondaryButtonText: 'Learn More',
    stats: [
      { value: '250+', label: 'Premium Venues' },
      { value: '1M+', label: 'Total Bookings' },
      { value: '4.9/5', label: 'User Rating' },
      { value: '99.9%', label: 'Platform Uptime' }
    ],
    features: [
      {
        icon: 'analytics',
        title: 'Advanced Analytics',
        description: 'Deep dive into revenue patterns, peak hours, and customer behavior with interactive charts.',
        order: 1
      },
      {
        icon: 'calendar_month',
        title: 'Smart Scheduling',
        description: 'Automated booking management that eliminates double-bookings and optimizes court usage.',
        order: 2
      },
      {
        icon: 'payments',
        title: 'Seamless Payments',
        description: 'Integrated payment processing with instant transfers and automated financial reporting.',
        order: 3
      }
    ]
  };

  return (
    <div className="min-h-screen mesh-gradient text-slate-900 dark:text-slate-100 selection:bg-primary/30 scroll-smooth">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/20 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-white text-3xl font-bold">sports_tennis</span>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tighter block leading-none">PLAY TIME</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Intelligence</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 font-bold text-sm tracking-wide">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#mobile" className="hover:text-primary transition-colors">Mobile App</a>
            <a href="#testimonials" className="hover:text-primary transition-colors">Testimonials</a>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 dark:shadow-white/10"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 overflow-hidden">
        {/* Floating background elements */}
        <div className="absolute top-40 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-secondary/20 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div
            ref={heroAnimation.ref}
            className={`transition-all duration-1000 ${heroAnimation.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-20'}`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              V3.0 Now Live
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.1] mb-8">
              <span className="block">{displayContent.heroTitle}</span>
              <span className="text-gradient block">{displayContent.heroSubtitle}</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-12 max-w-xl">
              {displayContent.heroDescription}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/login')}
                className="px-10 py-5 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
              >
                {displayContent.heroPrimaryButtonText}
              </button>
              <button
                className="px-10 py-5 bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/80 dark:hover:bg-white/10 transition-all"
              >
                {displayContent.heroSecondaryButtonText}
              </button>
            </div>
          </div>

          <div
            className={`relative transition-all duration-1000 delay-300 ${heroAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
          >
            <div className="relative z-10 animate-float">
              <img
                src="/hero-dashboard.png"
                alt="Dashboard Mockup"
                className="rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-white/20 dark:border-white/10"
              />
              {/* Floating Badge */}
              <div className="absolute -bottom-6 -left-6 glass-card p-6 rounded-2xl shadow-2xl animate-pulse-soft">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl font-bold">trending_up</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black">+42%</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Revenue Growth</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Background Glow */}
            <div className="absolute inset-0 bg-primary/20 blur-[100px] -z-10 translate-y-10 scale-90"></div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div
            ref={statsAnimation.ref}
            className={`grid grid-cols-2 lg:grid-cols-4 gap-8 transition-all duration-1000 ${statsAnimation.isVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            {displayContent.stats?.map((stat, i) => (
              <div key={i} className="glass-card p-8 rounded-3xl text-center hover:scale-105 transition-transform duration-500">
                <div className="text-4xl md:text-5xl font-black text-primary mb-2 line-clamp-1">{stat.value}</div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-6xl font-black mb-6">Designed for <span className="text-gradient">Performance</span></h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 font-medium">Every tool you need to scale your sports venue from one court to a national network.</p>
          </div>

          <div
            ref={featuresAnimation.ref}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {displayContent.features?.map((feature, i) => (
              <div
                key={i}
                className={`glass-card p-10 rounded-[2.5rem] hover:shadow-2xl transition-all duration-500 group ${featuresAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  <span className="material-symbols-outlined text-3xl font-bold">{feature.icon}</span>
                </div>
                <h3 className="text-2xl font-black mb-4">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App Showcase */}
      <section id="mobile" className="py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 glass rounded-[3rem] p-12 md:p-24 border-white/30 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div
              ref={mobileShowcaseAnimation.ref}
              className={`transition-all duration-1000 ${mobileShowcaseAnimation.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-20'}`}
            >
              <div className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-xs font-black tracking-widest uppercase mb-6">Mobile Eco-System</div>
              <h2 className="text-4xl md:text-6xl font-black mb-8">Management in your <span className="text-accent underline decoration-accent/30 decoration-8 underline-offset-8">pocket</span>.</h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 font-medium mb-12">
                Our companion mobile app for users and staff ensures reservations, check-ins, and notifications happen in real-time, no matter where you are.
              </p>
              <ul className="space-y-6">
                {['Instant Push Notifications', 'QR Code Check-ins', 'Staff Dashboards'].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-lg font-bold">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-sm font-bold">check</span>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className={`flex justify-center transition-all duration-1000 delay-300 ${mobileShowcaseAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
            >
              <div className="relative px-12 md:px-0">
                <img src="/app-mockup.png" alt="Mobile App" className="w-[320px] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border-[10px] border-slate-900" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[100px] -z-10 animate-pulse-soft"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-32 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[120px]"></div>

          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black mb-6">Trusted by the <span className="text-primary italic">Best</span>.</h2>
          </div>

          <div
            ref={testimonialsAnimation.ref}
            className={`grid grid-cols-1 md:grid-cols-3 gap-8 transition-all duration-1000 ${testimonialsAnimation.isVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            {[
              { name: 'Arjun Reddy', role: 'Owner', venue: 'Olympia Courts', quote: 'The analytics changed how we price our peak hours. Revenue is up 35% in just 3 months.' },
              { name: 'Sarah Joseph', role: 'Director', venue: 'Ace Badminton', quote: 'Best booking system we have ever used. My staff spends 50% less time on calls now.' },
              { name: 'Kunal Singh', role: 'Manager', venue: 'Elite Sports', quote: 'The real-time notification system is a game changer for our members. Highly recommended.' }
            ].map((t, i) => (
              <div key={i} className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex gap-1 text-primary mb-6">
                  {[...Array(5)].map((_, j) => <span key={j} className="material-symbols-outlined filled">star</span>)}
                </div>
                <p className="text-xl font-medium mb-10 leading-relaxed italic text-slate-300">"{t.quote}"</p>
                <div>
                  <div className="text-xl font-black mb-1">{t.name}</div>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">{t.role} • {t.venue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div
            ref={ctaAnimation.ref}
            className={`bg-gradient-to-tr from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 rounded-[3.5rem] p-12 md:p-24 text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] transition-all duration-1000 ${ctaAnimation.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
          >
            <h2 className="text-4xl md:text-7xl font-black mb-8">Ready to Scale?</h2>
            <p className="text-xl opacity-80 mb-12 max-w-2xl mx-auto font-medium">Join the network of premium sports venues already powered by Play Time Intelligence.</p>
            <button
              onClick={() => navigate('/login')}
              className="px-12 py-6 bg-primary text-white rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all animate-bounce-subtle"
            >
              Get Started Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-200 dark:border-white/5 opacity-60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3 grayscale opacity-50">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center">
              <span className="material-symbols-outlined text-white dark:text-slate-900 text-xl font-bold">sports_tennis</span>
            </div>
            <span className="text-lg font-black tracking-tighter">PLAY TIME</span>
          </div>

          <div className="text-xs font-bold uppercase tracking-widest">
            © 2026 Play Time Global. All rights reserved.
          </div>

          <div className="flex gap-8 text-xs font-black uppercase tracking-widest">
            <a href="#" className="hover:text-primary transition-colors">Twitter</a>
            <a href="#" className="hover:text-primary transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

