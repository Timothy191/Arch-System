import sys

filepath = "libs/features/departments/ui/src/control-room/DozerRollForm.tsx"
with open(filepath, "r") as f:
    content = f.read()

# Add imports if not present
if "import { createDozerRoll } from './actions';" not in content:
    content = content.replace("import { ShiftToggle } from '@repo/ui/ShiftToggle';", "import { ShiftToggle } from '@repo/ui/ShiftToggle';\nimport { createDozerRoll } from './actions';\nimport { useOfflineQueue } from '@repo/shared/hooks';")

# Replace insert logic
old_logic = """    try {
      const { error: insertError } = await supabase.from('dozer_rolls').insert({
        department_id: departmentId,
        machine_id: machineId,
        roll_date: today,
        shift_type: shiftType,
        blade_passes: parseInt(bladePasses || '0', 10),
        push_count: parseInt(pushCount || '0', 10),
        hours_operated: parseFloat(hoursOperated || '0'),
        area_covered_sqm: area,
        notes: `Length: ${lengthM}m, Width: ${widthM}m`,
      });

      if (insertError) throw insertError;

      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save roll. Try again.');
    } finally {
      setIsSubmitting(false);
    }"""

new_logic = """    try {
      if (!navigator.onLine) {
        useOfflineQueue.getState().enqueue({
          url: '/api/sync/fallback',
          method: 'POST',
          body: JSON.stringify({
            action: 'createDozerRoll',
            payload: {
              departmentId,
              machineId,
              today,
              shiftType,
              bladePasses: parseInt(bladePasses || '0', 10),
              pushCount: parseInt(pushCount || '0', 10),
              hoursOperated: parseFloat(hoursOperated || '0'),
              area,
              lengthM,
              widthM,
            }
          }),
          description: `Dozer Roll for ${dozers.find(d => d.id === machineId)?.name || 'Unknown'}`,
        });
        reset();
        router.refresh();
        return;
      }

      await createDozerRoll({
        departmentId,
        machineId,
        today,
        shiftType,
        bladePasses: parseInt(bladePasses || '0', 10),
        pushCount: parseInt(pushCount || '0', 10),
        hoursOperated: parseFloat(hoursOperated || '0'),
        area,
        lengthM,
        widthM,
      });

      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save roll. Try again.');
    } finally {
      setIsSubmitting(false);
    }"""

content = content.replace(old_logic, new_logic)

with open(filepath, "w") as f:
    f.write(content)

