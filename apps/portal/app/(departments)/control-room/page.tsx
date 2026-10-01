import { Divider } from '@repo/ui/Divider';
import { getDepartmentContext } from '~/lib/dept-context';
import { ShiftCloseoutForm } from './components/ShiftCloseoutForm';

export default async function ControlRoomDashboardPage() {
  const { deptId, today } = await getDepartmentContext({ department: 'control-room' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-color-text-primary">
            Control Room Operations
          </h1>
          <p className="text-sm text-color-text-secondary mt-1">
            Live SCADA monitoring and atomic shift closeout.
          </p>
        </div>
      </div>

      <Divider variant="dotted" label="END OF SHIFT PROCEDURES" />

      {/* Critical: Must support offline queueing and idempotency */}
      <ShiftCloseoutForm deptId={deptId} shiftDate={today} />
    </div>
  );
}
