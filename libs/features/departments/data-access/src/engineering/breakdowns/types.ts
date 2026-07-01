import "server-only";

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

// AGENT-TRACE: BreakdownControlRoomView matches the breakdowns_control_room_view schema
// This interface is used by Control Room to read Engineering breakdowns in read-only mode
// Only exposes operational fields required for awareness, not sensitive data like repair_notes
export interface BreakdownControlRoomView {
  id: string;
  fleet_id: string;
  machine_name: string | null;
  machine_type: string;
  reason: string;
  date_in: string;
  time_in: string;
  date_out: string | null;
  status: "active" | "completed";
  created_at: string;
}

export interface BreakdownMetrics {
  total: number;
  active: number;
  completedToday: number;
  avgRepairHours: number;
}

export interface CreateBreakdownInput {
  fleet_id: string;
  machine_name?: string;
  machine_type: string;
  date_in: string;
  time_in: string;
  reason: string;
}

export interface BookOutInput {
  date_out: string;
  time_out: string;
  repair_notes?: string;
}

export interface DirectCheckoutInput {
  fleet_id: string;
  machine_type: string;
  reason: string;
  repair_notes?: string;
  date_out: string;
  time_out: string;
}

export interface Machine {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  active: boolean;
}

export const MACHINE_TYPES = [
  "Excavator",
  "Haul Truck",
  "Dozer",
  "Drill Rig",
  "Grader",
  "Front End Loader",
  "Water Cart",
  "Compactor",
] as const;
