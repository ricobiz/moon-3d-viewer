'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Settings,
  CandlestickChart, Bot, MessageSquare, FlaskConical, ListOrdered
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';

const mobileNavItems = [
  { href: '/', icon: LayoutDashboard, label: 'Home' },
  { href: '/lab', icon: FlaskConical, label: 'Lab' },
  { href: '/chart', icon: CandlestickChart, label: 'Chart' },
  { href: '/trades', icon: ListOrdered, label: 'Trades' },
  { href: '/autotrader', icon: Bot, label: 'AutoTrade' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { mt5Connected, brokerConnected } = useStore();
  const isConnected = mt5Connected || brokerConnected;
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary border-t border-border flex items-center safe-area-pb">
      {mobileNavItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        const showDot = href === '/trades' && isConnected;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors relative',
              isActive
                ? 'text-accent-blue'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {showDot && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-green border border-bg-secondary" />
              )}
            </div>
            <span className="text-[10px] leading-tight">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
