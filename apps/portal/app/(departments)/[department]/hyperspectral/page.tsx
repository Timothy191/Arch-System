import { SatelliteMonitoringDashboard } from "@/features/departments";
import { getSatelliteMonitoringData } from "~/lib/monitoring/satellite-data";

// AGENT-TRACE: Server component — fetches real InSAR rows + live STAC scenes
// server-side and passes them as props. defaultTab opens to Hyperspectral.
export default async function HyperspectralPage() {
  const { readings, s1Scenes, s2Scenes, latestS2Pass } = await getSatelliteMonitoringData();
  return (
    <SatelliteMonitoringDashboard
      readings={readings}
      s1Scenes={s1Scenes}
      s2Scenes={s2Scenes}
      latestS2Pass={latestS2Pass}
      defaultTab="hyperspectral"
    />
  );
}
