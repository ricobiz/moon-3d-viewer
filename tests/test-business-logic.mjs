/**
 * Unit tests for the core business logic extracted from:
 * - Trade open/close detection (autotrader/page.tsx useEffect)
 * - Monitor risk assessment logic (api/monitor/route.ts buildRuleBasedAssessment)
 * - Strategy queue cycle countdown logic
 *
 * Run with: npm run test:logic  (or: node tests/test-business-logic.mjs)
 */

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

// ─── Replicate the trade detection logic ──────────────────────────────────────

function detectTradeChanges(prevTrades, currTrades) {
  const notifications = [];

  // Closed trades: present in prev, absent in curr
  prevTrades.forEach(prevTrade => {
    if (!currTrades.find(t => t.ticket === prevTrade.ticket)) {
      const pnl = prevTrade.profit;
      const isWin = pnl >= 0;
      notifications.push({
        event: 'closed',
        type: isWin ? 'success' : 'error',
        title: `Trade Closed: ${prevTrade.type} ${prevTrade.symbol}`,
        message: `#${prevTrade.ticket} | P&L: ${isWin ? '+' : ''}${pnl.toFixed(2)}`,
        pnl,
        isWin,
        trade: prevTrade,
      });
    }
  });

  // Opened trades: present in curr, absent in prev
  currTrades.forEach(currTrade => {
    if (!prevTrades.find(t => t.ticket === currTrade.ticket)) {
      notifications.push({
        event: 'opened',
        type: 'info',
        title: `Trade Opened: ${currTrade.type} ${currTrade.symbol}`,
        message: `#${currTrade.ticket} | ${currTrade.lots}L @ ${currTrade.openPrice}`,
        trade: currTrade,
      });
    }
  });

  return notifications;
}

// ─── Replicate the rule-based monitor logic ────────────────────────────────────

function buildRuleBasedAssessment(positions, closedTrades, equity, balance, netPnL, stats) {
  const drawdown = balance > 0 ? (balance - equity) / balance * 100 : 0;
  const recent = closedTrades.slice(-10);
  const losses = recent.filter(t => t.profit < 0).length;
  const wins = recent.filter(t => t.profit > 0).length;
  const consecutiveLosses = (() => {
    let count = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].profit < 0) count++;
      else break;
    }
    return count;
  })();

  const riskLevel =
    drawdown > 10 || consecutiveLosses >= 4 ? 'critical' :
    drawdown > 5 || consecutiveLosses >= 3 ? 'high' :
    drawdown > 2 || consecutiveLosses >= 2 ? 'medium' : 'low';

  const action =
    riskLevel === 'critical' ? 'pause' :
    riskLevel === 'high' ? 'tighten_sl' :
    riskLevel === 'medium' ? 'reduce_size' : 'continue';

  const indicators = [
    `${positions.length} open position${positions.length !== 1 ? 's' : ''}, floating P&L: ${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)}`,
    `Drawdown: ${drawdown.toFixed(1)}%`,
    `Recent: ${wins} wins / ${losses} losses`,
  ];
  if (consecutiveLosses >= 2) indicators.push(`⚠️ ${consecutiveLosses} consecutive losses detected`);
  if (stats.errors > 0) indicators.push(`${stats.errors} API error${stats.errors > 1 ? 's' : ''} this session`);

  return { riskLevel, action, drawdown, consecutiveLosses, indicators, wins, losses };
}

// ─── Replicate the strategy queue logic ───────────────────────────────────────

function simulateQueueCycleCountdown(queue, queueIndex, cyclesLeft, onSwitch) {
  if (queue.length > 1 && cyclesLeft > 0) {
    const next = cyclesLeft - 1;
    if (next <= 0) {
      const nextIdx = (queueIndex + 1) % queue.length;
      onSwitch(nextIdx, queue[nextIdx]);
      return { newIndex: nextIdx, newCyclesLeft: queue[nextIdx].cycles };
    }
    return { newIndex: queueIndex, newCyclesLeft: next };
  }
  return { newIndex: queueIndex, newCyclesLeft: cyclesLeft };
}

// ─── Trade helper ──────────────────────────────────────────────────────────────

function makeTrade(ticket, symbol, type, profit, lots = 0.01, openPrice = 1.085) {
  return { id: `t${ticket}`, ticket, symbol, type, profit, lots, openPrice, swap: 0, openTime: new Date().toISOString(), comment: '' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Trade Detection Logic
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔔 Suite 1: Trade Open/Close Detection Logic\n');

// Test 1.1: Opening a trade from empty
{
  const prev = [];
  const curr = [makeTrade(1001, 'EURUSD', 'BUY', 0)];
  const notes = detectTradeChanges(prev, curr);
  assert('1.1 Opening: generates 1 notification', notes.length === 1, `got ${notes.length}`);
  assert('1.1 Opening: type is info', notes[0].type === 'info', notes[0].type);
  assert('1.1 Opening: event is opened', notes[0].event === 'opened', notes[0].event);
  assert('1.1 Opening: title contains symbol', notes[0].title.includes('EURUSD'), notes[0].title);
  assert('1.1 Opening: message has ticket and price', notes[0].message.includes('#1001') && notes[0].message.includes('1.085'), notes[0].message);
}

// Test 1.2: Closing a trade with profit
{
  const prev = [makeTrade(1002, 'GBPUSD', 'SELL', 42.50)];
  const curr = [];
  const notes = detectTradeChanges(prev, curr);
  assert('1.2 Close profit: generates 1 notification', notes.length === 1);
  assert('1.2 Close profit: type is success', notes[0].type === 'success', notes[0].type);
  assert('1.2 Close profit: event is closed', notes[0].event === 'closed', notes[0].event);
  assert('1.2 Close profit: title says Trade Closed', notes[0].title.includes('Trade Closed'), notes[0].title);
  assert('1.2 Close profit: message shows +P&L', notes[0].message.includes('+42.50'), notes[0].message);
  assert('1.2 Close profit: isWin is true', notes[0].isWin === true);
}

// Test 1.3: Closing a trade with loss
{
  const prev = [makeTrade(1003, 'USDJPY', 'BUY', -28.75)];
  const curr = [];
  const notes = detectTradeChanges(prev, curr);
  assert('1.3 Close loss: type is error', notes[0].type === 'error', notes[0].type);
  assert('1.3 Close loss: message shows -P&L', notes[0].message.includes('-28.75'), notes[0].message);
  assert('1.3 Close loss: isWin is false', notes[0].isWin === false);
}

// Test 1.4: Closing exactly at breakeven (profit = 0) → treated as win
{
  const prev = [makeTrade(1004, 'XAUUSD', 'BUY', 0.00)];
  const curr = [];
  const notes = detectTradeChanges(prev, curr);
  assert('1.4 Breakeven: type is success (profit >= 0)', notes[0].type === 'success', notes[0].type);
  assert('1.4 Breakeven: isWin is true', notes[0].isWin === true);
}

// Test 1.5: Multiple trades — 2 closed, 1 opened, 1 unchanged
{
  const prev = [
    makeTrade(2001, 'EURUSD', 'BUY', 10),   // stays open
    makeTrade(2002, 'EURUSD', 'SELL', -5),   // closes with loss
    makeTrade(2003, 'GBPUSD', 'BUY', 30),   // closes with profit
  ];
  const curr = [
    makeTrade(2001, 'EURUSD', 'BUY', 12),   // still open, updated profit
    makeTrade(2004, 'BTCUSDT', 'BUY', 0),   // newly opened
  ];
  const notes = detectTradeChanges(prev, curr);
  const closed = notes.filter(n => n.event === 'closed');
  const opened = notes.filter(n => n.event === 'opened');
  assert('1.5 Mixed: 2 closed notifications', closed.length === 2, `got ${closed.length}`);
  assert('1.5 Mixed: 1 opened notification', opened.length === 1, `got ${opened.length}`);
  assert('1.5 Mixed: unchanged trade not notified', !notes.some(n => n.trade?.ticket === 2001));
  assert('1.5 Mixed: closed loss has error type', closed.find(n => n.trade.ticket === 2002)?.type === 'error');
  assert('1.5 Mixed: closed win has success type', closed.find(n => n.trade.ticket === 2003)?.type === 'success');
  assert('1.5 Mixed: opened has info type', opened[0].type === 'info');
}

// Test 1.6: No changes between snapshots
{
  const prev = [makeTrade(3001, 'EURUSD', 'BUY', 5)];
  const curr = [makeTrade(3001, 'EURUSD', 'BUY', 7)]; // same ticket, profit changed
  const notes = detectTradeChanges(prev, curr);
  assert('1.6 No change: 0 notifications', notes.length === 0, `got ${notes.length}`);
}

// Test 1.7: Complete session clear (all trades closed)
{
  const prev = [
    makeTrade(4001, 'EURUSD', 'BUY', 15),
    makeTrade(4002, 'GBPUSD', 'SELL', -10),
    makeTrade(4003, 'USDJPY', 'BUY', 25),
  ];
  const curr = [];
  const notes = detectTradeChanges(prev, curr);
  assert('1.7 All closed: 3 notifications', notes.length === 3, `got ${notes.length}`);
  assert('1.7 All closed: all are closed events', notes.every(n => n.event === 'closed'));
  const netPnl = notes.reduce((s, n) => s + n.pnl, 0);
  assert('1.7 All closed: net P&L correct', Math.abs(netPnl - 30) < 0.001, `got ${netPnl}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Monitor Rule-Based Logic
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🧠 Suite 2: AI Monitor Rule-Based Risk Assessment\n');

const baseStats = { decisions: 10, executed: 3, wins: 2, losses: 1, errors: 0 };

// Test 2.1: Low risk baseline
{
  const r = buildRuleBasedAssessment(
    [{ profit: 15 }],
    [{ profit: 20 }, { profit: 15 }, { profit: 30 }],
    10150, 10000, 15, baseStats
  );
  assert('2.1 Low risk: riskLevel', r.riskLevel === 'low', r.riskLevel);
  assert('2.1 Low risk: action is continue', r.action === 'continue', r.action);
  assert('2.1 Low risk: drawdown ~-1.5%', r.drawdown < 0, `${r.drawdown}%`); // negative = equity > balance
}

// Test 2.2: Medium risk — 2 consecutive losses
{
  const r = buildRuleBasedAssessment(
    [], 
    [{ profit: 10 }, { profit: 5 }, { profit: -20 }, { profit: -25 }],
    9750, 10000, 0, baseStats
  );
  assert('2.2 Medium: riskLevel', r.riskLevel === 'medium', r.riskLevel);
  assert('2.2 Medium: action is reduce_size', r.action === 'reduce_size', r.action);
  assert('2.2 Medium: 2 consecutive losses', r.consecutiveLosses === 2, `got ${r.consecutiveLosses}`);
  assert('2.2 Medium: drawdown 2.5%', Math.abs(r.drawdown - 2.5) < 0.01, `${r.drawdown}%`);
}

// Test 2.3: High risk — 3 consecutive losses + 6% drawdown
{
  const r = buildRuleBasedAssessment(
    [],
    [{ profit: 10 }, { profit: -30 }, { profit: -45 }, { profit: -50 }],
    9400, 10000, 0, baseStats
  );
  assert('2.3 High: riskLevel', r.riskLevel === 'high', r.riskLevel);
  assert('2.3 High: action is tighten_sl', r.action === 'tighten_sl', r.action);
  assert('2.3 High: 3 consecutive losses', r.consecutiveLosses === 3, `got ${r.consecutiveLosses}`);
}

// Test 2.4: Critical — 4+ consecutive losses  
{
  const r = buildRuleBasedAssessment(
    [],
    [{ profit: 5 }, { profit: -60 }, { profit: -80 }, { profit: -90 }, { profit: -70 }],
    8000, 10000, 0, baseStats
  );
  assert('2.4 Critical: riskLevel', r.riskLevel === 'critical', r.riskLevel);
  assert('2.4 Critical: action is pause', r.action === 'pause', r.action);
  assert('2.4 Critical: 4 consecutive losses', r.consecutiveLosses === 4, `got ${r.consecutiveLosses}`);
  assert('2.4 Critical: indicators have loss warning', r.indicators.some(i => i.includes('consecutive')));
}

// Test 2.5: Critical by drawdown alone (>10%)
{
  const r = buildRuleBasedAssessment(
    [],
    [{ profit: 5 }, { profit: 3 }], // wins, no consecutive losses
    8900, 10000, 0, { ...baseStats, wins: 2, losses: 0 }
  );
  assert('2.5 Critical drawdown: riskLevel', r.riskLevel === 'critical', r.riskLevel);
  assert('2.5 Critical drawdown: drawdown >10%', r.drawdown > 10, `${r.drawdown}%`);
}

// Test 2.6: Win streak doesn't trigger risk escalation
{
  const r = buildRuleBasedAssessment(
    [{ profit: 50 }],
    [{ profit: 30 }, { profit: 25 }, { profit: 40 }, { profit: 35 }, { profit: 50 }],
    10225, 10000, 50, { ...baseStats, wins: 5, losses: 0 }
  );
  assert('2.6 Win streak: riskLevel low', r.riskLevel === 'low', r.riskLevel);
  assert('2.6 Win streak: action continue', r.action === 'continue', r.action);
  assert('2.6 Win streak: 0 consecutive losses', r.consecutiveLosses === 0, `got ${r.consecutiveLosses}`);
}

// Test 2.7: Error count appears in indicators
{
  const r = buildRuleBasedAssessment(
    [], [], 10000, 10000, 0,
    { decisions: 5, executed: 2, wins: 1, losses: 1, errors: 3 }
  );
  assert('2.7 Errors: appears in indicators', r.indicators.some(i => i.includes('3 API errors')), JSON.stringify(r.indicators));
}

// Test 2.8: Empty state — no data at all
{
  const r = buildRuleBasedAssessment([], [], 0, 0, 0, { decisions: 0, executed: 0, wins: 0, losses: 0, errors: 0 });
  assert('2.8 Empty state: riskLevel low', r.riskLevel === 'low', r.riskLevel);
  assert('2.8 Empty state: action continue', r.action === 'continue', r.action);
  assert('2.8 Empty state: drawdown 0', r.drawdown === 0, `${r.drawdown}`);
}

// Test 2.9: Exactly 2% drawdown is NOT enough (boundary uses strict >2)
{
  const r = buildRuleBasedAssessment([], [], 9800, 10000, 0, baseStats);
  // drawdown is exactly 2.0% → condition is drawdown > 2, so stays low
  assert('2.9 Exactly 2% drawdown: still low (boundary is >2, not >=2)', r.riskLevel === 'low', `${r.riskLevel} at ${r.drawdown}%`);
}

// Test 2.9b: Just above 2% threshold triggers medium
{
  const r = buildRuleBasedAssessment([], [], 9799, 10000, 0, baseStats);
  // drawdown is 2.01% → above threshold → medium
  assert('2.9b 2.01% drawdown: medium risk triggered', r.riskLevel === 'medium', `${r.riskLevel} at ${r.drawdown}%`);
}

// Test 2.10: Just below 2% drawdown threshold
{
  const r = buildRuleBasedAssessment([], [], 9810, 10000, 0, baseStats);
  assert('2.10 Below 2%: low risk', r.riskLevel === 'low', `${r.riskLevel} at ${r.drawdown}%`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Strategy Queue Logic
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n📋 Suite 3: Strategy Queue Cycle Logic\n');

const makeQueueItem = (id, cycles) => ({
  id, symbol: 'EURUSD', timeframe: 'M15',
  strategy: `Strategy ${id}`, cycles, label: `Strategy ${id}`,
});

// Test 3.1: Countdown decrements
{
  const queue = [makeQueueItem('A', 3), makeQueueItem('B', 5)];
  let switched = false;
  const r = simulateQueueCycleCountdown(queue, 0, 3, () => { switched = true; });
  assert('3.1 Countdown: cycles decremented', r.newCyclesLeft === 2, `got ${r.newCyclesLeft}`);
  assert('3.1 Countdown: no switch yet', !switched);
  assert('3.1 Countdown: index unchanged', r.newIndex === 0);
}

// Test 3.2: Switch triggered when cycles reach 0
{
  const queue = [makeQueueItem('A', 3), makeQueueItem('B', 5)];
  let switchedTo = null;
  const r = simulateQueueCycleCountdown(queue, 0, 1, (idx, item) => { switchedTo = { idx, item }; });
  assert('3.2 Switch: triggered on last cycle', switchedTo !== null);
  assert('3.2 Switch: switches to next item', switchedTo.idx === 1, `switched to ${switchedTo.idx}`);
  assert('3.2 Switch: new cycles from next item', r.newCyclesLeft === 5, `got ${r.newCyclesLeft}`);
  assert('3.2 Switch: new index is 1', r.newIndex === 1, `got ${r.newIndex}`);
}

// Test 3.3: Wraps around at end of queue
{
  const queue = [makeQueueItem('A', 3), makeQueueItem('B', 2), makeQueueItem('C', 4)];
  let switchedTo = null;
  // Currently on last item (index 2), 1 cycle left
  const r = simulateQueueCycleCountdown(queue, 2, 1, (idx, item) => { switchedTo = { idx, item }; });
  assert('3.3 Wrap: switches to index 0', switchedTo.idx === 0, `switched to ${switchedTo.idx}`);
  assert('3.3 Wrap: new cycles from first item', r.newCyclesLeft === 3, `got ${r.newCyclesLeft}`);
}

// Test 3.4: No switch with single item in queue
{
  const queue = [makeQueueItem('A', 3)];
  let switched = false;
  const r = simulateQueueCycleCountdown(queue, 0, 1, () => { switched = true; });
  assert('3.4 Single item: no switch', !switched, 'should not switch with 1 item');
}

// Test 3.5: Infinite cycles (cyclesPerStrategy = 0) — no countdown
{
  const queue = [makeQueueItem('A', 0), makeQueueItem('B', 5)];
  let switched = false;
  // cyclesLeft = 0 → the condition (queue.length > 1 && cyclesPerStrategy > 0) is false
  const r = simulateQueueCycleCountdown(queue, 0, 0, () => { switched = true; });
  assert('3.5 Infinite cycles: no countdown/switch', !switched);
  assert('3.5 Infinite cycles: cycles stay at 0', r.newCyclesLeft === 0, `got ${r.newCyclesLeft}`);
}

// Test 3.6: Simulate a full multi-strategy session
{
  const queue = [
    makeQueueItem('momentum', 3),
    makeQueueItem('rsi', 2),
    makeQueueItem('trend', 4),
  ];
  let idx = 0;
  let cycles = queue[0].cycles;
  const switches = [];

  // 9 decisions: 3 for momentum, 2 for rsi, 4 for trend → wraps back to momentum
  // Switches happen at decisions 3, 5, 9 (3 total)
  for (let decision = 0; decision < 9; decision++) {
    const r = simulateQueueCycleCountdown(queue, idx, cycles, (newIdx, item) => {
      switches.push({ atDecision: decision, fromIdx: idx, toIdx: newIdx, item: item.id });
      idx = newIdx;
      cycles = item.cycles;
    });
    if (r.newIndex === idx) cycles = r.newCyclesLeft;
  }

  // 9 decisions / [3, 2, 4] cycle budgets → 3 strategy switches
  assert('3.6 Full session: 3 switches happened (3+2+4=9)', switches.length === 3, `got ${switches.length} switches: ${JSON.stringify(switches)}`);
  assert('3.6 Full session: 1st switch to rsi', switches[0].item === 'rsi', switches[0].item);
  assert('3.6 Full session: 2nd switch to trend', switches[1].item === 'trend', switches[1].item);
  assert('3.6 Full session: 3rd switch wraps back to momentum', switches[2].item === 'momentum', switches[2].item);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n⚠️  Suite 4: Edge Cases & Boundary Conditions\n');

// Test 4.1: Very large profit/loss values
{
  const prev = [makeTrade(9001, 'BTCUSDT', 'BUY', 15000.50)];
  const curr = [];
  const notes = detectTradeChanges(prev, curr);
  assert('4.1 Large profit: message formatted', notes[0].message.includes('+15000.50'), notes[0].message);
}

// Test 4.2: Tiny fractional loss
{
  const prev = [makeTrade(9002, 'EURUSD', 'SELL', -0.01)];
  const curr = [];
  const notes = detectTradeChanges(prev, curr);
  assert('4.2 Tiny loss: still error type', notes[0].type === 'error', notes[0].type);
  assert('4.2 Tiny loss: message shows -0.01', notes[0].message.includes('-0.01'), notes[0].message);
}

// Test 4.3: Multiple opens simultaneously
{
  const prev = [];
  const curr = [
    makeTrade(5001, 'EURUSD', 'BUY', 0),
    makeTrade(5002, 'GBPUSD', 'SELL', 0),
    makeTrade(5003, 'XAUUSD', 'BUY', 0),
  ];
  const notes = detectTradeChanges(prev, curr);
  assert('4.3 Multi-open: 3 notifications', notes.length === 3, `got ${notes.length}`);
  assert('4.3 Multi-open: all info type', notes.every(n => n.type === 'info'));
}

// Test 4.4: Monitor with very high drawdown (50%)
{
  const r = buildRuleBasedAssessment([], [], 5000, 10000, 0, baseStats);
  assert('4.4 Extreme drawdown: critical', r.riskLevel === 'critical', r.riskLevel);
  assert('4.4 Extreme drawdown: 50%', Math.abs(r.drawdown - 50) < 0.01, `${r.drawdown}%`);
}

// Test 4.5: exactly 5 consecutive losses → critical
{
  const r = buildRuleBasedAssessment(
    [], [{ profit: 10 }, { profit: -5 }, { profit: -8 }, { profit: -12 }, { profit: -6 }, { profit: -9 }],
    9700, 10000, 0, baseStats
  );
  assert('4.5 5 consec losses: critical', r.riskLevel === 'critical', r.riskLevel);
  assert('4.5 5 consec losses: pause', r.action === 'pause', r.action);
}

// ─── Runner ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('❌ Some unit tests FAILED');
  process.exit(1);
} else {
  console.log('✅ All unit tests passed');
}
