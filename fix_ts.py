import os

# Fix DailyLogForm
f1 = "apps/portal/app/(departments)/[department]/daily-log/DailyLogForm.tsx"
with open(f1, "r") as f:
    c = f.read()
c = c.replace("setStatus('saved')", "setStatus('success')")
c = c.replace("""      if (onSuccess) {
        onSuccess();
      }""", "")
with open(f1, "w") as f:
    f.write(c)

# Fix EngineeringNotesForm
f2 = "apps/portal/app/(departments)/[department]/engineering-notes/EngineeringNotesForm.tsx"
with open(f2, "r") as f:
    c = f.read()
if "import { createEngineeringNote }" not in c:
    c = "import { createEngineeringNote } from './actions';\nimport { useOfflineQueue } from '@repo/shared/hooks';\n" + c
c = c.replace("if (onSuccess) onSuccess();", "")
with open(f2, "w") as f:
    f.write(c)

# Fix DelayEntriesForm
f3 = "apps/portal/app/(departments)/[department]/machine-operations/DelayEntriesForm.tsx"
with open(f3, "r") as f:
    c = f.read()
if "import { saveDelayEntriesBatch }" not in c:
    c = "import { saveDelayEntriesBatch } from './actions';\nimport { useOfflineQueue } from '@repo/shared/hooks';\n" + c
with open(f3, "w") as f:
    f.write(c)

# Fix ClientProviders
f4 = "apps/portal/app/ClientProviders.tsx"
with open(f4, "r") as f:
    c = f.read()
c = c.replace("@/hooks/useOfflineQueue", "@repo/shared/hooks/src/useOfflineQueue")
# wait, I can just use '@repo/shared/hooks' because I exported it from index.ts
c = c.replace("import('@repo/shared/hooks/src/useOfflineQueue')", "import('@repo/shared/hooks')")
with open(f4, "w") as f:
    f.write(c)

