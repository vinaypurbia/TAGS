import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { OrderSummary } from './pages/OrderSummary';
import { ManageCategories } from './pages/ManageCategories';
import { Contact } from './pages/Contact';
import { AdminPanel } from './pages/AdminPanel';
import EditProductForm from './pages/EditProductForm';

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
      <CartProvider>
        <AppDataProvider>
          <AppShell />
        </AppDataProvider>
      </CartProvider>
    </BrowserRouter>
  );
}
