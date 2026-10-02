import { NextRequest, NextResponse } from 'next/server';
import { client } from '../db';
import { parseFeedId } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = parseFeedId(searchParams.get('id'));

  if (id === null) {
    return NextResponse.json({ error: 'Invalid feed id' }, { status: 400 });
  }

  const requested = Number(searchParams.get('max'));
  const max = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 100) : 10;

  try {
    const result = await client.episodesByFeedId(id, { max });
    return NextResponse.json(result.items, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 });
  }
}