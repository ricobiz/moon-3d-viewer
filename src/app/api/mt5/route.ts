import { NextRequest, NextResponse } from 'next/server';

// MT5 Bridge API proxy
// The bridge.py script runs on the user's Windows machine with MT5

const getBridgeUrl = () => {
  return process.env.MT5_BRIDGE_URL || 'http://localhost:8765';
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';
  const bridgeUrl = getBridgeUrl();

  try {
    const response = await fetch(`${bridgeUrl}/${action}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { connected: false, error: `Bridge error: ${response.status}` },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // Bridge is not running
    return NextResponse.json(
      {
        connected: false,
        error: 'MT5 bridge not reachable',
        hint: 'Run mt5-bridge/bridge.py on your Windows machine',
      },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, ...params } = body;
  const bridgeUrl = getBridgeUrl();

  try {
    const response = await fetch(`${bridgeUrl}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Bridge error: ${response.status}` },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'MT5 bridge not reachable' },
      { status: 200 }
    );
  }
}
