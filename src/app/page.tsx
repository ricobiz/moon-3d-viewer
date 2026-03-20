'use client';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import StatsCards from '@/components/dashboard/StatsCards';
import PnLChart from '@/components/dashboard/PnLChart';
import ActiveTrades from '@/components/dashboard/ActiveTrades';
import MarketOverview from '@/components/dashboard/MarketOverview';
import StrategyStatus from '@/components/dashboard/StrategyStatus';
import { useStore } from '@/lib/store';
import { Key, ArrowRight, Zap } from 'lucide-react';

export default function DashboardPage() {
  const { trades, accountInfo, strategies, settings } = useStore();
  const hasApiKey = !!settings.openrouterApiKey;

  const demoAccount = accountInfo || {
    balance: 10000.00,
    equity: 10247.50,
    margin: 312.40,
    freeMargin: 9935.10,
    marginLevel: 3282.5,
    profit: 247.50,
    currency: 'USD',
    leverage: 100,
    server: 'Demo-Server',
    company: 'Demo Broker',
    name: 'Demo Account',
    login: 12345678,
  };

  const demoTrades = trades.length > 0 ? trades : [
    { id: '1', ticket: 100001, symbol: 'EURUSD', type: 'BUY' as const, lots: 0.10, openPrice: 1.08234, currentPrice: 1.08456, sl: 1.07900, tp: 1.09000, profit: 22.20, swap: -0.50, openTime: new Date(Date.now() - 3600000).toISOString(), comment: 'RSI Strategy', strategyId: '1' },
    { id: '2', ticket: 100002, symbol: 'BTCUSDT', type: 'BUY' as const, lots: 0.01, openPrice: 65420.00, currentPrice: 66100.00, sl: 64000.00, tp: 68000.00, profit: 68.00, swap: 0, openTime: new Date(Date.now() - 7200000).toISOString(), comment: 'Trend Follow', strategyId: '2' },
    { id: '3', ticket: 100003, symbol: 'GBPUSD', type: 'SELL' as const, lots: 0.05, openPrice: 1.27650, currentPrice: 1.27420, sl: 1.28100, tp: 1.26800, profit: 11.50, swap: -0.20, openTime: new Date(Date.now() - 1800000).toISOString(), comment: 'MA Cross', strategyId: '3' },
    { id: '4', ticket: 100004, symbol: 'XAUUSD', type: 'BUY' as const, lots: 0.02, openPrice: 2318.50, currentPrice: 2305.30, sl: 2300.00, tp: 2350.00, profit: -26.40, swap: 0, openTime: new Date(Date.now() - 900000).toISOString(), comment: 'Gold Strategy', strategyId: '4' },
  ];

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="Dashboard" />
      <div className="p-5 space-y-5">

        {/* Setup Banner — shown until API key is set */}
        {!hasApiKey && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-accent-blue/30 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-accent-blue" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Добавьте OpenRouter API ключ для начала работы</p>
                <p className="text-xs text-text-muted">Получите бесплатно на <span className="text-accent-blue">openrouter.ai/keys</span> · Поддерживает Claude, GPT-4, Gemini и др.</p>
              </div>
            </div>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
            >
              <Key className="w-3.5 h-3.5" />
              Настройки
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Stats Row */}
        <StatsCards account={demoAccount} trades={demoTrades} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <PnLChart />
          </div>
          <div>
            <MarketOverview />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ActiveTrades trades={demoTrades} />
          </div>
          <div>
            <StrategyStatus strategies={strategies} />
          </div>
        </div>
      </div>
    </main>
  );
}
