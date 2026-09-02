export interface MonolithizedDashboardPayload {
  department_id: string;
  daily_logs: Array<{
    id: string;
    log_date: string;
    shift: "day" | "night";
    notes: string | null;
    sync_status: "pending" | "synced" | "failed";
    idempotency_key: string;
    last_synced_at: string;
  }>;
  breakdowns: Array<{
    id: string;
    fleet_id: string;
    machine_type: string;
    date_in: string;
    date_out: string | null;
    reason: string;
    status: "active" | "completed";
    sync_status: "pending" | "synced" | "failed";
    idempotency_key: string;
    last_synced_at: string;
  }>;
}
