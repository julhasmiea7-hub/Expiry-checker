import { ExpiryStatus, Product, ProductBatch } from '../types/inventory';

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  return new Date(dateStr);
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateDaysRemaining(expiryDateStr: string): number {
  if (!expiryDateStr) return 9999;
  const expDate = parseLocalDate(expiryDateStr);
  const todayStr = getTodayDateString();
  const todayDate = parseLocalDate(todayStr);

  const diffMs = expDate.getTime() - todayDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(daysRemaining: number): ExpiryStatus {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining === 0) return 'expires_today';
  if (daysRemaining >= 1 && daysRemaining <= 6) return 'urgent';
  if (daysRemaining >= 7 && daysRemaining <= 14) return 'critical';
  if (daysRemaining >= 15 && daysRemaining <= 30) return 'warning';
  return 'safe';
}

export interface ExpiryStatusConfig {
  status: ExpiryStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  pillColor: string;
  priority: number;
}

export function getExpiryStatusConfig(status: ExpiryStatus): ExpiryStatusConfig {
  switch (status) {
    case 'expired':
      return {
        status,
        label: 'Expired',
        badgeBg: 'bg-rose-500/15',
        badgeText: 'text-rose-400',
        borderColor: 'border-rose-500/40',
        pillColor: 'bg-rose-500',
        priority: 1,
      };
    case 'expires_today':
      return {
        status,
        label: 'Expires Today',
        badgeBg: 'bg-red-500/20',
        badgeText: 'text-red-400',
        borderColor: 'border-red-500/50',
        pillColor: 'bg-red-500',
        priority: 2,
      };
    case 'urgent':
      return {
        status,
        label: 'Urgent (1–6d)',
        badgeBg: 'bg-amber-500/20',
        badgeText: 'text-amber-300',
        borderColor: 'border-amber-500/50',
        pillColor: 'bg-amber-500',
        priority: 3,
      };
    case 'critical':
      return {
        status,
        label: 'Critical (7–14d)',
        badgeBg: 'bg-orange-500/20',
        badgeText: 'text-orange-300',
        borderColor: 'border-orange-500/40',
        pillColor: 'bg-orange-500',
        priority: 4,
      };
    case 'warning':
      return {
        status,
        label: 'Warning (15–30d)',
        badgeBg: 'bg-yellow-500/15',
        badgeText: 'text-yellow-300',
        borderColor: 'border-yellow-500/30',
        pillColor: 'bg-yellow-400',
        priority: 5,
      };
    case 'safe':
    default:
      return {
        status,
        label: 'Safe (>30d)',
        badgeBg: 'bg-emerald-500/15',
        badgeText: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        pillColor: 'bg-emerald-500',
        priority: 6,
      };
  }
}

export function formatExpiryRelative(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return `Expired ${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (daysRemaining === 0) {
    return 'Expires Today!';
  }
  if (daysRemaining === 1) {
    return 'Expires Tomorrow';
  }
  return `${daysRemaining} days left`;
}

export function getProductTotalStock(product: Product): number {
  if (!product.batches || product.batches.length === 0) return 0;
  return product.batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
}

export function getProductEarliestBatch(product: Product): {
  batch: ProductBatch | null;
  daysRemaining: number;
  status: ExpiryStatus;
} {
  const activeBatches = (product.batches || []).filter(b => (b.quantity || 0) > 0);
  if (activeBatches.length === 0) {
    // If no stock, pick the latest batch or null
    if (product.batches && product.batches.length > 0) {
      const b = product.batches[0];
      const days = calculateDaysRemaining(b.expiryDate);
      return { batch: b, daysRemaining: days, status: getExpiryStatus(days) };
    }
    return { batch: null, daysRemaining: 9999, status: 'safe' };
  }

  // Sort by expiry date ascending (FEFO)
  const sorted = [...activeBatches].sort((a, b) => {
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  const earliest = sorted[0];
  const days = calculateDaysRemaining(earliest.expiryDate);
  return {
    batch: earliest,
    daysRemaining: days,
    status: getExpiryStatus(days),
  };
}

// First Expiry First Out (FEFO) sorting
export function getFEFOSortedBatches(batches: ProductBatch[]): ProductBatch[] {
  return [...batches].sort((a, b) => {
    // Active stock first
    const aStock = a.quantity > 0 ? 1 : 0;
    const bStock = b.quantity > 0 ? 1 : 0;
    if (aStock !== bStock) return bStock - aStock;

    // Earliest expiry date first
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });
}
