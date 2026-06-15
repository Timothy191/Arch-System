"use client";

import { useEffect } from "react";
import { useNavigationState } from "../../hooks/useNavigationState";

export function ActiveDepartmentSetter({
  department,
}: {
  department: string | null;
}) {
  const setActiveDepartment = useNavigationState(
    (state) => state.setActiveDepartment,
  );

  useEffect(() => {
    setActiveDepartment(department);
    // Cleanup when unmounting (e.g. going back to hub)
    return () => setActiveDepartment(null);
  }, [department, setActiveDepartment]);

  return null;
}
