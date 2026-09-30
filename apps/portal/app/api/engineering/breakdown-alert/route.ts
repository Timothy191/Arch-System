import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { handleEquipmentBreakdown } from '@/workflows/equipment-maintenance';

export async function POST(request: Request) {
  try {
    const { equipmentId, description } = await request.json();

    if (!equipmentId || !description) {
      return NextResponse.json({ error: 'Missing equipmentId or description' }, { status: 400 });
    }

    // Start the durable workflow asynchronously
    const { id: runId } = await start(handleEquipmentBreakdown, [equipmentId, description]);

    return NextResponse.json({
      message: 'Breakdown alert workflow started',
      equipmentId,
      runId,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start workflow' }, { status: 500 });
  }
}
