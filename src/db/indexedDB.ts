import { ExpiryNotification, NotificationSettings, Product, StockMovement } from '../types/inventory';
import { getTodayDateString } from '../utils/expiry';

const DB_NAME = 'ShelfGuard_DB_v2';
const DB_VERSION = 2;

export interface BackupData {
  version: number;
  exportedAt: string;
  products: Product[];
  movements: StockMovement[];
  notifications: ExpiryNotification[];
  settings?: NotificationSettings;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  browserPushEnabled: false,
  reminderIntervals: {
    d30: true,
    d15: true,
    d7: true,
    d3: true,
    d1: true,
    d0: true,
    dailyExpired: true,
  },
  lowStockAlerts: true,
  dailyShiftBriefing: true,
};

export const INITIAL_CATEGORIES = [
  'Dairy & Eggs',
  'Bakery & Deli',
  'Meat & Seafood',
  'Fresh Produce',
  'Pantry & Canned',
  'Beverages & Juices',
  'Frozen Foods',
  'Snacks & Confectionery',
  'Health & Personal Care',
  'Household & Cleaning',
];

export const INITIAL_LOCATIONS = [
  'Aisle 1 - Dairy Chiller A',
  'Aisle 1 - Dairy Chiller B',
  'Aisle 2 - Fresh Bakery Shelf 1',
  'Aisle 2 - Fresh Bakery Shelf 2',
  'Aisle 3 - Chilled Meat Display',
  'Aisle 4 - Organic Produce Cooler',
  'Aisle 5 - Dry Goods Shelf C3',
  'Aisle 6 - Beverage Cooler Bay 2',
  'Backroom - Walk-in Refrigerator',
  'Backroom - Dry Stock Rack D4',
];

// Helper to open DB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('category', 'category', { unique: false });
        prodStore.createIndex('sku', 'sku', { unique: false });
        prodStore.createIndex('barcode', 'barcode', { unique: false });
        prodStore.createIndex('isArchived', 'isArchived', { unique: false });
      }

      // Movements store
      if (!db.objectStoreNames.contains('movements')) {
        const moveStore = db.createObjectStore('movements', { keyPath: 'id' });
        moveStore.createIndex('productId', 'productId', { unique: false });
        moveStore.createIndex('timestamp', 'timestamp', { unique: false });
        moveStore.createIndex('type', 'type', { unique: false });
      }

      // Notifications store
      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notifStore.createIndex('read', 'read', { unique: false });
        notifStore.createIndex('timestamp', 'timestamp', { unique: false });
        notifStore.createIndex('severity', 'severity', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generate realistic supermarket seed data
function generateSeedData(): Product[] {
  const today = new Date();
  
  const formatDateOffset = (days: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  return [
    {
      id: 'prod-milk-001',
      name: 'Organic Whole Milk 1 Gallon',
      sku: 'DAI-MLK-001',
      barcode: '071234500112',
      category: 'Dairy & Eggs',
      brand: 'Clover Valley',
      supplier: 'Fresh Valley Dairies',
      purchasePrice: 2.80,
      sellingPrice: 4.49,
      minStockLevel: 15,
      location: 'Aisle 1 - Dairy Chiller A',
      image: '🥛',
      notes: 'Keep chilled below 38°F. High turnaround item.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-milk-1',
          productId: 'prod-milk-001',
          batchNumber: 'LOT-9921',
          quantity: 6,
          mfgDate: formatDateOffset(-10),
          expiryDate: formatDateOffset(2), // Urgent: 2 days left
          receivedDate: formatDateOffset(-8),
          location: 'Front Facing Shelf A1',
          costPrice: 2.80,
        },
        {
          id: 'b-milk-2',
          productId: 'prod-milk-001',
          batchNumber: 'LOT-9945',
          quantity: 24,
          mfgDate: formatDateOffset(-4),
          expiryDate: formatDateOffset(9), // Critical: 9 days left
          receivedDate: formatDateOffset(-2),
          location: 'Behind Front Batch',
          costPrice: 2.80,
        },
        {
          id: 'b-milk-3',
          productId: 'prod-milk-001',
          batchNumber: 'LOT-9980',
          quantity: 36,
          mfgDate: formatDateOffset(-1),
          expiryDate: formatDateOffset(18), // Warning: 18 days left
          receivedDate: formatDateOffset(0),
          location: 'Backroom - Walk-in Refrigerator',
          costPrice: 2.80,
        },
      ],
    },
    {
      id: 'prod-yogurt-002',
      name: 'Greek Yogurt Plain 500g',
      sku: 'DAI-YOG-002',
      barcode: '071234500228',
      category: 'Dairy & Eggs',
      brand: 'Olympus Pure',
      supplier: 'Aegean Imports',
      purchasePrice: 2.10,
      sellingPrice: 3.89,
      minStockLevel: 12,
      location: 'Aisle 1 - Dairy Chiller B',
      image: '🥣',
      notes: 'Check foil seal during receiving.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-yogurt-1',
          productId: 'prod-yogurt-002',
          batchNumber: 'LOT-8812',
          quantity: 5,
          mfgDate: formatDateOffset(-25),
          expiryDate: formatDateOffset(-2), // Expired 2 days ago!
          receivedDate: formatDateOffset(-20),
          location: 'Quarantine Rack Q1',
          costPrice: 2.10,
          notes: 'Expired batch needs write-off / vendor credit return',
        },
        {
          id: 'b-yogurt-2',
          productId: 'prod-yogurt-002',
          batchNumber: 'LOT-8890',
          quantity: 18,
          mfgDate: formatDateOffset(-5),
          expiryDate: formatDateOffset(21), // Warning
          receivedDate: formatDateOffset(-3),
          location: 'Aisle 1 - Dairy Chiller B',
          costPrice: 2.10,
        },
      ],
    },
    {
      id: 'prod-bread-003',
      name: 'Sliced Sourdough Artisan Loaf',
      sku: 'BAK-SRD-003',
      barcode: '071234500335',
      category: 'Bakery & Deli',
      brand: 'Golden Hearth',
      supplier: 'Metro Artisan Bakers',
      purchasePrice: 1.95,
      sellingPrice: 4.29,
      minStockLevel: 8,
      location: 'Aisle 2 - Fresh Bakery Shelf 1',
      image: '🍞',
      notes: 'Daily baked fresh bread. Remove same-day end of shift.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-bread-1',
          productId: 'prod-bread-003',
          batchNumber: 'LOT-B701',
          quantity: 4,
          mfgDate: formatDateOffset(-3),
          expiryDate: formatDateOffset(0), // Expires Today!
          receivedDate: formatDateOffset(-3),
          location: 'Clearance Endcap 2',
          costPrice: 1.95,
          notes: 'Apply 40% quick-sale discount sticker',
        },
        {
          id: 'b-bread-2',
          productId: 'prod-bread-003',
          batchNumber: 'LOT-B715',
          quantity: 16,
          mfgDate: formatDateOffset(0),
          expiryDate: formatDateOffset(4), // Urgent: 4 days
          receivedDate: formatDateOffset(0),
          location: 'Aisle 2 - Fresh Bakery Shelf 1',
          costPrice: 1.95,
        },
      ],
    },
    {
      id: 'prod-salmon-004',
      name: 'Fresh Atlantic Salmon Fillet 400g',
      sku: 'MEA-SLM-004',
      barcode: '071234500441',
      category: 'Meat & Seafood',
      brand: 'Ocean Catch',
      supplier: 'Nordic Coast Seafood',
      purchasePrice: 6.50,
      sellingPrice: 11.99,
      minStockLevel: 10,
      location: 'Aisle 3 - Chilled Meat Display',
      image: '🐟',
      notes: 'Store over crushed ice, temp 32-34°F.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-salmon-1',
          productId: 'prod-salmon-004',
          batchNumber: 'LOT-SEA-10',
          quantity: 3,
          mfgDate: formatDateOffset(-4),
          expiryDate: formatDateOffset(1), // Expires Tomorrow (Urgent)
          receivedDate: formatDateOffset(-3),
          location: 'Front Seafood Display',
          costPrice: 6.50,
        },
        {
          id: 'b-salmon-2',
          productId: 'prod-salmon-004',
          batchNumber: 'LOT-SEA-12',
          quantity: 14,
          mfgDate: formatDateOffset(-1),
          expiryDate: formatDateOffset(5), // Urgent: 5 days
          receivedDate: formatDateOffset(0),
          location: 'Seafood Cold Room',
          costPrice: 6.50,
        },
      ],
    },
    {
      id: 'prod-spinach-005',
      name: 'Organic Baby Spinach Clamshell 200g',
      sku: 'PRO-SPN-005',
      barcode: '071234500557',
      category: 'Fresh Produce',
      brand: 'Earth Greens',
      supplier: 'SunValley Organics',
      purchasePrice: 1.60,
      sellingPrice: 3.49,
      minStockLevel: 14,
      location: 'Aisle 4 - Organic Produce Cooler',
      image: '🥗',
      notes: 'Inspect for moisture or leaf wilting.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-spinach-1',
          productId: 'prod-spinach-005',
          batchNumber: 'LOT-EG-802',
          quantity: 6,
          mfgDate: formatDateOffset(-7),
          expiryDate: formatDateOffset(3), // Urgent: 3 days
          receivedDate: formatDateOffset(-5),
          location: 'Produce Tier 1',
          costPrice: 1.60,
        },
        {
          id: 'b-spinach-2',
          productId: 'prod-spinach-005',
          batchNumber: 'LOT-EG-840',
          quantity: 22,
          mfgDate: formatDateOffset(-2),
          expiryDate: formatDateOffset(10), // Critical: 10 days
          receivedDate: formatDateOffset(-1),
          location: 'Produce Tier 2',
          costPrice: 1.60,
        },
      ],
    },
    {
      id: 'prod-eggs-006',
      name: 'Free-Range Grade A Large Brown Eggs 12ct',
      sku: 'DAI-EGG-006',
      barcode: '071234500663',
      category: 'Dairy & Eggs',
      brand: 'Pasture Gold',
      supplier: 'Highland Farm Coop',
      purchasePrice: 2.20,
      sellingPrice: 4.89,
      minStockLevel: 20,
      location: 'Aisle 1 - Dairy Chiller B',
      image: '🥚',
      notes: 'Inspect cartons for cracked eggs before stocking.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-egg-1',
          productId: 'prod-eggs-006',
          batchNumber: 'LOT-PG-301',
          quantity: 15,
          mfgDate: formatDateOffset(-14),
          expiryDate: formatDateOffset(13), // Critical: 13 days
          receivedDate: formatDateOffset(-12),
          location: 'Aisle 1 - Lower Shelf',
          costPrice: 2.20,
        },
        {
          id: 'b-egg-2',
          productId: 'prod-eggs-006',
          batchNumber: 'LOT-PG-388',
          quantity: 35,
          mfgDate: formatDateOffset(-2),
          expiryDate: formatDateOffset(28), // Warning: 28 days
          receivedDate: formatDateOffset(0),
          location: 'Backroom Refrigerator',
          costPrice: 2.20,
        },
      ],
    },
    {
      id: 'prod-pasta-007',
      name: 'Organic Tomato Basil Pasta Sauce 680g',
      sku: 'PAN-PST-007',
      barcode: '071234500779',
      category: 'Pantry & Canned',
      brand: 'Nonna Mia',
      supplier: 'Tuscan Food Importers',
      purchasePrice: 2.40,
      sellingPrice: 4.99,
      minStockLevel: 10,
      location: 'Aisle 5 - Dry Goods Shelf C3',
      image: '🥫',
      notes: 'Glass jar. Inspect vacuum pop button on lid.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-pasta-1',
          productId: 'prod-pasta-007',
          batchNumber: 'LOT-NM-501',
          quantity: 28,
          mfgDate: formatDateOffset(-60),
          expiryDate: formatDateOffset(180), // Safe
          receivedDate: formatDateOffset(-50),
          location: 'Aisle 5 - Middle Shelf',
          costPrice: 2.40,
        },
      ],
    },
    {
      id: 'prod-water-008',
      name: 'Italian Sparkling Mineral Water 6x500ml',
      sku: 'BEV-WTR-008',
      barcode: '071234500885',
      category: 'Beverages & Juices',
      brand: 'San Fontana',
      supplier: 'Alpine Springs Beverage',
      purchasePrice: 3.50,
      sellingPrice: 6.79,
      minStockLevel: 12,
      location: 'Aisle 6 - Beverage Cooler Bay 2',
      image: '🍾',
      notes: 'Heavy six-packs. Keep bottom shelf for safety.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-water-1',
          productId: 'prod-water-008',
          batchNumber: 'LOT-SF-911',
          quantity: 42,
          mfgDate: formatDateOffset(-90),
          expiryDate: formatDateOffset(240), // Safe
          receivedDate: formatDateOffset(-70),
          location: 'Aisle 6 - Beverage Floor Base',
          costPrice: 3.50,
        },
      ],
    },
    {
      id: 'prod-croissant-009',
      name: 'Butter Croissants 4-Pack Bakery Fresh',
      sku: 'BAK-CRS-009',
      barcode: '071234500991',
      category: 'Bakery & Deli',
      brand: 'Golden Hearth',
      supplier: 'Metro Artisan Bakers',
      purchasePrice: 2.10,
      sellingPrice: 4.99,
      minStockLevel: 6,
      location: 'Aisle 2 - Fresh Bakery Shelf 2',
      image: '🥐',
      notes: 'Short shelf life. Prioritize FEFO.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-croissant-1',
          productId: 'prod-croissant-009',
          batchNumber: 'LOT-CRS-02',
          quantity: 5,
          mfgDate: formatDateOffset(-2),
          expiryDate: formatDateOffset(1), // Expires Tomorrow
          receivedDate: formatDateOffset(-2),
          location: 'Bakery Front Table',
          costPrice: 2.10,
        },
      ],
    },
    {
      id: 'prod-beef-010',
      name: 'USDA Choice Ground Beef 85/15 1lb',
      sku: 'MEA-BEEF-010',
      barcode: '071234501004',
      category: 'Meat & Seafood',
      brand: 'Prime Cuts',
      supplier: 'Midwest Cattle Supply',
      purchasePrice: 4.20,
      sellingPrice: 6.99,
      minStockLevel: 15,
      location: 'Aisle 3 - Chilled Meat Display',
      image: '🥩',
      notes: 'Strict temp monitoring. Rotate daily.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: [
        {
          id: 'b-beef-1',
          productId: 'prod-beef-010',
          batchNumber: 'LOT-BEEF-404',
          quantity: 7,
          mfgDate: formatDateOffset(-4),
          expiryDate: formatDateOffset(-1), // Expired yesterday!
          receivedDate: formatDateOffset(-3),
          location: 'Cold Storage Holding',
          costPrice: 4.20,
          notes: 'Expired batch flagged for bio-waste log',
        },
        {
          id: 'b-beef-2',
          productId: 'prod-beef-010',
          batchNumber: 'LOT-BEEF-418',
          quantity: 19,
          mfgDate: formatDateOffset(-1),
          expiryDate: formatDateOffset(3), // Urgent: 3 days
          receivedDate: formatDateOffset(0),
          location: 'Aisle 3 - Chilled Meat Display',
          costPrice: 4.20,
        },
      ],
    },
  ];
}

function generateInitialMovements(): StockMovement[] {
  const now = new Date();
  return [
    {
      id: 'mov-init-1',
      productId: 'prod-milk-001',
      productName: 'Organic Whole Milk 1 Gallon',
      batchNumber: 'LOT-9980',
      type: 'stock_in',
      quantity: 36,
      previousStock: 30,
      newStock: 66,
      reason: 'Standard weekly replenishment delivery from Fresh Valley',
      staffName: 'Marcus Store Clerk',
      timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
      referenceDoc: 'PO-88219',
    },
    {
      id: 'mov-init-2',
      productId: 'prod-yogurt-002',
      productName: 'Greek Yogurt Plain 500g',
      batchNumber: 'LOT-8812',
      type: 'expired_writeoff',
      quantity: -5,
      previousStock: 28,
      newStock: 23,
      reason: 'Quarantine expired batch LOT-8812 for disposal documentation',
      staffName: 'Elena Inventory Lead',
      timestamp: new Date(now.getTime() - 14 * 3600000).toISOString(),
      referenceDoc: 'EXP-LOG-041',
    },
    {
      id: 'mov-init-3',
      productId: 'prod-bread-003',
      productName: 'Sliced Sourdough Artisan Loaf',
      batchNumber: 'LOT-B701',
      type: 'adjustment',
      quantity: -2,
      previousStock: 22,
      newStock: 20,
      reason: 'Cycle count discrepancy check (damaged packaging write-off)',
      staffName: 'Marcus Store Clerk',
      timestamp: new Date(now.getTime() - 22 * 3600000).toISOString(),
    },
  ];
}

// Database Operations
export async function getAllProducts(): Promise<Product[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const req = store.getAll();

    req.onsuccess = async () => {
      let results: Product[] = req.result || [];
      if (results.length === 0) {
        // First run: seed database with realistic products
        const seed = generateSeedData();
        await saveProducts(seed);
        const seedMovements = generateInitialMovements();
        await saveMovements(seedMovements);
        results = seed;
      }
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    product.updatedAt = new Date().toISOString();
    const req = store.put(product);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveProducts(products: Product[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    products.forEach(p => store.put(p));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const req = store.delete(productId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMovements(): Promise<StockMovement[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('movements', 'readonly');
    const store = tx.objectStore('movements');
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      // Sort newest first
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addStockMovement(movement: StockMovement): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('movements', 'readwrite');
    const store = tx.objectStore('movements');
    const req = store.put(movement);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveMovements(movements: StockMovement[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('movements', 'readwrite');
    const store = tx.objectStore('movements');
    movements.forEach(m => store.put(m));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllNotifications(): Promise<ExpiryNotification[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readonly');
    const store = tx.objectStore('notifications');
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveNotification(notification: ExpiryNotification): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const req = store.put(notification);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveNotifications(notifications: ExpiryNotification[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    notifications.forEach(n => store.put(n));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.read = true;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const req = store.getAll();
    req.onsuccess = () => {
      const list: ExpiryNotification[] = req.result || [];
      list.forEach(item => {
        if (!item.read) {
          item.read = true;
          store.put(item);
        }
      });
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearReadNotifications(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const req = store.getAll();
    req.onsuccess = () => {
      const list: ExpiryNotification[] = req.result || [];
      list.forEach(item => {
        if (item.read) {
          store.delete(item.id);
        }
      });
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// Settings operations
export async function getSettings(): Promise<NotificationSettings> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get('notification_settings');
    req.onsuccess = () => {
      if (req.result && req.result.value) {
        resolve({ ...DEFAULT_NOTIFICATION_SETTINGS, ...req.result.value });
      } else {
        resolve(DEFAULT_NOTIFICATION_SETTINGS);
      }
    };
    req.onerror = () => resolve(DEFAULT_NOTIFICATION_SETTINGS);
  });
}

export async function saveSettings(settings: NotificationSettings): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key: 'notification_settings', value: settings });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Full Backup and Restore
export async function exportFullDatabaseBackup(): Promise<BackupData> {
  const products = await getAllProducts();
  const movements = await getAllMovements();
  const notifications = await getAllNotifications();
  const settings = await getSettings();

  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    movements,
    notifications,
    settings,
  };
}

export async function restoreDatabaseFromBackup(backup: BackupData): Promise<boolean> {
  if (!backup || !Array.isArray(backup.products)) {
    throw new Error('Invalid backup file structure: missing products array.');
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['products', 'movements', 'notifications', 'settings'], 'readwrite');

    const prodStore = tx.objectStore('products');
    const moveStore = tx.objectStore('movements');
    const notifStore = tx.objectStore('notifications');
    const setStore = tx.objectStore('settings');

    // Clear existing to avoid ID collisions
    prodStore.clear();
    moveStore.clear();
    notifStore.clear();

    backup.products.forEach(p => prodStore.put(p));
    if (Array.isArray(backup.movements)) {
      backup.movements.forEach(m => moveStore.put(m));
    }
    if (Array.isArray(backup.notifications)) {
      backup.notifications.forEach(n => notifStore.put(n));
    }
    if (backup.settings) {
      setStore.put({ key: 'notification_settings', value: backup.settings });
    }

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Reset to initial demo data
export async function resetToDemoData(): Promise<Product[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['products', 'movements', 'notifications'], 'readwrite');
    tx.objectStore('products').clear();
    tx.objectStore('movements').clear();
    tx.objectStore('notifications').clear();

    const seedProds = generateSeedData();
    seedProds.forEach(p => tx.objectStore('products').put(p));

    const seedMoves = generateInitialMovements();
    seedMoves.forEach(m => tx.objectStore('movements').put(m));

    tx.oncomplete = () => resolve(seedProds);
    tx.onerror = () => reject(tx.error);
  });
}
