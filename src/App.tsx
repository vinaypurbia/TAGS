import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { OrderSummary } from './pages/OrderSummary';
import AddProductForm from './components/AddProductForm';
import { ManageCategories } from './pages/ManageCategories';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Catalog />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/order" element={<OrderSummary />} />
            <Route path="/add-product" element={<AddProductForm />} />
            <Route path="/manage-categories" element={<ManageCategories />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Layout>
      </CartProvider>
    </BrowserRouter>
  );
}
