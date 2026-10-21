import { getPlantProcessingWorkspaceData } from '~/features/departments/components/plant-processing/actions';
import { PlantHourlySheetClient } from '~/features/departments/components/plant-processing/PlantHourlySheetClient';
import { getDepartmentContext } from '~/lib/dept-context';

export default async function DepartmentHourlySheetPage({
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
    <PlantHourlySheetClient
      initialDate={plantData.currentDate}
      initialSheets={plantData.initialSheets}
      mode="sheet"
    />
  );
}
