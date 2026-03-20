'use client';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import {
  Key, Server, Shield, Bell, Save, Eye, EyeOff,
  ExternalLink, CheckCircle, XCircle, Loader2, Info,
  RefreshCw, Building2, CreditCard, ChevronDown, Database, Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: { prompt: number; completion: number };
}

export default function SettingsPage() {
  const { settings, updateSettings, addNotification, setMt5Connected, setAccountInfo } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [testingMt5, setTestingMt5] = useState(false);
  const [mt5TestResult, setMt5TestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showAllModels, setShowAllModels] = useState(false);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch('/api/openrouter-models');
      const data = await res.json();
      if (data.models?.length) {
        setModels(data.models);
      }
    } catch {
      addNotification({ type: 'error', title: 'Models Error', message: 'Cannot fetch OpenRouter models' });
    }
    setLoadingModels(false);
  };

  useEffect(() => { fetchModels(); }, []);

  const filteredModels = models.filter(m =>
    !modelSearch ||
    m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );
  const displayedModels = showAllModels ? filteredModels : filteredModels.slice(0, 20);

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
            <h2 className="text-sm font-semibold text-text-primary">AI Configuration (OpenRouter)</h2>
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
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                    className="text-accent-blue hover:underline inline-flex items-center gap-0.5">
                    openrouter.ai/keys <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>
            </div>

            {/* Model selection — dynamic */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-text-muted font-medium">Default AI Model</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">{models.length > 0 ? `${models.length} models available` : 'Loading...'}</span>
                  <button onClick={fetchModels} disabled={loadingModels}
                    className="flex items-center gap-1 text-xs text-accent-blue hover:underline disabled:opacity-50">
                    <RefreshCw className={cn('w-3 h-3', loadingModels && 'animate-spin')} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Current model display */}
              <div className="mb-2 p-2 bg-bg-tertiary border border-border rounded-lg text-xs">
                <span className="text-text-muted">Current: </span>
                <span className="text-text-primary font-medium">{settings.openrouterModel}</span>
              </div>

              {/* Search + list */}
              <input
                type="text"
                className="trading-input mb-2 text-xs"
                placeholder="Search models..."
                value={modelSearch}
                onChange={e => setModelSearch(e.target.value)}
              />

              {loadingModels ? (
                <div className="flex items-center gap-2 py-3 text-xs text-text-muted">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading models from OpenRouter...
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    {displayedModels.map(m => (
                      <button
                        key={m.id}
                        onClick={() => updateSettings({ openrouterModel: m.id })}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs border-b border-border/50 last:border-0 transition-colors hover:bg-bg-hover',
                          settings.openrouterModel === m.id && 'bg-accent-blue/5 border-l-2 border-l-accent-blue'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn('font-medium', settings.openrouterModel === m.id ? 'text-accent-blue' : 'text-text-primary')}>
                            {m.name}
                          </span>
                          {m.pricing.prompt === 0 ? (
                            <span className="text-accent-green text-[10px] font-medium">FREE</span>
                          ) : (
                            <span className="text-text-muted text-[10px]">${(m.pricing.prompt * 1000000).toFixed(2)}/Mtok</span>
                          )}
                        </div>
                        <div className="text-text-muted mt-0.5 truncate">{m.id}</div>
                        {m.contextLength > 0 && (
                          <div className="text-text-muted text-[10px]">{(m.contextLength / 1000).toFixed(0)}k ctx</div>
                        )}
                      </button>
                    ))}
                  </div>
                  {filteredModels.length > 20 && (
                    <button
                      onClick={() => setShowAllModels(!showAllModels)}
                      className="w-full py-2 text-xs text-accent-blue hover:bg-bg-hover flex items-center justify-center gap-1 border-t border-border"
                    >
                      <ChevronDown className={cn('w-3 h-3 transition-transform', showAllModels && 'rotate-180')} />
                      {showAllModels ? 'Show less' : `Show all ${filteredModels.length} models`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Real Market Data */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Database className="w-4 h-4 text-accent-green" />
            <h2 className="text-sm font-semibold text-text-primary">Real Market Data</h2>
            <span className="ml-auto text-xs bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 px-2 py-0.5 rounded-full">Free APIs available</span>
          </div>

          <div className="text-xs text-text-secondary space-y-3">
            <p>Without a data key, the app uses <strong className="text-accent-yellow">synthetic (simulated) data</strong> for charts and backtests. Add a free key for real historical prices.</p>

            <div className="space-y-3">
              {/* Twelve Data */}
              <div className="p-3 bg-bg-tertiary rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-text-primary">Twelve Data</p>
                    <p className="text-text-muted">800 free requests/day · Forex, Crypto, Stocks</p>
                  </div>
                  <span className="text-accent-green font-semibold">FREE</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-text-muted">
                  <li>Go to <span className="text-accent-blue">twelvedata.com</span> → Sign Up (free)</li>
                  <li>Copy your API key from the dashboard</li>
                  <li>Paste it below</li>
                </ol>
                <input
                  className="trading-input"
                  placeholder="Twelve Data API key..."
                  value={settings.twelveDataKey}
                  onChange={e => updateSettings({ twelveDataKey: e.target.value })}
                />
              </div>

              {/* Alpha Vantage */}
              <div className="p-3 bg-bg-tertiary rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-text-primary">Alpha Vantage</p>
                    <p className="text-text-muted">25 free requests/day · Forex, Crypto, Stocks</p>
                  </div>
                  <span className="text-accent-green font-semibold">FREE</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-text-muted">
                  <li>Go to <span className="text-accent-blue">alphavantage.co/support/#api-key</span> → Get free key</li>
                  <li>Paste it below</li>
                </ol>
                <input
                  className="trading-input"
                  placeholder="Alpha Vantage API key..."
                  value={settings.alphaVantageKey}
                  onChange={e => updateSettings({ alphaVantageKey: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* VPS for 24/7 trading */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Monitor className="w-4 h-4 text-accent-purple" />
            <h2 className="text-sm font-semibold text-text-primary">Trade 24/7 Without a PC</h2>
          </div>

          <div className="text-xs text-text-secondary space-y-3 leading-relaxed">
            <p>You have <strong className="text-text-primary">two options</strong> to trade automatically without keeping your computer on:</p>

            {/* Option 1: MT5 VPS */}
            <div className="p-3 bg-accent-green/5 border border-accent-green/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-accent-green text-white text-[10px] font-bold px-2 py-0.5 rounded-full">EASIEST</span>
                <p className="font-semibold text-text-primary">MT5 Built-in VPS (~$5/month)</p>
              </div>
              <p>MetaTrader 5 has a built-in VPS service. Your Expert Advisors (EAs) run 24/7 on MetaQuotes servers — no Windows computer needed.</p>
              <ol className="list-decimal list-inside space-y-1 text-text-muted">
                <li>Open MetaTrader 5 terminal</li>
                <li>Go to <strong className="text-text-primary">Tools → VPS</strong></li>
                <li>Subscribe (~$5/month, or free with some brokers if monthly volume ≥ 3 lots)</li>
                <li>MT5 automatically migrates your EAs to the cloud server</li>
              </ol>
              <p className="text-accent-green">Best for: running MQL5 EAs generated by this app (see AI Strategies page)</p>
            </div>

            {/* Option 2: Windows VPS */}
            <div className="p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-accent-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ADVANCED</span>
                <p className="font-semibold text-text-primary">Windows VPS ($10–20/month)</p>
              </div>
              <p>Rent a Windows VPS, install MT5 + our Python bridge. This connects the full web app to MT5 running in the cloud.</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { name: 'Vultr', note: 'From $6/mo Windows', url: 'vultr.com' },
                  { name: 'ForexVPS.net', note: 'Optimized for MT5', url: 'forexvps.net' },
                  { name: 'BeeksFX', note: 'Low latency VPS', url: 'beeksfx.com' },
                  { name: 'DigitalOcean', note: 'From $12/mo Windows', url: 'digitalocean.com' },
                ].map(v => (
                  <div key={v.name} className="bg-bg-primary p-2 rounded">
                    <p className="font-medium text-text-primary">{v.name}</p>
                    <p className="text-text-muted">{v.note}</p>
                    <p className="text-accent-blue">{v.url}</p>
                  </div>
                ))}
              </div>
              <ol className="list-decimal list-inside space-y-1 text-text-muted mt-1">
                <li>Rent a Windows VPS from any provider above</li>
                <li>Install MetaTrader 5 + Python on the VPS</li>
                <li>Copy <code className="bg-bg-primary px-1 rounded text-accent-blue">mt5-bridge/bridge.py</code> to the VPS</li>
                <li>Run the bridge: <code className="bg-bg-primary px-1 rounded text-accent-blue">python bridge.py --host 0.0.0.0</code></li>
                <li>In Bridge URL below, enter your VPS IP: <code className="bg-bg-primary px-1 rounded text-accent-blue">http://YOUR.VPS.IP:8765</code></li>
              </ol>
            </div>
          </div>
        </section>

        {/* Broker / Provider info */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Building2 className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">Broker & Provider</h2>
          </div>

          <div className="text-xs text-text-secondary space-y-3 leading-relaxed">
            <p>
              This platform connects to <strong className="text-text-primary">MetaTrader 5 (MT5)</strong> — the industry-standard trading terminal.
              MT5 works with <strong className="text-text-primary">hundreds of brokers worldwide</strong>.
            </p>

            <div className="grid grid-cols-1 gap-2">
              {[
                { name: 'IC Markets', type: 'ECN/Forex', note: 'Tight spreads, raw ECN, popular for algo trading', url: 'icmarkets.com' },
                { name: 'Pepperstone', type: 'ECN/Forex/Crypto', note: 'Excellent MT5 support, fast execution', url: 'pepperstone.com' },
                { name: 'Exness', type: 'Forex/CFD', note: 'High leverage, instant withdrawals', url: 'exness.com' },
                { name: 'XM', type: 'Forex/Stocks/Crypto', note: 'Low minimum deposit ($5)', url: 'xm.com' },
                { name: 'Alpari', type: 'Forex/CFD', note: 'Classic MT5 broker, wide asset range', url: 'alpari.com' },
                { name: 'RoboForex', type: 'Forex/Crypto/Stocks', note: 'Supports copy trading and EAs', url: 'roboforex.com' },
              ].map(b => (
                <div key={b.name} className="flex items-start gap-3 p-2.5 bg-bg-tertiary rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{b.name}</span>
                      <span className="text-[10px] text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded">{b.type}</span>
                    </div>
                    <p className="text-text-muted mt-0.5">{b.note}</p>
                    <p className="text-accent-blue mt-0.5">{b.url}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
              <p className="font-medium text-text-primary mb-1">How to connect:</p>
              <ol className="list-decimal list-inside space-y-1 text-text-secondary">
                <li>Open an account with any MT5 broker above</li>
                <li>Download and install MetaTrader 5 from the broker&apos;s website</li>
                <li>Log in to your live or demo account in MT5</li>
                <li>Run <code className="bg-bg-primary px-1 py-0.5 rounded text-accent-blue">mt5-bridge/bridge.py</code> on the same Windows PC</li>
                <li>Enable MT5 Bridge below and click &quot;Test Connection&quot;</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Deposit / Funding info */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <CreditCard className="w-4 h-4 text-accent-green" />
            <h2 className="text-sm font-semibold text-text-primary">Funding Your Account</h2>
          </div>

          <div className="text-xs text-text-secondary space-y-3 leading-relaxed">
            <p>Deposit methods vary by broker. Most support:</p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { method: 'Bank Transfer (SWIFT/SEPA)', time: '1–3 business days', fee: 'Free' },
                { method: 'Credit/Debit Card (Visa, MC)', time: 'Instant', fee: '0–1.5%' },
                { method: 'Cryptocurrency (BTC, ETH, USDT)', time: '10–30 min', fee: 'Network fee' },
                { method: 'Neteller / Skrill', time: 'Instant', fee: '1–2%' },
                { method: 'Perfect Money / WebMoney', time: 'Instant', fee: '0.5%' },
                { method: 'Local bank transfer', time: 'Same day', fee: 'Varies' },
              ].map(({ method, time, fee }) => (
                <div key={method} className="p-2 bg-bg-tertiary rounded-lg">
                  <p className="font-medium text-text-primary">{method}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-text-muted">{time}</span>
                    <span className="text-accent-green">{fee}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg">
              <p className="font-medium text-accent-yellow mb-1">Risk Warning</p>
              <p>CFDs and Forex trading involve significant risk. Only trade with money you can afford to lose.
                Start with a <strong className="text-text-primary">demo account</strong> to test strategies before using real funds.
                Most brokers offer free demo accounts with virtual money.</p>
            </div>
          </div>
        </section>

        {/* MT5 Bridge */}
        <section className="trading-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Server className="w-4 h-4 text-accent-blue" />
            <h2 className="text-sm font-semibold text-text-primary">MetaTrader 5 Bridge</h2>
          </div>

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
              <input type="number" className="trading-input" value={settings.defaultLotSize}
                min={0.01} max={100} step={0.01}
                onChange={(e) => updateSettings({ defaultLotSize: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Risk per Trade (%)</label>
              <input type="number" className="trading-input" value={settings.riskPercent}
                min={0.1} max={20} step={0.1}
                onChange={(e) => updateSettings({ riskPercent: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Default Stop Loss (pips)</label>
              <input type="number" className="trading-input" value={settings.defaultSlPips}
                min={0} step={1}
                onChange={(e) => updateSettings({ defaultSlPips: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Default Take Profit (pips)</label>
              <input type="number" className="trading-input" value={settings.defaultTpPips}
                min={0} step={1}
                onChange={(e) => updateSettings({ defaultTpPips: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Max Open Trades</label>
              <input type="number" className="trading-input" value={settings.maxOpenTrades}
                min={1} max={100} step={1}
                onChange={(e) => updateSettings({ maxOpenTrades: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium">Max Daily Loss (%)</label>
              <input type="number" className="trading-input" value={settings.maxDailyLoss}
                min={0.1} max={50} step={0.1}
                onChange={(e) => updateSettings({ maxDailyLoss: parseFloat(e.target.value) })} />
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
