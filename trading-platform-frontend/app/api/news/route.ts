import { NextResponse } from 'next/server';

/**
 * Economic Calendar API proxy — Forex Factory via faireconomy.media mirror.
 *
 * The FF feed updates once per hour. We cache for 1 hour (3600s) to stay
 * well within the rate limit (they block if you request more than once per 5 min).
 *
 * Fields returned: title, country, date, impact, forecast, previous.
 * The "actual" field is NOT provided by this free feed.
 */

const FF_URLS = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
];

async function fetchFromFF() {
  const results = await Promise.allSettled(
    FF_URLS.map((url) =>
      fetch(url, {
        next: { revalidate: 3600 },
        headers: { 'User-Agent': 'TradePro/1.0' },
      }).then((r) => {
        if (!r.ok) throw new Error(`${url} → ${r.status}`);
        return r.json();
      }),
    ),
  );

  const allEvents: Record<string, unknown>[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allEvents.push(...result.value);
    }
  }
  return allEvents;
}

export async function GET() {
  try {
    const events = await fetchFromFF();

    if (events.length === 0) {
      return NextResponse.json(
        { error: 'No data from calendar sources' },
        { status: 502 },
      );
    }

    // Deduplicate by title+date combo
    const seen = new Set<string>();
    const unique = events.filter((e) => {
      const key = `${(e as { title?: string }).title}|${(e as { date?: string }).date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(unique, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 },
    );
  }
}
