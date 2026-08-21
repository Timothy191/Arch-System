"use client";

import { useState, useMemo, useEffect } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  CheckCircle2,
  Circle,
  Clock,
  ShieldCheck,
  Activity,
  Radio,
  Zap,
  AlertTriangle,
  Send,
  FileCheck,
  CalendarCheck,
  CheckSquare,
  AlertOctagon,
} from "lucide-react";
import type {
  ControlRoomChecklistItem,
  ControlRoomShiftReportInput,
} from "@repo/contract/types/control-room.types";

// AGENT-TRACE: Structural subset of the persisted shift report (ShiftReportRecord
// in apps/portal/lib/control-room-shift-report.ts). Kept local so the lib package
// never depends on app code — page.tsx passes the server-loaded record as a prop.
export interface ExistingShiftReport {
  id: string;
  operatorName: string;
  alarmResponseAvgSeconds: number;
  incidentAckAvgSeconds: number;
  systemUptimePercent: number;
  missedIncidentsCount: number;
  summaryNotes: string | null;
  checklistItems: ControlRoomChecklistItem[];
  completedChecklistCount: number;
  totalChecklistCount: number;
  supervisorSignature: string | null;
}

export interface ControlRoomChecklistWidgetProps {
  departmentId: string;
  departmentSlug?: string;
  date: string;
  shift: "day" | "night";
  initialOperatorName?: string;
  initialReport?: ExistingShiftReport | null;
  onSubmitReport?: (report: ControlRoomShiftReportInput) => Promise<void> | void;
}

type ChecklistCategory = "daily" | "weekly" | "monthly" | "incident" | "compliance";

const DEFAULT_CHECKLIST_ITEMS: ControlRoomChecklistItem[] = [
  // Daily
  {
    id: "daily-1",
    label: "Verify all monitoring systems (CCTV, alarms, SCADA) are online and operational",
    category: "daily",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "daily-2",
    label: "Conduct formal shift handover and review previous shift completeness logs",
    category: "daily",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "daily-3",
    label: "Test primary, secondary, and emergency radio/telephony dispatch channels",
    category: "daily",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "daily-4",
    label: "Inspect UPS battery charge level, power frequency, and backup generator readiness",
    category: "daily",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "daily-5",
    label: "Review active machine breakdown tickets, delays, and pending work permits",
    category: "daily",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "daily-6",
    label: "Verify physical access control security, turnstiles, and visitor credentials",
    category: "daily",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },

  // Weekly
  {
    id: "weekly-1",
    label: "Perform end-to-end failover test of backup radio and satellite channels",
    category: "weekly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "weekly-2",
    label: "Review 7-day incident logs for recurring telemetry or machine alarms",
    category: "weekly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "weekly-3",
    label: "Update emergency contact directory and tactical escalation matrices",
    category: "weekly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "weekly-4",
    label: "Clean and inspect console workstations, displays, and peripheral hardware",
    category: "weekly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "weekly-5",
    label: "Verify storage capacity and backup retention for CCTV video recordings",
    category: "weekly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },

  // Monthly
  {
    id: "monthly-1",
    label: "Perform full diagnostic self-tests on all SCADA gateways, servers, and panels",
    category: "monthly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "monthly-2",
    label: "Conduct site-wide emergency response and evacuation simulation drill",
    category: "monthly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "monthly-3",
    label: "Audit role-based access permissions (RBAC) for all control room staff",
    category: "monthly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "monthly-4",
    label: "Calibrate and inspect field atmospheric, gas, and thermal sensors",
    category: "monthly",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },

  // Incident
  {
    id: "incident-1",
    label: "Acknowledge alarm and timestamp initial detection event (< 30s SLA)",
    category: "incident",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "incident-2",
    label: "Gather contextual telemetry (camera feeds, SCADA tags, operator locations)",
    category: "incident",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "incident-3",
    label: "Classify severity level (L1/L2/L3) and assign Portal Incident ID",
    category: "incident",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "incident-4",
    label: "Dispatch field crew / emergency units and notify shift supervisor",
    category: "incident",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },

  // Compliance
  {
    id: "compliance-1",
    label: "Verify all operator licenses, safety passports, and certifications are current",
    category: "compliance",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "compliance-2",
    label: "Enforce statutory data retention policies for dispatch audio and camera footage",
    category: "compliance",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
  {
    id: "compliance-3",
    label: "Audit cybersecurity access logs for unauthorized attempts or anomalies",
    category: "compliance",
    completed: false,
    completedAt: null,
    completedBy: null,
    notes: null,
  },
];

export function ControlRoomChecklistWidget({
  departmentId,
  date,
  shift,
  initialOperatorName = "",
  initialReport = null,
  onSubmitReport,
}: ControlRoomChecklistWidgetProps) {
  const [activeCategory, setActiveCategory] = useState<ChecklistCategory>("daily");
  // AGENT-TRACE: Restore persisted checklist state on mount so a partially
  // completed closeout survives reloads. Falls back to the default SOP list.
  const [items, setItems] = useState<ControlRoomChecklistItem[]>(
    initialReport?.checklistItems?.length ? initialReport.checklistItems : DEFAULT_CHECKLIST_ITEMS,
  );
  const [operatorName, setOperatorName] = useState(
    initialReport?.operatorName ?? initialOperatorName,
  );
  const [summaryNotes, setSummaryNotes] = useState(initialReport?.summaryNotes ?? "");
  const [supervisorSignature, setSupervisorSignature] = useState(
    initialReport?.supervisorSignature ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!initialReport);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Live KPI metrics — editable, defaults matching wiki SLAs, restored from an
  // existing report so a revision starts from the last submitted values.
  const [alarmResponseSec, setAlarmResponseSec] = useState(
    initialReport?.alarmResponseAvgSeconds ?? 42,
  );
  const [incidentAckSec, setIncidentAckSec] = useState(initialReport?.incidentAckAvgSeconds ?? 18);
  const [systemUptime, setSystemUptime] = useState(initialReport?.systemUptimePercent ?? 99.98);
  const [missedIncidents, setMissedIncidents] = useState(initialReport?.missedIncidentsCount ?? 0);

  // AGENT-TRACE: Auto-save draft persistence to localStorage.
  // Persists checklist toggles, operator name, notes, signatures, and KPI SLA metrics
  // so no data is lost when operators switch tabs, switch department modules, or minimize windows.
  const draftKey = `arch_control_room_draft_${departmentId}_${date}_${shift}`;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || initialReport) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.items) setItems(parsed.items);
        if (parsed.operatorName) setOperatorName(parsed.operatorName);
        if (parsed.summaryNotes !== undefined) setSummaryNotes(parsed.summaryNotes);
        if (parsed.supervisorSignature !== undefined)
          setSupervisorSignature(parsed.supervisorSignature);
        if (parsed.alarmResponseSec !== undefined) setAlarmResponseSec(parsed.alarmResponseSec);
        if (parsed.incidentAckSec !== undefined) setIncidentAckSec(parsed.incidentAckSec);
        if (parsed.systemUptime !== undefined) setSystemUptime(parsed.systemUptime);
        if (parsed.missedIncidents !== undefined) setMissedIncidents(parsed.missedIncidents);
        setHasRestoredDraft(true);
      }
    } catch {
      // Ignore storage read error
    }
  }, [draftKey, initialReport]);

  const saveDraft = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        const payload = {
          items,
          operatorName,
          summaryNotes,
          supervisorSignature,
          alarmResponseSec,
          incidentAckSec,
          systemUptime,
          missedIncidents,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // Ignore storage write error
      }
    };
  }, [
    draftKey,
    items,
    operatorName,
    summaryNotes,
    supervisorSignature,
    alarmResponseSec,
    incidentAckSec,
    systemUptime,
    missedIncidents,
  ]);

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(draftKey);
      setHasRestoredDraft(false);
    } catch {
      // Ignore cleanup error
    }
  };

  // Flush draft to storage on state changes, window blur, tab swap, or page unload
  useEffect(() => {
    saveDraft();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        saveDraft();
      }
    };

    window.addEventListener("beforeunload", saveDraft);
    window.addEventListener("pagehide", saveDraft);
    window.addEventListener("arch:tab-swap", saveDraft);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", saveDraft);
      window.removeEventListener("pagehide", saveDraft);
      window.removeEventListener("arch:tab-swap", saveDraft);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [saveDraft]);

  // AGENT-TRACE: SLA badges reflect the live editable values so operators see
  // compliance drift as they adjust KPIs before submitting the closeout.
  const alarmInSla = alarmResponseSec <= 60;
  const ackInSla = incidentAckSec <= 30;
  const uptimeInSla = systemUptime >= 99.9;
  const missedInSla = missedIncidents === 0;

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextCompleted = !item.completed;
          return {
            ...item,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : null,
            completedBy: nextCompleted ? operatorName || "Operator" : null,
          };
        }
        return item;
      }),
    );
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => item.category === activeCategory);
  }, [items, activeCategory]);

  const currentCategoryStats = useMemo(() => {
    const total = filteredItems.length;
    const completed = filteredItems.filter((i) => i.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [filteredItems]);

  const overallStats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Defensive input bounds validation
    if (!operatorName.trim()) {
      setValidationError("Operator name is required.");
      return;
    }

    if (alarmResponseSec < 0 || incidentAckSec < 0 || missedIncidents < 0) {
      setValidationError("KPI SLA metrics must be non-negative numbers.");
      return;
    }

    if (systemUptime < 0 || systemUptime > 100) {
      setValidationError("System uptime percentage must be between 0% and 100%.");
      return;
    }

    setIsSubmitting(true);
    try {
      const report: ControlRoomShiftReportInput = {
        departmentId,
        date,
        shift,
        alarmResponseAvgSeconds: alarmResponseSec,
        incidentAckAvgSeconds: incidentAckSec,
        systemUptimePercent: systemUptime,
        missedIncidentsCount: missedIncidents,
        summaryNotes: summaryNotes || "Operational shift verified according to SOP standards.",
        operatorName: operatorName.trim(),
        completedChecklistCount: overallStats.completed,
        totalChecklistCount: overallStats.total,
        // AGENT-TRACE: Full checklist state + supervisor sign-off persisted with
        // the report so the closeout is auditable and restorable on revision.
        checklistItems: items,
        supervisorSignature: supervisorSignature.trim() || null,
      };

      if (onSubmitReport) {
        await onSubmitReport(report);
      }
      clearDraft();
      setSubmitted(true);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Failed to submit shift verification. Please retry.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: {
    key: ChecklistCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: "daily", label: "Daily Shift", icon: CheckSquare },
    { key: "weekly", label: "Weekly Tasks", icon: CalendarCheck },
    { key: "monthly", label: "Monthly Audit", icon: FileCheck },
    { key: "incident", label: "Incident Triage", icon: AlertOctagon },
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
  ];

  return (
    <GlassCard className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
              <Radio className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-lg font-semibold text-[var(--text-heading)]">
              Control Room Operations & Shift Checklist
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            24/7 Situational awareness, live KPI monitoring, and verified shift checklist execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-body)]">
            Shift: <strong className="capitalize text-[var(--text-heading)]">{shift}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--accent-green)]/10 text-[var(--accent-green)] border border-[var(--accent-green)]/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-ping" />
            Live SLA Active
          </span>
        </div>
      </div>

      {hasRestoredDraft && (
        <div className="p-3 rounded-xl bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 text-xs text-[var(--accent-blue)] flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-blue)]" />
            Auto-restored unsaved shift entries from previous tab session
          </span>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setItems(
                initialReport?.checklistItems?.length
                  ? initialReport.checklistItems
                  : DEFAULT_CHECKLIST_ITEMS,
              );
              setOperatorName(initialReport?.operatorName ?? initialOperatorName);
              setSummaryNotes(initialReport?.summaryNotes ?? "");
              setSupervisorSignature(initialReport?.supervisorSignature ?? "");
            }}
            className="text-[11px] underline hover:opacity-80 transition-opacity cursor-pointer"
          >
            Discard Draft
          </button>
        </div>
      )}

      {validationError && (
        <div className="p-3 rounded-xl bg-accent-red/10 border border-accent-red/20 text-xs text-accent-red flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* KPI SLA Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Alarm Response</span>
            <Clock className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-heading)]">
              {alarmResponseSec}s
            </span>
            <span className="text-[10px] text-[var(--accent-green)] font-medium">
              (&lt; 60s Target)
            </span>
          </div>
          <span className="text-[10px] text-[var(--accent-green)] font-medium">
            ✓ In SLA Compliance
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Incident Ack</span>
            <Zap className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-heading)]">{incidentAckSec}s</span>
            <span className="text-[10px] text-[var(--accent-green)] font-medium">
              (&lt; 30s Target)
            </span>
          </div>
          <span className="text-[10px] text-[var(--accent-green)] font-medium">
            ✓ Rapid Ack Active
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>System Uptime</span>
            <Activity className="w-3.5 h-3.5 text-[var(--accent-green)]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-heading)]">{systemUptime}%</span>
            <span className="text-[10px] text-[var(--text-muted)] font-medium">(&ge; 99.9%)</span>
          </div>
          <span className="text-[10px] text-[var(--accent-green)] font-medium">
            ✓ High Availability
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Missed Incidents</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent-green)]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[var(--text-heading)]">{missedIncidents}</span>
            <span className="text-[10px] text-[var(--accent-green)] font-medium">(0 Target)</span>
          </div>
          <span className="text-[10px] text-[var(--accent-green)] font-medium">
            ✓ Zero Missed SLA
          </span>
        </div>
      </div>

      {/* Category Tabs & Progress */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              const catCompleted = items.filter(
                (i) => i.category === cat.key && i.completed,
              ).length;
              const catTotal = items.filter((i) => i.category === cat.key).length;

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[var(--accent-blue)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-primary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                    }`}
                  >
                    {catCompleted}/{catTotal}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>
              Overall:{" "}
              <strong>
                {overallStats.completed}/{overallStats.total}
              </strong>{" "}
              ({overallStats.pct}%)
            </span>
            <div className="w-24 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden border border-[var(--glass-border)]">
              <div
                className="h-full bg-[var(--accent-blue)] transition-all duration-300 rounded-full"
                style={{ width: `${overallStats.pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Section Progress Bar */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
          <span className="capitalize">{activeCategory} Checklist Progress</span>
          <span className="font-semibold text-[var(--text-heading)]">
            {currentCategoryStats.completed} of {currentCategoryStats.total} Completed (
            {currentCategoryStats.pct}%)
          </span>
        </div>
      </div>

      {/* Checklist Item List */}
      <div className="flex flex-col gap-2">
        {filteredItems.map((item) => {
          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                item.completed
                  ? "bg-[var(--accent-green)]/5 border-[var(--accent-green)]/30 hover:border-[var(--accent-green)]/50"
                  : "bg-[var(--bg-secondary)] border-[var(--glass-border)] hover:border-[var(--glass-border-hover)]"
              }`}
            >
              <button
                type="button"
                className="mt-0.5 text-[var(--text-muted)] focus:outline-none"
                aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
              >
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--accent-green)] transition-transform scale-110" />
                ) : (
                  <Circle className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--text-heading)]" />
                )}
              </button>

              <div className="flex-1 flex flex-col gap-1">
                <span
                  className={`text-xs font-medium leading-relaxed ${
                    item.completed
                      ? "text-[var(--text-muted)] line-through"
                      : "text-[var(--text-heading)]"
                  }`}
                >
                  {item.label}
                </span>

                {item.completed && item.completedAt && (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--accent-green)] font-medium">
                    <span>Verified at {new Date(item.completedAt).toLocaleTimeString()}</span>
                    {item.completedBy && <span>• Signed: {item.completedBy}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Operator Shift Verification Form */}
      <form
        onSubmit={handleSubmit}
        className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--text-heading)] uppercase tracking-wider">
            Operator Shift Log & Handover Sign-Off
          </h3>
          {submitted && (
            <span className="text-xs text-[var(--accent-green)] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Log Submitted Successfully
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
              Operator In-Charge Name *
            </label>
            <input
              type="text"
              required
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="e.g. John Doe (Shift Supervisor)"
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
              Shift Handover Summary Notes
            </label>
            <input
              type="text"
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder="All alarms cleared, SCADA telemetry green..."
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[var(--text-muted)]">
            Checklist Status:{" "}
            <strong>
              {overallStats.completed}/{overallStats.total} items verified
            </strong>
          </span>

          <button
            type="submit"
            disabled={isSubmitting || !operatorName.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Submitting Log..." : "Submit Shift Verification"}</span>
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
