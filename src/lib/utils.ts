import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'USD', decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string | number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

export function formatTime(date: Date | string | number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

export function getPnLColor(value: number): string {
  if (value > 0) return 'text-accent-green';
  if (value < 0) return 'text-accent-red';
  return 'text-text-secondary';
}

export function getPnLBg(value: number): string {
  if (value > 0) return 'bg-accent-green/10 text-accent-green';
  if (value < 0) return 'bg-accent-red/10 text-accent-red';
  return 'bg-bg-tertiary text-text-secondary';
}

export function getOrderTypeColor(type: string): string {
  switch (type.toUpperCase()) {
    case 'BUY': return 'text-accent-green';
    case 'SELL': return 'text-accent-red';
    default: return 'text-text-secondary';
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate unique ID
export function genId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Format lot size
export function formatLot(lot: number): string {
  return lot.toFixed(2);
}

// Get timeframe label
export function getTimeframeLabel(tf: string): string {
  const map: Record<string, string> = {
    M1: '1 min', M5: '5 min', M15: '15 min', M30: '30 min',
    H1: '1 hour', H4: '4 hours', D1: 'Daily', W1: 'Weekly', MN: 'Monthly',
  };
  return map[tf] || tf;
}

// Debounce
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
