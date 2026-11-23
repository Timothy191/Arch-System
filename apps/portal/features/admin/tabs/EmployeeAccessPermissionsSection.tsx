'use client';

import type { DepartmentPermission, EmployeeRecordType } from '@repo/contract';
import { BadgeCheck, Check, ShieldCheck, UserCheck } from 'lucide-react';
import type { AdminDepartmentOption } from './actions';

const SECTION_BOX_CLASS =
  'space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5';
const DEPT_CARD_BASE_CLASS =
  'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-all';
const CHECKBOX_SQUARE_BASE_CLASS =
  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors';
const PERMISSION_TOGGLE_CLASS =
  'inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors';

function getPermissionLabel(permission: DepartmentPermission | undefined): string {
  if (!permission?.read) return 'Not assigned';
  return permission.write ? 'Read + Write' : 'Read Only';
}

function DepartmentCheckboxCard(options: {
  readonly department: AdminDepartmentOption;
  readonly isSelected: boolean;
  readonly permission: DepartmentPermission | undefined;
  readonly onToggle: (departmentId: string) => void;
}) {
  const { department, isSelected, permission, onToggle } = options;
  const statusLabel = isSelected ? getPermissionLabel(permission) : 'Not assigned';
  const cardStateClass = isSelected
    ? 'border-[var(--accent-emerald)] bg-[var(--bg-primary)] shadow-xs'
    : 'border-[var(--border-default)] bg-[var(--bg-primary)]/70 hover:border-[var(--border-strong)]';
  const checkboxStateClass = isSelected
    ? 'border-[var(--accent-emerald)] bg-[var(--accent-emerald)] text-[var(--bg-void)]'
    : 'border-[var(--border-strong)] bg-[var(--bg-primary)] text-transparent';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      data-testid={`dept-card-${department.id}`}
      onClick={() => onToggle(department.id)}
      className={`${DEPT_CARD_BASE_CLASS} ${cardStateClass}`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[var(--text-heading)] text-sm">
          {department.display_name}
        </div>
        <div
          className={
            isSelected
              ? 'font-medium text-[11px] text-[var(--accent-emerald)]'
              : 'text-[11px] text-[var(--text-muted)]'
          }
        >
          {statusLabel}
        </div>
      </div>
      <span
        aria-hidden="true"
        data-testid={`dept-checkbox-${department.id}`}
        className={`${CHECKBOX_SQUARE_BASE_CLASS} ${checkboxStateClass}`}
      >
        <Check className="h-3 w-3 stroke-[3]" />
      </span>
    </button>
  );
}

function PermissionCheckbox(options: {
  readonly label: string;
  readonly checked: boolean;
  readonly ariaLabel: string;
  readonly testId: string;
  readonly onToggle: () => void;
}) {
  const { label, checked, ariaLabel, testId, onToggle } = options;
  const toggleStateClass = checked
    ? 'border-[var(--accent-emerald)] bg-[var(--bg-primary)] text-[var(--text-heading)]'
    : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]';
  const squareStateClass = checked
    ? 'border-[var(--accent-emerald)] bg-[var(--accent-emerald)] text-[var(--bg-void)]'
    : 'border-[var(--border-strong)] bg-[var(--bg-primary)] text-transparent';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onToggle}
      className={`${PERMISSION_TOGGLE_CLASS} ${toggleStateClass}`}
    >
      <span>{label}</span>
      <span aria-hidden="true" className={`${CHECKBOX_SQUARE_BASE_CLASS} ${squareStateClass}`}>
        <Check className="h-3 w-3 stroke-[3]" />
      </span>
    </button>
  );
}

export function AccountTypeSelectorBox(options: {
  readonly recordType: EmployeeRecordType;
  readonly onChange: (nextType: EmployeeRecordType) => void;
}) {
  const { recordType, onChange } = options;
  const isUser = recordType === 'user';

  return (
    <div
      data-testid="account-type-selector"
      className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
          Account Type
        </span>
        <span className="text-[var(--text-muted)] text-xs">
          {isUser ? 'User portal login & permissions' : 'Employee site & badge record'}
        </span>
      </div>
      <div role="radiogroup" aria-label="Account Type" className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          role="radio"
          aria-checked={isUser}
          data-testid="account-type-user"
          onClick={() => onChange('user')}
          className={`${DEPT_CARD_BASE_CLASS} ${
            isUser
              ? 'border-[var(--accent-emerald)] bg-[var(--bg-primary)] shadow-xs'
              : 'border-[var(--border-default)] bg-[var(--bg-primary)]/70 hover:border-[var(--border-strong)]'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <UserCheck
              className={`h-4 w-4 shrink-0 ${
                isUser ? 'text-[var(--accent-emerald)]' : 'text-[var(--text-muted)]'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="font-semibold text-[var(--text-heading)] text-sm">User</div>
              <div className="truncate text-[11px] text-[var(--text-muted)]">
                Portal login & R/W access
              </div>
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`${CHECKBOX_SQUARE_BASE_CLASS} ${
              isUser
                ? 'border-[var(--accent-emerald)] bg-[var(--accent-emerald)] text-[var(--bg-void)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-primary)] text-transparent'
            }`}
          >
            <Check className="h-3 w-3 stroke-[3]" />
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={!isUser}
          data-testid="account-type-employee"
          onClick={() => onChange('employee')}
          className={`${DEPT_CARD_BASE_CLASS} ${
            !isUser
              ? 'border-[var(--accent-emerald)] bg-[var(--bg-primary)] shadow-xs'
              : 'border-[var(--border-default)] bg-[var(--bg-primary)]/70 hover:border-[var(--border-strong)]'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <BadgeCheck
              className={`h-4 w-4 shrink-0 ${
                !isUser ? 'text-[var(--accent-emerald)]' : 'text-[var(--text-muted)]'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="font-semibold text-[var(--text-heading)] text-sm">Employee</div>
              <div className="truncate text-[11px] text-[var(--text-muted)]">
                HR & access badge profile
              </div>
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`${CHECKBOX_SQUARE_BASE_CLASS} ${
              !isUser
                ? 'border-[var(--accent-emerald)] bg-[var(--accent-emerald)] text-[var(--bg-void)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-primary)] text-transparent'
            }`}
          >
            <Check className="h-3 w-3 stroke-[3]" />
          </span>
        </button>
      </div>
    </div>
  );
}

export function EmployeeAccessPermissionsSection(options: {
  readonly recordType: EmployeeRecordType;
  readonly departments: readonly AdminDepartmentOption[];
  readonly accessibleDepartments: readonly string[];
  readonly departmentPermissions: Readonly<Record<string, DepartmentPermission>>;
  readonly onRecordTypeChange: (nextType: EmployeeRecordType) => void;
  readonly onToggleDepartment: (departmentId: string) => void;
  readonly onUpdatePermission: (options: {
    readonly departmentId: string;
    readonly mode: 'read' | 'write';
  }) => void;
  readonly onApplyBulkWrite: (canWrite: boolean) => void;
}) {
  const {
    recordType,
    departments,
    accessibleDepartments,
    departmentPermissions,
    onRecordTypeChange,
    onToggleDepartment,
    onUpdatePermission,
    onApplyBulkWrite,
  } = options;

  const selectedDepartments = departments.filter((dept) => accessibleDepartments.includes(dept.id));
  const readCount = selectedDepartments.filter(
    (dept) => departmentPermissions[dept.id]?.read
  ).length;
  const writeCount = selectedDepartments.filter(
    (dept) => departmentPermissions[dept.id]?.write
  ).length;

  return (
    <div className="space-y-4">
      <div className={SECTION_BOX_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="block font-semibold text-[var(--text-heading)] text-sm">
              Accessible Departments
            </span>
            <span className="text-[var(--text-muted)] text-xs">
              {recordType === 'user'
                ? 'Active portal modules for this User account.'
                : 'Optional department visibility for this Employee record.'}
            </span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-0.5">
            <button
              type="button"
              onClick={() => onRecordTypeChange('user')}
              className={`rounded-md px-2.5 py-1 font-medium text-xs transition-colors ${
                recordType === 'user'
                  ? 'bg-[var(--accent-emerald)] text-[var(--bg-void)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              User
            </button>
            <button
              type="button"
              onClick={() => onRecordTypeChange('employee')}
              className={`rounded-md px-2.5 py-1 font-medium text-xs transition-colors ${
                recordType === 'employee'
                  ? 'bg-[var(--accent-emerald)] text-[var(--bg-void)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
              }`}
            >
              Employee
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {departments.map((dept) => (
            <DepartmentCheckboxCard
              key={dept.id}
              department={dept}
              isSelected={accessibleDepartments.includes(dept.id)}
              permission={departmentPermissions[dept.id]}
              onToggle={onToggleDepartment}
            />
          ))}
        </div>
      </div>

      <div data-testid="read-write-permissions-section" className={SECTION_BOX_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-emerald)]" aria-hidden="true" />
            <div>
              <span className="block font-semibold text-[var(--text-heading)] text-sm">
                Read + Write Permissions
              </span>
              <span className="text-[var(--text-muted)] text-xs">
                {selectedDepartments.length === 0
                  ? 'No departments selected yet'
                  : `${readCount} Read · ${writeCount} Write enabled`}
              </span>
            </div>
          </div>

          {selectedDepartments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onApplyBulkWrite(false)}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[var(--text-body)] text-xs transition-colors hover:border-[var(--border-strong)]"
              >
                All Read Only
              </button>
              <button
                type="button"
                onClick={() => onApplyBulkWrite(true)}
                className="rounded border border-[var(--accent-emerald)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[var(--accent-emerald)] text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
              >
                All Read + Write
              </button>
            </div>
          )}
        </div>

        {selectedDepartments.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-default)] border-dashed bg-[var(--bg-primary)]/60 px-3 py-3 text-center text-[var(--text-muted)] text-xs">
            Select one or more departments above to configure Read and Write permissions.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)] overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]">
            {selectedDepartments.map((dept) => {
              const perm = departmentPermissions[dept.id] ?? { read: true, write: true };
              return (
                <div
                  key={dept.id}
                  data-testid={`perm-row-${dept.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-[var(--text-heading)] text-sm">
                      {dept.display_name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium text-[11px] ${
                        perm.write
                          ? 'bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                      }`}
                    >
                      {perm.write ? 'Read + Write' : 'Read Only'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PermissionCheckbox
                      label="Read"
                      checked={perm.read}
                      ariaLabel={`${dept.display_name} Read permission`}
                      testId={`perm-read-${dept.id}`}
                      onToggle={() => onUpdatePermission({ departmentId: dept.id, mode: 'read' })}
                    />
                    <PermissionCheckbox
                      label="Write"
                      checked={perm.write}
                      ariaLabel={`${dept.display_name} Write permission`}
                      testId={`perm-write-${dept.id}`}
                      onToggle={() => onUpdatePermission({ departmentId: dept.id, mode: 'write' })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
