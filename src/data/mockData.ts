// ============================================
// Datos de Demostración - POS Digital Atelier
// ============================================

export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: 'paper' | 'writing' | 'art' | 'other';
  image: string;
  featured?: boolean;
  subtitle?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SalesDataPoint {
  hour: string;
  amount: number;
}

// Productos de ejemplo
export const products: Product[] = [
  {
    id: 1,
    name: 'Pluma Fuente Edición Limitada',
    price: 124.00,
    stock: 12,
    category: 'writing',
    image: '🖋️',
    featured: true,
    subtitle: 'Serie Platino #04',
  },
  {
    id: 2,
    name: 'Cuaderno Cuadrícula A5',
    price: 12.50,
    stock: 42,
    category: 'paper',
    image: '📓',
  },
  {
    id: 3,
    name: 'Set de Pasteles Artísticos',
    price: 45.00,
    stock: 8,
    category: 'art',
    image: '🎨',
  },
  {
    id: 4,
    name: 'Lápices de Grafito HB',
    price: 1.20,
    stock: 154,
    category: 'writing',
    image: '✏️',
  },
  {
    id: 5,
    name: 'Pincel de Detalle',
    price: 6.75,
    stock: 24,
    category: 'art',
    image: '🖌️',
  },
  {
    id: 6,
    name: 'Papel Acuarela A3',
    price: 18.90,
    stock: 35,
    category: 'paper',
    image: '📄',
  },
  {
    id: 7,
    name: 'Portaminas 0.5',
    price: 8.50,
    stock: 67,
    category: 'writing',
    image: '✏️',
  },
  {
    id: 8,
    name: 'Set de Pinturas Acrílicas',
    price: 32.00,
    stock: 15,
    category: 'art',
    image: '🎨',
  },
];

// Carrito de ejemplo
export const sampleCart: CartItem[] = [
  { product: products[1], quantity: 2 },  // Grid Notebook A5
  { product: products[0], quantity: 1 },  // Ltd Edition Pen
  { product: products[4], quantity: 1 },  // Detailing Brush
];

// Datos de ventas por hora (para el gráfico del dashboard)
export const salesByHour: SalesDataPoint[] = [
  { hour: '08:00', amount: 320 },
  { hour: '09:00', amount: 450 },
  { hour: '10:00', amount: 480 },
  { hour: '11:00', amount: 520 },
  { hour: '12:00', amount: 680 },
  { hour: '13:00', amount: 590 },
  { hour: '14:00', amount: 620 },
  { hour: '15:00', amount: 550 },
  { hour: '16:00', amount: 700 },
  { hour: '17:00', amount: 580 },
  { hour: '18:00', amount: 650 },
  { hour: '19:00', amount: 480 },
  { hour: '20:00', amount: 1200 },
];

// Datos del dashboard
export const dashboardData = {
  totalSales: 4820.50,
  ticketsGenerated: 142,
  ticketsGrowth: 12,
  avgTicketValue: 34.20,
  serviceSpeed: 2.4,
};

// Items de inventario bajo
export const lowStockItems = [
  { name: 'Set de Pasteles Artísticos', stock: 8, minStock: 15, category: 'Arte' },
  { name: 'Tinta para Pluma Fuente', stock: 3, minStock: 10, category: 'Escritura' },
  { name: 'Block de Dibujo A4', stock: 5, minStock: 12, category: 'Papel' },
  { name: 'Lienzo 40x50', stock: 4, minStock: 8, category: 'Arte' },
];

// Info del cajero
export const cashierInfo = {
  name: 'Alex Rivera',
  role: 'CAJERO',
  terminal: 'TERMINAL 04',
  store: 'Digital Atelier',
};
