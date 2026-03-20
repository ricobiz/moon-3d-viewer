'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BrainCircuit, ListOrdered, Settings,
  TrendingUp, ChevronLeft, ChevronRight, Zap,
  CandlestickChart, History, Bot, MessageSquare
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
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
  const { sidebarCollapsed, toggleSidebar, mt5Connected, accountInfo, settings } = useStore();

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
            <span className="text-xs text-text-muted">MetaTrader 5</span>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className={cn(
        'mx-3 my-3 rounded-lg border p-2.5 transition-colors',
        mt5Connected
          ? 'bg-accent-green/5 border-accent-green/20'
          : 'bg-bg-tertiary border-border'
      )}>
        {sidebarCollapsed ? (
          <div className="flex justify-center">
            <span className={cn('status-dot', mt5Connected ? 'active' : 'inactive')} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn('status-dot flex-shrink-0', mt5Connected ? 'active' : 'inactive')} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {mt5Connected ? 'MT5 Connected' : 'MT5 Offline'}
              </p>
              {mt5Connected && accountInfo && (
                <p className="text-xs text-text-muted truncate">
                  #{accountInfo.login} • {accountInfo.server}
                </p>
              )}
              {!mt5Connected && (
                <p className="text-xs text-text-muted">Configure in Settings</p>
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
      {!sidebarCollapsed && accountInfo && (
        <div className="mx-3 mb-3 p-3 bg-bg-tertiary rounded-lg border border-border">
          <p className="text-xs text-text-muted mb-1">Balance</p>
          <p className="text-base font-bold font-mono text-text-primary">
            ${accountInfo.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className={cn(
            'text-xs font-mono mt-0.5',
            accountInfo.profit >= 0 ? 'text-accent-green' : 'text-accent-red'
          )}>
            {accountInfo.profit >= 0 ? '+' : ''}{accountInfo.profit.toFixed(2)} today
          </p>
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
