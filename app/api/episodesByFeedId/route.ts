import { NextRequest, NextResponse } from 'next/server';
import { client } from '../db';

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const requested = Number(searchParams.get('max'));
    const max = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 100) : 10;
    const result = await client.episodesByFeedId(Number(id), { max });
    return NextResponse.json(result.items);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}