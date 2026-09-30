import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Prevent unauthorized access by checking the CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return NextResponse.json({ ok: true, message: 'Cron job executed successfully' });
}
