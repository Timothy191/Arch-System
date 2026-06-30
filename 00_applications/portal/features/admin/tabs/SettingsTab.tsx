"use client";

import { useState } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { Settings as SettingsIcon, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Checkbox } from "@repo/ui/components/Checkbox";
import { toast } from "sonner";
import { uploadCardTemplate } from "../actions/card-templates";

export function SettingsTab() {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await uploadCardTemplate(formData);
      toast.success("Card template uploaded successfully");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload template");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-[var(--text-heading)]">System Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-[var(--border-default)] pb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[var(--accent-blue)]" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--text-heading)]">Card Templates</h3>
              <p className="text-sm text-[var(--text-muted)]">Upload access card backgrounds</p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-heading)] mb-1.5">
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
              <label className="block text-sm font-medium text-[var(--text-heading)] mb-1.5">
                Background Image
              </label>
              <Input
                type="file"
                name="background"
                accept="image/png, image/jpeg, image/webp"
                required
                className="w-full bg-[var(--bg-primary)] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--bg-tertiary)] file:text-[var(--text-heading)] hover:file:bg-[var(--bg-secondary)]"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                Recommended size: 1011 × 638 pixels (CR80 ratio). PNG or JPG.
              </p>
            </div>

            <div className="flex items-center pt-2">
              <Checkbox name="isDefault" value="true" label="Set as default template" />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isUploading} className="min-w-[120px]">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {isUploading ? "Uploading..." : "Upload Template"}
              </Button>
            </div>
          </form>
        </GlassCard>

        <GlassCard className="p-12 flex flex-col items-center justify-center text-center">
          <SettingsIcon className="w-16 h-16 text-[var(--text-muted)] mb-4" />
          <h3 className="text-xl font-medium text-[var(--text-heading)] mb-2">
            More Settings Coming Soon
          </h3>
          <p className="text-[var(--text-muted)] max-w-md">
            Additional application-wide preferences and integrations will be available here.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
