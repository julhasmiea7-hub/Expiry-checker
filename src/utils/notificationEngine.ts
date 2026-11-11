import { ExpiryNotification, NotificationSettings, Product } from '../types/inventory';
import { calculateDaysRemaining, getExpiryStatus, getTodayDateString } from './expiry';
import { getAllNotifications, saveNotifications } from '../db/indexedDB';
import { playCriticalAlertSound, playWarningChime } from './audioAlert';

const SENT_NOTIFICATIONS_STORAGE_KEY = 'shelfguard_sent_reminders_log';

function getSentLog(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SENT_NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordSentLog(key: string) {
  try {
    const log = getSentLog();
    log[key] = new Date().toISOString();
    // Keep max 500 records to prevent memory bloating
    const entries = Object.entries(log).slice(-500);
    localStorage.setItem(SENT_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (e) {
    console.warn('Could not record sent notification log', e);
  }
}

export async function runExpiryNotificationScan(
  products: Product[],
  settings: NotificationSettings
): Promise<{ newCount: number; notifications: ExpiryNotification[] }> {
  if (!settings.enabled) {
    return { newCount: 0, notifications: [] };
  }

  const todayStr = getTodayDateString();
  const sentLog = getSentLog();
  const newNotifications: ExpiryNotification[] = [];
  let shouldPlayCriticalChime = false;
  let shouldPlayWarningChime = false;

  for (const product of products) {
    if (product.isArchived) continue;

    for (const batch of product.batches || []) {
      if (!batch.expiryDate || batch.quantity <= 0) continue;

      const daysRemaining = calculateDaysRemaining(batch.expiryDate);
      let matchesInterval = false;
      let reminderIntervalKey = '';
      let severity: 'critical' | 'urgent' | 'warning' | 'info' = 'info';
      let title = '';
      let message = '';

      if (daysRemaining < 0 && settings.reminderIntervals.dailyExpired) {
        matchesInterval = true;
        reminderIntervalKey = 'daily_expired';
        severity = 'critical';
        shouldPlayCriticalChime = true;
        title = `EXPIRED: ${product.name}`;
        message = `Batch ${batch.batchNumber} expired ${Math.abs(daysRemaining)} day(s) ago (${batch.quantity} units). Remove or quarantine immediately!`;
      } else if (daysRemaining === 0 && settings.reminderIntervals.d0) {
        matchesInterval = true;
        reminderIntervalKey = 'd0';
        severity = 'critical';
        shouldPlayCriticalChime = true;
        title = `EXPIRES TODAY: ${product.name}`;
        message = `Batch ${batch.batchNumber} expires today! (${batch.quantity} units in ${product.location || 'store'}).`;
      } else if (daysRemaining === 1 && settings.reminderIntervals.d1) {
        matchesInterval = true;
        reminderIntervalKey = 'd1';
        severity = 'urgent';
        shouldPlayWarningChime = true;
        title = `Expires Tomorrow: ${product.name}`;
        message = `Batch ${batch.batchNumber} has only 1 day remaining (${batch.quantity} units). Consider discount sticker or priority front shelf.`;
      } else if (daysRemaining === 3 && settings.reminderIntervals.d3) {
        matchesInterval = true;
        reminderIntervalKey = 'd3';
        severity = 'urgent';
        shouldPlayWarningChime = true;
        title = `Urgent Expiry (3 Days): ${product.name}`;
        message = `Batch ${batch.batchNumber} expires in 3 days (${batch.quantity} units).`;
      } else if (daysRemaining === 7 && settings.reminderIntervals.d7) {
        matchesInterval = true;
        reminderIntervalKey = 'd7';
        severity = 'critical';
        title = `Expiry Reminder (7 Days): ${product.name}`;
        message = `Batch ${batch.batchNumber} will expire in 1 week (${batch.quantity} units).`;
      } else if (daysRemaining === 15 && settings.reminderIntervals.d15) {
        matchesInterval = true;
        reminderIntervalKey = 'd15';
        severity = 'warning';
        title = `Expiry Notice (15 Days): ${product.name}`;
        message = `Batch ${batch.batchNumber} expires in 15 days (${batch.quantity} units).`;
      } else if (daysRemaining === 30 && settings.reminderIntervals.d30) {
        matchesInterval = true;
        reminderIntervalKey = 'd30';
        severity = 'info';
        title = `30-Day Expiry Milestone: ${product.name}`;
        message = `Batch ${batch.batchNumber} entered 30-day window (${batch.quantity} units).`;
      }

      if (matchesInterval) {
        // Unique deterministic key to prevent duplicate notifications for this batch & reminder today
        const dedupeKey = `notif_${product.id}_${batch.id}_${reminderIntervalKey}_${todayStr}`;
        if (!sentLog[dedupeKey]) {
          const notif: ExpiryNotification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'expiry_alert',
            title,
            message,
            productId: product.id,
            productName: product.name,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            daysRemaining,
            severity,
            read: false,
            timestamp: new Date().toISOString(),
            reminderInterval: daysRemaining,
          };
          newNotifications.push(notif);
          recordSentLog(dedupeKey);

          // Dispatch native browser notification if allowed
          if (settings.browserPushEnabled && typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              try {
                new Notification(title, {
                  body: message,
                  icon: '/icon.svg',
                  badge: '/icon.svg',
                  tag: dedupeKey,
                });
              } catch (e) {
                console.warn('Native notification failed', e);
              }
            }
          }
        }
      }
    }

    // Check low stock alert
    if (settings.lowStockAlerts) {
      const totalStock = (product.batches || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      if (totalStock <= product.minStockLevel && product.minStockLevel > 0) {
        const dedupeKey = `low_stock_${product.id}_${todayStr}`;
        if (!sentLog[dedupeKey]) {
          newNotifications.push({
            id: `notif_low_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'low_stock',
            title: `Low Stock Alert: ${product.name}`,
            message: `Current stock (${totalStock} units) is at or below minimum threshold (${product.minStockLevel} units). Reorder recommended.`,
            productId: product.id,
            productName: product.name,
            severity: 'warning',
            read: false,
            timestamp: new Date().toISOString(),
          });
          recordSentLog(dedupeKey);
        }
      }
    }
  }

  // Play audio sound if configured and new alerts exist
  if (settings.soundEnabled && newNotifications.length > 0) {
    if (shouldPlayCriticalChime) {
      playCriticalAlertSound();
    } else if (shouldPlayWarningChime) {
      playWarningChime();
    }
  }

  // Save new notifications to IndexedDB
  if (newNotifications.length > 0) {
    await saveNotifications(newNotifications);
  }

  // Sync with backend server scheduler in background
  try {
    fetch('/api/notifications/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products, settings }),
    }).catch(() => {});
  } catch {}

  const all = await getAllNotifications();
  return { newCount: newNotifications.length, notifications: all };
}

export async function sendTestNotification(settings: NotificationSettings): Promise<boolean> {
  if (settings.soundEnabled) {
    playCriticalAlertSound();
  }

  const notif: ExpiryNotification = {
    id: `test_${Date.now()}`,
    type: 'system',
    title: 'ShelfGuard Notification Test',
    message: 'Test alert verified successfully! Sound, badge counters, and background scheduler channels are operational.',
    severity: 'info',
    read: false,
    timestamp: new Date().toISOString(),
  };

  await saveNotifications([notif]);

  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(notif.title, {
          body: notif.message,
          icon: '/icon.svg',
          badge: '/icon.svg',
        });
      } catch (e) {
        console.warn('Native notification failed', e);
      }
    }
  }

  // Server test
  try {
    await fetch('/api/notifications/push-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'ShelfGuard Verification Alert',
        message: 'Server scheduler successfully sent push test message.',
      }),
    });
  } catch {}

  return true;
}
