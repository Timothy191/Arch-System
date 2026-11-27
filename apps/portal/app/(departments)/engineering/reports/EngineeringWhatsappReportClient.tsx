'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { Check, Copy, ExternalLink, MessageSquare, Plus, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EngineeringReportsNav } from './EngineeringReportsNav';
import type { EngineeringReportsPayload } from './engineering-reports-model';
import {
  buildEngineeringWhatsappMessage,
  type EngineeringWhatsappSectionOptions,
} from './engineering-whatsapp';

interface EngineeringWhatsappReportClientProps {
  readonly payload: EngineeringReportsPayload;
}

interface WhatsappRecipient {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
}

const DEFAULT_RECIPIENTS: readonly WhatsappRecipient[] = [
  { id: 'rec-group', name: 'Engineering Broadcast Group', phone: '' },
  { id: 'rec-lead', name: 'Engineering Shift Lead', phone: '+27820001001' },
  { id: 'rec-workshop', name: 'Workshop Foreman', phone: '+27820001002' },
];

export function EngineeringWhatsappReportClient({ payload }: EngineeringWhatsappReportClientProps) {
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [sections, setSections] = useState<EngineeringWhatsappSectionOptions>({
    includeKpis: true,
    includeBreakdowns: true,
    includeTireHealth: true,
    includeMachineHours: true,
  });

  const [recipients, setRecipients] = useState<readonly WhatsappRecipient[]>(DEFAULT_RECIPIENTS);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    DEFAULT_RECIPIENTS[0]?.id ?? 'rec-group'
  );
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientPhone, setNewRecipientPhone] = useState('');

  const whatsappMessage = useMemo(
    () => buildEngineeringWhatsappMessage({ payload, sections }),
    [payload, sections]
  );

  const selectedRecipient = useMemo(
    () => recipients.find((r) => r.id === selectedRecipientId) ?? recipients[0],
    [recipients, selectedRecipientId]
  );

  const whatsappHref = useMemo(() => {
    const digits = (selectedRecipient?.phone ?? '').replace(/[^\d]/g, '');
    const encoded = encodeURIComponent(whatsappMessage);
    return digits
      ? `https://wa.me/${digits}?text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`;
  }, [selectedRecipient, whatsappMessage]);

  const handleCopyWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setWhatsappCopied(true);
      toast.success('WhatsApp dispatch copied to clipboard.');
      setTimeout(() => setWhatsappCopied(false), 2000);
    } catch {
      toast.error('Clipboard access unavailable in this browser.');
    }
  };

  const toggleSection = (key: keyof EngineeringWhatsappSectionOptions) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddRecipient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newRecipientName.trim();
    const phone = newRecipientPhone.trim();
    if (!name) {
      toast.error('Recipient name is required.');
      return;
    }
    const created: WhatsappRecipient = {
      id: `rec-${Date.now()}`,
      name,
      phone,
    };
    setRecipients((prev) => [...prev, created]);
    setSelectedRecipientId(created.id);
    setNewRecipientName('');
    setNewRecipientPhone('');
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (selectedRecipientId === id && next[0]) {
        setSelectedRecipientId(next[0].id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <EngineeringReportsNav payload={payload} activeRoute="whatsapp-report" />

      <div
        className="grid grid-cols-1 gap-5 lg:grid-cols-3"
        data-testid="engineering-whatsapp-view"
      >
        {/* Recipient Management & Delivery Settings */}
        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center gap-2 border-[var(--border-default)] border-b pb-3">
            <Users className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <h3 className="font-bold text-[var(--text-heading)] text-sm">Recipient Management</h3>
          </div>

          <ul className="space-y-2" aria-label="WhatsApp dispatch recipients">
            {recipients.map((rec) => {
              const isSelected = rec.id === selectedRecipient?.id;
              return (
                <li
                  key={rec.id}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
                    isSelected
                      ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 font-semibold text-[var(--text-heading)]'
                      : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedRecipientId(rec.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate">{rec.name}</span>
                    <span className="block font-mono text-[10px] text-[var(--text-muted)]">
                      {rec.phone || 'Broadcast / Group Picker'}
                    </span>
                  </button>
                  {recipients.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove ${rec.name}`}
                      onClick={() => handleRemoveRecipient(rec.id)}
                      className="rounded p-1 text-[var(--text-muted)] hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <form
            onSubmit={handleAddRecipient}
            className="space-y-2 border-[var(--border-default)] border-t pt-3"
          >
            <p className="font-semibold text-[11px] text-[var(--text-muted)] uppercase">
              Add Recipient
            </p>
            <input
              type="text"
              aria-label="Recipient name"
              placeholder="Recipient or group name"
              value={newRecipientName}
              onChange={(e) => setNewRecipientName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs"
            />
            <input
              type="tel"
              aria-label="Recipient phone"
              placeholder="Phone (+27...)"
              value={newRecipientPhone}
              onChange={(e) => setNewRecipientPhone(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3 py-1.5 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Recipient</span>
            </button>
          </form>
        </GlassCard>

        {/* Dispatch Message Preview & Actions */}
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4 border-[var(--border-default)] border-b pb-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-lg">
                <MessageSquare className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <span>WhatsApp Engineering Shift Dispatch</span>
              </h3>
              <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                Target: <strong>{selectedRecipient?.name}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsapp}
                data-testid="copy-whatsapp-report-btn"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-3.5 py-2 font-semibold text-[var(--text-heading)] text-xs hover:bg-[var(--bg-secondary)]"
              >
                {whatsappCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy WhatsApp Report</span>
                  </>
                )}
              </button>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="send-whatsapp-report-link"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white text-xs shadow-xs hover:bg-emerald-700"
              >
                <span>Send via WhatsApp</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {(
              [
                { key: 'includeKpis', label: 'KPI Overview' },
                { key: 'includeBreakdowns', label: 'Active & 24h Breakdowns' },
                { key: 'includeTireHealth', label: 'Tire Health & Removals' },
                { key: 'includeMachineHours', label: 'Machine Hours' },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs"
              >
                <input
                  type="checkbox"
                  checked={sections[item.key]}
                  onChange={() => toggleSection(item.key)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
            <pre
              data-testid="whatsapp-message-preview"
              className="whitespace-pre-wrap font-mono text-[var(--text-heading)] text-xs leading-relaxed"
            >
              {whatsappMessage}
            </pre>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
