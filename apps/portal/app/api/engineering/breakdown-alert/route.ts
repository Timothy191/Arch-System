import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { handleEquipmentBreakdown } from '@/workflows/equipment-maintenance';

export async function POST(request: Request) {
  try {
    const { equipmentId, description } = await request.json();

    if (!equipmentId || !description) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Missing equipmentId or description', code: 'API_ERROR' },
        },
        { status: 400 }
      );
    }

    // Start the durable workflow asynchronously
    const { runId } = await start(handleEquipmentBreakdown, [equipmentId, description]);

    return NextResponse.json({
      message: 'Breakdown alert workflow started',
      equipmentId,
      runId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Failed to start workflow', code: 'API_ERROR' } },
      { status: 500 }
    );
  }
}
