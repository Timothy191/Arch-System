'use client';

import { Checkbox } from '@repo/ui/components/Checkbox';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Image as ImageIcon, Loader2, Settings as SettingsIcon, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { uploadCardTemplate } from '../actions/card-templates';

export function SettingsTab() {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await uploadCardTemplate(formData);
      toast.success('Card template uploaded successfully');
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload template');
    } finally {
      setIsUploading(false);
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
                Recommended size: 1011 × 638 pixels (CR80 ratio). PNG or JPG.
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

        <GlassCard className="flex flex-col items-center justify-center p-12 text-center">
          <SettingsIcon className="mb-4 h-16 w-16 text-[var(--text-muted)]" />
          <h3 className="mb-2 font-medium text-[var(--text-heading)] text-xl">
            More Settings Coming Soon
          </h3>
          <p className="max-w-md text-[var(--text-muted)]">
            Additional application-wide preferences and integrations will be available here.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
