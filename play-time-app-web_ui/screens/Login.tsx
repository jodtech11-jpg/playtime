
import React, { useState } from 'react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    setLoading(true);
    // Simulating login delay
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 1000);
  };

  const handlePhoneLogin = () => {
    if (!phoneNumber) {
      alert("Please enter a mobile number.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
        setLoading(false);
        onLogin();
    }, 1000);
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Hero Section */}
      <div className="relative h-[45vh] w-full overflow-hidden shrink-0">
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuAgvpQQbvSUUHHJim7RCklWvzJ7KE4wUTvBdHlhuYfrEDaEZfSRcF_UmCXHvFHMMeOxWTr0zLOuy3-LhMKDQq7KuQ7VKMNDUelXTOVjCwDxNIgwF0zyp8trxyROaLGPGw91pMR74GGAl8V7qj9ZNUlP-x7_mqFPDjiI3zSl1731YK0OhYjIEBvGRrQyPF6JzPMvypwt6_zqF80vumUEYJkzY0Zqrd8QcWXHVL0L9jADhw3UXMLNla53-5pHKKRgthITxRHqmcAvI5r5")` }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background-dark"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/60 to-transparent opacity-90"></div>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 text-center z-10">
          <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/20 backdrop-blur-sm border border-primary/30 mb-4 shadow-[0_0_15px_rgba(13,242,89,0.3)]">
            <span className="material-symbols-outlined text-4xl text-primary">sports_cricket</span>
          </div>
          <h1 className="text-white text-3xl font-extrabold tracking-tight font-display">Play Time</h1>
          <p className="text-gray-300 text-sm font-medium tracking-widest mt-1 opacity-90 uppercase">BOOK. PLAY. REPEAT.</p>
        </div>
      </div>

      {/* Login Sheet */}
      <div className="flex-1 flex flex-col relative z-20 -mt-6 rounded-t-3xl bg-surface-dark/80 backdrop-blur-xl border-t border-white/5 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-white/20"></div>
        </div>
        
        <div className="px-6 pb-8 pt-4 flex flex-col h-full overflow-y-auto no-scrollbar">
          <div className="mb-8">
            <h2 className="text-white text-[28px] font-bold leading-tight mb-2 font-display">Let's get you on the field.</h2>
            <p className="text-secondary-text text-base font-normal">Enter your mobile number to start booking.</p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex gap-3">
              <div className="w-24 shrink-0">
                <label className="block text-gray-400 text-xs font-medium mb-1.5 ml-1 uppercase tracking-wider">Code</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-lg">🇮🇳</span>
                  </div>
                  <input 
                    className="w-full h-14 bg-surface-input border border-white/5 text-white rounded-xl focus:ring-primary focus:border-primary pl-10 pr-2 text-base font-medium transition-colors" 
                    readOnly 
                    type="text" 
                    value="+91" 
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-gray-400 text-xs font-medium mb-1.5 ml-1 uppercase tracking-wider">Mobile Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-500">
                    <span className="material-symbols-outlined text-[20px]">smartphone</span>
                  </span>
                  <input 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full h-14 bg-surface-input border border-white/5 text-white rounded-xl focus:ring-primary focus:border-primary pl-10 pr-4 text-base font-medium placeholder:text-gray-600 transition-colors" 
                    placeholder="98765 43210" 
                    type="tel" 
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            disabled={loading}
            onClick={handlePhoneLogin}
            className="w-full group relative overflow-hidden rounded-xl bg-primary h-14 flex items-center justify-center shadow-[0_4px_20px_rgba(13,242,89,0.3)] hover:shadow-[0_6px_24px_rgba(13,242,89,0.4)] transition-all active:scale-[0.98]"
          >
            <span className="text-background-dark text-lg font-extrabold tracking-wide mr-2 z-10">
                {loading ? 'Processing...' : 'Get OTP'}
            </span>
            <span className="material-symbols-outlined text-background-dark z-10 group-hover:translate-x-1 transition-transform">arrow_forward</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#142a1c] px-4 text-gray-500 font-medium">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-2 h-12 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-white font-black text-xl">G</span>
              <span className="text-white font-bold text-sm">Google</span>
            </button>
            <button 
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-2 h-12 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-white">whatshot</span>
              <span className="text-white font-bold text-sm">Apple</span>
            </button>
          </div>

          <p className="text-center text-xs text-gray-600 mt-auto">
            By continuing, you agree to our <a className="text-primary hover:underline" href="#">Terms</a> & <a className="text-primary hover:underline" href="#">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
