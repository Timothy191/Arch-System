'use client';

import { cn } from '@repo/ui/lib/utils';
import {
  Check,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  Maximize2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  GOOGLE_DOCS_AUTO_SIGNIN_URL,
  GOOGLE_DOCS_CREATE_URL,
  GOOGLE_DRIVE_URL,
  openDockedGoogleWindow,
} from '~/lib/google-workspace';

const COPY_FEEDBACK_TIMEOUT_MS = 2000;
const STORAGE_KEY_DOCS_DRAFT = 'arch_google_docs_scratchpad';

interface MiningTemplate {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly defaultContent: string;
}

const MINING_TEMPLATES: readonly MiningTemplate[] = [
  {
    id: 'pre-start',
    title: 'Drill Rig Pre-Start Checklist',
    shortTitle: 'Rig Pre-Start',
    description: 'Hydraulic pressure, drill bits, engine fluids, safety pins, interlocks.',
    defaultContent: `# DRILL RIG PRE-START INSPECTION RECORD
Date: ${new Date().toISOString().slice(0, 10)}
Rig ID: DR-01 (Sandvik D50KS)
Operator: Timothy Archer (EMP-001)
Shift: Day (06:00 - 18:00)

## 1. FLUID & PRESSURE CHECKS
- Engine Oil Level: OK / NORMAL
- Hydraulic Tank Level: OK (85%)
- Compressor Oil: OK
- Fuel Level: 92%

## 2. MECHANICAL & DRILL STRING
- Drill Bit Condition: Grade A (Bit #B-409, 250mm Tricone)
- Stabilizer Wear: < 3mm tolerance
- Rotation Head Gearbox: Inspected, no leaks
- Mast Locking Pins: Engaged & locked

## 3. SAFETY INTERLOCKS & COMMUNICATIONS
- Emergency Stop Switches (Cab & Rig Perimeter): TESTED OK
- Fire Suppression Status: Charged (Green)
- Two-Way Radio Channel 4 (Pit Dispatch): VERIFIED CLEAR
- SCADA Telemetry Unit: Online & Transmitting (100% Signal)

Operator Signature: _______________________
Shift Supervisor Sign-off: _______________________
`,
  },
  {
    id: 'handover',
    title: 'Shift Handover & Operations Memo',
    shortTitle: 'Shift Handover',
    description: 'Meters drilled, blast pattern progress, pit delays, handover notes.',
    defaultContent: `# DRILLING SHIFT HANDOVER MEMO
Date: ${new Date().toISOString().slice(0, 10)}
Department: Drilling Operations / Central Pit
Incoming Shift: Night Shift (18:00 - 06:00)
Outgoing Shift: Day Shift (06:00 - 18:00)

## OPERATIONAL SUMMARY
- Total Holes Drilled: 24 holes
- Cumulative Depth: 360.5 meters
- Target Bench: Bench 3 East (Coal Seam 4 Upper)
- Average Penetration Rate: 18.2 m/hr

## RIG STATUS
- Rig DR-01: Operational (Pattern P-204, Hole #18 completed)
- Rig DR-02: Operational (Bench 2 Infill drilling)
- Rig DR-03: Standby for bit replacement at 19:30

## CRITICAL HANDOVER INSTRUCTIONS
1. Maintain 50m blast buffer from North pit wall.
2. Fuel bowser scheduled for DR-01 top-up at 21:00.
3. High-wall monitor radar telemetry showing zero geotechnical movement.

Prepared by: Timothy Archer
Handover Recipient: _______________________
`,
  },
  {
    id: 'blast-pattern',
    title: 'Blast Window & Pattern Design',
    shortTitle: 'Blast Pattern',
    description: 'Pattern specs, burden, spacing, explosive charge, exclusion zone.',
    defaultContent: `# BLAST PATTERN SPECIFICATION & EXCLUSION RECORD
Pattern Reference: BP-2026-N4
Bench Location: Bench 4 North
Target Seam: Middle Coal 2B

## GEOMETRY & BURDEN
- Number of Holes: 48
- Burden: 6.5 meters
- Spacing: 7.5 meters
- Hole Diameter: 250 mm
- Design Depth: 15.0 meters
- Sub-drill: 1.0 meter

## EXCLUSION ZONE & BLAST WINDOW
- Scheduled Blast Date: ${new Date().toISOString().slice(0, 10)}
- Blast Window: 12:00 - 13:00 SAST
- Exclusion Perimeter: 500 meter clear radius
- Pit Access Gates Closed: Gate 2 and Gate 4

Blaster-in-Charge: _______________________
Engineering Sign-off: _______________________
`,
  },
  {
    id: 'breakdown',
    title: 'Equipment Incident / Breakdown Report',
    shortTitle: 'Breakdown Log',
    description: 'Engineering root-cause analysis, downtime hours, spare parts.',
    defaultContent: `# DRILL RIG INCIDENT / BREAKDOWN LOG
Rig ID: DR-01
Timestamp: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} SAST
Location: Bench 3 East

## 1. INCIDENT DESCRIPTION
- Fault Code: HYD-ERR-402 (High Hydraulic Oil Temperature)
- Primary Symptom: Hydraulic oil temperature exceeded 88°C under continuous rotary torque.
- Operational Action Taken: Rig shut down safely by operator; locked out at 09:42.

## 2. DOWNTIME ANALYSIS
- Total Downtime: 1.5 hours
- Engineering Response Time: 12 minutes
- Repair Carried Out: Cleaned hydraulic oil cooler radiator fins; replaced auxiliary fan relay.

## 3. RETURN TO SERVICE
- Test Run Completed: 11:15 SAST (Temperature stable at 68°C)
- Status: RETURNED TO FULL PRODUCTION

Technician Name: _______________________
Maintenance Supervisor: _______________________
`,
  },
];

export function SplitWindowGoogleDocsView() {
  const [activeSubTab, setActiveSubTab] = useState<'scratchpad' | 'templates' | 'web'>(
    'scratchpad'
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('pre-start');
  const [docTitle, setDocTitle] = useState('Drill Rig Operational Memo');
  const [content, setContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Initialize draft from localStorage or default template
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDraft = localStorage.getItem(STORAGE_KEY_DOCS_DRAFT);
      if (savedDraft) {
        setContent(savedDraft);
      } else {
        const defaultTmpl = MINING_TEMPLATES[0];
        if (defaultTmpl) {
          setContent(defaultTmpl.defaultContent);
          setDocTitle(defaultTmpl.title);
        }
      }
    }
  }, []);

  // Save changes to localStorage
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DOCS_DRAFT, newContent);
    }
  };

  const handleSelectTemplate = (tmpl: MiningTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setDocTitle(tmpl.title);
    handleContentChange(tmpl.defaultContent);
    setActiveSubTab('scratchpad');
  };

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPY_FEEDBACK_TIMEOUT_MS);
    } catch {
      // Clipboard write failed
    }
  };

  const handleOpenGoogleDocs = () => {
    if (typeof window !== 'undefined') {
      window.open(GOOGLE_DOCS_AUTO_SIGNIN_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCreateNewDoc = () => {
    if (typeof window !== 'undefined') {
      window.open(GOOGLE_DOCS_CREATE_URL, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/60">
      {/* Sub-Header & Controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-black/[0.06] border-b bg-white/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[12.5px] text-[var(--text-heading)]">
                Google Docs Workspace
              </span>
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 font-semibold text-[9.5px] text-emerald-700">
                Auto Sign-In Live
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openDockedGoogleWindow(GOOGLE_DOCS_AUTO_SIGNIN_URL)}
            title="Open side-by-side Popout Window"
            className="flex h-6 items-center gap-1 rounded-md border border-black/[0.06] bg-white px-2 font-medium text-[10.5px] text-[var(--text-secondary)] shadow-2xs hover:bg-black/[0.03] hover:text-[var(--text-heading)]"
          >
            <Maximize2 className="h-3 w-3" />
            <span className="hidden sm:inline">Popout Window</span>
          </button>
          <button
            type="button"
            onClick={handleCreateNewDoc}
            title="New Blank Google Doc"
            className="flex h-6 items-center gap-1 rounded-md bg-blue-600 px-2 font-semibold text-[10.5px] text-white shadow-2xs transition-opacity hover:opacity-90"
          >
            <FilePlus2 className="h-3 w-3" />
            <span>New Doc</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex shrink-0 border-black/[0.06] border-b bg-black/[0.015] px-3 font-semibold text-[11px] text-[var(--text-muted)]">
        <button
          type="button"
          onClick={() => setActiveSubTab('scratchpad')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 py-2 pr-3 transition-colors',
            activeSubTab === 'scratchpad'
              ? 'border-blue-600 font-bold text-blue-600'
              : 'border-transparent hover:text-[var(--text-secondary)]'
          )}
        >
          <FileText className="h-3 w-3" />
          <span>Live Scratchpad &amp; Editor</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('templates')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors',
            activeSubTab === 'templates'
              ? 'border-blue-600 font-bold text-blue-600'
              : 'border-transparent hover:text-[var(--text-secondary)]'
          )}
        >
          <Sparkles className="h-3 w-3" />
          <span>Mining Templates</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('web')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors',
            activeSubTab === 'web'
              ? 'border-blue-600 font-bold text-blue-600'
              : 'border-transparent hover:text-[var(--text-secondary)]'
          )}
        >
          <FolderOpen className="h-3 w-3" />
          <span>Launch &amp; Drive</span>
        </button>
      </div>

      {/* Pane Content based on sub-tab */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeSubTab === 'scratchpad' && (
          <div className="flex min-h-0 flex-1 flex-col p-3">
            {/* Quick Template Selector Chips */}
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <span className="shrink-0 font-medium text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Load Template:
              </span>
              {MINING_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] transition-all',
                    selectedTemplateId === tmpl.id
                      ? 'border-blue-500/30 bg-blue-50 font-bold text-blue-700'
                      : 'border-black/[0.06] bg-white text-[var(--text-secondary)] hover:bg-black/[0.03]'
                  )}
                >
                  {tmpl.shortTitle}
                </button>
              ))}
            </div>

            {/* Document Title bar */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document title..."
                className="min-w-0 flex-1 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1 font-semibold text-[12px] text-[var(--text-heading)] shadow-2xs focus:border-blue-500 focus:outline-none"
              />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyClipboard}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium text-[11px] shadow-2xs transition-all',
                    isCopied
                      ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700'
                      : 'border-black/[0.08] bg-white text-[var(--text-secondary)] hover:bg-black/[0.03]'
                  )}
                  title="Copy formatted template content"
                >
                  {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenGoogleDocs}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-[11px] text-white shadow-2xs hover:bg-blue-700"
                  title="Open Google Docs with active Google session"
                >
                  <span>Open in Docs</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Textarea Editor */}
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-2xs">
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Type or paste document draft here..."
                className="h-full w-full resize-none p-3 font-mono text-[11.5px] text-[var(--text-body)] leading-relaxed focus:outline-none"
                spellCheck={false}
              />
            </div>

            {/* Footer notes */}
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-[var(--text-muted)]">
              <span>Auto-saved to local workspace draft. Work side-by-side with Arch OS.</span>
              <button
                type="button"
                onClick={() => {
                  const defaultTmpl = MINING_TEMPLATES[0];
                  if (defaultTmpl) {
                    handleSelectTemplate(defaultTmpl);
                  }
                }}
                className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                title="Reset to default template"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'templates' && (
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
            <p className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              Standard Drilling &amp; Mining Templates
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {MINING_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="group rounded-xl border border-black/[0.06] bg-white p-3 shadow-2xs transition-all hover:border-blue-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-[12.5px] text-[var(--text-heading)]">
                        {tmpl.title}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        {tmpl.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[9.5px] text-blue-700">
                      Standard
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 border-black/[0.04] border-t pt-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl)}
                      className="rounded-lg border border-black/[0.08] bg-black/[0.02] px-2.5 py-1 font-semibold text-[11px] text-[var(--text-heading)] transition-colors hover:bg-black/[0.05]"
                    >
                      Insert in Split Scratchpad
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateNewDoc}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-[11px] text-white shadow-2xs hover:bg-blue-700"
                    >
                      <span>Create in Google Docs</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'web' && (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <h4 className="font-bold text-[13px] text-blue-950">
                  Google Workspace Direct Handoff
                </h4>
              </div>
              <p className="mt-1 text-[11.5px] text-blue-900/80 leading-relaxed">
                Google Workspace utilizes Google SSO authentication. Opening Google Docs from this
                docked split panel automatically reuses your authenticated Google credentials.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleOpenGoogleDocs}
                className="group flex flex-col justify-between rounded-xl border border-black/[0.08] bg-white p-3.5 text-left shadow-2xs transition-all hover:border-blue-500/40 hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[12.5px] text-[var(--text-heading)] group-hover:text-blue-600">
                      Launch Google Docs
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-[var(--text-muted)] group-hover:text-blue-600" />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Auto-connects to your Google account documents and recents.
                  </p>
                </div>
                <span className="mt-3 font-semibold text-[11px] text-blue-600">
                  Launch Google Docs &rarr;
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(GOOGLE_DRIVE_URL, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="group flex flex-col justify-between rounded-xl border border-black/[0.08] bg-white p-3.5 text-left shadow-2xs transition-all hover:border-blue-500/40 hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[12.5px] text-[var(--text-heading)] group-hover:text-blue-600">
                      Mining Google Drive
                    </span>
                    <FolderOpen className="h-3.5 w-3.5 text-[var(--text-muted)] group-hover:text-blue-600" />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Access shared department folders, blast logs, and reports.
                  </p>
                </div>
                <span className="mt-3 font-semibold text-[11px] text-blue-600">
                  Open Google Drive &rarr;
                </span>
              </button>
            </div>

            <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-[11.5px] text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-heading)]">
                Split Workspace Tip:{' '}
              </span>
              Keep this pane open on the right while navigating Drilling Operations, Machine
              Telemetry, or Reports on the left. Changes you make stay persisted.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
