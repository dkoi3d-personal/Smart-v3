/**
 * Learning Stats API
 *
 * GET /api/learnings/stats - Get learning statistics
 */

import { NextResponse } from 'next/server';
import { getLearningStore } from '@/services/memory/learning-store';

const store = getLearningStore();

// GET /api/learnings/stats
export async function GET() {
  const stats = store.getStats();

  return NextResponse.json(stats);
}
