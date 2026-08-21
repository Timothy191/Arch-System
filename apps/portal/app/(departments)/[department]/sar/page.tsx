import { SatelliteMonitoringDashboard } from "@/features/departments";
import { getSatelliteMonitoringData } from "~/lib/monitoring/satellite-data";

// AGENT-TRACE: Server component — fetches real InSAR rows + live STAC scenes
// server-side and passes them as props. defaultTab opens straight to SAR/InSAR.
export default async function SARPage() {
  const { readings, s1Scenes, s2Scenes, latestS2Pass } = await getSatelliteMonitoringData();
  return (
    <SatelliteMonitoringDashboard
      readings={readings}
      s1Scenes={s1Scenes}
      s2Scenes={s2Scenes}
      latestS2Pass={latestS2Pass}
      defaultTab="sar"
    />
  );
}
