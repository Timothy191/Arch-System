export interface Breakdown {
  id: string;
  department_id: string;
  fleet_id: string;
  machine_name: string | null;
  machine_type: string;
  date_in: string;
  time_in: string;
  date_out: string | null;
  time_out: string | null;
  reason: string;
  repair_notes: string | null;
  status: "active" | "completed";
  missing_book_in: boolean;
  created_by: string | null;
  completed_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
