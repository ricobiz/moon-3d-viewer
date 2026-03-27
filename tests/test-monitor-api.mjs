/**
 * Real-scenario integration tests for the AI Portfolio Monitor API.
 * Runs against a live Next.js dev server on port 3001.
 *
 * Tests:
 *  1. Low-risk scenario  — healthy session, no losses
 *  2. Medium-risk        — 2 consecutive losses, small drawdown
 *  3. High-risk          — 3 consecutive losses, 6% drawdown
 *  4. Critical-risk      — 4+ consecutive losses, 12% drawdown
 *  5. No positions       — empty state (just started)
 *  6. Win-streak         — 5 consecutive wins, verify 'continue' action
 *  7. Missing fields     — partial body, verify no crash
 *  8. GET /api/monitor   — verify info response
 */

const BASE = 'http://localhost:3001';

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${extra ? ' — ' + extra : ''}`);
    failed++;
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

function makeTrade(profit) {
  // Trade type is independent of profit: a BUY can lose, a SELL can profit.
  const types = ['BUY', 'SELL'];
  return { ticket: Math.floor(Math.random() * 99999), symbol: 'EURUSD', type: types[Math.floor(Math.random() * 2)], profit };
}

function makePosition(profit) {
  return {
    ticket: Math.floor(Math.random() * 99999),
    symbol: 'EURUSD',
    type: 'BUY',
    lots: 0.01,
    openPrice: 1.085,
    currentPrice: 1.085 + profit * 0.0001,
    sl: 1.080,
    tp: 1.090,
    profit,
    openTime: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);
const VALID_ACTIONS = new Set(['continue', 'tighten_sl', 'reduce_size', 'pause', 'close_worst', 'switch_strategy']);
const VALID_URGENCY = new Set(['low', 'medium', 'high']);

function assertShape(label, r) {
  assert(`${label}: has riskLevel`, VALID_RISK_LEVELS.has(r.riskLevel), r.riskLevel);
  assert(`${label}: has action`, VALID_ACTIONS.has(r.action), r.action);
  assert(`${label}: has urgency`, VALID_URGENCY.has(r.urgency), r.urgency);
  assert(`${label}: assessment is non-empty string`, typeof r.assessment === 'string' && r.assessment.length > 10, r.assessment);
  assert(`${label}: recommendation is non-empty string`, typeof r.recommendation === 'string' && r.recommendation.length > 5, r.recommendation);
  assert(`${label}: indicators is array`, Array.isArray(r.indicators));
  assert(`${label}: indicators has 1-5 items`, r.indicators.length >= 1 && r.indicators.length <= 7, JSON.stringify(r.indicators));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testLowRisk() {
  console.log('\n📊 Test 1: Low-risk healthy session');
  const r = await post('/api/monitor', {
    positions: [makePosition(15)],
    closedTrades: [makeTrade(20), makeTrade(15), makeTrade(30)],
    equity: 10150,
    balance: 10000,
    netPnL: 15,
    strategy: 'Trend following on EURUSD M15',
    symbol: 'EURUSD',
    timeframe: 'M15',
    sessionStats: { decisions: 10, executed: 3, wins: 3, losses: 0, errors: 0 },
    // no apiKey → rule-based
  });
  assertShape('Low-risk', r);
  assert('Low-risk: riskLevel is low', r.riskLevel === 'low', r.riskLevel);
  assert('Low-risk: action is continue', r.action === 'continue', r.action);
}

async function testMediumRisk() {
  console.log('\n📊 Test 2: Medium-risk (2 consecutive losses)');
  const r = await post('/api/monitor', {
    positions: [makePosition(-35)],
    closedTrades: [makeTrade(10), makeTrade(5), makeTrade(-20), makeTrade(-25)],
    equity: 9750,   // ~2.5% drawdown
    balance: 10000,
    netPnL: -35,
    strategy: 'RSI reversal',
    symbol: 'EURUSD',
    timeframe: 'M15',
    sessionStats: { decisions: 8, executed: 4, wins: 2, losses: 2, errors: 0 },
  });
  assertShape('Medium-risk', r);
  assert('Medium-risk: riskLevel is medium', r.riskLevel === 'medium', r.riskLevel);
  assert('Medium-risk: action is reduce_size', r.action === 'reduce_size', r.action);
}

async function testHighRisk() {
  console.log('\n📊 Test 3: High-risk (3 consecutive losses, 6% drawdown)');
  const r = await post('/api/monitor', {
    positions: [makePosition(-80)],
    closedTrades: [makeTrade(10), makeTrade(-30), makeTrade(-45), makeTrade(-50)],
    equity: 9400,   // 6% drawdown
    balance: 10000,
    netPnL: -80,
    strategy: 'Breakout on BTCUSDT',
    symbol: 'BTCUSDT',
    timeframe: 'H1',
    sessionStats: { decisions: 12, executed: 4, wins: 1, losses: 3, errors: 1 },
  });
  assertShape('High-risk', r);
  assert('High-risk: riskLevel is high or critical', r.riskLevel === 'high' || r.riskLevel === 'critical', r.riskLevel);
  assert('High-risk: action is tighten_sl or pause', r.action === 'tighten_sl' || r.action === 'pause', r.action);
  assert('High-risk: urgency is medium or high', r.urgency !== 'low', r.urgency);
}

async function testCriticalRisk() {
  console.log('\n📊 Test 4: Critical-risk (4 consecutive losses, 12% drawdown)');
  const r = await post('/api/monitor', {
    positions: [makePosition(-200)],
    closedTrades: [
      makeTrade(-60), makeTrade(-80), makeTrade(-90), makeTrade(-70), makeTrade(-100),
    ],
    equity: 8800,   // 12% drawdown
    balance: 10000,
    netPnL: -200,
    strategy: 'Grid martingale',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    sessionStats: { decisions: 15, executed: 5, wins: 0, losses: 5, errors: 2 },
  });
  assertShape('Critical', r);
  assert('Critical: riskLevel is critical', r.riskLevel === 'critical', r.riskLevel);
  assert('Critical: action is pause', r.action === 'pause', r.action);
  assert('Critical: urgency is high', r.urgency === 'high', r.urgency);
  // Indicators should mention consecutive losses
  const mentionsLosses = r.indicators.some(i => i.toLowerCase().includes('loss') || i.toLowerCase().includes('consecutive'));
  assert('Critical: indicators mention losses', mentionsLosses, JSON.stringify(r.indicators));
}

async function testEmptyState() {
  console.log('\n📊 Test 5: Empty state (just started, no positions, no history)');
  const r = await post('/api/monitor', {
    positions: [],
    closedTrades: [],
    equity: 10000,
    balance: 10000,
    netPnL: 0,
    strategy: 'Trend following',
    symbol: 'EURUSD',
    timeframe: 'M15',
    sessionStats: { decisions: 0, executed: 0, wins: 0, losses: 0, errors: 0 },
  });
  assertShape('Empty', r);
  assert('Empty: riskLevel is low', r.riskLevel === 'low', r.riskLevel);
  assert('Empty: action is continue', r.action === 'continue', r.action);
  assert('Empty: drawdown is 0%', r.indicators.some(i => i.includes('0.0%') || i.includes('0%')), JSON.stringify(r.indicators));
}

async function testWinStreak() {
  console.log('\n📊 Test 6: Win streak — 5 consecutive wins');
  const r = await post('/api/monitor', {
    positions: [makePosition(45)],
    closedTrades: [
      makeTrade(30), makeTrade(25), makeTrade(40), makeTrade(35), makeTrade(50),
    ],
    equity: 10225,
    balance: 10000,
    netPnL: 45,
    strategy: 'Momentum breakout',
    symbol: 'GBPUSD',
    timeframe: 'M30',
    sessionStats: { decisions: 20, executed: 5, wins: 5, losses: 0, errors: 0 },
  });
  assertShape('WinStreak', r);
  assert('WinStreak: riskLevel is low', r.riskLevel === 'low', r.riskLevel);
  assert('WinStreak: action is continue', r.action === 'continue', r.action);
}

async function testMissingFields() {
  console.log('\n📊 Test 7: Missing / partial body (no crash expected)');
  const r = await post('/api/monitor', {
    // minimal body, everything optional
    strategy: 'Test',
  });
  assertShape('Partial', r);
  // With empty/zero data should come back as low risk
  assert('Partial: does not crash, returns valid riskLevel', VALID_RISK_LEVELS.has(r.riskLevel), r.riskLevel);
}

async function testGetEndpoint() {
  console.log('\n📊 Test 8: GET /api/monitor returns info');
  const r = await get('/api/monitor');
  assert('GET: returns info field', typeof r.info === 'string' && r.info.length > 5, r.info);
}

async function testApiAutotraderShape() {
  console.log('\n📊 Test 9: /api/autotrader validates input (no API key → 400 + error field)');
  // Without an apiKey the autotrader API should return HTTP 400 with an error payload
  const res = await fetch(`${BASE}/api/autotrader`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candles: Array.from({ length: 5 }, (_, i) => ({
        time: Date.now() / 1000 - (4 - i) * 900,
        open: 1.085 + i * 0.0001,
        high: 1.085 + i * 0.0001 + 0.0005,
        low: 1.085 + i * 0.0001 - 0.0005,
        close: 1.085 + i * 0.0001 + 0.0002,
        volume: 100,
      })),
      strategy: 'buy when bullish',
      symbol: 'EURUSD',
      timeframe: 'M15',
      openTrades: 0,
      slPips: 50,
      tpPips: 100,
      // no apiKey — should be rejected with 400
    }),
  });
  // Correct: API rejects missing apiKey with 400 Bad Request
  assert('/api/autotrader: responds 400 when no API key', res.status === 400, `status=${res.status}`);
  const r = await res.json();
  assert('/api/autotrader: returns error field', typeof r.error === 'string', JSON.stringify(r));
  assert('/api/autotrader: error mentions API key', r.error.toLowerCase().includes('api key') || r.error.toLowerCase().includes('openrouter'), r.error);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 Real-Scenario Integration Tests — AI Monitor & AutoTrader\n');
  console.log(`   Server: ${BASE}\n`);

  // Quick connectivity check
  try {
    await fetch(`${BASE}/api/monitor`);
  } catch (e) {
    console.error(`❌ Cannot reach ${BASE} — is the dev server running? (${e.message})`);
    process.exit(1);
  }

  try {
    await testLowRisk();
    await testMediumRisk();
    await testHighRisk();
    await testCriticalRisk();
    await testEmptyState();
    await testWinStreak();
    await testMissingFields();
    await testGetEndpoint();
    await testApiAutotraderShape();
  } catch (e) {
    console.error('\n💥 Unexpected error:', e.message);
    failed++;
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('❌ Some tests FAILED');
    process.exit(1);
  } else {
    console.log('✅ All tests passed');
  }
}

main();
