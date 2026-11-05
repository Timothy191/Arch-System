import { getPlantProcessingWorkspaceData } from '~/features/departments/components/plant-processing/actions';
import { PlantDelaysClient } from '~/features/departments/components/plant-processing/PlantDelaysClient';
import { getDepartmentContext } from '~/lib/dept-context';

export default async function DepartmentDelaysPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  const { today } = await getDepartmentContext({
    department: deptSlug,
  });

  const plantData = await getPlantProcessingWorkspaceData(today);

  return (
    <PlantDelaysClient
      initialDate={plantData.currentDate}
      initialDelays={plantData.initialDelays}
    />
  );
}
