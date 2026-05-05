export type Category = 'Toys' | 'Adventure Gear' | 'Gadgets' | 'Sports Items';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  specs: string[];
}

export const CATEGORIES: Category[] = ['Toys', 'Adventure Gear', 'Gadgets', 'Sports Items'];

export const PRODUCTS: Product[] = [
  {
    id: 'T001',
    name: 'Mega Building Blocks Set',
    description: 'A 500-piece building block set to enhance creativity and motor skills. Perfect for kids aged 4 and up.',
    price: 35.99,
    category: 'Toys',
    image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=800',
    specs: ['500 pieces', 'Non-toxic plastic', 'Ages 4+']
  },
  {
    id: 'T002',
    name: 'Interactive Robot Dog',
    description: 'Smart robotic dog that responds to voice commands, does tricks, and plays music.',
    price: 59.99,
    category: 'Toys',
    image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800',
    specs: ['Rechargeable battery', 'Voice recognition', 'Touch sensors']
  },
  {
    id: 'A001',
    name: 'Pro Explorer Backpack',
    description: 'Durable, water-resistant 45L backpack suitable for hiking, camping, and outdoor adventures.',
    price: 89.99,
    category: 'Adventure Gear',
    image: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&q=80&w=800',
    specs: ['45L capacity', 'Water-resistant', 'Ergonomic back support', 'Molle webbing']
  },
  {
    id: 'A002',
    name: 'All-Weather Camping Tent',
    description: 'Lightweight 3-person dome tent with rainfly and easy 5-minute setup.',
    price: 120.00,
    category: 'Adventure Gear',
    image: 'https://images.unsplash.com/photo-1504280390224-340788ee5c60?auto=format&fit=crop&q=80&w=800',
    specs: ['3-person capacity', 'Fiberglass poles', 'Rainfly included']
  },
  {
    id: 'G001',
    name: 'HD Drone with 4K Camera',
    description: 'Foldable quadcopter drone with 4K camera, real-time transmission, and auto-return feature.',
    price: 249.99,
    category: 'Gadgets',
    image: 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?auto=format&fit=crop&q=80&w=800',
    specs: ['4K Camera', '25 mins flight time', 'Altitude hold', 'One-key return']
  },
  {
    id: 'G002',
    name: 'Solar Power Bank 20000mAh',
    description: 'Rugged, waterproof portable charger with solar panels. Perfect for keeping your devices alive off-grid.',
    price: 45.00,
    category: 'Gadgets',
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&q=80&w=800',
    specs: ['20000mAh', 'Dual USB output', 'Waterproof & dustproof', 'Built-in LED flashlight']
  },
  {
    id: 'S001',
    name: 'Pro Grip Basketball',
    description: 'Official size and weight outdoor/indoor basketball with enhanced grip surface.',
    price: 29.50,
    category: 'Sports Items',
    image: 'https://images.unsplash.com/photo-1519861531473-920026076da6?auto=format&fit=crop&q=80&w=800',
    specs: ['Size 7 (Official)', 'Composite leather', 'Indoor/Outdoor use']
  },
  {
    id: 'S002',
    name: 'Adjustable Dumbbell Set',
    description: 'Space-saving adjustable dumbbells that combine 15 sets of weights into one, ranging from 5 to 52.5 lbs.',
    price: 199.99,
    category: 'Sports Items',
    image: 'https://images.unsplash.com/photo-1638204642436-b51fb1c5ee23?auto=format&fit=crop&q=80&w=800',
    specs: ['5, 7.5, 10... up to 52.5 lbs', 'Dial adjustment', 'Space-saving design']
  }
];
