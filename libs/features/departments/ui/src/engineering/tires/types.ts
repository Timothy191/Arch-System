export type {
  Tire,
  TireInspection,
  CreateTireInput,
  LogTireInspectionInput,
  ReplaceTireInput,
  TireStatus,
  TireCondition,
} from "@repo/contract";

export interface TireWithInspections {
  id: string;
  serial_number: string;
  brand: string;
  size: string;
  machine_id: string | null;
  machine_name?: string | null;
  position: string;
  status: "installed" | "inventory" | "scrapped";
  installed_at: string;
  installed_hours: number;
  removed_at: string | null;
  removed_hours: number | null;
  scrapped_reason: string | null;
  created_at?: string;
  updated_at?: string;
  inspections?: {
    id: string;
    inspection_date: string;
    tread_depth_mm: number;
    pressure_psi: number;
    condition_status: "good" | "warning" | "critical";
    notes: string | null;
    created_at: string;
  }[];
  latest_inspection?: {
    tread_depth_mm: number;
    pressure_psi: number;
    condition_status: "good" | "warning" | "critical";
    inspection_date: string;
    notes: string | null;
  } | null;
}

export interface TireMetrics {
  totalActive: number;
  avgTreadDepth: number;
  warningCount: number;
  criticalCount: number;
  avgPressure: number;
}

export interface WearCurvePoint {
  date: string;
  hours: number;
  treadDepth: number;
  warningThreshold: number;
  criticalThreshold: number;
}
