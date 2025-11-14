import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { valid: false },
        { status: 401 }
      );
    }

    // Verify token (simple check - in production use proper JWT verification)
    try {
      Buffer.from(token, 'base64').toString();
      return NextResponse.json({ valid: true }, { status: 200 });
    } catch {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

