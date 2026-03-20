import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';

export const metadata: Metadata = {
  title: 'AI Trading Bot — MetaTrader 5',
  description: 'AI-powered algorithmic trading platform with MQL5 strategy generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary text-text-primary antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar: hidden on mobile, visible on lg+ */}
          <div className="hidden lg:flex">
            <Sidebar />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden pb-14 lg:pb-0">
              {children}
            </div>
          </div>
        </div>
        {/* Mobile bottom navigation */}
        <MobileNav />
      </body>
    </html>
  );
}
