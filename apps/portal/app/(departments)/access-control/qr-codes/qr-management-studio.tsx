'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
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
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { QRCodeSection } from '../card-actions/qr-section';
import type {
  BadgeInventoryItem,
  CreateBadgePayload,
  CredentialEntityType,
  EntityOption,
} from './actions';
import { createBadgeCredential, getBadgesInventory, revokeBadgeCredential } from './actions';

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
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inspectBadge, setInspectBadge] = useState<BadgeInventoryItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form State for Quick Issue
  const [formEntityType, setFormEntityType] = useState<CredentialEntityType>(
    'employee' as unknown as CredentialEntityType
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [isCustomEntity, setIsCustomEntity] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customReg, setCustomReg] = useState('');
  const [customMake, setCustomMake] = useState('');
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [rfidCodeInput, setRfidCodeInput] = useState('');
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
      case 'coal_truck':
        setQrCodeInput(`TRK-COAL-${randomSuffix}`);
        break;
      case 'vehicle':
        setQrCodeInput(`VEH-${randomSuffix}`);
        break;
      case 'visitor':
        setQrCodeInput(`VIS-${randomSuffix}`);
        break;
      case 'equipment':
        setQrCodeInput(`EQP-${randomSuffix}`);
        break;
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
          prev.map((b) => (b.id === badgeId ? { ...b, is_active: false, status: 'Revoked' } : b))
        );
        toast.success('Credential revoked successfully');
      } catch {
        toast.error('Failed to revoke credential');
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
          toast.success('New QR & RFID credential activated and registered in database!');
          setIsModalOpen(false);
          // Refresh list
          const updated = await getBadgesInventory(filterType, search);
          setBadges(updated);
          // Reset form
          setQrCodeInput('');
          setRfidCodeInput('');
          setSelectedEntityId('');
          setIsCustomEntity(false);
          setCustomName('');
          setCustomCode('');
          setCustomReg('');
          setCustomMake('');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create badge';
        toast.error(msg);
      }
    });
  };

  // Get options for current form selection
  const currentOptions: EntityOption[] =
    formEntityType === 'personnel'
      ? options.personnel
      : formEntityType === 'coal_truck'
        ? options.coalTrucks
        : formEntityType === 'vehicle'
          ? options.vehicles
          : formEntityType === 'visitor'
            ? options.visitors
            : options.equipment;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stats Bar ── */}
      <GlassCard className="border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-5 backdrop-blur-md">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-emerald-500/20 shadow-md">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[var(--text-heading)] text-xl tracking-tight">
                  Universal QR & RFID Credential Hub
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 font-medium text-blue-400 text-xs">
                  <Radio className="h-3 w-3 animate-pulse text-blue-400" />
                  C66 RFID Ready
                </span>
              </div>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Issue and manage credentials for{' '}
                <strong className="text-[var(--text-primary)]">Employees</strong>,{' '}
                <strong className="text-[var(--text-primary)]">Vehicles</strong>,{' '}
                <strong className="text-amber-400">Coal Trucks</strong>,{' '}
                <strong className="text-[var(--text-primary)]">Visitors</strong>, and{' '}
                <strong className="text-[var(--text-primary)]">Heavy Equipment</strong>.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setFormEntityType('personnel');
              handleAutoGenerateCode('personnel');
              setIsModalOpen(true);
            }}
            className="gap-2 self-end bg-gradient-to-r from-emerald-600 to-teal-600 py-2 font-semibold text-white shadow-emerald-600/30 shadow-lg hover:from-emerald-500 hover:to-teal-500 md:self-center"
          >
            <Plus className="h-4 w-4" />
            Issue QR / RFID Pass
          </Button>
        </div>
      </GlassCard>

      {/* ── Category Filters & Search Controls ── */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Credentials', icon: Layers },
            { id: 'personnel', label: 'Employees', icon: Users },
            { id: 'coal_truck', label: 'Coal Trucks', icon: Truck },
            { id: 'vehicle', label: 'Vehicles', icon: Car },
            { id: 'visitor', label: 'Visitors', icon: Users },
            { id: 'equipment', label: 'Equipment', icon: Wrench },
          ].map((cat) => {
            const Icon = cat.icon;
            const active = filterType === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleFilter(cat.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 font-medium text-xs transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                    : 'border-[var(--border-default)] bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search code or RFID..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-1.5 pr-3 pl-8 text-[var(--text-primary)] text-xs placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* ── Credentials Inventory Table ── */}
      <GlassCard className="overflow-hidden border border-[var(--border-default)] p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/30 text-[var(--text-muted)]">
                <th className="p-3.5 font-medium">QR Pass</th>
                <th className="p-3.5 font-medium">RFID UID</th>
                <th className="p-3.5 font-medium">Target Entity</th>
                <th className="p-3.5 font-medium">Category</th>
                <th className="p-3.5 font-medium">Status</th>
                <th className="p-3.5 font-medium">Issued / Expires</th>
                <th className="p-3.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]/40">
              {badges.map((b) => (
                <tr key={b.id} className="transition-colors hover:bg-[var(--bg-secondary)]/20">
                  <td className="p-3.5">
                    <div
                      onClick={() => setInspectBadge(b)}
                      className="group flex cursor-pointer items-center gap-2"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1 shadow-sm transition-transform group-hover:scale-105">
                        <QRCodeSection data={b.qr_code} size={30} />
                      </div>
                      <span className="font-bold font-mono text-[var(--text-primary)] group-hover:text-blue-400">
                        {b.qr_code}
                      </span>
                    </div>
                  </td>

                  <td className="p-3.5">
                    {b.rfid_code ? (
                      <span className="inline-flex items-center gap-1 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] text-blue-300">
                        <Radio className="h-3 w-3 text-blue-400" />
                        {b.rfid_code}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--text-muted)] italic">
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
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium text-[10px] ${
                        b.entity_subtitle.toLowerCase().includes('coal')
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                          : b.entity_type === 'personnel'
                            ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                            : b.entity_type === 'vehicle'
                              ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400'
                              : b.entity_type === 'visitor'
                                ? 'border-purple-500/20 bg-purple-500/10 text-purple-400'
                                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {b.entity_subtitle.toLowerCase().includes('coal') ? (
                        <Truck className="h-2.5 w-2.5" />
                      ) : (
                        <ShieldCheck className="h-2.5 w-2.5" />
                      )}
                      {b.entity_subtitle.toLowerCase().includes('coal')
                        ? 'Coal Truck'
                        : b.entity_type.toUpperCase()}
                    </span>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[10px] ${
                        b.is_active
                          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border border-red-500/20 bg-red-500/10 text-red-400'
                      }`}
                    >
                      {b.is_active ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
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

                  <td className="space-x-2 p-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setInspectBadge(b)}
                      className="inline-flex items-center gap-1 font-medium text-blue-400 text-xs hover:text-blue-300"
                    >
                      <QrCode className="h-3 w-3" /> View
                    </button>
                    {b.is_active && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(b.id)}
                        className="inline-flex items-center gap-1 font-medium text-red-400 text-xs hover:text-red-300"
                      >
                        <XCircle className="h-3 w-3" /> Revoke
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
        <div className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm duration-200">
          <div className="w-full max-w-xl space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 text-[var(--text-heading)] shadow-2xl">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-3">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-base">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Issue New QR / RFID Credential
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Credential will be saved to the database and verifiable via Chainway C66 scanner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-heading)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewBadge} className="space-y-4">
              {/* Entity Type Selector Tabs */}
              <div className="space-y-1.5">
                <label className="font-medium text-[var(--text-secondary)] text-xs">
                  Target Entity Type
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1 sm:grid-cols-5">
                  {[
                    { id: 'personnel', label: 'Employee', icon: Users },
                    { id: 'coal_truck', label: 'Coal Truck', icon: Truck },
                    { id: 'vehicle', label: 'Vehicle', icon: Car },
                    { id: 'visitor', label: 'Visitor', icon: Users },
                    { id: 'equipment', label: 'Equipment', icon: Wrench },
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
                          setSelectedEntityId('');
                        }}
                        className={`flex flex-col items-center justify-center rounded p-2 font-medium text-[11px] transition-all ${
                          active
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                        }`}
                      >
                        <Icon className="mb-1 h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Existing or Create New */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[var(--text-secondary)] text-xs">
                    Assign Target Entity
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomEntity(!isCustomEntity)}
                    className="text-[11px] text-[var(--accent-blue)] hover:underline"
                  >
                    {isCustomEntity ? 'Select Existing Entity' : '+ Register New On-The-Fly'}
                  </button>
                </div>

                {!isCustomEntity ? (
                  <select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose {formEntityType.replace('_', ' ')} --</option>
                    {currentOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} • {opt.sublabel}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-3">
                    {formEntityType === 'coal_truck' || formEntityType === 'vehicle' ? (
                      <>
                        <input
                          type="text"
                          placeholder="Fleet / Truck Code (e.g. CT-99)"
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)]"
                        />
                        <input
                          type="text"
                          placeholder="Registration (e.g. ABC 999 GP)"
                          value={customReg}
                          onChange={(e) => setCustomReg(e.target.value)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)]"
                        />
                        <input
                          type="text"
                          placeholder="Make & Model (e.g. Scania R500)"
                          value={customMake}
                          onChange={(e) => setCustomMake(e.target.value)}
                          className="col-span-2 rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)]"
                        />
                      </>
                    ) : formEntityType === 'visitor' ? (
                      <>
                        <input
                          type="text"
                          placeholder="Visitor Full Name"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)]"
                        />
                        <input
                          type="text"
                          placeholder="Company (e.g. TransCol Logistics)"
                          value={customMake}
                          onChange={(e) => setCustomMake(e.target.value)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)]"
                        />
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Code (e.g. EQP-991)"
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)]"
                        />
                        <input
                          type="text"
                          placeholder="Type / Description"
                          value={customMake}
                          onChange={(e) => setCustomMake(e.target.value)}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)]"
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
                    <label className="font-medium text-[var(--text-secondary)] text-xs">
                      QR Code String
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateCode(formEntityType)}
                      className="flex items-center gap-1 font-medium text-[10px] text-emerald-600 hover:underline"
                    >
                      <Sparkles className="h-2.5 w-2.5" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                    placeholder="e.g. TRK-COAL-1002"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono font-semibold text-emerald-700 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 font-medium text-[var(--text-secondary)] text-xs">
                    <Radio className="h-3 w-3 text-blue-600" />
                    RFID Chip Tag UID (Optional)
                  </label>
                  <input
                    type="text"
                    value={rfidCodeInput}
                    onChange={(e) => setRfidCodeInput(e.target.value)}
                    placeholder="e.g. E28011606000021"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono font-semibold text-blue-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Live QR Preview Thumbnail */}
              <div className="flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-white p-1 shadow-inner">
                  <QRCodeSection data={qrCodeInput || 'SAMPLE'} size={56} />
                </div>
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-[var(--text-heading)]">Live Code Preview</p>
                  <p className="truncate font-bold font-mono text-[11px] text-emerald-700">
                    {qrCodeInput}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Verifiable by optical 2D barcode imager and Chainway C66 RFID reader.
                  </p>
                </div>
              </div>

              {/* Validity Period */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text-secondary)]">
                  Validity Expiration
                </span>
                <div className="flex items-center gap-2">
                  {[
                    { label: '24 Hours', days: 1 },
                    { label: '30 Days', days: 30 },
                    { label: '1 Year', days: 365 },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setValidityDays(p.days)}
                      className={`rounded px-2.5 py-1 font-medium text-xs transition-colors ${
                        validityDays === p.days
                          ? 'bg-blue-600 text-white'
                          : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-[var(--border-default)] border-t pt-3">
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
                  className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                >
                  {isPending ? 'Activating...' : 'Save & Activate Credential'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Inspect & Print Single Badge ── */}
      {inspectBadge && (
        <div className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm duration-200">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 text-center text-[var(--text-heading)] shadow-2xl">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b pb-2">
              <span className="font-bold text-sm">Badge Credential Detail</span>
              <button
                type="button"
                onClick={() => setInspectBadge(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-white p-3 shadow-md">
              <QRCodeSection data={inspectBadge.qr_code} size={160} />
            </div>

            <div className="space-y-1">
              <p className="font-bold font-mono text-base text-emerald-700">
                {inspectBadge.qr_code}
              </p>
              <p className="font-semibold text-[var(--text-heading)]">{inspectBadge.entity_name}</p>
              <p className="text-[var(--text-muted)] text-xs">{inspectBadge.entity_subtitle}</p>
              {inspectBadge.rfid_code && (
                <p className="pt-1 font-medium font-mono text-blue-700 text-xs">
                  RFID Tag: {inspectBadge.rfid_code}
                </p>
              )}
            </div>

            <Button
              className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-500"
              onClick={() => {
                toast.success('Ready for scanning with Chainway C66');
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
