import { PageHeader } from "@repo/ui/PageHeader";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { QrCode, Smartphone, ShieldCheck, ShieldOff, AlertTriangle, Scan } from "lucide-react";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { assertAccessCardActionsRole } from "../actions";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Status badge helper                                                */
/* ------------------------------------------------------------------ */

function CardStatusPill({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-accent-green/10 border-accent-green/20 text-accent-green">
        <ShieldCheck className="w-3 h-3" />
        Active
      </span>
    );
  }
  if (status === "revoked") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-red-50/70 border-red-200/50 text-red-700">
        <ShieldOff className="w-3 h-3" />
        Revoked
      </span>
    );
  }
  if (status === "lost") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50/70 border-amber-200/50 text-amber-700">
        <AlertTriangle className="w-3 h-3" />
        Lost
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50/70 border-gray-200/50 text-gray-700">
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function QrCodesPage() {
  await assertAccessCardActionsRole();

  const supabase = await createServerSupabaseClient();

  const { data: issuedCards } = await supabase
    .from("issued_cards")
    .select("*, personnel:personnel(first_name, surname)")
    .order("issued_at", { ascending: false })
    .limit(50);

  const cards = (issuedCards ?? []).map((card) => {
    const person = card.personnel as {
      first_name: string;
      surname: string;
    } | null;
    const name = person ? `${person.first_name} ${person.surname}` : "Unknown";
    const qrTruncated =
      card.qr_code_data.length > 16 ? `${card.qr_code_data.slice(0, 16)}…` : card.qr_code_data;
    return { ...card, entityName: name, qrTruncated };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="QR Codes" showDate />

      {/* ────────── Description ────────── */}
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-blue)]/10 flex items-center justify-center border border-[var(--accent-blue)]/20 shrink-0">
            <QrCode className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-heading)]">QR / RFID Card Management</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
              Each issued access card contains a unique QR code and an optional RFID UID for
              contactless entry. QR codes are embedded at print time and linked to personnel records
              for identity verification at site access points.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* ────────── Card Preview ────────── */}
      <GlassCard className="relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 rounded-full bg-[var(--accent-blue)]/8 blur-3xl" />
        <div className="flex flex-col items-center py-8">
          <h3 className="font-medium text-[var(--text-heading)] mb-6">Card Preview</h3>

          {/* Credit-card sized preview */}
          <div className="w-[340px] h-[214px] rounded-xl bg-gradient-to-br from-white to-[var(--bg-secondary)] border border-[var(--border-default)] shadow-window p-5 flex flex-col justify-between relative overflow-hidden">
            {/* Card brand */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-blue)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] tracking-wider uppercase">
                  Access Card
                </span>
              </div>
              <Smartphone className="w-5 h-5 text-[var(--text-muted)]" />
            </div>

            {/* QR placeholder */}
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center">
                <QrCode className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
            </div>

            {/* Employee info */}
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">Employee Name</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Department · Role</p>
            </div>

            {/* Bottom strip */}
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span>Arch Systems</span>
              <span>ID: ••••</span>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] mt-4 text-center max-w-md">
            Preview shows where the QR code, personnel details, and department role appear on the
            printed CR80 card. Actual layout depends on the selected card template.
          </p>
        </div>
      </GlassCard>

      {/* ────────── Issued Cards Table ────────── */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-heading)] flex items-center">
            <Scan className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
            Recently Issued Cards
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            Last {cards.length} of {50}+ cards
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border-default)] hover:bg-transparent">
              <TableHead className="text-[var(--text-muted)]">Personnel</TableHead>
              <TableHead className="text-[var(--text-muted)]">QR Code</TableHead>
              <TableHead className="text-[var(--text-muted)]">RFID UID</TableHead>
              <TableHead className="text-[var(--text-muted)]">Status</TableHead>
              <TableHead className="text-[var(--text-muted)]">Issued At</TableHead>
              <TableHead className="text-right text-[var(--text-muted)]">Expires At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-[var(--text-muted)]">
                  No issued cards found.
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => (
              <TableRow
                key={card.id}
                className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <TableCell className="text-[var(--text-heading)]">{card.entityName}</TableCell>
                <TableCell className="font-mono text-sm text-[var(--accent-blue)]">
                  {card.qrTruncated}
                </TableCell>
                <TableCell className="font-mono text-sm text-[var(--text-secondary)]">
                  {card.rfid_uid ?? "—"}
                </TableCell>
                <TableCell>
                  <CardStatusPill status={card.status} />
                </TableCell>
                <TableCell className="text-[var(--text-secondary)] text-sm">
                  {new Date(card.issued_at).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-right text-[var(--text-secondary)] text-sm">
                  {card.expires_at
                    ? new Date(card.expires_at).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
}
