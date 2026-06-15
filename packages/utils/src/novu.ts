import { Novu } from "@novu/node";

const novu = new Novu(process.env.NOVU_API_KEY ?? "");

export async function triggerBreakdownNotification(
  fleetId: string,
  reason: string,
  departmentId: string,
) {
  await novu.trigger("breakdown-created", {
    to: { subscriberId: departmentId },
    payload: { fleetId, reason },
  });
}

export async function triggerSafetyNotification(
  incidentType: string,
  location: string,
  departmentId: string,
) {
  await novu.trigger("safety-incident-reported", {
    to: { subscriberId: departmentId },
    payload: { incidentType, location },
  });
}

export async function triggerReportReadyNotification(
  reportId: string,
  departmentId: string,
) {
  await novu.trigger("report-ready", {
    to: { subscriberId: departmentId },
    payload: { reportId },
  });
}
