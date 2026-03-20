'use client';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import { AVAILABLE_MODELS } from '@/lib/openrouter';
import { useState } from 'react';
import {
  Key, Server, Shield, Bell, Save, Eye, EyeOff,
  ExternalLink, CheckCircle, XCircle, Loader2, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { settings, updateSettings, addNotification, setMt5Connected, setAccountInfo } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [testingMt5, setTestingMt5] = useState(false);
  const [mt5TestResult, setMt5TestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    addNotification({ type: 'success', title: 'Settings Saved', message: 'Your settings have been saved' });
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestMt5 = async () => {
    setTestingMt5(true);
    setMt5TestResult(null);
    try {
      const res = await fetch('/api/mt5?action=status', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        setMt5TestResult(data.connected ? 'success' : 'error');
        if (data.connected) {
          setMt5Connected(true);
          if (data.account) setAccountInfo(data.account);
          addNotification({ type: 'success', title: 'MT5 Connected!', message: `Account: ${data.account?.login} • ${data.account?.server}` });
        } else {
          addNotification({ type: 'error', title: 'MT5 Not Connected', message: 'Bridge is reachable but MT5 is disconnected' });
        }
      } else {
        setMt5TestResult('error');
        addNotification({ type: 'error', title: 'Connection Failed', message: 'Cannot reach MT5 bridge' });
      }
    } catch {
      setMt5TestResult('error');
      addNotification({ type: 'error', title: 'Connection Failed', message: 'MT5 bridge is not running or unreachable' });
    }
    setTestingMt5(false);
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="Settings" />
      <div className="p-5 max-w-3xl space-y-6">

        {/* AI / OpenRouter */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Key className="w-4 h-4 text-accent-purple" />
            <h2 className="text-sm font-semibold text-text-primary">AI Configuration</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">OpenRouter API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="trading-input pr-10"
                  placeholder="sk-or-v1-..."
                  value={settings.openrouterApiKey}
                  onChange={(e) => updateSettings({ openrouterApiKey: e.target.value })}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Info className="w-3 h-3 text-text-muted flex-shrink-0" />
                <p className="text-xs text-text-muted">
                  Get your free API key at{' '}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-blue hover:underline inline-flex items-center gap-0.5"
                  >
                    openrouter.ai/keys <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Default AI Model</label>
              <select
                className="trading-input"
                value={settings.openrouterModel}
                onChange={(e) => updateSettings({ openrouterModel: e.target.value })}
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">
                Claude 3.5 Sonnet recommended for best MQL5 code quality
              </p>
            </div>
          </div>
        </section>

        {/* MT5 Bridge */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Server className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">MetaTrader 5 Bridge</h2>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
            <p className="text-xs text-text-secondary leading-relaxed">
              The MT5 bridge is a Python script that runs on your Windows machine with MetaTrader 5 installed.
              It allows this app to read account data and place/manage orders.
              <br /><br />
              <strong className="text-text-primary">To use:</strong> Run <code className="bg-bg-primary px-1 py-0.5 rounded text-accent-blue">mt5-bridge/bridge.py</code> on your Windows PC with MT5.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs text-text-muted font-medium">Enable MT5 Bridge</label>
                <p className="text-xs text-text-muted mt-0.5">Connect to MetaTrader 5 for live trading</p>
              </div>
              <button
                onClick={() => updateSettings({ mt5BridgeEnabled: !settings.mt5BridgeEnabled })}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  settings.mt5BridgeEnabled ? 'bg-accent-blue' : 'bg-bg-tertiary border border-border'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
                  settings.mt5BridgeEnabled ? 'left-5' : 'left-0.5'
                )} />
              </button>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Bridge URL</label>
              <input
                className="trading-input"
                placeholder="http://localhost:8765"
                value={settings.mt5BridgeUrl}
                onChange={(e) => updateSettings({ mt5BridgeUrl: e.target.value })}
              />
              <p className="text-xs text-text-muted mt-1">
                Default: http://localhost:8765 (local) or your PC&apos;s IP on the network
              </p>
            </div>

            <button
              onClick={handleTestMt5}
              disabled={testingMt5}
              className="btn-secondary flex items-center gap-2"
            >
              {testingMt5 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mt5TestResult === 'success' ? (
                <CheckCircle className="w-4 h-4 text-accent-green" />
              ) : mt5TestResult === 'error' ? (
                <XCircle className="w-4 h-4 text-accent-red" />
              ) : (
                <Server className="w-4 h-4" />
              )}
              {testingMt5 ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </section>

        {/* Risk Management */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Shield className="w-4 h-4 text-accent-green" />
            <h2 className="text-sm font-semibold text-text-primary">Risk Management</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Default Lot Size</label>
              <input
                type="number"
                className="trading-input"
                value={settings.defaultLotSize}
                min={0.01}
                max={100}
                step={0.01}
                onChange={(e) => updateSettings({ defaultLotSize: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Risk per Trade (%)</label>
              <input
                type="number"
                className="trading-input"
                value={settings.riskPercent}
                min={0.1}
                max={20}
                step={0.1}
                onChange={(e) => updateSettings({ riskPercent: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Default Stop Loss (pips)</label>
              <input
                type="number"
                className="trading-input"
                value={settings.defaultSlPips}
                min={0}
                step={1}
                onChange={(e) => updateSettings({ defaultSlPips: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Default Take Profit (pips)</label>
              <input
                type="number"
                className="trading-input"
                value={settings.defaultTpPips}
                min={0}
                step={1}
                onChange={(e) => updateSettings({ defaultTpPips: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Max Open Trades</label>
              <input
                type="number"
                className="trading-input"
                value={settings.maxOpenTrades}
                min={1}
                max={100}
                step={1}
                onChange={(e) => updateSettings({ maxOpenTrades: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Max Daily Loss (%)</label>
              <input
                type="number"
                className="trading-input"
                value={settings.maxDailyLoss}
                min={0.1}
                max={50}
                step={0.1}
                onChange={(e) => updateSettings({ maxDailyLoss: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Bell className="w-4 h-4 text-accent-yellow" />
            <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs text-text-muted font-medium">In-App Notifications</label>
              <p className="text-xs text-text-muted mt-0.5">Show alerts for trades, strategy events, and errors</p>
            </div>
            <button
              onClick={() => updateSettings({ notifications: !settings.notifications })}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                settings.notifications ? 'bg-accent-blue' : 'bg-bg-tertiary border border-border'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
                settings.notifications ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={cn(
            'btn-primary flex items-center gap-2 px-6',
            saved && 'bg-accent-green hover:bg-accent-green'
          )}
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </main>
  );
}
