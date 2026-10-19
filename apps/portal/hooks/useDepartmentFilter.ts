import type { Department } from '@repo/departments/data-access';
import { useMemo, useState } from 'react';

export type FilterCategory = 'all' | 'pinned' | 'active' | 'critical';

interface UseDepartmentFilterProps {
  departments: Department[];
  pinnedNames: Set<string>;
}

interface UseDepartmentFilterReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: FilterCategory;
  setActiveFilter: (filter: FilterCategory) => void;
  filteredDepartments: Department[];
  pinnedCount: number;
  activeCount: number;
  criticalCount: number;
}

/**
 * Custom hook for filtering and sorting department modules.
 * Separates business logic from presentation components.
 */
export function useDepartmentFilter({
  departments,
  pinnedNames,
}: UseDepartmentFilterProps): UseDepartmentFilterReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');

  const filteredDepartments = useMemo(() => {
    return departments
      .filter((dept) => {
        // Search query filter
        const matchesSearch =
          searchQuery.trim() === '' ||
          dept.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dept.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dept.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Category filter
        if (activeFilter === 'pinned') {
          return pinnedNames.has(dept.name);
        }
        if (activeFilter === 'active') {
          return dept.status === 'active';
        }
        if (activeFilter === 'critical') {
          return dept.status === 'alert' || dept.status === 'maintenance';
        }

        return true;
      })
      .sort((a, b) => {
        // Pinned modules float to the top
        const aPinned = pinnedNames.has(a.name);
        const bPinned = pinnedNames.has(b.name);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0;
      });
  }, [departments, searchQuery, activeFilter, pinnedNames]);

  const pinnedCount = pinnedNames.size;
  const activeCount = useMemo(
    () => departments.filter((d) => d.status === 'active').length,
    [departments]
  );
  const criticalCount = useMemo(
    () => departments.filter((d) => d.status === 'alert' || d.status === 'maintenance').length,
    [departments]
  );

  return {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    filteredDepartments,
    pinnedCount,
    activeCount,
    criticalCount,
  };
}
