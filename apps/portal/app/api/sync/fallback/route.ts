import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'createDozerRoll': {
        const { createDozerRoll } = await import('@repo/departments/ui/server');
        await createDozerRoll(payload);
        break;
      }
      case 'saveDelayEntriesBatch': {
        const { saveDelayEntriesBatch } = await import(
          '@/app/(departments)/[department]/machine-operations/actions'
        );
        await saveDelayEntriesBatch(payload);
        break;
      }
      case 'createEngineeringNote': {
        const { createEngineeringNote } = await import(
          '@/app/(departments)/[department]/engineering-notes/actions'
        );
        await createEngineeringNote(payload);
        break;
      }
      case 'createDailyLog': {
        const { createDailyLog } = await import(
          '@/app/(departments)/[department]/daily-log/actions'
        );
        await createDailyLog(payload);
        break;
      }
      case 'createDepartment': {
        const { createDepartment } = await import('@/features/admin/tabs/actions');
        await createDepartment(payload);
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: { message: 'Unknown action', code: 'API_ERROR' } },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: { message, code: 'API_ERROR' } },
      { status: 500 }
    );
  }
}
