'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  openrouterApiKey: string;
  openrouterModel: string;
  mt5BridgeUrl: string;
  mt5BridgeEnabled: boolean;
  defaultLotSize: number;
  defaultSlPips: number;
  defaultTpPips: number;
  maxOpenTrades: number;
  maxDailyLoss: number;
  riskPercent: number;
  theme: 'dark';
  notifications: boolean;
}

export interface Trade {
  id: string;
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  openTime: string;
  comment: string;
  strategyId?: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  mql5Code: string;
  symbol: string;
  timeframe: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalTrades: number;
    winRate: number;
    totalProfit: number;
    maxDrawdown: number;
  };
}

export interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  profit: number;
  currency: string;
  leverage: number;
  server: string;
  company: string;
  name: string;
  login: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
  balance: number;
}

interface AppStore {
  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Connection status
  mt5Connected: boolean;
  setMt5Connected: (connected: boolean) => void;

  // Account
  accountInfo: AccountInfo | null;
  setAccountInfo: (info: AccountInfo | null) => void;

  // Trades
  trades: Trade[];
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  removeTrade: (id: string) => void;

  // Strategies
  strategies: Strategy[];
  addStrategy: (strategy: Strategy) => void;
  updateStrategy: (id: string, updates: Partial<Strategy>) => void;
  removeStrategy: (id: string) => void;

  // Equity history
  equityHistory: EquityPoint[];
  addEquityPoint: (point: EquityPoint) => void;

  // UI state
  activeStrategyId: string | null;
  setActiveStrategyId: (id: string | null) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

const defaultSettings: Settings = {
  openrouterApiKey: '',
  openrouterModel: 'anthropic/claude-3.5-sonnet',
  mt5BridgeUrl: 'http://localhost:8765',
  mt5BridgeEnabled: false,
  defaultLotSize: 0.01,
  defaultSlPips: 50,
  defaultTpPips: 100,
  maxOpenTrades: 10,
  maxDailyLoss: 5,
  riskPercent: 1,
  theme: 'dark',
  notifications: true,
};

// Sample equity history for demo
const generateSampleEquity = (): EquityPoint[] => {
  const points: EquityPoint[] = [];
  let equity = 10000;
  let balance = 10000;
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const change = (Math.random() - 0.45) * 150;
    equity += change;
    if (Math.random() > 0.7) balance = equity;
    points.push({
      time: new Date(now - i * 24 * 3600 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      equity: Math.round(equity * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }
  return points;
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      updateSettings: (updates) =>
        set((state) => ({ settings: { ...state.settings, ...updates } })),

      mt5Connected: false,
      setMt5Connected: (connected) => set({ mt5Connected: connected }),

      accountInfo: null,
      setAccountInfo: (info) => set({ accountInfo: info }),

      trades: [],
      setTrades: (trades) => set({ trades }),
      addTrade: (trade) =>
        set((state) => ({ trades: [...state.trades, trade] })),
      removeTrade: (id) =>
        set((state) => ({ trades: state.trades.filter((t) => t.id !== id) })),

      strategies: [],
      addStrategy: (strategy) =>
        set((state) => ({ strategies: [strategy, ...state.strategies] })),
      updateStrategy: (id, updates) =>
        set((state) => ({
          strategies: state.strategies.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      removeStrategy: (id) =>
        set((state) => ({
          strategies: state.strategies.filter((s) => s.id !== id),
        })),

      equityHistory: generateSampleEquity(),
      addEquityPoint: (point) =>
        set((state) => ({
          equityHistory: [...state.equityHistory.slice(-999), point],
        })),

      activeStrategyId: null,
      setActiveStrategyId: (id) => set({ activeStrategyId: id }),

      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      notifications: [],
      addNotification: (n) => {
        const id = Math.random().toString(36).substr(2, 9);
        const notification: Notification = {
          ...n,
          id,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          notifications: [...state.notifications.slice(-49), notification],
        }));
        setTimeout(() => get().removeNotification(id), 5000);
      },
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
    }),
    {
      name: 'trading-bot-store',
      partialize: (state) => ({
        settings: state.settings,
        strategies: state.strategies,
      }),
    }
  )
);
