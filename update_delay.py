import sys

filepath = "apps/portal/app/(departments)/[department]/machine-operations/DelayEntriesForm.tsx"
with open(filepath, "r") as f:
    content = f.read()

if "import { saveDelayEntriesBatch } from './actions';" not in content:
    content = content.replace("import { Trash2, AlertCircle, Clock, CheckCircle } from 'lucide-react';", "import { Trash2, AlertCircle, Clock, CheckCircle } from 'lucide-react';\nimport { saveDelayEntriesBatch } from './actions';\nimport { useOfflineQueue } from '@repo/shared/hooks';")

old_logic = """      // Save each entry
      for (const entry of delayEntries) {
        const entryData = {
          machine_operation_id: machineOperationId,
          delay_category_id: entry.delay_category_id,
          // AGENT-TRACE: Convert local time to UTC for database storage
          delay_start_time: toUTC(entry.delay_start_time),
          delay_end_time: toUTC(entry.delay_end_time),
          is_manual_override: entry.is_manual_override,
          manual_duration_hours: entry.manual_duration_hours,
          description: entry.description,
          status: 'draft' as const,
        };

        if (entry.id) {
          // Update existing
          const { error } = await supabase
            .from('delay_entries')
            .update(entryData)
            .eq('id', entry.id);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase.from('delay_entries').insert(entryData);
          if (error) throw error;
        }
      }"""

new_logic = """      // Prepare batch for saving
      const entriesToSave = delayEntries.map((entry) => ({
        ...(entry.id ? { id: entry.id } : {}),
        machine_operation_id: machineOperationId,
        delay_category_id: entry.delay_category_id,
        delay_start_time: toUTC(entry.delay_start_time),
        delay_end_time: toUTC(entry.delay_end_time),
        is_manual_override: entry.is_manual_override,
        manual_duration_hours: entry.manual_duration_hours,
        description: entry.description,
        status: 'draft' as const,
      }));

      if (!navigator.onLine) {
        useOfflineQueue.getState().enqueue({
          url: '/api/sync/fallback',
          method: 'POST',
          body: JSON.stringify({
            action: 'saveDelayEntriesBatch',
            payload: {
              machineOperationId,
              entries: entriesToSave,
            }
          }),
          description: `Saving ${entriesToSave.length} delay entries`,
        });
        // Mock the reload since we are offline
        const simulatedUpdate = delayEntries.map(d => ({...d, status: 'draft' as const}));
        setDelayEntries(simulatedUpdate);
        onDelayChange?.(simulatedUpdate);
        setIsSubmitting(false);
        return;
      }

      await saveDelayEntriesBatch({ machineOperationId, entries: entriesToSave });"""

content = content.replace(old_logic, new_logic)

with open(filepath, "w") as f:
    f.write(content)

