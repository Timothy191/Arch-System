import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  entityId: z.string(),
  status: z.enum(['accounted', 'unaccounted', 'evacuated']),
  station: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const payload = schema.parse(json);

    // In a real implementation, this would write to the database
    // and broadcast the event over Supabase Realtime CDC channels.

    return NextResponse.json({ success: true, payload });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
