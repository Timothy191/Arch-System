import { z } from "zod";
import { createServerSupabaseClient } from "@repo/supabase/server";

/**
 * Tool definitions shared by the agent-graph node system.
 *
 * Previously used by agent-graph.ts via the Vercel AI SDK (`ai.tool()`).
 * Calls are now dispatched manually inside agent-graph.ts rather than being
 * bound to an LLM provider as OpenAI-compatible function calls.
 */

export const machineStatusTool = {
  description: "Get current status and details of machines in a department",
  inputSchema: z.object({
    departmentName: z
      .string()
      .describe("Department name to query machines for"),
  }),
  execute: async ({ departmentName }: { departmentName: string }) => {
    const supabase = await createServerSupabaseClient();
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("name", departmentName)
      .single();
    if (!dept) return { error: "Department not found" };
    const { data: machines } = await supabase
      .from("machines")
      .select("id, name, machine_type, active")
      .eq("department_id", dept.id);
    return { machines: machines ?? [] };
  },
};

const fleetStatusTool = {
  description:
    "Get real-time operational status of the vehicle fleet including active breakdowns.",
  inputSchema: z.object({
    fleetCode: z
      .string()
      .optional()
      .describe(
        "Specific fleet code to check (e.g. TR102). If omitted, returns overview of all active fleet.",
      ),
  }),
  execute: async ({ fleetCode }: { fleetCode?: string }) => {
    const supabase = await createServerSupabaseClient();

    let query = supabase.from("fleet").select(`
        id,
        fleet_code,
        vehicle_type,
        status,
        make,
        model
      `);

    if (fleetCode) {
      query = query.eq("fleet_code", fleetCode);
    }

    const { data: fleet, error: fleetError } = await query;
    if (fleetError) return { error: fleetError.message };

    // Get active breakdowns to overlay
    const { data: breakdowns } = await supabase
      .from("breakdowns")
      .select("fleet_id, reason, date_in, time_in")
      .eq("status", "active")
      .is("deleted_at", null);

    const breakdownMap = new Map(breakdowns?.map((b) => [b.fleet_id, b]));

    const report = fleet.map((v) => ({
      ...v,
      is_down: breakdownMap.has(v.fleet_code),
      breakdown_details: breakdownMap.get(v.fleet_code) || null,
    }));

    return {
      timestamp: new Date().toISOString(),
      count: report.length,
      vehicles: report,
    };
  },
};

export const shiftLogsTool = {
  description: "Get recent shift logs for a department",
  inputSchema: z.object({
    departmentName: z.string().describe("Department name"),
    date: z.string().optional().describe("ISO date string, defaults to today"),
  }),
  execute: async ({
    departmentName,
    date,
  }: {
    departmentName: string;
    date?: string;
  }) => {
    const supabase = await createServerSupabaseClient();
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("name", departmentName)
      .single();
    if (!dept) return { error: "Department not found" };
    const targetDate = date ?? new Date().toISOString().split("T")[0];
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("id, log_date, shift")
      .eq("department_id", dept.id)
      .eq("log_date", targetDate);
    return { logs: logs ?? [] };
  },
};

export const delaysTool = {
  description: "Get operational delays for a department on a given date",
  inputSchema: z.object({
    departmentName: z.string().describe("Department name"),
    date: z.string().optional().describe("ISO date string, defaults to today"),
  }),
  execute: async ({
    departmentName,
    date,
  }: {
    departmentName: string;
    date?: string;
  }) => {
    const supabase = await createServerSupabaseClient();
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("name", departmentName)
      .single();
    if (!dept) return { error: "Department not found" };
    const targetDate = date ?? new Date().toISOString().split("T")[0];
    const { data: delays } = await supabase
      .from("operational_delays")
      .select("delay_minutes, status, reason")
      .eq("department_id", dept.id)
      .eq("delay_date", targetDate);
    return { delays: delays ?? [] };
  },
};

export const aiTools = {
  machineStatus: machineStatusTool,
  fleetStatus: fleetStatusTool,
  shiftLogs: shiftLogsTool,
  delays: delaysTool,
} as const;
