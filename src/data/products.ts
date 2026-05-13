export interface Product {
  id: string;
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  discountedPrice?: number;
  category: string;
  image: string;
  imageUrl: string;
  videoUrl?: string;
  specs: string[];
}

export const CATEGORIES = [
  'Electronics',
  'Automotive',
  'Travel Gear',
  'Toys'
];

// Parse Meta price string like "₹3,500.00" or "3500 INR" → number
function parseMetaPrice(priceStr: string): number {
  if (!priceStr) return 0;
  return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
}

// Fetch live products from Meta Catalog API
export async function fetchProducts(): Promise<Product[]> {
  const CATALOG_ID = '1901314136807871';
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    console.error('META_ACCESS_TOKEN is not set in environment variables');
    return [];
  }

  try {
    const url = `https://graph.facebook.com/v25.0/${CATALOG_ID}/products?fields=id,name,description,price,sale_price,image_url,url,availability,category&access_token=${ACCESS_TOKEN}`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hour

    if (!res.ok) {
      console.error('Meta API error:', res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const metaProducts = data.data || [];

    return metaProducts.map((mp: any): Product => {
      const price = parseMetaPrice(mp.price);
      const salePrice = mp.sale_price ? parseMetaPrice(mp.sale_price) : undefined;

      return {
        id: mp.id,
        _id: mp.id,
        name: mp.name || '',
        description: mp.description || '',
        price: salePrice ?? price,
        originalPrice: price,
        discountedPrice: salePrice,
        category: mp.category || 'General',
        image: mp.image_url || '',
        imageUrl: mp.image_url || '',
        specs: [],
      };
    });
  } catch (err) {
    console.error('Failed to fetch Meta products:', err);
    return [];
  }
}

// For backward compatibility — use fetchProducts() instead in async contexts
export const PRODUCTS: Product[] = [];
export const products = PRODUCTS;
