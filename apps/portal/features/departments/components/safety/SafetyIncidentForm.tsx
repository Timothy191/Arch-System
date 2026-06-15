"use client";

import { useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { useRouter } from "next/navigation";
import { revalidateRSC } from "@/app/actions";

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Severity {
  id: string;
  level: string;
  color: string;
}

interface SafetyIncidentFormProps {
  departmentId: string;
  categories: Category[];
  severities: Severity[];
}

const INCIDENT_TYPES = [
  { value: "near-miss", label: "Near Miss" },
  { value: "incident", label: "Incident" },
  { value: "lost-time", label: "Lost Time Injury" },
  { value: "equipment-damage", label: "Equipment Damage" },
];

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "under-investigation", label: "Under Investigation" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export function SafetyIncidentForm({
  departmentId,
  categories,
  severities,
}: SafetyIncidentFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const getCurrentShift = (): "day" | "night" => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? "day" : "night";
  };

  const [formData, setFormData] = useState({
    incidentType: "",
    categoryId: "",
    severityId: "",
    shiftType: getCurrentShift(),
    description: "",
    location: "",
    injuredParties: 0,
    rootCause: "",
    correctiveAction: "",
    status: "open",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.incidentType) newErrors.incidentType = "Select incident type";
    if (!formData.severityId) newErrors.severityId = "Select severity";
    if (!formData.description.trim())
      newErrors.description = "Enter description";
    if (formData.injuredParties < 0 || formData.injuredParties > 100)
      newErrors.injuredParties = "Invalid number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { error } = await supabase.from("safety_incidents").insert({
        department_id: departmentId,
        incident_date: today,
        shift_type: formData.shiftType,
        category_id: formData.categoryId || null,
        severity_id: formData.severityId || null,
        incident_type: formData.incidentType,
        description: formData.description,
        location: formData.location || null,
        injured_parties: formData.injuredParties,
        root_cause: formData.rootCause || null,
        corrective_action: formData.correctiveAction || null,
        status: formData.status,
        reported_by: employee?.id,
      });

      if (error) throw error;

      // Revalidate cached RSC data
      revalidateRSC(["table:safety_incidents"]).catch(() => {});

      // Trigger n8n workflow for safety alert
      import("@repo/utils").then(({ triggerWorkflow }) => {
        triggerWorkflow("safety-incident", {
          department_id: departmentId,
          severity_id: formData.severityId,
          reported_by: employee?.id,
          incident_date: today,
          description: formData.description,
        });
      });

      setFormData({
        incidentType: "",
        categoryId: "",
        severityId: "",
        shiftType: getCurrentShift(),
        description: "",
        location: "",
        injuredParties: 0,
        rootCause: "",
        correctiveAction: "",
        status: "open",
      });
      router.refresh();
    } catch (err) {
      setErrors({ submit: "Failed to save incident. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassCard>
      <form onSubmit={handleSubmit} className="space-y-5">
        <h3 className="text-lg font-medium text-[var(--text-heading)]">
          Log Safety Incident
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Incident Type */}
          <div className="space-y-2">
            <label
              htmlFor="incident-type"
              className="text-[var(--text-muted)] text-sm block"
            >
              Type <span className="text-accent-red">*</span>
            </label>
            <select
              id="incident-type"
              aria-label="Incident Type"
              value={formData.incidentType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  incidentType: e.target.value,
                }))
              }
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e] transition-colors"
            >
              <option value="">Select type...</option>
              {INCIDENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.incidentType && (
              <p className="text-accent-red text-xs">{errors.incidentType}</p>
            )}
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <label className="text-[var(--text-muted)] text-sm block">
              Severity <span className="text-accent-red">*</span>
            </label>
            <select
              aria-label="Severity Level"
              value={formData.severityId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, severityId: e.target.value }))
              }
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e] transition-colors"
            >
              <option value="">Select severity...</option>
              {severities.map((s) => (
                <option key={s.id} value={s.id} style={{ color: s.color }}>
                  {s.level}
                </option>
              ))}
            </select>
            {errors.severityId && (
              <p className="text-accent-red text-xs">{errors.severityId}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-[var(--text-muted)] text-sm block">
              Category
            </label>
            <select
              aria-label="Incident Category"
              value={formData.categoryId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, categoryId: e.target.value }))
              }
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e] transition-colors"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Shift & Injured Parties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[var(--text-muted)] text-sm block">
              Shift
            </label>
            <div className="flex gap-2">
              {["day", "night"].map((shift) => (
                <button
                  key={shift}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      shiftType: shift as "day" | "night",
                    }))
                  }
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    formData.shiftType === shift
                      ? "bg-[#3ecf8e] text-[var(--text-heading)]"
                      : "bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                  }`}
                >
                  {shift.charAt(0).toUpperCase() + shift.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[var(--text-muted)] text-sm block">
              Injured Parties
            </label>
            <input
              type="number"
              aria-label="Number of Injured Parties"
              value={formData.injuredParties}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  injuredParties: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e]"
            />
            {errors.injuredParties && (
              <p className="text-accent-red text-xs">{errors.injuredParties}</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-[var(--text-muted)] text-sm block">
            Description <span className="text-accent-red">*</span>
          </label>
          <textarea
            aria-label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Describe the incident..."
            rows={4}
            maxLength={500}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e] transition-colors resize-none"
          />
          <div className="flex justify-between">
            {errors.description && (
              <p className="text-accent-red text-xs">{errors.description}</p>
            )}
            <p className="text-[var(--text-secondary)] text-xs ml-auto">
              {formData.description.length}/500
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="text-[var(--text-muted)] text-sm block">
            Location
          </label>
          <input
            type="text"
            aria-label="Location"
            value={formData.location}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, location: e.target.value }))
            }
            placeholder="e.g., Main Pit, South Stockpile"
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e]"
          />
        </div>

        {/* Root Cause & Corrective Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[var(--text-muted)] text-sm block">
              Root Cause
            </label>
            <input
              type="text"
              value={formData.rootCause}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, rootCause: e.target.value }))
              }
              placeholder="Root cause of incident"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[var(--text-muted)] text-sm block">
              Corrective Action
            </label>
            <input
              type="text"
              value={formData.correctiveAction}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  correctiveAction: e.target.value,
                }))
              }
              placeholder="Action taken to prevent recurrence"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-emphasis)] rounded-lg px-3 py-2.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[#3ecf8e]"
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-[var(--text-muted)] text-sm block">
            Status
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, status: s.value }))
                }
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  formData.status === s.value
                    ? "bg-[#3ecf8e] text-[var(--text-heading)]"
                    : "bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#3ecf8e] hover:bg-[#35b37d] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-secondary)] text-[var(--text-heading)] font-medium py-2.5 px-6 rounded-lg transition-colors"
          >
            {isSubmitting ? "Saving..." : "Log Incident"}
          </button>
          {errors.submit && (
            <p className="text-accent-red text-sm">{errors.submit}</p>
          )}
        </div>
      </form>
    </GlassCard>
  );
}
