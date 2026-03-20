'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BrainCircuit, ListOrdered, TrendingUp,
  Settings, CandlestickChart, History, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { href: '/', icon: LayoutDashboard, label: 'Home' },
  { href: '/chart', icon: CandlestickChart, label: 'Chart' },
  { href: '/autotrader', icon: Bot, label: 'AutoTrade' },
  { href: '/trades', icon: ListOrdered, label: 'Trades' },
  { href: '/history', icon: History, label: 'History' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary border-t border-border flex items-center safe-bottom">
      {mobileNavItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
              isActive
                ? 'text-accent-blue'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] leading-tight">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
