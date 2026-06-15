"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "./audit";
import {
  AuthError,
  NotFoundError,
  ForbiddenError,
  DatabaseError,
} from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";
import { getShiftCompleteness } from "./shift-completeness";
import {
  withAsyncSpan,
  addEvent,
  setAttributes,
} from "@/lib/observability/tracing";
import {
  RateLimiter,
  RedisStore,
  FixedWindowStrategy,
} from "@repo/rate-limiter";
import { getRedisClient } from "@repo/redis";
import {
  validateShiftDataIntegrity,
  validateMachineHours,
  validateBinFactor,
} from "./shift-completeness";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// AGENT-TRACE: Rate limiter for shift closeout - 5 attempts per minute per user
async function getShiftCloseoutRateLimiter(): Promise<RateLimiter | null> {
  try {
    const redis = await getRedisClient();
    if (redis?.isOpen) {
      const store = new RedisStore(redis);
      const strategy = new FixedWindowStrategy();
      return new RateLimiter({
        store,
        strategy,
        limit: 5, // 5 attempts per minute
        windowMs: 60 * 1000, // 1 minute
        keyPrefix: "shift_closeout:",
      });
    }
  } catch (error) {
    // If Redis is not available, return null (rate limiting disabled)
    // eslint-disable-next-line no-console
    console.warn("Redis not available for rate limiting:", error);
  }
  return null;
}

// AGENT-TRACE: Track failed PIN attempts and enforce lockout
async function checkPinAttemptLockout(employeeCode: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) return false;

    const key = `pin_attempts:${employeeCode}`;
    const attempts = await redis.get(key);

    if (attempts) {
      const data = JSON.parse(attempts);
      const now = Date.now();

      // Check if we're in lockout period
      if (data.lockedUntil && data.lockedUntil > now) {
        return true; // Locked out
      }

      // Reset if window expired (5 minutes)
      if (now - data.firstAttempt > 5 * 60 * 1000) {
        await redis.del(key);
        return false;
      }

      // Check if we've hit the threshold (3 attempts)
      if (data.count >= 3) {
        // Set lockout for 15 minutes
        data.lockedUntil = now + 15 * 60 * 1000;
        await redis.set(key, JSON.stringify(data), { EX: 15 * 60 });
        return true;
      }
    }

    return false;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to check PIN attempt lockout:", error);
    return false;
  }
}

async function recordFailedPinAttempt(employeeCode: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) return;

    const key = `pin_attempts:${employeeCode}`;
    const attempts = await redis.get(key);
    const now = Date.now();

    if (attempts) {
      const data = JSON.parse(attempts);

      // Reset if window expired (5 minutes)
      if (now - data.firstAttempt > 5 * 60 * 1000) {
        data.count = 1;
        data.firstAttempt = now;
      } else {
        data.count += 1;
      }

      await redis.set(key, JSON.stringify(data), { EX: 15 * 60 });
    } else {
      await redis.set(
        key,
        JSON.stringify({
          count: 1,
          firstAttempt: now,
        }),
        { EX: 15 * 60 },
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to record failed PIN attempt:", error);
  }
}

async function validateShiftData(
  supabase: SupabaseClient,
  departmentId: string,
  date: string,
  shiftType: "day" | "night",
): Promise<string[]> {
  // AGENT-TRACE: OpenTelemetry instrumentation for shift validation
  return withAsyncSpan(
    "shift_validation",
    {
      department_id: departmentId,
      date,
      shift_type: shiftType,
    },
    async (_span) => {
      addEvent("validation_start");

      const { data: existing } = await supabase
        .from("shift_status")
        .select("id, status")
        .eq("department_id", departmentId)
        .eq("shift_date", date)
        .eq("shift_type", shiftType)
        .single();

      if (existing?.status === "closed") {
        setAttributes({ already_closed: true });
        return ["Shift is already closed"];
      }

      const completeness = await getShiftCompleteness(
        supabase,
        departmentId,
        null,
        date,
        shiftType,
      );

      setAttributes({ machine_count: completeness.statuses.length });

      const errors: string[] = [];

      if (completeness.statuses.length === 0) {
        errors.push("No active machines found for this department");
      }

      for (const status of completeness.statuses) {
        if (!status.exempt && !status.hasEntry) {
          errors.push(`Machine '${status.machineName}': not reported`);
        }
      }

      // AGENT-TRACE: Enhanced server-side validation for each machine
      for (const status of completeness.statuses) {
        if (status.hoursWorked !== undefined && status.hoursWorked !== null) {
          // Validate hours worked
          const hourErrors = validateMachineHours(
            Number(status.hoursWorked),
            shiftType,
          );
          errors.push(
            ...hourErrors.map(
              (e) => `Machine '${status.machineName}': ${e.message}`,
            ),
          );
        }
      }

      // AGENT-TRACE: Cross-field validation for hourly loads
      const { data: hourlyLoads } = await supabase
        .from("hourly_loads")
        .select("machine_id, total_loads")
        .eq("department_id", departmentId)
        .eq("load_date", date)
        .eq("shift_type", shiftType);

      // AGENT-TRACE: Fetch machine data for bin_factor validation
      const { data: machines } = await supabase
        .from("machines")
        .select("id, name, bin_factor")
        .eq("department_id", departmentId);

      const machineMap = new Map((machines || []).map((m) => [m.id, m]));

      // AGENT-TRACE: Validate bin_factors for all machines
      for (const machine of machines || []) {
        if (machine.bin_factor) {
          const binFactorErrors = validateBinFactor(machine.bin_factor);
          errors.push(
            ...binFactorErrors.map(
              (e) => `Machine '${machine.name}': ${e.message}`,
            ),
          );
        }
      }

      // AGENT-TRACE: Validate load consistency for hourly loads
      const loadMap = new Map(
        (hourlyLoads || []).map((load) => [load.machine_id, load]),
      );

      for (const [machineId, loads] of loadMap.entries()) {
        const machine = machineMap.get(machineId);
        if (machine && loads.total_loads && completeness.statuses) {
          const status = completeness.statuses.find(
            (s) => s.machineId === machineId,
          );
          if (status && status.hoursWorked) {
            const consistencyErrors = validateShiftDataIntegrity(
              machineId,
              status.hoursWorked,
              loads.total_loads,
              machine.bin_factor,
              shiftType,
            );
            errors.push(
              ...consistencyErrors.map(
                (e) => `Machine '${machine.name}': ${e.message}`,
              ),
            );
          }
        }
      }

      setAttributes({ error_count: errors.length });
      addEvent("validation_complete", {
        has_errors: errors.length > 0,
        error_count: errors.length,
      });

      return errors;
    },
  );
}

export async function setPin(employeeCode: string, pin: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logError(new Error("Not authenticated"), { context: "setPin" });
    throw new AuthError("Not authenticated", { context: { action: "setPin" } });
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (error || !employee) {
    logError(new Error("Employee not found"), { context: "setPin" });
    throw new NotFoundError("Employee not found", { resource: "employee" });
  }

  if (employee.role !== "supervisor" && employee.role !== "admin") {
    logError(new Error("Only supervisors and admins can set PINs"), {
      context: "setPin",
    });
    throw new ForbiddenError("Only supervisors and admins can set PINs", {
      context: {
        requiredRoles: ["supervisor", "admin"],
        actualRole: employee.role,
      },
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(pin, salt);

  const { error: updateError } = await supabase
    .from("employees")
    .update({ pin_hash: hash, employee_code: employeeCode })
    .eq("id", employee.id);

  if (updateError) {
    throw new DatabaseError("Failed to set PIN", {
      operation: "update",
      table: "employees",
      context: { error: updateError.message },
    });
  }

  return { success: true };
}

export async function verifyPin(employeeCode: string, pin: string) {
  // AGENT-TRACE: OpenTelemetry instrumentation for PIN verification
  return withAsyncSpan(
    "pin_verification",
    { employee_code: employeeCode },
    async (_span) => {
      addEvent("pin_verify");

      // AGENT-TRACE: Check for PIN attempt lockout
      const isLockedOut = await checkPinAttemptLockout(employeeCode);
      setAttributes({ locked_out: isLockedOut });
      if (isLockedOut) {
        return {
          valid: false,
          employee: null,
          lockedOut: true,
          message:
            "Too many failed PIN attempts. Please try again in 15 minutes.",
        };
      }

      const supabase = await createServerSupabaseClient();

      const { data: employee, error } = await supabase
        .from("employees")
        .select("id, full_name, pin_hash")
        .eq("employee_code", employeeCode)
        .single();

      if (error || !employee || !employee.pin_hash) {
        setAttributes({ pin_found: false });
        return { valid: false, employee: null };
      }

      const valid = await bcrypt.compare(pin, employee.pin_hash);

      if (!valid) {
        // AGENT-TRACE: Record failed PIN attempt
        await recordFailedPinAttempt(employeeCode);
      }

      setAttributes({
        pin_found: true,
        pin_valid: valid,
        employee_id: employee.id,
      });

      return {
        valid,
        employee: valid
          ? { id: employee.id, full_name: employee.full_name }
          : null,
      };
    },
  );
}

export async function closeShift(
  departmentId: string,
  date: string,
  shiftType: "day" | "night",
  approvedById: string,
  pin: string,
  validateOnly: boolean = false,
  departmentSlug?: string,
) {
  // AGENT-TRACE: OpenTelemetry instrumentation for shift closeout
  return withAsyncSpan(
    "shift_closeout",
    {
      department_id: departmentId,
      date,
      shift_type: shiftType,
      approved_by_id: approvedById,
      validate_only: validateOnly,
    },
    async (_span) => {
      const supabase = await createServerSupabaseClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        logError(new Error("Not authenticated"), { context: "closeShift" });
        throw new AuthError("Not authenticated", {
          context: { action: "closeShift" },
        });
      }

      // AGENT-TRACE: Rate limit check - 5 attempts per minute per user
      const rateLimiter = await getShiftCloseoutRateLimiter();
      if (rateLimiter) {
        const rateLimitResult = await rateLimiter.check(user.id);
        setAttributes({
          rate_limit_allowed: rateLimitResult.allowed,
          rate_limit_remaining: rateLimitResult.remaining,
        });
        if (!rateLimitResult.allowed) {
          return {
            success: false,
            errors: [
              `Too many shift closeout attempts. Please try again in ${Math.ceil(rateLimitResult.retryAfter! / 60)} minutes.`,
            ],
          };
        }
      }

      const errors = await validateShiftData(
        supabase,
        departmentId,
        date,
        shiftType,
      );
      if (errors.length > 0) {
        setAttributes({ validation_errors: errors.length });
        return { success: false, errors };
      }

      if (validateOnly) {
        setAttributes({ validate_only: true });
        return { success: true };
      }

      const { data: closedBy } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (!closedBy) {
        logError(new Error("Operator not found"), { context: "closeShift" });
        throw new NotFoundError("Operator not found", { resource: "employee" });
      }

      setAttributes({ operator_id: closedBy.id });

      const { data: approver } = await supabase
        .from("employees")
        .select("id, pin_hash, full_name")
        .eq("id", approvedById)
        .single();

      if (!approver || !approver.pin_hash) {
        return {
          success: false,
          errors: ["Approving supervisor not found or has no PIN set"],
        };
      }

      const pinValid = await bcrypt.compare(pin, approver.pin_hash);
      if (!pinValid) {
        setAttributes({ pin_valid: false });
        return { success: false, errors: ["Invalid supervisor PIN"] };
      }

      setAttributes({ pin_valid: true });

      const { data: inserted, error: insertError } = await supabase
        .from("shift_status")
        .insert({
          department_id: departmentId,
          shift_date: date,
          shift_type: shiftType,
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: closedBy.id,
          approved_by: approvedById,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        setAttributes({ insert_success: false });
        return { success: false, errors: ["Failed to close shift"] };
      }

      setAttributes({
        insert_success: true,
        shift_status_id: inserted.id,
      });
      addEvent("shift_closed", {
        shift_status_id: inserted.id,
        closed_by: closedBy.id,
        approved_by: approvedById,
      });

      await logAuditEvent({
        action: "insert",
        tableName: "shift_status",
        recordId: inserted.id,
        departmentId,
      });

      if (departmentSlug) {
        revalidatePath(`/${departmentSlug}`);
        revalidatePath(`/${departmentSlug}/shift-coverage`);
      }

      return { success: true, shiftStatusId: inserted.id };
    },
  );
}
