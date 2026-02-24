import { NextResponse } from 'next/server';

/**
 * Proxy endpoint for Forex Factory calendar JSON feeds.
 * Fetches this-week + next-week data, merges, deduplicates, and returns
 * a combined array so the frontend gets full coverage without CORS issues.
 */

const FF_URLS = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
];

export async function GET() {
  try {
    // Fetch both weeks in parallel
    const results = await Promise.allSettled(
      FF_URLS.map((url) =>
        fetch(url, {
          next: { revalidate: 300 }, // cache for 5 minutes
          headers: { 'User-Agent': 'TradePro/1.0' },
        }).then((r) => {
          if (!r.ok) throw new Error(`${url} → ${r.status}`);
          return r.json();
        }),
      ),
    );

    // Merge all successful responses
    const allEvents: Record<string, unknown>[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        allEvents.push(...result.value);
      }
    }

    if (allEvents.length === 0) {
      return NextResponse.json(
        { error: 'No data from Forex Factory' },
        { status: 502 },
      );
    }

    // Deduplicate by title+date combo
    const seen = new Set<string>();
    const unique = allEvents.filter((e) => {
      const key = `${(e as { title?: string }).title}|${(e as { date?: string }).date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(unique, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('FF proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 },
    );
  }
}
