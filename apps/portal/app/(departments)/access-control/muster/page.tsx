import { getDepartmentContext } from '~/lib/dept-context';
import { getMusterRollCall } from '../actions';
import { MusterRollCallView } from './muster-roll-call-view';

export default async function AccessControlMusterPage() {
  const { deptId } = await getDepartmentContext({
    department: 'access-control',
  });

  const musterSummary = await getMusterRollCall(deptId);

  return <MusterRollCallView initialSummary={musterSummary} />;
}
