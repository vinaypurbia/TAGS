import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingBag, Check, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, addItem } = useCart();
  const [isRecentlyAdded, setIsRecentlyAdded] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        const found = data.find((p: any) => p._id === id);
        setProduct(found || null);
        if (found?.imageUrls?.length > 0) {
          setSelectedImage(found.imageUrls[0]);
        } else if (found?.imageUrl) {
          setSelectedImage(found.imageUrl);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-black font-black uppercase tracking-widest
