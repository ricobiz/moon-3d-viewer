'use client';
import { useState, useRef } from 'react';
import {
  BrainCircuit, Loader2, Download, Copy, Check,
  ChevronDown, ChevronUp, Sparkles, AlertCircle,
  Settings2, Play
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { generateStrategy, AVAILABLE_MODELS } from '@/lib/openrouter';
import { cn, genId } from '@/lib/utils';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
const FOREX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY'];
const CRYPTO_PAIRS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT'];
const COMMODITIES = ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL'];

const EXAMPLES = [
  {
    title: 'RSI + MACD Reversal',
    text: 'Trade EURUSD on M15. Buy when RSI(14) drops below 30 and then crosses back above 30, AND MACD line crosses above signal line. Sell when RSI goes above 70 and crosses back below. Stop loss: 30 pips. Take profit: 60 pips. Only trade during London and New York sessions.',
  },
  {
    title: 'Moving Average Crossover',
    text: 'Trade BTCUSDT on H1 timeframe. Buy when the 20 EMA crosses above the 50 EMA. Close the buy when 20 EMA crosses back below 50 EMA. Use ATR(14) for dynamic stop loss at 1.5x ATR. Position size: 1% risk per trade. Add a 200 EMA trend filter - only buy when price is above the 200 EMA.',
  },
  {
    title: 'Bollinger Band Breakout',
    text: 'Trade XAUUSD (Gold) on H4. Buy when price breaks above the upper Bollinger Band (20, 2.0) with volume confirmation. Stop loss just below the middle band. Take profit at 2:1 ratio. Sell when price breaks below lower band. Maximum 3 trades at once. Include trailing stop at 20 pips when in profit.',
  },
  {
    title: 'Scalping Strategy',
    text: 'Scalp GBPUSD on M5. Use Stochastic(5,3,3) - buy when stochastic crosses above 20, sell when crosses below 80. Additionally require price to be above/below the VWAP. Stop loss: 10 pips. Take profit: 15 pips. Trade only between 08:00-12:00 and 13:00-17:00 GMT. Max 10 trades per day.',
  },
];

interface Props {
  onCreated?: () => void;
}

export default function StrategyBuilder({ onCreated }: Props) {
  const { settings, addStrategy, addNotification } = useStore();

  const [description, setDescription] = useState('');
  const [symbol, setSymbol] = useState('EURUSD');
  const [timeframe, setTimeframe] = useState('H1');
  const [generatedCode, setGeneratedCode] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [model, setModel] = useState(settings.openrouterModel);
  const [riskPercent, setRiskPercent] = useState(settings.riskPercent);
  const [lotSize, setLotSize] = useState(settings.defaultLotSize);

  const codeRef = useRef<HTMLPreElement>(null);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please describe your trading strategy');
      return;
    }
    if (!settings.openrouterApiKey) {
      setError('OpenRouter API key not configured. Go to Settings to add it.');
      return;
    }

    setError('');
    setIsGenerating(true);
    setGeneratedCode('');

    try {
      const result = await generateStrategy(
        description,
        settings.openrouterApiKey,
        model,
        { symbol, timeframe, riskPercent, lotSize }
      );

      setGeneratedCode(result.code);
      setStrategyName(result.name);

      addNotification({
        type: 'success',
        title: 'Strategy Generated!',
        message: `${result.name} • ${result.tokensUsed} tokens used`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      setError(msg);
      addNotification({ type: 'error', title: 'Generation Failed', message: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedCode) return;
    const id = genId();
    addStrategy({
      id,
      name: strategyName || 'Unnamed Strategy',
      description,
      mql5Code: generatedCode,
      symbol,
      timeframe,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    addNotification({
      type: 'success',
      title: 'Strategy Saved',
      message: `"${strategyName}" added to your strategies`,
    });
    onCreated?.();
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategyName.replace(/\s+/g, '_')}.mq5`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const useExample = (ex: typeof EXAMPLES[0]) => {
    setDescription(ex.text);
  };

  return (
    <div className="h-full flex gap-5 overflow-hidden">
      {/* Left Panel - Input */}
      <div className="w-96 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
        {/* API Key Warning */}
        {!settings.openrouterApiKey && (
          <div className="flex items-start gap-2 p-3 bg-accent-yellow/10 border border-accent-yellow/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-accent-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-accent-yellow">API Key Required</p>
              <p className="text-xs text-text-muted mt-0.5">Add your OpenRouter API key in Settings to generate strategies.</p>
            </div>
          </div>
        )}

        {/* Strategy Description */}
        <div className="trading-card flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-accent-purple" />
            <h3 className="text-sm font-semibold text-text-primary">Strategy Description</h3>
          </div>
          <p className="text-xs text-text-muted">
            Describe your trading strategy in plain language. The AI will convert it to complete MQL5 Expert Advisor code.
          </p>
          <textarea
            className="trading-input font-sans"
            rows={8}
            placeholder="Example: Buy EURUSD when RSI drops below 30 and bounces back. Sell when RSI exceeds 70. Use 30 pip stop loss and 60 pip take profit. Trade only during London session..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Pair & Timeframe */}
        <div className="trading-card flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Symbol & Timeframe</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Symbol</label>
              <select
                className="trading-input text-sm"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                <optgroup label="Forex">
                  {FOREX_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
                <optgroup label="Crypto">
                  {CRYPTO_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
                <optgroup label="Commodities">
                  {COMMODITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Timeframe</label>
              <select
                className="trading-input text-sm"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="trading-card">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-text-muted" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Advanced Settings</span>
            </div>
            {showAdvanced ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">AI Model</label>
                <select
                  className="trading-input text-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Risk % per trade</label>
                  <input
                    type="number"
                    className="trading-input text-sm"
                    value={riskPercent}
                    min={0.1}
                    max={10}
                    step={0.1}
                    onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Default Lot Size</label>
                  <input
                    type="number"
                    className="trading-input text-sm"
                    value={lotSize}
                    min={0.01}
                    max={10}
                    step={0.01}
                    onChange={(e) => setLotSize(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Examples */}
        <div className="trading-card flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-yellow" />
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Examples</h3>
          </div>
          <div className="space-y-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                onClick={() => useExample(ex)}
                className="w-full text-left p-2.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover border border-border transition-colors"
              >
                <p className="text-xs font-medium text-text-primary">{ex.title}</p>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{ex.text}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" />
            <p className="text-xs text-accent-red">{error}</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className="btn-primary flex items-center justify-center gap-2 py-3"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating MQL5 Code...
            </>
          ) : (
            <>
              <BrainCircuit className="w-4 h-4" />
              Generate MQL5 Strategy
            </>
          )}
        </button>
      </div>

      {/* Right Panel - Code Output */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
        <div className="trading-card flex-1 flex flex-col overflow-hidden">
          {/* Code Header */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-accent-red/60" />
                <div className="w-3 h-3 rounded-full bg-accent-yellow/60" />
                <div className="w-3 h-3 rounded-full bg-accent-green/60" />
              </div>
              <span className="text-xs font-mono text-text-muted">
                {generatedCode ? (strategyName || 'strategy.mq5') : 'MQL5 Expert Advisor'}
              </span>
              {generatedCode && (
                <span className="text-xs bg-accent-green/10 text-accent-green border border-accent-green/20 rounded px-1.5 py-0.5">
                  Ready
                </span>
              )}
            </div>

            {generatedCode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .mq5
                </button>
                <button
                  onClick={handleSave}
                  className="btn-success text-xs flex items-center gap-1.5 py-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Strategy
                </button>
              </div>
            )}
          </div>

          {/* Code Area */}
          <div className="flex-1 overflow-auto bg-bg-primary rounded-lg border border-border">
            {isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="spinner w-12 h-12" />
                  <BrainCircuit className="w-5 h-5 text-accent-blue absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-text-primary">AI is generating your strategy...</p>
                  <p className="text-xs text-text-muted mt-1">Analyzing description and writing MQL5 code</p>
                </div>
                <div className="flex gap-1 mt-2">
                  {['Parsing strategy...', 'Designing logic...', 'Writing MQL5...', 'Optimizing...'].map((step, i) => (
                    <div key={step} className={cn(
                      'h-1 w-12 rounded-full',
                      i === 0 ? 'bg-accent-blue' : 'bg-bg-tertiary'
                    )} />
                  ))}
                </div>
              </div>
            ) : generatedCode ? (
              <pre
                ref={codeRef}
                className="code-block text-text-primary p-4 overflow-auto h-full"
                style={{ fontSize: 12 }}
              >
                <code className="text-text-primary">{generatedCode}</code>
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
                <BrainCircuit className="w-16 h-16 text-text-muted opacity-30" />
                <div>
                  <p className="text-base font-medium text-text-secondary">Ready to generate MQL5 code</p>
                  <p className="text-sm text-text-muted mt-2 max-w-md">
                    Describe your trading strategy in plain Russian or English language. AI will generate a complete, ready-to-use Expert Advisor for MetaTrader 5.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2 text-left max-w-lg">
                  {[
                    { icon: '📊', text: 'Any technical indicator (RSI, MACD, MA, BB, etc.)' },
                    { icon: '⏱️', text: 'Any timeframe from M1 to Monthly' },
                    { icon: '💱', text: 'Forex, Crypto, Commodities, Indices' },
                    { icon: '🛡️', text: 'Risk management, SL/TP, trailing stop' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-start gap-2 p-2.5 bg-bg-secondary rounded-lg border border-border">
                      <span className="text-base">{icon}</span>
                      <p className="text-xs text-text-muted">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        {generatedCode && (
          <div className="trading-card flex-shrink-0">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">How to install in MetaTrader 5</h4>
            <ol className="space-y-1.5">
              {[
                'Download the .mq5 file or copy the code above',
                'In MetaTrader 5: File → Open Data Folder → MQL5 → Experts',
                'Paste the .mq5 file into the Experts folder',
                'In MetaTrader 5: Press F5 to compile, then drag onto chart',
                'Configure input parameters and enable Auto Trading',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
                  <span className="w-4 h-4 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
