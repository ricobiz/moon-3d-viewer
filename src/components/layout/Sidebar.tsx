'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BrainCircuit, ListOrdered, Settings,
  TrendingUp, ChevronLeft, ChevronRight, Zap,
  CandlestickChart, History, Bot, MessageSquare, FlaskConical,
  Smartphone
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/lab', icon: FlaskConical, label: 'Strategy Lab ✨' },
  { href: '/chart', icon: CandlestickChart, label: 'Price Chart' },
  { href: '/chat', icon: MessageSquare, label: 'AI Strategy Chat' },
  { href: '/autotrader', icon: Bot, label: 'AI AutoTrader' },
  { href: '/strategies', icon: BrainCircuit, label: 'AI Strategies' },
  { href: '/trades', icon: ListOrdered, label: 'Live Trades' },
  { href: '/history', icon: History, label: 'Trade History' },
  { href: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mt5Connected, accountInfo, brokerConnected, brokerAccount, settings } = useStore();

  const isConnected = mt5Connected || brokerConnected;
  const brokerLabel = settings.activeBroker === 'bybit' ? 'Bybit' : settings.activeBroker === 'binance' ? 'Binance' : 'MT5';

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-bg-secondary border-r border-border transition-all duration-300 relative flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-text-primary truncate">AI Trade Bot</span>
            <span className="text-xs text-text-muted">
              {brokerConnected ? brokerLabel : mt5Connected ? 'MetaTrader 5' : 'Demo Mode'}
            </span>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className={cn(
        'mx-3 my-3 rounded-lg border p-2.5 transition-colors',
        isConnected
          ? 'bg-accent-green/5 border-accent-green/20'
          : 'bg-bg-tertiary border-border'
      )}>
        {sidebarCollapsed ? (
          <div className="flex justify-center">
            <span className={cn('status-dot', isConnected ? 'active' : 'inactive')} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn('status-dot flex-shrink-0', isConnected ? 'active' : 'inactive')} />
            <div className="min-w-0">
              {brokerConnected && brokerAccount ? (
                <>
                  <p className="text-xs font-medium text-text-primary truncate flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-accent-blue" />
                    {brokerLabel} Connected
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    ${brokerAccount.balance.toFixed(2)} {brokerAccount.currency}
                  </p>
                </>
              ) : mt5Connected ? (
                <>
                  <p className="text-xs font-medium text-text-primary truncate">MT5 Connected</p>
                  {accountInfo && (
                    <p className="text-xs text-text-muted truncate">#{accountInfo.login} • {accountInfo.server}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-text-primary">Demo Mode</p>
                  <p className="text-xs text-text-muted">Connect in Settings</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'nav-link',
                isActive && 'active',
                sidebarCollapsed && 'justify-center px-2'
              )}
              data-tooltip={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Account Balance */}
      {!sidebarCollapsed && (accountInfo || brokerAccount) && (
        <div className="mx-3 mb-3 p-3 bg-bg-tertiary rounded-lg border border-border">
          <p className="text-xs text-text-muted mb-1">Balance</p>
          <p className="text-base font-bold font-mono text-text-primary">
            ${(brokerAccount?.balance ?? accountInfo?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          {brokerAccount?.unrealizedPnl != null && (
            <p className={cn(
              'text-xs font-mono mt-0.5',
              brokerAccount.unrealizedPnl >= 0 ? 'text-accent-green' : 'text-accent-red'
            )}>
              {brokerAccount.unrealizedPnl >= 0 ? '+' : ''}{brokerAccount.unrealizedPnl.toFixed(2)} unrealized
            </p>
          )}
          {accountInfo && !brokerAccount && (
            <p className={cn(
              'text-xs font-mono mt-0.5',
              accountInfo.profit >= 0 ? 'text-accent-green' : 'text-accent-red'
            )}>
              {accountInfo.profit >= 0 ? '+' : ''}{accountInfo.profit.toFixed(2)} today
            </p>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-bg-tertiary border border-border rounded-full flex items-center justify-center hover:bg-bg-hover transition-colors z-10"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3 h-3 text-text-secondary" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-text-secondary" />
        )}
      </button>
    </aside>
  );
}
