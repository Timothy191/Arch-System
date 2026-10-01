import sys

filepath = "apps/portal/app/(departments)/[department]/daily-log/DailyLogForm.tsx"
with open(filepath, "r") as f:
    content = f.read()

if "import { createDailyLog } from './actions';" not in content:
    content = content.replace("import { logError } from '@/lib/errors/error-logger';", "import { logError } from '@/lib/errors/error-logger';\nimport { createDailyLog } from './actions';\nimport { useOfflineQueue } from '@repo/shared/hooks';")

old_logic = """    const { data: logData, error } = await supabase
      .from('daily_logs')
      .insert({
        department_id: departmentId,
        log_date: today,
        shift: data.shift,
        notes: finalNotes === '' ? null : finalNotes,
      })
      .select('id')
      .single();

    if (error) {
      logError(error);
      toast.error('Failed to save daily log', {
        description: error.message,
      });
      setStatus('error');
      return;
    }

    if (isProduction && logData) {
      const { error: prodError } = await supabase.from('production_logs').insert({
        daily_log_id: logData.id,
        coal_tonnes: data.actualCoalTonnes || 0,
        waste_tonnes: data.actualWasteTonnes || 0,
      });
      if (prodError) {
        logError(prodError);
        toast.error('Saved daily log, but failed to save production metrics', {
          description: prodError.message,
        });
      }
    }"""

new_logic = """    const payload = {
      departmentId,
      today,
      shift: data.shift,
      notes: finalNotes === '' ? null : finalNotes,
      isProduction,
      actualCoalTonnes: data.actualCoalTonnes,
      actualWasteTonnes: data.actualWasteTonnes,
    };

    if (!navigator.onLine) {
      useOfflineQueue.getState().enqueue({
        url: '/api/sync/fallback',
        method: 'POST',
        body: JSON.stringify({
          action: 'createDailyLog',
          payload
        }),
        description: 'Daily Log',
      });
      
      clearDraft();
      toast.success('Log saved offline and will sync automatically');
      setStatus('saved');
      
      if (onSuccess) {
        onSuccess();
      }
      return;
    }

    let logData;
    try {
      const res = await createDailyLog(payload);
      logData = { id: res.id };
    } catch (err: any) {
      logError(err);
      toast.error('Failed to save daily log', {
        description: err.message,
      });
      setStatus('error');
      return;
    }"""

content = content.replace(old_logic, new_logic)

with open(filepath, "w") as f:
    f.write(content)

