'use client';

import { Checkbox } from '@repo/ui/components/Checkbox';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Settings as SettingsIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  type AdminCardTemplateItem,
  deleteCardTemplate,
  listCardTemplates,
  setDefaultCardTemplate,
  uploadCardTemplate,
} from '../actions/card-templates';

const QUICK_ADMIN_ROUTES = [
  { href: '/admin/observability', label: 'Observability & CI' },
  { href: '/admin/cloudflare', label: 'Cloudflare Edge' },
  { href: '/admin/redis', label: 'RedisInsight' },
] as const;

export function SettingsTab() {
  const [isUploading, setIsUploading] = useState(false);
  const [templates, setTemplates] = useState<AdminCardTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCardTemplateItem | null>(null);

  const refreshTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await listCardTemplates();
      setTemplates(res.templates ?? []);
      if (res.error) {
        toast.error(res.error);
      }
    } catch {
      toast.error('Failed to load card templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setIsUploading(true);
    const formData = new FormData(formEl);
    try {
      await uploadCardTemplate(formData);
      toast.success('Card template uploaded successfully');
      formEl.reset();
      await refreshTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload template');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSetDefault = async (template: AdminCardTemplateItem) => {
    setBusyTemplateId(template.id);
    try {
      const res = await setDefaultCardTemplate(template.id);
      if ('error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`"${template.name}" set as default template`);
      await refreshTemplates();
    } catch {
      toast.error('Failed to set default template');
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyTemplateId(deleteTarget.id);
    try {
      const res = await deleteCardTemplate(deleteTarget.id);
      if ('error' in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Removed "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await refreshTemplates();
    } catch {
      toast.error('Failed to remove template');
    } finally {
      setBusyTemplateId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-medium text-[var(--text-heading)] text-lg">System Settings</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
          <div className="mb-6 flex items-center gap-3 border-[var(--border-default)] border-b pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-blue)]/10">
              <ImageIcon className="h-5 w-5 text-[var(--accent-blue)]" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--text-heading)]">Card Templates</h3>
              <p className="text-[var(--text-muted)] text-sm">Upload access card backgrounds</p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-medium text-[var(--text-heading)] text-sm">
                Template Name
              </label>
              <Input
                name="name"
                required
                placeholder="e.g. Standard Employee 2026"
                className="w-full bg-[var(--bg-primary)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-medium text-[var(--text-heading)] text-sm">
                Background Image
              </label>
              <Input
                type="file"
                name="background"
                accept="image/png, image/jpeg, image/webp"
                required
                className="w-full bg-[var(--bg-primary)] file:mr-4 file:rounded-md file:border-0 file:bg-[var(--bg-tertiary)] file:px-3 file:py-1 file:font-semibold file:text-[var(--text-heading)] file:text-sm hover:file:bg-[var(--bg-secondary)]"
              />
              <p className="mt-1.5 text-[var(--text-muted)] text-xs">
                Recommended size: 1011 × 638 pixels (CR80 ratio). PNG, JPEG, or WebP up to 5 MB.
              </p>
            </div>

            <div className="flex items-center pt-2">
              <Checkbox name="isDefault" value="true" label="Set as default template" />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isUploading} className="min-w-[120px]">
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? 'Uploading...' : 'Upload Template'}
              </Button>
            </div>
          </form>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3 border-[var(--border-default)] border-b pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-blue)]/10">
              <SettingsIcon className="h-5 w-5 text-[var(--accent-blue)]" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--text-heading)]">Runtime & Deployment</h3>
              <p className="text-[var(--text-muted)] text-sm">
                Current portal runtime and deployment metadata
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Environment</dt>
              <dd className="font-mono text-[var(--text-heading)]">
                {process.env.NODE_ENV ?? 'development'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Application</dt>
              <dd className="font-mono text-[var(--text-heading)]">Arch-System Portal</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Portal Version</dt>
              <dd className="font-mono text-[var(--text-heading)]">
                {process.env.NEXT_PUBLIC_PORTAL_VERSION ?? '1.6.2'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Admin API</dt>
              <dd className="font-mono text-[var(--text-heading)]">/api/admin/data/[table]</dd>
            </div>
          </dl>

          <div className="mt-2 border-[var(--border-default)] border-t pt-4">
            <p className="mb-2 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
              Platform Consoles
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ADMIN_ROUTES.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  {route.label}
                  <ExternalLink className="h-3 w-3 text-[var(--text-muted)]" />
                </Link>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Installed Card Templates Gallery */}
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center justify-between border-[var(--border-default)] border-b pb-3">
          <div>
            <h3 className="font-medium text-[var(--text-heading)]">Installed Card Templates</h3>
            <p className="text-[var(--text-muted)] text-xs">
              Preview access card backgrounds, set the active default, or retire unused templates.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {templates.length} active
          </Badge>
        </div>

        {loadingTemplates ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-xs">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-xs">
            No card templates uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5"
                data-testid={`card-template-${tpl.id}`}
              >
                <div className="flex items-start gap-3">
                  {tpl.background ? (
                    <Image
                      src={tpl.background}
                      alt={tpl.name}
                      width={160}
                      height={100}
                      unoptimized
                      className="h-16 w-24 shrink-0 rounded border border-[var(--border-default)] object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-muted)]">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text-heading)] text-sm">
                      {tpl.name}
                    </p>
                    {tpl.is_default && (
                      <Badge
                        variant="outline"
                        className="mt-1 border-emerald-600/30 bg-emerald-50 text-[10px] text-emerald-700"
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Default
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {!tpl.is_default && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyTemplateId === tpl.id}
                      onClick={() => void handleSetDefault(tpl)}
                    >
                      Set Default
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyTemplateId === tpl.id}
                    aria-label={`Delete ${tpl.name}`}
                    className="text-accent-red hover:text-accent-red/80"
                    onClick={() => setDeleteTarget(tpl)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Card Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove template &ldquo;{deleteTarget?.name}&rdquo;? It will
              no longer appear in access card issuance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyTemplateId !== null}
              onClick={() => void handleConfirmDelete()}
            >
              Confirm Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
