import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { handleShiftReport } from '@/workflows/shift-report-compiler';

export async function POST(request: Request) {
  try {
    const { shiftId } = await request.json();

    if (!shiftId) {
      return NextResponse.json({ error: 'Missing shiftId' }, { status: 400 });
    }

    // Start the durable workflow asynchronously to bypass 10s serverless timeout constraints
    const { id: runId } = await start(handleShiftReport, [shiftId]);

    return NextResponse.json({
      message: 'Shift report compilation workflow started',
      shiftId,
      runId,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start workflow' }, { status: 500 });
  }
}
