'use client';

import {
  machineOperatorScanRequestSchema,
  machineOperatorScanResponseSchema,
  z,
} from '@repo/contract';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, Camera, CheckCircle2, RefreshCw, ScanLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const scanErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

type MachinePreview = Extract<
  z.infer<typeof machineOperatorScanResponseSchema>,
  { stage: 'machine' }
>['machine'];
type EligibleOperator = Extract<
  z.infer<typeof machineOperatorScanResponseSchema>,
  { stage: 'operators' }
>['operators'][number];
type Assignment = Extract<
  z.infer<typeof machineOperatorScanResponseSchema>,
  { stage: 'assignment' }
>;
type BarcodeResult = { rawValue: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
};
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;
type CameraWindow = Window & { BarcodeDetector?: BarcodeDetectorConstructor };

interface ControlRoomMachine {
  id: string;
  name: string;
  machine_type: string;
  site_id: string | null;
}

interface ControlRoomSite {
  id: string;
  name: string;
}

export function C66MachineOperatorScanner({
  departmentId,
  machines,
  sites,
}: {
  departmentId: string;
  machines: ControlRoomMachine[];
  sites: ControlRoomSite[];
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const scanLockRef = useRef(false);
  const [machineCode, setMachineCode] = useState('');
  const [operatorCode, setOperatorCode] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(
    sites.length === 1 ? (sites[0]?.id ?? '') : ''
  );
  const [machine, setMachine] = useState<MachinePreview | null>(null);
  const [eligibleOperators, setEligibleOperators] = useState<EligibleOperator[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [cameraTarget, setCameraTarget] = useState<'machine' | 'operator' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function stopCamera() {
    if (scanIntervalRef.current !== null) window.clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraTarget(null);
  }

  useEffect(
    () => () => {
      if (scanIntervalRef.current !== null) window.clearInterval(scanIntervalRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  async function readError(response: Response): Promise<string> {
    const body: unknown = await response.json();
    const parsed = scanErrorSchema.safeParse(body);
    if (!parsed.success) return 'The scanner request failed. Please try again.';
    if (parsed.data.code === 'SITE_REQUIRED') return 'Choose the machine site before assigning.';
    return parsed.data.error;
  }

  async function loadOperators(machineId: string) {
    setEligibleOperators([]);
    setSelectedOperatorId('');
    const query = new URLSearchParams({ departmentId, machineId });
    const response = await fetch(`/api/control-room/machine-operator-scan?${query}`);
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    const parsed = machineOperatorScanResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.stage !== 'operators') {
      setError('The operator service returned an invalid response.');
      return;
    }
    setMachine(parsed.data.machine);
    setEligibleOperators(parsed.data.operators);
  }

  async function chooseMachine(machineId?: string, scannedCode?: string) {
    setError(null);
    setAssignment(null);
    setEligibleOperators([]);
    setSelectedOperatorId('');
    const request = machineOperatorScanRequestSchema.safeParse({
      departmentId,
      ...(machineId ? { machineId } : { machineCode: scannedCode }),
    });
    if (!request.success) {
      setError('Select or scan a valid machine.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/control-room/machine-operator-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.data),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const parsed = machineOperatorScanResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.stage !== 'machine') {
        setError('The machine service returned an invalid response.');
        return;
      }
      setMachine(parsed.data.machine);
      setSelectedMachineId(parsed.data.machine.id);
      setMachineCode('');
      setSelectedSiteId(
        parsed.data.machine.siteId || (sites.length === 1 ? (sites[0]?.id ?? '') : '')
      );
      await loadOperators(parsed.data.machine.id);
    } catch {
      setError('Connection lost while checking the machine. Retry the selection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function assignOperator(operatorId?: string, scannedCode?: string) {
    if (!machine) return;
    setError(null);
    setAssignment(null);
    const request = machineOperatorScanRequestSchema.safeParse({
      departmentId,
      machineId: machine.id,
      ...(operatorId ? { operatorId } : { operatorCode: scannedCode }),
      siteId: selectedSiteId || undefined,
    });
    if (!request.success) {
      setError('Select an eligible operator or scan a valid personnel badge.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/control-room/machine-operator-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.data),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const parsed = machineOperatorScanResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.stage !== 'assignment') {
        setError('The assignment service returned an invalid response.');
        return;
      }
      setAssignment(parsed.data);
      setOperatorCode('');
      router.refresh();
    } catch {
      setError('Connection lost before the assignment could be confirmed. Retry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startCamera(target: 'machine' | 'operator') {
    setError(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable here. Use the dropdown or scanner field instead.');
      return;
    }
    const Detector = (window as CameraWindow).BarcodeDetector;
    if (!Detector) {
      setError(
        'Camera barcode detection is unsupported in this browser. Use the dropdown or scanner field.'
      );
      return;
    }

    try {
      const detector = new Detector({ formats: ['qr_code', 'code_128'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      detectorRef.current = detector;
      setCameraTarget(target);
      if (!videoRef.current) throw new Error('Camera preview is unavailable');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      scanIntervalRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (
          !video ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
          scanLockRef.current
        ) {
          return;
        }
        scanLockRef.current = true;
        try {
          const [result] = await detector.detect(video);
          if (result?.rawValue) {
            stopCamera();
            if (target === 'machine') {
              setMachineCode(result.rawValue);
              await chooseMachine(undefined, result.rawValue);
            } else {
              setOperatorCode(result.rawValue);
              await assignOperator(undefined, result.rawValue);
            }
          }
        } catch {
          stopCamera();
          setError('The camera could not read this barcode. Use the dropdown or scanner field.');
        } finally {
          scanLockRef.current = false;
        }
      }, 250);
    } catch {
      stopCamera();
      setError('Camera permission or barcode detection failed. Use the dropdown or scanner field.');
    }
  }

  function resetSelection() {
    stopCamera();
    setMachine(null);
    setEligibleOperators([]);
    setAssignment(null);
    setMachineCode('');
    setOperatorCode('');
    setSelectedMachineId('');
    setSelectedOperatorId('');
    setError(null);
  }

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-medium text-[var(--text-heading)]">
            <ScanLine size={20} className="text-[var(--accent-blue)]" />
            C66 Machine &amp; Operator Check-in
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Use the device camera, a connected C66 scanner, or dropdowns. Operators are filtered by
            their personnel job title and current medical and induction clearances.
          </p>
        </div>
        {(machine || assignment) && (
          <button
            type="button"
            onClick={resetSelection}
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)] disabled:opacity-50"
          >
            <RefreshCw size={15} />
            Reset
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2">
          <h4 className="text-sm font-medium text-[var(--text-secondary)]">1. Select a machine</h4>
          <select
            aria-label="Machine"
            value={selectedMachineId}
            disabled={isSubmitting}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedMachineId(value);
              setMachine(null);
              if (value) void chooseMachine(value);
              else {
                setEligibleOperators([]);
                setSelectedOperatorId('');
              }
            }}
            className="min-h-12 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)]"
          >
            <option value="">Choose active machine…</option>
            {machines.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.machine_type}
              </option>
            ))}
          </select>
          <label htmlFor="c66-machine-code" className="block text-xs text-[var(--text-muted)]">
            Or scan the machine with the C66 keyboard scanner
          </label>
          <div className="flex gap-2">
            <input
              id="c66-machine-code"
              autoComplete="off"
              value={machineCode}
              disabled={isSubmitting}
              onChange={(event) => setMachineCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void chooseMachine(undefined, machineCode);
                }
              }}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)]"
              placeholder="Machine code / serial"
            />
            <button
              type="button"
              onClick={() => void chooseMachine(undefined, machineCode)}
              disabled={isSubmitting || !machineCode}
              className="min-h-11 rounded-lg bg-[var(--accent-blue)] px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Check
            </button>
            <button
              type="button"
              onClick={() => void startCamera('machine')}
              disabled={isSubmitting || cameraTarget !== null}
              aria-label="Scan machine with camera"
              className="min-h-11 rounded-lg border border-[var(--border-default)] px-3 text-[var(--text-heading)] disabled:opacity-50"
            >
              <Camera size={18} />
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-medium text-[var(--text-secondary)]">
            2. Select a {machine?.machineType ?? 'machine'} operator
          </h4>
          <select
            aria-label="Operator"
            value={selectedOperatorId}
            disabled={!machine || isSubmitting || eligibleOperators.length === 0}
            onChange={(event) => {
              setSelectedOperatorId(event.target.value);
              if (event.target.value) void assignOperator(event.target.value);
            }}
            className="min-h-12 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] disabled:opacity-50"
          >
            <option value="">
              {!machine
                ? 'Choose a machine first…'
                : eligibleOperators.length
                  ? 'Choose cleared, matching operator…'
                  : 'No cleared type-matched operators'}
            </option>
            {eligibleOperators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.name} · {operator.jobTitle}
              </option>
            ))}
          </select>
          <label htmlFor="c66-operator-code" className="block text-xs text-[var(--text-muted)]">
            Or scan an operator&apos;s personnel badge
          </label>
          <div className="flex gap-2">
            <input
              id="c66-operator-code"
              autoComplete="off"
              value={operatorCode}
              disabled={!machine || isSubmitting}
              onChange={(event) => setOperatorCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void assignOperator(undefined, operatorCode);
                }
              }}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 text-[var(--text-heading)] disabled:opacity-50"
              placeholder={machine ? 'Operator badge code' : 'Choose a machine first'}
            />
            <button
              type="button"
              onClick={() => void assignOperator(undefined, operatorCode)}
              disabled={!machine || isSubmitting || !operatorCode}
              className="min-h-11 rounded-lg bg-[var(--accent-blue)] px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Assign
            </button>
            <button
              type="button"
              onClick={() => void startCamera('operator')}
              disabled={!machine || isSubmitting || cameraTarget !== null}
              aria-label="Scan operator badge with camera"
              className="min-h-11 rounded-lg border border-[var(--border-default)] px-3 text-[var(--text-heading)] disabled:opacity-50"
            >
              <Camera size={18} />
            </button>
          </div>
        </section>
      </div>

      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Camera barcode preview"
        hidden={!cameraTarget}
        className="max-h-64 w-full rounded-lg bg-[var(--bg-secondary)] object-cover"
      />
      {cameraTarget && (
        <button
          type="button"
          onClick={stopCamera}
          className="min-h-11 rounded-lg border border-[var(--border-default)] px-3 text-sm text-[var(--text-heading)]"
        >
          Stop camera
        </button>
      )}

      {machine && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm">
          <p className="font-medium text-[var(--text-heading)]">
            {machine.name} · {machine.machineType}
          </p>
          {!machine.siteId && (
            <label className="mt-2 block space-y-1 text-sm text-[var(--text-secondary)]">
              <span>Machine site</span>
              <select
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[var(--text-heading)]"
              >
                <option value="">Select site…</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="mt-2 text-[var(--text-secondary)]">
            Type filtering uses the personnel job title; machine-specific certificates are not yet
            recorded or verified by the system.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-[var(--accent-red)]">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {assignment && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 p-3 text-sm text-[var(--text-heading)]"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--accent-green)]" />
          <span>
            {assignment.alreadyAssigned ? 'Already assigned: ' : 'Assigned: '}
            {assignment.operator.name} → {assignment.machine.name}. Medical clearance and induction
            are current.
            {assignment.checks.badgeScanned
              ? ' The badge was verified.'
              : ' The operator was selected from the cleared personnel list.'}
            {assignment.machine.requiresHourlyLoads &&
              ' This dump truck is included automatically in Hourly Loads.'}
          </span>
        </div>
      )}
    </GlassCard>
  );
}
