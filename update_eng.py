import sys

filepath = "apps/portal/app/(departments)/[department]/engineering-notes/EngineeringNotesForm.tsx"
with open(filepath, "r") as f:
    content = f.read()

if "import { createEngineeringNote } from './actions';" not in content:
    content = content.replace("import { speculativeEmbedShiftLog } from '@/app/api/ai/speculative';\n", "import { speculativeEmbedShiftLog } from '@/app/api/ai/speculative';\nimport { createEngineeringNote } from './actions';\nimport { useOfflineQueue } from '@repo/shared/hooks';\n")

old_logic = """      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from('engineering_notes').insert({
        department_id: departmentId,
        note_date: today,
        shift_type: formData.shiftType,
        issue_type: formData.issueType,
        severity: formData.severity,
        machine_id: formData.machineId || null,
        description: formData.description,
        action_taken: formData.actionTaken || null,
        requires_follow_up: formData.requiresFollowUp,
        status: 'open',
      });

      if (error) throw error;

      clearDraft();"""

new_logic = """      const today = new Date().toISOString().split('T')[0];
      const payload = {
        department_id: departmentId,
        note_date: today,
        shift_type: formData.shiftType,
        issue_type: formData.issueType,
        severity: formData.severity,
        machine_id: formData.machineId || null,
        description: formData.description,
        action_taken: formData.actionTaken || null,
        requires_follow_up: formData.requiresFollowUp,
        status: 'open',
      };

      if (!navigator.onLine) {
        useOfflineQueue.getState().enqueue({
          url: '/api/sync/fallback',
          method: 'POST',
          body: JSON.stringify({
            action: 'createEngineeringNote',
            payload
          }),
          description: 'Engineering Note',
        });
        clearDraft();
        toast.success('Note saved offline and will sync automatically.');
        
        // Speculatively generate embeddings in background when online
        setIsSubmitting(false);
        if (onSuccess) onSuccess();
        return;
      }

      await createEngineeringNote(payload);
      clearDraft();"""

content = content.replace(old_logic, new_logic)

with open(filepath, "w") as f:
    f.write(content)

