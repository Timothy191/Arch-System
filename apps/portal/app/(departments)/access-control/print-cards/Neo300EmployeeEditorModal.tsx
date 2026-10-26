'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { Camera, CheckCircle2, Upload, UserPlus, X } from 'lucide-react';
import {
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useRef,
} from 'react';
import { toast } from 'sonner';
import type { CardStudioDepartment, UpsertEmployeeCardInput } from './actions';

export const DEFAULT_EXPIRY_ONE_YEAR = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0]!;
};

interface Neo300EmployeeEditorModalProps {
  editorMode: 'create' | 'edit';
  formState: UpsertEmployeeCardInput;
  setFormState: Dispatch<SetStateAction<UpsertEmployeeCardInput>>;
  departments: CardStudioDepartment[];
  isPending: boolean;
  onClose: () => void;
  onSave: (e: FormEvent) => void;
}

export function Neo300EmployeeEditorModal({
  editorMode,
  formState,
  setFormState,
  departments,
  isPending,
  onClose,
  onSave,
}: Neo300EmployeeEditorModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetW = 240;
        const targetH = 300;
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Center-crop portrait aspect ratio
          const scale = Math.max(targetW / img.width, targetH / img.height);
          const sw = targetW / scale;
          const sh = targetH / scale;
          const sx = (img.width - sw) / 2;
          const sy = (img.height - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          setFormState((prev) => ({ ...prev, photo_url: dataUrl }));
          toast.success('Employee ID photo processed & ready for CR80 card');
        }
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <GlassCard className="space-y-5 border-2 border-[var(--accent-blue)]/40 p-6 shadow-lg">
      <div className="flex items-center justify-between border-[var(--border-subtle)] border-b pb-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
            <UserPlus className="h-4 w-4 text-[var(--accent-blue)]" />
            {editorMode === 'create'
              ? 'Register New Employee & Provision Access Card'
              : `Edit Employee Card Profile & Photo (${formState.emp_code})`}
          </h3>
          <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
            Saves directly to <code className="font-mono">personnel</code>, issues active{' '}
            <code className="font-mono">badges</code> (QR + RFID), and auto-syncs to{' '}
            <code className="font-mono">operators</code> across Control Room, Drilling &amp;
            Production.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-heading)]"
          aria-label="Close employee editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onSave} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Photo Upload & Live Portrait Preview (4 cols) */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 lg:col-span-4">
          <div className="relative flex h-36 w-28 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--border-default)] bg-slate-900 shadow-inner">
            {formState.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={formState.photo_url}
                alt="Employee ID preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <Camera className="h-7 w-7 text-slate-400" />
                <span className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider">
                  ID Portrait
                </span>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handlePhotoFileChange}
            className="hidden"
          />

          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload / Capture Photo
            </Button>
            {formState.photo_url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFormState((prev) => ({ ...prev, photo_url: '' }))}
                className="text-red-600 text-xs"
              >
                Clear
              </Button>
            )}
          </div>

          <input
            type="text"
            placeholder="Or paste photo URL / data URI…"
            value={formState.photo_url || ''}
            onChange={(e) => setFormState((prev) => ({ ...prev, photo_url: e.target.value }))}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-primary)] text-xs"
          />
        </div>

        {/* Employee Database Fields (8 cols) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:col-span-8">
          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              First Name *
            </label>
            <input
              type="text"
              required
              value={formState.first_name}
              onChange={(e) => setFormState((prev) => ({ ...prev, first_name: e.target.value }))}
              placeholder="e.g. Sipho"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              Surname *
            </label>
            <input
              type="text"
              required
              value={formState.surname}
              onChange={(e) => setFormState((prev) => ({ ...prev, surname: e.target.value }))}
              placeholder="e.g. Ndlovu"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              Employee Code *
            </label>
            <input
              type="text"
              required
              value={formState.emp_code}
              onChange={(e) => {
                const code = e.target.value.toUpperCase();
                setFormState((prev) => ({
                  ...prev,
                  emp_code: code,
                  qr_code: `EMP-${code}`,
                }));
              }}
              placeholder="e.g. EMP-0105"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              National ID / Passport Number *
            </label>
            <input
              type="text"
              required
              value={formState.id_number}
              onChange={(e) => setFormState((prev) => ({ ...prev, id_number: e.target.value }))}
              placeholder="e.g. 8804125104081"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              Job Title / Designation *
            </label>
            <input
              type="text"
              required
              value={formState.job_title}
              onChange={(e) => setFormState((prev) => ({ ...prev, job_title: e.target.value }))}
              placeholder="e.g. Pit Viper Drill Operator"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              Department
            </label>
            <select
              aria-label="Employee Department"
              value={formState.department_id || ''}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, department_id: e.target.value || null }))
              }
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            >
              <option value="">General Operations</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              Medical Fitness Expiry Date
            </label>
            <input
              type="date"
              aria-label="Medical Fitness Expiry Date"
              value={formState.medical_expiry || ''}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, medical_expiry: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              Safety Induction Expiry Date
            </label>
            <input
              type="date"
              aria-label="Safety Induction Expiry Date"
              value={formState.induction_expiry || ''}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, induction_expiry: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              Site Clearance Zone
            </label>
            <select
              aria-label="Site Clearance Zone"
              value={formState.area || 'Main Complex'}
              onChange={(e) => setFormState((prev) => ({ ...prev, area: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-sm"
            >
              <option value="Main Complex">Main Complex &amp; Control Room</option>
              <option value="North Pit">North Pit &amp; Haul Roads</option>
              <option value="South Pit">South Pit &amp; Blast Zone</option>
              <option value="Engineering Workshop">Engineering Workshop-03</option>
              <option value="Processing Plant">Coal Wash Plant &amp; Weighbridge</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-secondary)] text-xs">
              RFID Chip UID / QR Payload
            </label>
            <input
              type="text"
              value={formState.rfid_code || ''}
              onChange={(e) => setFormState((prev) => ({ ...prev, rfid_code: e.target.value }))}
              placeholder="e.g. RFID-9A84F2"
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[var(--text-heading)] text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-[var(--border-subtle)] border-t pt-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="gap-1.5 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isPending
                ? 'Saving to Database…'
                : editorMode === 'create'
                  ? 'Save Employee to DB & Load Card'
                  : 'Update Employee & Card Details'}
            </Button>
          </div>
        </div>
      </form>
    </GlassCard>
  );
}
