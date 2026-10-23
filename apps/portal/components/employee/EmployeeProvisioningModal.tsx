'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { Plus, UserPlus, X } from 'lucide-react';
import React, { useState } from 'react';
import type { DepartmentOption, ProvisionedEmployeeResult } from '@/actions/employee-provisioning';
import { EmployeeProvisioningForm } from './EmployeeProvisioningForm';

interface EmployeeProvisioningModalProps {
  departments: DepartmentOption[];
  onEmployeeCreated?: (created: ProvisionedEmployeeResult) => void;
  triggerLabel?: string;
  triggerClassName?: string;
}

export function EmployeeProvisioningModal({
  departments,
  onEmployeeCreated,
  triggerLabel = 'Register New Employee',
  triggerClassName = 'bg-accent-blue text-bg-secondary hover:bg-accent-blue/90 shadow-diffusion-cyan',
}: EmployeeProvisioningModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = (created: ProvisionedEmployeeResult) => {
    onEmployeeCreated?.(created);
    setIsOpen(false);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className={triggerClassName}>
        <UserPlus className="mr-2 h-4 w-4" />
        {triggerLabel}
      </Button>

      {isOpen && (
        <div className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm duration-200">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl shadow-window">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-10 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-heading)]"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            <EmployeeProvisioningForm
              departments={departments}
              onSuccess={handleSuccess}
              sourceContext="access-control"
            />
          </div>
        </div>
      )}
    </>
  );
}
