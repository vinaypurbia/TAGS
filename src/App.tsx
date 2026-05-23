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

// Detects if user is on mobile browser (not installed PWA)
function usePWABanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — never show banner
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isInstalled) return;

    // User dismissed before — respect their choice
    const dismissed = localStorage.getItem('tags_pwa_banner_dismissed');
    if (dismissed) return;

    // Only show on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    setShow(true);
  }, []);

  function dismiss(permanent: boolean) {
    if (permanent) localStorage.setItem('tags_pwa_banner_dismissed', '1');
    setShow(false);
  }

  return { show, dismiss };
}

function PWABanner() {
  const { show, dismiss } = usePWABanner();
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

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
                ? 'Tap the Share button below, then "Add to Home Screen" for the full TAGS app experience.'
                : 'Add TAGS to your home screen for a faster, full-screen experience.'}
            </p>
          </div>
          <button
            onClick={() => dismiss(false)}
            className="text-white/30 hover:text-white/60 text-lg leading-none shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Bottom row — instruction + don't show again */}
        <div className="flex items-center gap-2 mt-3">
          {isIOS ? (
            <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-[#FA5600] text-base">⬆</span>
              <span className="text-white/60 text-xs font-bold">
                Share → Add to Home Screen
              </span>
            </div>
          ) : (
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
  useFirebaseNotifications();

  // Request notification permission after splash screen
  useEffect(() => {
    const timer = setTimeout(() => {
      requestNotificationPermission();
    }, 5000); // Ask after 5 seconds — not immediately on load
    return () => clearTimeout(timer);
  }, []);

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
