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
        <UserPlus className="w-4 h-4 mr-2" />
        {triggerLabel}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-window">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors border border-[var(--border-default)]"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
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
