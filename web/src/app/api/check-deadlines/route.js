import { NextResponse } from 'next/server';

// Vercel Cron Jobs надсилає GET запити
export async function GET(request) {
  return runCheck(request);
}

// Ручний запуск з адмінки - POST
export async function POST(request) {
  return runCheck(request);
}

async function runCheck(request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  // Логування для дебагу
  const startTime = Date.now();
  console.log('[check-deadlines] Starting check at', new Date().toISOString());

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/check-deadlines`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    const duration = Date.now() - startTime;
    console.log('[check-deadlines] Completed in', duration, 'ms, result:', data);

    return NextResponse.json({
      ...data,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }, { status: res.status });
  } catch (err) {
    console.error('[check-deadlines] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
