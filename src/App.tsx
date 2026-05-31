import React, { useEffect, useState } from 'react';
import { requestNotificationPermission, useFirebaseNotifications } from './hooks/useNotifications';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import PosLoginPage from './pages/PosLoginPage';
import POSPage from './pages/POSPage';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { OrderSummary } from './pages/OrderSummary';
import { ManageCategories } from './pages/ManageCategories';
import { Contact } from './pages/Contact';
import { AdminPanel } from './pages/AdminPanel';
import EditProductForm from './pages/EditProductForm';
import { MyAccount } from './pages/MyAccount';

// Captures the install prompt on Android Chrome
let deferredInstallPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function PWABanner() {
  const [show, setShow] = useState(false);
  const [installPromptReady, setInstallPromptReady] = useState(false);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    // Already running as installed PWA — never show
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isInstalled) return;

    // User dismissed before — respect their choice
    const dismissed = localStorage.getItem('tags_pwa_banner_dismissed');
    if (dismissed) return;

    // Only show on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Check if install prompt is already captured
    if (deferredInstallPrompt) setInstallPromptReady(true);

    // Also listen for it arriving slightly later
    const handler = (e: any) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      setInstallPromptReady(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    setShow(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss(permanent: boolean) {
    if (permanent) localStorage.setItem('tags_pwa_banner_dismissed', '1');
    setShow(false);
  }

  async function handleInstall() {
    if (deferredInstallPrompt) {
      // Android — trigger native install prompt directly
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        localStorage.setItem('tags_pwa_banner_dismissed', '1');
      }
      deferredInstallPrompt = null;
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-4 pointer-events-none">
      <div
        className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-auto"
        style={{ animation: 'slideUp 0.3s ease forwards' }}
      >
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Top row — icon + text + close */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#FA5600] rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm">T</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm">Better on the App!</p>
            <p className="text-white/50 text-xs mt-0.5 leading-relaxed">
              {isIOS
                ? 'Tap Share below, then "Add to Home Screen" for the full TAGS experience.'
                : 'Install TAGS on your home screen for a faster, full-screen experience.'}
            </p>
          </div>
          <button
            onClick={() => dismiss(false)}
            className="text-white/30 hover:text-white/60 text-lg leading-none shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Bottom row — install button or iOS instruction */}
        <div className="flex items-center gap-2 mt-3">
          {isIOS ? (
            // iPhone — step by step visual guide
            <div className="flex-1 space-y-2">
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">How to install on iPhone:</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#FA5600] flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-[10px]">1</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/70 text-xs font-bold">Tap</span>
                  <span className="bg-white/10 rounded-lg px-2 py-0.5 text-white text-xs font-black">⬆ Share</span>
                  <span className="text-white/70 text-xs font-bold">at the bottom</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#FA5600] flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-[10px]">2</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/70 text-xs font-bold">Tap</span>
                  <span className="bg-white/10 rounded-lg px-2 py-0.5 text-white text-xs font-black">＋ Add to Home Screen</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#FA5600] flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-[10px]">3</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/70 text-xs font-bold">Tap</span>
                  <span className="bg-white/10 rounded-lg px-2 py-0.5 text-white text-xs font-black">Add</span>
                  <span className="text-white/70 text-xs font-bold">— done! 🎉</span>
                </div>
              </div>
            </div>
          ) : installPromptReady ? (
            // Android with prompt ready — show real install button
            <button
              onClick={handleInstall}
              className="flex-1 bg-[#FA5600] text-white font-black text-sm uppercase tracking-widest py-3 rounded-xl hover:bg-[#E04A00] transition active:scale-95"
            >
              + Install App
            </button>
          ) : (
            // Android but prompt not ready yet — show manual instruction
            <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[#FA5600] text-base">⊕</span>
              <span className="text-white/60 text-xs font-bold">
                Tap "Add to Home Screen" in your browser menu
              </span>
            </div>
          )}
          <button
            onClick={() => dismiss(true)}
            className="text-white/30 text-[10px] font-bold uppercase tracking-widest shrink-0"
          >
            Don't show
          </button>
        </div>
      </div>
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-[#1A1A1A] flex flex-col items-center justify-center z-50">

      {/* Animated TAGS logo — each letter drops in with a staggered delay */}
      <div className="flex items-end gap-0 mb-6">
        <span
          className="text-6xl font-black tracking-tighter uppercase text-[#FA5600]"
          style={{ animation: 'splashLetter 0.5s ease 0s both' }}
        >T</span>
        <span
          className="text-6xl font-black tracking-tighter uppercase text-white"
          style={{ animation: 'splashLetter 0.5s ease 0.15s both' }}
        >A</span>
        <span
          className="text-6xl font-black tracking-tighter uppercase text-white"
          style={{ animation: 'splashLetter 0.5s ease 0.3s both' }}
        >G</span>
        <span
          className="text-6xl font-black tracking-tighter uppercase text-white"
          style={{ animation: 'splashLetter 0.5s ease 0.45s both' }}
        >S</span>
      </div>

      {/* Tagline fades in after letters */}
      <p
        className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-10"
        style={{ animation: 'splashLetter 0.5s ease 0.65s both' }}
      >
        Toys · Adventure · Gadgets · Sports
      </p>

      {/* Animated loading bar sweeps back and forth */}
      <div className="w-32 h-0.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FA5600] rounded-full"
          style={{ animation: 'loadBar 1.2s ease-in-out infinite' }}
        />
      </div>

      <style>{`
        @keyframes splashLetter {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0px); }
        }
        @keyframes loadBar {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 100%; margin-left: 0%; }
          51%  { width: 100%; margin-left: 0%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

// Minimum time (ms) the splash screen must be visible
const MIN_SPLASH_MS = 1500;

function AppShell() {
  const { isLoaded } = useAppData();
  const [minTimeDone, setMinTimeDone] = useState(false);

  // Handle foreground push notifications
  // Delay until after splash to avoid SW race condition
  const [notifReady, setNotifReady] = useState(false);
  useEffect(() => {
    // Wait for SW to be ready before initializing Firebase messaging
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setNotifReady(true))
        .catch(() => setNotifReady(true)); // fail silently
    } else {
      setNotifReady(true);
    }
  }, []);

  useFirebaseNotifications(notifReady);

  // Request notification permission after splash screen
  useEffect(() => {
    if (!notifReady) return;
    const timer = setTimeout(() => {
      requestNotificationPermission();
    }, 5000); // Ask after 5 seconds — not immediately on load
    return () => clearTimeout(timer);
  }, [notifReady]);

  // Start a timer on mount — splash shows for at least MIN_SPLASH_MS
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Only hide splash when BOTH conditions are true:
  // 1. APIs have responded (isLoaded)
  // 2. Minimum display time has passed (minTimeDone)
  const showSplash = !isLoaded || !minTimeDone;

  if (showSplash) return <SplashScreen />;

  return (
    <>
      <style>{`
        @keyframes siteIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .site-fadein {
          animation: siteIn 0.4s ease forwards;
        }
      `}</style>
      <div className="site-fadein">
        <Routes>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pos-login" element={<PosLoginPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/products/:id/edit" element={<EditProductForm />} />
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Catalog />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/order" element={<OrderSummary />} />
                <Route path="/manage-categories" element={<ManageCategories />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/account" element={<MyAccount />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppDataProvider>
            <AppShell />
            <PWABanner />
          </AppDataProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
