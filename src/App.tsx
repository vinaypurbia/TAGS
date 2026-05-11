import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { OrderSummary } from './pages/OrderSummary';
import { ManageCategories } from './pages/ManageCategories';
import { Contact } from './pages/Contact';
import { AdminPanel } from './pages/AdminPanel';
import EditProductForm from './pages/EditProductForm';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          {/* Admin panel — full screen, outside Layout */}
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
      </CartProvider>
    </BrowserRouter>
  );
}
