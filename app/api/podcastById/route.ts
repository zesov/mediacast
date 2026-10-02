import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { PodcastById } from 'podcastdx-client/types';
import { client } from '../db';
import { parseFeedId } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = parseFeedId(searchParams.get('id'));

  if (id === null) {
    return NextResponse.json({ error: 'Invalid feed id' }, { status: 400 });
  }

  try {
    const result: PodcastById = await client.podcastById(id);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch podcast' }, { status: 500 });
  }
}