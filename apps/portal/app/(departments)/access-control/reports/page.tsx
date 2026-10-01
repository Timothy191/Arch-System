import { getDepartmentContext } from '~/lib/dept-context';
import { getAccessReportsData } from '../actions';
import { AccessReportsStudio } from './access-reports-studio';

export default async function AccessControlReportsPage() {
  const { deptId } = await getDepartmentContext({
    department: 'access-control',
  });

  const reportsData = await getAccessReportsData(deptId);

  return <AccessReportsStudio initialData={reportsData} />;
}
