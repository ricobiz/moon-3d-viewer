'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, Bell, Wifi, WifiOff, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn, formatTime } from '@/lib/utils';

export default function Header({ title }: { title: string }) {
  const { mt5Connected, accountInfo, notifications, removeNotification, settings, setMt5Connected, setAccountInfo, setTrades, addEquityPoint } = useStore();
  const [currentTime, setCurrentTime] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const tick = () => setCurrentTime(formatTime(new Date()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-poll MT5 if bridge is enabled
  useEffect(() => {
    if (!settings.mt5BridgeEnabled) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/mt5?action=status');
        if (res.ok) {
          const data = await res.json();
          setMt5Connected(data.connected);
          if (data.account) setAccountInfo(data.account);
          if (data.trades) setTrades(data.trades);
          if (data.account) {
            addEquityPoint({
              time: formatTime(new Date()),
              equity: data.account.equity,
              balance: data.account.balance,
            });
          }
        } else {
          setMt5Connected(false);
        }
      } catch {
        setMt5Connected(false);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [settings.mt5BridgeEnabled, settings.mt5BridgeUrl]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/mt5?action=status');
      if (res.ok) {
        const data = await res.json();
        setMt5Connected(data.connected);
        if (data.account) setAccountInfo(data.account);
        if (data.trades) setTrades(data.trades);
      }
    } catch {}
    setTimeout(() => setRefreshing(false), 600);
  };

  const notifIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-accent-green flex-shrink-0" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-accent-yellow flex-shrink-0" />;
      default: return <Info className="w-4 h-4 text-accent-blue flex-shrink-0" />;
    }
  };

  return (
    <>
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm animate-fade-in">
          {notifications.slice(-3).map((n) => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border shadow-lg',
                n.type === 'success' && 'bg-accent-green/10 border-accent-green/30',
                n.type === 'error' && 'bg-accent-red/10 border-accent-red/30',
                n.type === 'warning' && 'bg-accent-yellow/10 border-accent-yellow/30',
                n.type === 'info' && 'bg-accent-blue/10 border-accent-blue/30',
              )}
            >
              {notifIcon(n.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{n.title}</p>
                <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
              </div>
              <button onClick={() => removeNotification(n.id)} className="text-text-muted hover:text-text-secondary">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header bar */}
      <header className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-text-primary">{title}</h1>
          {accountInfo && (
            <div className="hidden md:flex items-center gap-4 ml-4 text-xs text-text-muted font-mono">
              <span>Balance: <span className="text-text-primary font-medium">${accountInfo.balance.toFixed(2)}</span></span>
              <span>Equity: <span className={cn('font-medium', accountInfo.equity >= accountInfo.balance ? 'text-accent-green' : 'text-accent-red')}>${accountInfo.equity.toFixed(2)}</span></span>
              <span>Free Margin: <span className="text-text-primary font-medium">${accountInfo.freeMargin.toFixed(2)}</span></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Clock */}
          <span className="hidden sm:block text-xs font-mono text-text-muted">{currentTime} UTC</span>

          {/* MT5 Status */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            mt5Connected
              ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
              : 'bg-bg-tertiary text-text-muted border border-border'
          )}>
            {mt5Connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{mt5Connected ? 'MT5 Live' : 'MT5 Offline'}</span>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </header>
    </>
  );
}
