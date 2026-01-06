/**
 * Claude Account API
 *
 * GET - Get account status
 * POST - Login/Logout actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { claudeAccountService } from '@/services/claude-account-service';

export async function GET() {
  try {
    const status = await claudeAccountService.getStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'logout') {
      const result = await claudeAccountService.logout();
      return NextResponse.json(result);
    }

    if (action === 'check-installed') {
      const installed = claudeAccountService.isClaudeInstalled();
      return NextResponse.json({ installed });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
