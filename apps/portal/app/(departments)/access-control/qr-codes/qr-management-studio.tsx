"use client";

import { Button } from "@repo/ui/components/ui/button";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  Car,
  CheckCircle2,
  Layers,
  Plus,
  QrCode,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { QRCodeSection } from "../../access-card-actions/card-actions/qr-section";
import type {
  BadgeInventoryItem,
  CreateBadgePayload,
  CredentialEntityType,
  EntityOption,
} from "./actions";
import { createBadgeCredential, getBadgesInventory, revokeBadgeCredential } from "./actions";

interface QrManagementStudioProps {
  initialBadges: BadgeInventoryItem[];
  options: {
    personnel: EntityOption[];
    vehicles: EntityOption[];
    coalTrucks: EntityOption[];
    visitors: EntityOption[];
    equipment: EntityOption[];
  };
}

export function QrManagementStudio({ initialBadges, options }: QrManagementStudioProps) {
  const [badges, setBadges] = useState<BadgeInventoryItem[]>(initialBadges);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inspectBadge, setInspectBadge] = useState<BadgeInventoryItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form State for Quick Issue
  const [formEntityType, setFormEntityType] = useState<CredentialEntityType>(
    "employee" as unknown as CredentialEntityType
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [isCustomEntity, setIsCustomEntity] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [customReg, setCustomReg] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [rfidCodeInput, setRfidCodeInput] = useState("");
  const [validityDays, setValidityDays] = useState<number>(365);

  const handleFilter = (type: string) => {
    setFilterType(type);
    startTransition(async () => {
      const results = await getBadgesInventory(type, search);
      setBadges(results);
    });
  };

  const handleSearch = (term: string) => {
    setSearch(term);
    startTransition(async () => {
      const results = await getBadgesInventory(filterType, term);
      setBadges(results);
    });
  };

  const handleAutoGenerateCode = (entityType: CredentialEntityType) => {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    switch (entityType) {
      case "coal_truck":
        setQrCodeInput(`TRK-COAL-${randomSuffix}`);
        break;
      case "vehicle":
        setQrCodeInput(`VEH-${randomSuffix}`);
        break;
      case "visitor":
        setQrCodeInput(`VIS-${randomSuffix}`);
        break;
      case "equipment":
        setQrCodeInput(`EQP-${randomSuffix}`);
        break;
      case "personnel":
      default:
        setQrCodeInput(`EMP-${randomSuffix}`);
        break;
    }
  };

  const handleRevoke = (badgeId: string) => {
    startTransition(async () => {
      try {
        await revokeBadgeCredential(badgeId);
        setBadges((prev) =>
          prev.map((b) => (b.id === badgeId ? { ...b, is_active: false, status: "Revoked" } : b))
        );
        toast.success("Credential revoked successfully");
      } catch {
        toast.error("Failed to revoke credential");
      }
    });
  };

  const handleSubmitNewBadge = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload: CreateBadgePayload = {
          entityType: formEntityType,
          code: qrCodeInput,
          rfidCode: rfidCodeInput,
          targetEntityId: isCustomEntity ? undefined : selectedEntityId || undefined,
          newEntityData: isCustomEntity
            ? {
                name: customName,
                code: customCode,
                regNumber: customReg,
                make: customMake,
              }
            : undefined,
          expiresInDays: validityDays,
        };

        const res = await createBadgeCredential(payload);
        if (res.success) {
          toast.success("New QR & RFID credential activated and registered in database!");
          setIsModalOpen(false);
          // Refresh list
          const updated = await getBadgesInventory(filterType, search);
          setBadges(updated);
          // Reset form
          setQrCodeInput("");
          setRfidCodeInput("");
          setSelectedEntityId("");
          setIsCustomEntity(false);
          setCustomName("");
          setCustomCode("");
          setCustomReg("");
          setCustomMake("");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create badge";
        toast.error(msg);
      }
    });
  };

  // Get options for current form selection
  const currentOptions: EntityOption[] =
    formEntityType === "personnel"
      ? options.personnel
      : formEntityType === "coal_truck"
        ? options.coalTrucks
        : formEntityType === "vehicle"
          ? options.vehicles
          : formEntityType === "visitor"
            ? options.visitors
            : options.equipment;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stats Bar ── */}
      <GlassCard className="p-5 border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">
                  Universal QR & RFID Credential Hub
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-500/10 border-blue-500/20 text-blue-400">
                  <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
                  C66 RFID Ready
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Issue and manage credentials for{" "}
                <strong className="text-[var(--text-primary)]">Employees</strong>,{" "}
                <strong className="text-[var(--text-primary)]">Vehicles</strong>,{" "}
                <strong className="text-amber-400">Coal Trucks</strong>,{" "}
                <strong className="text-[var(--text-primary)]">Visitors</strong>, and{" "}
                <strong className="text-[var(--text-primary)]">Heavy Equipment</strong>.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setFormEntityType("personnel");
              handleAutoGenerateCode("personnel");
              setIsModalOpen(true);
            }}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2 shadow-lg shadow-emerald-600/30 self-end md:self-center"
          >
            <Plus className="w-4 h-4" />
            Issue QR / RFID Pass
          </Button>
        </div>
      </GlassCard>

      {/* ── Category Filters & Search Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: "All Credentials", icon: Layers },
            { id: "personnel", label: "Employees", icon: Users },
            { id: "coal_truck", label: "Coal Trucks", icon: Truck },
            { id: "vehicle", label: "Vehicles", icon: Car },
            { id: "visitor", label: "Visitors", icon: Users },
            { id: "equipment", label: "Equipment", icon: Wrench },
          ].map((cat) => {
            const Icon = cat.icon;
            const active = filterType === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleFilter(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                  active
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                    : "bg-[var(--bg-secondary)]/50 border-[var(--border-default)] text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search code or RFID..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* ── Credentials Inventory Table ── */}
      <GlassCard className="p-0 overflow-hidden border border-[var(--border-default)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/30 text-[var(--text-muted)]">
                <th className="p-3.5 font-medium">QR Pass</th>
                <th className="p-3.5 font-medium">RFID UID</th>
                <th className="p-3.5 font-medium">Target Entity</th>
                <th className="p-3.5 font-medium">Category</th>
                <th className="p-3.5 font-medium">Status</th>
                <th className="p-3.5 font-medium">Issued / Expires</th>
                <th className="p-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]/40">
              {badges.map((b) => (
                <tr key={b.id} className="hover:bg-[var(--bg-secondary)]/20 transition-colors">
                  <td className="p-3.5">
                    <div
                      onClick={() => setInspectBadge(b)}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <div className="w-9 h-9 bg-white rounded-md p-1 flex items-center justify-center shrink-0 border border-slate-200 shadow-sm group-hover:scale-105 transition-transform">
                        <QRCodeSection data={b.qr_code} size={30} />
                      </div>
                      <span className="font-mono font-bold text-[var(--text-primary)] group-hover:text-blue-400">
                        {b.qr_code}
                      </span>
                    </div>
                  </td>

                  <td className="p-3.5">
                    {b.rfid_code ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        <Radio className="w-3 h-3 text-blue-400" />
                        {b.rfid_code}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)] italic font-mono text-[11px]">
                        No RFID tag
                      </span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <p className="font-semibold text-[var(--text-heading)]">{b.entity_name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{b.entity_subtitle}</p>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                        b.entity_subtitle.toLowerCase().includes("coal")
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : b.entity_type === "personnel"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : b.entity_type === "vehicle"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                              : b.entity_type === "visitor"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {b.entity_subtitle.toLowerCase().includes("coal") ? (
                        <Truck className="w-2.5 h-2.5" />
                      ) : (
                        <ShieldCheck className="w-2.5 h-2.5" />
                      )}
                      {b.entity_subtitle.toLowerCase().includes("coal")
                        ? "Coal Truck"
                        : b.entity_type.toUpperCase()}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        b.is_active
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {b.is_active ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {b.status}
                    </span>
                  </td>

                  <td className="p-3.5 text-slate-400">
                    <div>
                      <span>Issued: {new Date(b.issued_at).toLocaleDateString()}</span>
                      {b.expires_at && (
                        <p className="text-[10px] text-amber-400">
                          Exp: {new Date(b.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setInspectBadge(b)}
                      className="text-blue-400 hover:text-blue-300 font-medium text-xs inline-flex items-center gap-1"
                    >
                      <QrCode className="w-3 h-3" /> View
                    </button>
                    {b.is_active && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(b.id)}
                        className="text-red-400 hover:text-red-300 font-medium text-xs inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {badges.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[var(--text-muted)]">
                    No credentials found. Click "+ Issue QR / RFID Pass" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ── Modal: Issue New QR / RFID Pass ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Issue New QR / RFID Credential
                </h3>
                <p className="text-xs text-slate-400">
                  Credential will be saved to the database and verifiable via Chainway C66 scanner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewBadge} className="space-y-4">
              {/* Entity Type Selector Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Target Entity Type</label>
                <div className="grid grid-cols-5 gap-1.5 bg-slate-950 p-1 rounded-lg border border-white/10">
                  {[
                    { id: "personnel", label: "Employee", icon: Users },
                    { id: "coal_truck", label: "Coal Truck", icon: Truck },
                    { id: "vehicle", label: "Vehicle", icon: Car },
                    { id: "visitor", label: "Visitor", icon: Users },
                    { id: "equipment", label: "Equipment", icon: Wrench },
                  ].map((t) => {
                    const active = formEntityType === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          const val = t.id as CredentialEntityType;
                          setFormEntityType(val);
                          handleAutoGenerateCode(val);
                          setSelectedEntityId("");
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded text-[11px] font-medium transition-all ${
                          active
                            ? "bg-emerald-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 mb-1" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Existing or Create New */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Assign Target Entity</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomEntity(!isCustomEntity)}
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    {isCustomEntity ? "Select Existing Entity" : "+ Register New On-The-Fly"}
                  </button>
                </div>

                {!isCustomEntity ? (
                  <select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose {formEntityType.replace("_", " ")} --</option>
                    {currentOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} • {opt.sublabel}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-lg border border-white/10">
                    {formEntityType === "coal_truck" || formEntityType === "vehicle" ? (
                      <>
                        <input
                          type="text"
                          placeholder="Fleet / Truck Code (e.g. CT-99)"
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Registration (e.g. ABC 999 GP)"
                          value={customReg}
                          onChange={(e) => setCustomReg(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Make & Model (e.g. Scania R500)"
                          value={customMake}
                          onChange={(e) => setCustomMake(e.target.value)}
                          className="col-span-2 px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded text-xs text-white"
                        />
                      </>
                    ) : formEntityType === "visitor" ? (
                      <>
                        <input
                          type="text"
                          placeholder="Visitor Full Name"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Company (e.g. TransCol Logistics)"
                          value={customMake}
                          onChange={(e) => setCustomMake(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded text-xs text-white"
                        />
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Code (e.g. EQP-991)"
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Type / Description"
                          value={customMake}
                          onChange={(e) => setCustomMake(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded text-xs text-white"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* QR Code & RFID Input */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">QR Code String</label>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateCode(formEntityType)}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                    placeholder="e.g. TRK-COAL-1002"
                    className="w-full px-3 py-2 bg-slate-950 border border-white/15 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                    <Radio className="w-3 h-3 text-blue-400" />
                    RFID Chip Tag UID (Optional)
                  </label>
                  <input
                    type="text"
                    value={rfidCodeInput}
                    onChange={(e) => setRfidCodeInput(e.target.value)}
                    placeholder="e.g. E28011606000021"
                    className="w-full px-3 py-2 bg-slate-950 border border-white/15 rounded-lg text-xs font-mono text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Live QR Preview Thumbnail */}
              <div className="flex items-center gap-4 bg-slate-950/80 p-3 rounded-xl border border-white/10">
                <div className="w-16 h-16 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 shadow-inner">
                  <QRCodeSection data={qrCodeInput || "SAMPLE"} size={56} />
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-white">Live Code Preview</p>
                  <p className="font-mono text-[11px] text-emerald-400 truncate">{qrCodeInput}</p>
                  <p className="text-[10px] text-slate-400">
                    Verifiable by optical 2D barcode imager and Chainway C66 RFID reader.
                  </p>
                </div>
              </div>

              {/* Validity Period */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Validity Expiration</span>
                <div className="flex items-center gap-2">
                  {[
                    { label: "24 Hours", days: 1 },
                    { label: "30 Days", days: 30 },
                    { label: "1 Year", days: 365 },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setValidityDays(p.days)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        validityDays === p.days
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !qrCodeInput}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {isPending ? "Activating..." : "Save & Activate Credential"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Inspect & Print Single Badge ── */}
      {inspectBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl text-center space-y-4 text-white">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <span className="font-bold text-sm">Badge Credential Detail</span>
              <button
                type="button"
                onClick={() => setInspectBadge(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mx-auto w-48 h-48 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center">
              <QRCodeSection data={inspectBadge.qr_code} size={160} />
            </div>

            <div className="space-y-1">
              <p className="font-mono font-bold text-base text-emerald-400">
                {inspectBadge.qr_code}
              </p>
              <p className="font-semibold text-white">{inspectBadge.entity_name}</p>
              <p className="text-xs text-slate-400">{inspectBadge.entity_subtitle}</p>
              {inspectBadge.rfid_code && (
                <p className="text-xs font-mono text-blue-400 pt-1">
                  RFID Tag: {inspectBadge.rfid_code}
                </p>
              )}
            </div>

            <Button
              className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white"
              onClick={() => {
                toast.success("Ready for scanning with Chainway C66");
                setInspectBadge(null);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
