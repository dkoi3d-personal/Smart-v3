import { NextResponse } from 'next/server';
import { devServerManager } from '@/services/dev-server-manager';

export async function POST() {
  try {
    console.log('[API] Stopping all preview servers');
    await devServerManager.stopAll();

    return NextResponse.json({
      success: true,
      message: 'All preview servers stopped'
    });
  } catch (error) {
    console.error('Stop all preview error:', error);
    return NextResponse.json(
      { error: 'Failed to stop all previews' },
      { status: 500 }
    );
  }
}
