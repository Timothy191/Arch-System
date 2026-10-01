import sys

filepath = "apps/portal/features/admin/tabs/DepartmentsTab.tsx"
with open(filepath, "r") as f:
    content = f.read()

if "import { createDepartment } from './actions';" not in content:
    content = content.replace("import { logError } from '@/lib/errors/error-logger';", "import { logError } from '@/lib/errors/error-logger';\nimport { createDepartment } from './actions';\nimport { useOfflineQueue } from '@repo/shared/hooks';")

old_logic = """    if (editingDept) {
      const { error } = await supabase
        .from('departments')
        .update(formData)
        .eq('id', editingDept.id);
      if (error)
        logError(new Error(error.message), {
          context: 'departments_tab_update',
        });
    } else {
      const { error } = await supabase.from('departments').insert(formData);
      if (error)
        logError(new Error(error.message), {
          context: 'departments_tab_create',
        });
    }"""

new_logic = """    if (editingDept) {
      const { error } = await supabase
        .from('departments')
        .update(formData)
        .eq('id', editingDept.id);
      if (error)
        logError(new Error(error.message), {
          context: 'departments_tab_update',
        });
    } else {
      if (!navigator.onLine) {
        useOfflineQueue.getState().enqueue({
          url: '/api/sync/fallback',
          method: 'POST',
          body: JSON.stringify({
            action: 'createDepartment',
            payload: formData
          }),
          description: `Create Department: ${formData.name}`,
        });
      } else {
        try {
          await createDepartment(formData);
        } catch (err: any) {
          logError(err, { context: 'departments_tab_create' });
        }
      }
    }"""

content = content.replace(old_logic, new_logic)

with open(filepath, "w") as f:
    f.write(content)

