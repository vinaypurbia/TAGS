export interface Product {
  id: string;
  _id: string; // Added to fix error in image_f288da6.png
  name: string;
  description: string;
  price: number;
  originalPrice: number; // Added for catalog calculations
  discountedPrice?: number; // Added for catalog calculations
  category: string;
  image: string;
  imageUrl: string; // Added to match Catalog.tsx usage
  videoUrl?: string;
  specs: string[]; // Added to fix error in image_f286dd.png
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
    _id: '1',
    name: 'Wireless Earbuds Pro',
    description: 'High quality wireless earbuds with noise cancellation and 24hr battery life.',
    price: 49.99,
    originalPrice: 49.99,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800',
    specs: ['Active Noise Cancellation', 'Bluetooth 5.3', '24h Battery Life']
  },
  {
    id: '2',
    _id: '2',
    name: 'Portable Power Bank',
    description: 'Ultra compact 20,000mAh power bank with fast charging support.',
    price: 34.99,
    originalPrice: 34.99,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&q=80&w=800',
    specs: ['20,000mAh Capacity', 'USB-C PD Output', 'LED Indicator']
  },
  {
    id: '3',
    _id: '3',
    name: 'Car Phone Mount',
    description: 'Universal magnetic car mount compatible with all smartphones.',
    price: 19.99,
    originalPrice: 19.99,
    category: 'Automotive',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=800',
    specs: ['Strong Magnet', '360° Rotation', 'Easy Installation']
  },
  {
    id: '4',
    _id: '4',
    name: 'Dash Cam HD',
    description: '1080p dash camera with night vision and wide angle lens.',
    price: 59.99,
    originalPrice: 59.99,
    category: 'Automotive',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=800',
    specs: ['1080p Full HD', 'Wide Angle Lens', 'Night Vision']
  },
  {
    id: '5',
    _id: '5',
    name: 'Travel Neck Pillow',
    description: 'Memory foam travel pillow with adjustable support for long journeys.',
    price: 24.99,
    originalPrice: 24.99,
    category: 'Travel Gear',
    image: 'https://images.unsplash.com/photo-1504280390224-340788ee5c60?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1504280390224-340788ee5c60?auto=format&fit=crop&q=80&w=800',
    specs: ['Memory Foam', 'Washable Cover', 'Adjustable Strap']
  },
  {
    id: '6',
    _id: '6',
    name: 'Packing Cubes Set',
    description: 'Set of 6 lightweight packing cubes to organize your luggage perfectly.',
    price: 29.99,
    originalPrice: 29.99,
    category: 'Travel Gear',
    image: 'https://images.unsplash.com/photo-1581553673739-c4906b5d0de8?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1581553673739-c4906b5d0de8?auto=format&fit=crop&q=80&w=800',
    specs: ['Set of 6', 'Durable Mesh', 'Water Resistant']
  },
  {
    id: '7',
    _id: '7',
    name: 'Remote Control Car',
    description: 'High speed RC car with 4WD and rechargeable battery, great for kids.',
    price: 39.99,
    originalPrice: 39.99,
    category: 'Toys',
    image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
    specs: ['4WD System', 'Rechargeable Battery', 'Max Speed 15km/h']
  },
  {
    id: '8',
    _id: '8',
    name: 'Building Blocks Set',
    description: 'Creative 500-piece building blocks set for children aged 6 and above.',
    price: 34.99,
    originalPrice: 34.99,
    category: 'Toys',
    image: 'https://images.unsplash.com/photo-1519861531473-920026076da6?auto=format&fit=crop&q=80&w=800',
    imageUrl: 'https://images.unsplash.com/photo-1519861531473-920026076da6?auto=format&fit=crop&q=80&w=800',
    specs: ['500 Pieces', 'Non-Toxic ABS Material', 'Instruction Manual']
  }
];

export const products = PRODUCTS;
