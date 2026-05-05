export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  videoUrl?: string;
}

export const CATEGORIES = [
  'Electronics',
  'Automotive',
  'Travel Gear',
  'Toys'
];

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Wireless Earbuds Pro',
    description: 'High quality wireless earbuds with noise cancellation and 24hr battery life.',
    price: 49.99,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '2',
    name: 'Portable Power Bank',
    description: 'Ultra compact 20,000mAh power bank with fast charging support.',
    price: 34.99,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '3',
    name: 'Car Phone Mount',
    description: 'Universal magnetic car mount compatible with all smartphones.',
    price: 19.99,
    category: 'Automotive',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '4',
    name: 'Dash Cam HD',
    description: '1080p dash camera with night vision and wide angle lens.',
    price: 59.99,
    category: 'Automotive',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '5',
    name: 'Travel Neck Pillow',
    description: 'Memory foam travel pillow with adjustable support for long journeys.',
    price: 24.99,
    category: 'Travel Gear',
    image: 'https://images.unsplash.com/photo-1504280390224-340788ee5c60?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '6',
    name: 'Packing Cubes Set',
    description: 'Set of 6 lightweight packing cubes to organize your luggage perfectly.',
    price: 29.99,
    category: 'Travel Gear',
    image: 'https://images.unsplash.com/photo-1581553673739-c4906b5d0de8?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '7',
    name: 'Remote Control Car',
    description: 'High speed RC car with 4WD and rechargeable battery, great for kids.',
    price: 39.99,
    category: 'Toys',
    image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '8',
    name: 'Building Blocks Set',
    description: 'Creative 500-piece building blocks set for children aged 6 and above.',
    price: 34.99,
    category: 'Toys',
    image: 'https://images.unsplash.com/photo-1519861531473-920026076da6?auto=format&fit=crop&q=80&w=800',
  },
];

// Keep backward compatibility
export const products = PRODUCTS;
