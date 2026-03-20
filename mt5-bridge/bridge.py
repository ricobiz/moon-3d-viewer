"""
AI Trading Bot — MetaTrader 5 Bridge
=====================================
Run this script on your Windows machine where MetaTrader 5 is installed.
It creates a local HTTP server that connects this app to your MT5 terminal.

Requirements:
    pip install MetaTrader5 flask flask-cors

Usage:
    python bridge.py [--host 0.0.0.0] [--port 8765]

The app at http://localhost:3000 will connect to this bridge automatically
when you enable it in Settings.
"""

import sys
import json
import time
import argparse
import threading
import logging
from datetime import datetime, timezone

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger(__name__)

# Check dependencies
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    log.warning("MetaTrader5 package not installed. Running in simulation mode.")
    log.warning("Install with: pip install MetaTrader5")

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError:
    log.error("Flask not installed. Run: pip install flask flask-cors")
    sys.exit(1)

app = Flask(__name__)
CORS(app, origins="*")

# ─── MT5 Connection ──────────────────────────────────────────────────────────

mt5_initialized = False
last_init_attempt = 0
REINIT_INTERVAL = 30  # seconds


def ensure_mt5():
    """Ensure MT5 is initialized, attempt reconnect if needed."""
    global mt5_initialized, last_init_attempt

    if not MT5_AVAILABLE:
        return False

    if mt5_initialized and mt5.terminal_info() is not None:
        return True

    now = time.time()
    if now - last_init_attempt < REINIT_INTERVAL:
        return False

    last_init_attempt = now
    log.info("Attempting MT5 initialization...")

    if mt5.initialize():
        mt5_initialized = True
        info = mt5.terminal_info()
        log.info(f"✓ MT5 connected: {info.name} build {info.build}")
        account = mt5.account_info()
        if account:
            log.info(f"✓ Account: #{account.login} | {account.company} | Balance: {account.balance} {account.currency}")
        return True
    else:
        error = mt5.last_error()
        log.warning(f"MT5 init failed: {error}")
        mt5_initialized = False
        return False


def get_account_data():
    """Get account information from MT5."""
    if not ensure_mt5():
        return None

    account = mt5.account_info()
    if not account:
        return None

    return {
        "login": account.login,
        "balance": account.balance,
        "equity": account.equity,
        "margin": account.margin,
        "freeMargin": account.margin_free,
        "marginLevel": account.margin_level,
        "profit": account.profit,
        "currency": account.currency,
        "leverage": account.leverage,
        "server": account.server,
        "company": account.company,
        "name": account.name,
    }


def get_trades_data():
    """Get open positions from MT5."""
    if not ensure_mt5():
        return []

    positions = mt5.positions_get()
    if positions is None:
        return []

    trades = []
    for pos in positions:
        # Get current tick
        tick = mt5.symbol_info_tick(pos.symbol)
        current_price = tick.bid if pos.type == 1 else tick.ask if tick else pos.price_open

        trades.append({
            "id": str(pos.ticket),
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "type": "BUY" if pos.type == 0 else "SELL",
            "lots": pos.volume,
            "openPrice": pos.price_open,
            "currentPrice": current_price,
            "sl": pos.sl,
            "tp": pos.tp,
            "profit": pos.profit,
            "swap": pos.swap,
            "openTime": datetime.fromtimestamp(pos.time, tz=timezone.utc).isoformat(),
            "comment": pos.comment,
            "magic": pos.magic,
        })

    return trades


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route('/status', methods=['GET'])
@app.route('/', methods=['GET'])
def status():
    """Return connection status and account info."""
    connected = ensure_mt5()

    response = {
        "connected": connected,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mt5Available": MT5_AVAILABLE,
    }

    if connected:
        response["account"] = get_account_data()
        response["trades"] = get_trades_data()

        # Terminal info
        if MT5_AVAILABLE:
            term = mt5.terminal_info()
            if term:
                response["terminal"] = {
                    "build": term.build,
                    "name": term.name,
                    "connected": term.connected,
                }

    return jsonify(response)


@app.route('/trades', methods=['GET'])
def get_trades():
    """Get all open positions."""
    if not ensure_mt5():
        return jsonify({"error": "MT5 not connected", "trades": []})

    return jsonify({"trades": get_trades_data()})


@app.route('/account', methods=['GET'])
def get_account():
    """Get account information."""
    if not ensure_mt5():
        return jsonify({"error": "MT5 not connected"})

    data = get_account_data()
    if not data:
        return jsonify({"error": "Failed to get account info"})

    return jsonify(data)


@app.route('/order', methods=['POST'])
def place_order():
    """Place a market order."""
    if not ensure_mt5():
        return jsonify({"success": False, "error": "MT5 not connected"})

    data = request.json
    symbol = data.get('symbol', 'EURUSD')
    order_type = data.get('type', 'BUY').upper()
    lots = float(data.get('lots', 0.01))
    sl_pips = float(data.get('slPips', 0))
    tp_pips = float(data.get('tpPips', 0))
    comment = data.get('comment', 'AI Trading Bot')
    magic = int(data.get('magic', 12345))

    # Get symbol info
    symbol_info = mt5.symbol_info(symbol)
    if not symbol_info:
        return jsonify({"success": False, "error": f"Symbol {symbol} not found"})

    if not symbol_info.visible:
        mt5.symbol_select(symbol, True)

    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return jsonify({"success": False, "error": "Cannot get price tick"})

    point = symbol_info.point
    digits = symbol_info.digits

    if order_type == 'BUY':
        price = tick.ask
        order_type_mt5 = mt5.ORDER_TYPE_BUY
        sl = round(price - sl_pips * 10 * point, digits) if sl_pips > 0 else 0.0
        tp = round(price + tp_pips * 10 * point, digits) if tp_pips > 0 else 0.0
    else:
        price = tick.bid
        order_type_mt5 = mt5.ORDER_TYPE_SELL
        sl = round(price + sl_pips * 10 * point, digits) if sl_pips > 0 else 0.0
        tp = round(price - tp_pips * 10 * point, digits) if tp_pips > 0 else 0.0

    request_data = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lots,
        "type": order_type_mt5,
        "price": price,
        "sl": sl,
        "tp": tp,
        "deviation": 20,
        "magic": magic,
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request_data)

    if result is None:
        error = mt5.last_error()
        return jsonify({"success": False, "error": f"Order send failed: {error}"})

    if result.retcode == mt5.TRADE_RETCODE_DONE:
        log.info(f"✓ Order placed: {order_type} {lots} {symbol} @ {price} | Ticket: {result.order}")
        return jsonify({
            "success": True,
            "ticket": result.order,
            "price": result.price,
            "volume": result.volume,
        })
    else:
        log.warning(f"Order failed: retcode={result.retcode} | {result.comment}")
        return jsonify({
            "success": False,
            "error": f"Order rejected: {result.comment} (code {result.retcode})",
        })


@app.route('/close', methods=['POST'])
def close_position():
    """Close an open position by ticket."""
    if not ensure_mt5():
        return jsonify({"success": False, "error": "MT5 not connected"})

    data = request.json
    ticket = int(data.get('ticket', 0))

    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        return jsonify({"success": False, "error": f"Position #{ticket} not found"})

    pos = positions[0]
    tick = mt5.symbol_info_tick(pos.symbol)
    if not tick:
        return jsonify({"success": False, "error": "Cannot get current price"})

    close_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
    price = tick.bid if pos.type == 0 else tick.ask

    request_data = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": pos.volume,
        "type": close_type,
        "position": ticket,
        "price": price,
        "deviation": 20,
        "magic": pos.magic,
        "comment": "Closed by AI Trading Bot",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request_data)

    if result and result.retcode == mt5.TRADE_RETCODE_DONE:
        log.info(f"✓ Position #{ticket} closed | P&L: {pos.profit}")
        return jsonify({"success": True, "ticket": ticket})
    else:
        err = result.comment if result else str(mt5.last_error())
        return jsonify({"success": False, "error": f"Close failed: {err}"})


@app.route('/close-all', methods=['POST'])
def close_all():
    """Close all open positions."""
    if not ensure_mt5():
        return jsonify({"success": False, "error": "MT5 not connected"})

    positions = mt5.positions_get()
    if not positions:
        return jsonify({"success": True, "closed": 0})

    closed = 0
    errors = []

    for pos in positions:
        tick = mt5.symbol_info_tick(pos.symbol)
        if not tick:
            errors.append(f"Cannot get tick for {pos.symbol}")
            continue

        close_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
        price = tick.bid if pos.type == 0 else tick.ask

        req = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": close_type,
            "position": pos.ticket,
            "price": price,
            "deviation": 20,
            "magic": pos.magic,
            "comment": "Close all by AI Trading Bot",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(req)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            closed += 1
        else:
            err = result.comment if result else str(mt5.last_error())
            errors.append(f"#{pos.ticket}: {err}")

    return jsonify({"success": True, "closed": closed, "errors": errors})


@app.route('/symbols', methods=['GET'])
def get_symbols():
    """Get available trading symbols."""
    if not ensure_mt5():
        return jsonify({"symbols": []})

    symbols = mt5.symbols_get()
    if not symbols:
        return jsonify({"symbols": []})

    result = [
        {
            "name": s.name,
            "description": s.description,
            "digits": s.digits,
            "spread": s.spread,
            "category": s.path.split("\\")[0] if s.path else "Other",
        }
        for s in symbols
        if s.visible
    ]

    return jsonify({"symbols": result})


@app.route('/history', methods=['GET'])
def get_history():
    """Get trade history."""
    if not ensure_mt5():
        return jsonify({"deals": []})

    days = int(request.args.get('days', 30))
    from_time = int(time.time()) - days * 86400

    deals = mt5.history_deals_get(from_time, int(time.time()))
    if not deals:
        return jsonify({"deals": []})

    result = [
        {
            "ticket": d.ticket,
            "order": d.order,
            "symbol": d.symbol,
            "type": "BUY" if d.type == 0 else "SELL",
            "volume": d.volume,
            "price": d.price,
            "profit": d.profit,
            "commission": d.commission,
            "swap": d.swap,
            "time": datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat(),
            "comment": d.comment,
        }
        for d in deals
        if d.entry == 1  # Only closing deals
    ]

    return jsonify({"deals": result})


@app.route('/tick/<symbol>', methods=['GET'])
def get_tick(symbol):
    """Get current price tick for a symbol."""
    if not ensure_mt5():
        return jsonify({"error": "MT5 not connected"})

    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return jsonify({"error": f"No tick data for {symbol}"})

    return jsonify({
        "symbol": symbol,
        "bid": tick.bid,
        "ask": tick.ask,
        "last": tick.last,
        "volume": tick.volume,
        "time": datetime.fromtimestamp(tick.time, tz=timezone.utc).isoformat(),
        "spread": round((tick.ask - tick.bid) * 100000, 1),
    })


# ─── Main ─────────────────────────────────────────────────────────────────────

def print_banner(host, port):
    print()
    print("╔═══════════════════════════════════════════════════╗")
    print("║         AI Trading Bot — MT5 Bridge               ║")
    print("╠═══════════════════════════════════════════════════╣")
    print(f"║  Listening on: http://{host}:{port}              ")
    print(f"║  MT5 Package:  {'✓ Available' if MT5_AVAILABLE else '✗ Not installed (simulation mode)'}            ")
    print("╠═══════════════════════════════════════════════════╣")
    print("║  Configure app at: http://localhost:3000/settings ║")
    print("║  Bridge URL:       http://localhost:8765           ║")
    print("╚═══════════════════════════════════════════════════╝")
    print()
    if not MT5_AVAILABLE:
        print("  ⚠  To enable real trading, install MetaTrader5:")
        print("     pip install MetaTrader5")
        print()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AI Trading Bot MT5 Bridge')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8765, help='Port to listen on (default: 8765)')
    parser.add_argument('--debug', action='store_true', help='Enable Flask debug mode')
    args = parser.parse_args()

    print_banner(args.host, args.port)

    # Try initial MT5 connection
    if MT5_AVAILABLE:
        ensure_mt5()

    app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)
