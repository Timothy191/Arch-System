import type { Department } from '@repo/departments/data-access';
import { useEffect, useState } from 'react';
import { dispatchActiveModuleChange } from '@/lib/event-manager';

interface UsePinnedDepartmentsProps {
  departments: Department[];
}

interface UsePinnedDepartmentsReturn {
  pinnedNames: Set<string>;
  handlePinnedChange: (departmentName: string, pinned: boolean) => void;
}

/**
 * Custom hook for managing pinned department state.
 * Handles localStorage persistence and event dispatching.
 */
export function usePinnedDepartments({
  departments,
}: UsePinnedDepartmentsProps): UsePinnedDepartmentsReturn {
  const [pinnedNames, setPinnedNames] = useState<Set<string>>(new Set());

  // Load pinned departments from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pinned = new Set<string>();
    departments.forEach((dept) => {
      if (localStorage.getItem(`pinned_dept_${dept.name}`) === 'true') {
        pinned.add(dept.name);
      }
    });
    setPinnedNames(pinned);
  }, [departments]);

  const handlePinnedChange = (departmentName: string, pinned: boolean) => {
    setPinnedNames((current) => {
      const next = new Set(current);
      if (pinned) next.add(departmentName);
      else next.delete(departmentName);
      return next;
    });

    const targetDept = departments.find((d) => d.name === departmentName);
    if (targetDept && typeof window !== 'undefined') {
      dispatchActiveModuleChange({
        name: targetDept.name,
        title: targetDept.displayName,
      });
    }
  };

  return {
    pinnedNames,
    handlePinnedChange,
  };
}
