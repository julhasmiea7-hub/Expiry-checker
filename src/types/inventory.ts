export type ExpiryStatus = 
  | 'safe'           // > 30 days
  | 'warning'        // 15–30 days
  | 'critical'       // 7–14 days
  | 'urgent'         // 1–6 days
  | 'expires_today'  // 0 days
  | 'expired';       // < 0 days

export interface ProductBatch {
  id: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  mfgDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  receivedDate: string; // ISO string
  location?: string; // e.g., "Aisle 3 - Shelf B2"
  costPrice?: number;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string; // Product Code
  barcode?: string;
  category: string;
  brand: string;
  supplier: string;
  purchasePrice: number;
  sellingPrice: number;
  minStockLevel: number;
  location: string; // Storage Location / Shelf Number
  image?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  batches: ProductBatch[];
}

export type MovementType = 
  | 'stock_in' 
  | 'stock_out' 
  | 'adjustment' 
  | 'damaged' 
  | 'expired_writeoff' 
  | 'return';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  batchId?: string;
  batchNumber?: string;
  type: MovementType;
  quantity: number; // Signed delta (e.g., +20 or -5)
  previousStock: number;
  newStock: number;
  reason: string;
  staffName: string;
  timestamp: string;
  referenceDoc?: string;
}

export type AlertSeverity = 'critical' | 'urgent' | 'warning' | 'info';

export interface ExpiryNotification {
  id: string;
  type: 'expiry_alert' | 'low_stock' | 'stock_movement' | 'system';
  title: string;
  message: string;
  productId?: string;
  productName?: string;
  batchId?: string;
  batchNumber?: string;
  daysRemaining?: number;
  severity: AlertSeverity;
  read: boolean;
  timestamp: string;
  reminderInterval?: number; // 30, 15, 7, 3, 1, 0, or -1 (daily expired)
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  browserPushEnabled: boolean;
  reminderIntervals: {
    d30: boolean;
    d15: boolean;
    d7: boolean;
    d3: boolean;
    d1: boolean;
    d0: boolean;
    dailyExpired: boolean;
  };
  lowStockAlerts: boolean;
  dailyShiftBriefing: boolean;
}

export interface DashboardStats {
  totalProducts: number;
  totalStockQuantity: number;
  expiredCount: number;
  expiredUnits: number;
  expiresTodayCount: number;
  expires7DaysCount: number;
  expires15DaysCount: number;
  expires30DaysCount: number;
  safeCount: number;
  lowStockCount: number;
  totalValuation: number;
  potentialLossValue: number;
}
