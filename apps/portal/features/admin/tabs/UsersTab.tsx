'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Camera, Edit2, QrCode, RefreshCw, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logError } from '@/lib/errors/error-logger';
import {
  type AdminDepartmentOption,
  type AdminEmployeeRecord,
  getUsersAdminData,
  upsertEmployeeAdmin,
} from './actions';
import { DEFAULT_ADMIN_AREAS, getSavedAdminAreas } from './DepartmentsTab';

type Employee = AdminEmployeeRecord;

interface EmployeeFormPayload {
  names: string;
  surname: string;
  full_name: string;
  id_number: string;
  job_title: string;
  area: string;
  medical_expiry: string;
  induction_expiry: string;
  coy_number: string;
  qr_code: string;
  photo_url: string;
  role: string;
  department_id: string | null;
  accessible_departments: string[];
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toISOString().split('T')[0] ?? '—';
}

export function UsersTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<AdminDepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getUsersAdminData();
      setEmployees(data.employees);
      setDepartments(data.departments);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load employee records');
      logError(error, { context: 'users_tab_load_data' });
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowEditDialog(true);
  };

  const handleUpdate = async (formData: EmployeeFormPayload) => {
    const result = await upsertEmployeeAdmin({
      id: editingEmployee?.id ?? null,
      ...formData,
    });

    if (!result.success) {
      const message = result.error || 'Failed to save employee';
      logError(new Error(message), {
        context: editingEmployee ? 'users_tab_update_employee' : 'users_tab_add_employee',
      });
      toast.error(message);
      return;
    }

    toast.success(editingEmployee ? 'Employee updated' : 'Employee added');
    setShowEditDialog(false);
    setEditingEmployee(null);
    await loadData();
  };

  const query = searchTerm.trim().toLowerCase();
  const filteredEmployees = employees.filter((emp) => {
    if (!query) return true;
    return (
      emp.full_name.toLowerCase().includes(query) ||
      (emp.employee_code?.toLowerCase().includes(query) ?? false) ||
      (emp.national_id?.toLowerCase().includes(query) ?? false) ||
      (emp.job_title?.toLowerCase().includes(query) ?? false) ||
      (emp.qr_code_data?.toLowerCase().includes(query) ?? false)
    );
  });

  const deptMap = new Map(departments.map((d) => [d.id, d.display_name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] z-10 pointer-events-none" />
          <Input
            placeholder="Search employees by name, Coy No, ID, job title, or QR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 bg-[var(--bg-secondary)] border-[var(--border-default)]"
          />
        </div>
        <Button
          className="shrink-0 bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
          onClick={() => {
            setEditingEmployee(null);
            setShowEditDialog(true);
          }}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Employee
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Coy / ID Number
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Job Title & Area
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Department & Access
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Medical / Induction
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  QR Code & Role
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    Loading...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const primaryArea = emp.areas?.[0] || '—';
                  const primaryDept = emp.department_id
                    ? (deptMap.get(emp.department_id) ??
                      emp.departments?.display_name ??
                      'Unassigned')
                    : (emp.departments?.display_name ?? 'Unassigned');

                  return (
                    <tr key={emp.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden shrink-0 relative flex items-center justify-center text-xs font-semibold text-[var(--text-muted)]">
                            {emp.photo_url ? (
                              <Image
                                src={emp.photo_url}
                                alt={emp.full_name}
                                fill
                                sizes="36px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <span>
                                {(emp.first_name?.[0] ?? emp.full_name[0] ?? 'E').toUpperCase()}
                                {(emp.last_name?.[0] ?? '').toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-[var(--text-heading)] text-sm font-medium">
                              {emp.full_name}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {emp.first_name || '—'} {emp.last_name || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-mono text-[var(--text-heading)]">
                          {emp.employee_code || '—'}
                        </div>
                        <div className="text-xs font-mono text-[var(--text-muted)]">
                          ID: {emp.national_id || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-[var(--text-heading)]">
                          {emp.job_title || '—'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">Area: {primaryArea}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-[var(--text-heading)]">{primaryDept}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {emp.accessible_departments?.length || 0} accessible depts
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs text-[var(--text-heading)]">
                          Med: {formatDateShort(emp.medical_expiry_date)}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Ind: {formatDateShort(emp.induction_expiry_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="outline"
                            className={
                              emp.role === 'admin'
                                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                : emp.role === 'supervisor'
                                  ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
                                  : ''
                            }
                          >
                            {emp.role}
                          </Badge>
                          <span className="text-xs font-mono text-[var(--text-muted)]">
                            {emp.qr_code_data || 'No QR'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(emp)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-accent-red hover:text-accent-red/80"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[var(--bg-primary)] border-[var(--border-default)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <EditEmployeeForm
            employee={editingEmployee}
            departments={departments}
            onSubmit={handleUpdate}
            onCancel={() => {
              setShowEditDialog(false);
              setEditingEmployee(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditEmployeeForm({
  employee,
  departments,
  onSubmit,
  onCancel,
}: {
  employee: Employee | null;
  departments: { id: string; display_name: string }[];
  onSubmit: (_data: EmployeeFormPayload) => void;
  onCancel: () => void;
}) {
  const initialFirstParts = (employee?.full_name || '').trim().split(/\s+/);
  const defaultNames = employee?.first_name ?? initialFirstParts[0] ?? '';
  const defaultSurname = employee?.last_name ?? initialFirstParts.slice(1).join(' ') ?? '';

  const [names, setNames] = useState(defaultNames);
  const [surname, setSurname] = useState(defaultSurname);
  const [fullName, setFullName] = useState(employee?.full_name || '');
  const [idNumber, setIdNumber] = useState(employee?.national_id || '');
  const [jobTitle, setJobTitle] = useState(employee?.job_title || '');
  const [area, setArea] = useState(employee?.areas?.[0] || '');
  const [medicalExpiry, setMedicalExpiry] = useState<string>(
    employee?.medical_expiry_date ? (employee.medical_expiry_date.split('T')[0] ?? '') : ''
  );
  const [inductionExpiry, setInductionExpiry] = useState<string>(
    employee?.induction_expiry_date ? (employee.induction_expiry_date.split('T')[0] ?? '') : ''
  );
  const [coyNumber, setCoyNumber] = useState(employee?.employee_code || '');
  const [qrCode, setQrCode] = useState(employee?.qr_code_data || '');
  const [photoUrl, setPhotoUrl] = useState(employee?.photo_url || '');
  const [role, setRole] = useState(employee?.role || 'operator');
  const [departmentId, setDepartmentId] = useState(employee?.department_id || '');
  const [accessibleDepts, setAccessibleDepts] = useState<string[]>(
    employee?.accessible_departments || []
  );
  const [availableAreas, setAvailableAreas] = useState<string[]>([...DEFAULT_ADMIN_AREAS]);

  useEffect(() => {
    setAvailableAreas(getSavedAdminAreas());
  }, []);

  const handleNamesChange = (val: string) => {
    setNames(val);
    setFullName(`${val} ${surname}`.trim());
  };

  const handleSurnameChange = (val: string) => {
    setSurname(val);
    setFullName(`${names} ${val}`.trim());
  };

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    const parts = val.trim().split(/\s+/);
    setNames(parts[0] || '');
    setSurname(parts.slice(1).join(' ') || '');
  };

  const handleGenerateQR = () => {
    const suffix = Date.now().toString(36).slice(-6).toUpperCase();
    const prefix = (coyNumber || names || 'EMP')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 6)
      .toUpperCase();
    setQrCode(`QR-${prefix}-${suffix}`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
        toast.success('Employee photo loaded');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const combinedFullName = fullName.trim() || `${names.trim()} ${surname.trim()}`.trim();
    onSubmit({
      names,
      surname,
      full_name: combinedFullName,
      id_number: idNumber,
      job_title: jobTitle,
      area,
      medical_expiry: medicalExpiry,
      induction_expiry: inductionExpiry,
      coy_number: coyNumber,
      qr_code: qrCode,
      photo_url: photoUrl,
      role,
      department_id: departmentId || null,
      accessible_departments: accessibleDepts,
    });
  };

  const toggleAccessibleDept = (deptId: string) => {
    setAccessibleDepts((prev) =>
      prev.includes(deptId) ? prev.filter((d) => d !== deptId) : [...prev, deptId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="names" className="block text-sm font-medium text-[var(--text-body)] mb-2">
            Names
          </label>
          <input
            id="names"
            type="text"
            value={names}
            onChange={(e) => handleNamesChange(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
            placeholder="Enter first name(s)"
          />
        </div>

        <div>
          <label
            htmlFor="surname"
            className="block text-sm font-medium text-[var(--text-body)] mb-2"
          >
            Surname
          </label>
          <input
            id="surname"
            type="text"
            value={surname}
            onChange={(e) => handleSurnameChange(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
            placeholder="Enter surname"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="fullName"
          className="block text-sm font-medium text-[var(--text-body)] mb-2"
        >
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => handleFullNameChange(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
          placeholder="Enter full name"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="idNumber"
            className="block text-sm font-medium text-[var(--text-body)] mb-2"
          >
            Id Number
          </label>
          <input
            id="idNumber"
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)] font-mono"
            placeholder="Enter ID / passport number"
          />
        </div>

        <div>
          <label
            htmlFor="coyNumber"
            className="block text-sm font-medium text-[var(--text-body)] mb-2"
          >
            Coy Number
          </label>
          <input
            id="coyNumber"
            type="text"
            value={coyNumber}
            onChange={(e) => setCoyNumber(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)] font-mono"
            placeholder="e.g. COY-1042 / EMP-1042"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="jobTitle"
            className="block text-sm font-medium text-[var(--text-body)] mb-2"
          >
            Job Title
          </label>
          <input
            id="jobTitle"
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
            placeholder="e.g. Excavator Operator"
          />
        </div>

        <div>
          <label htmlFor="area" className="block text-sm font-medium text-[var(--text-body)] mb-2">
            Area
          </label>
          <select
            id="area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
          >
            <option value="">Select area</option>
            {availableAreas.map((areaName) => (
              <option key={areaName} value={areaName}>
                {areaName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="medicalExpiry"
            className="block text-sm font-medium text-[var(--text-body)] mb-2"
          >
            Medical Expiry
          </label>
          <input
            id="medicalExpiry"
            type="date"
            value={medicalExpiry}
            onChange={(e) => setMedicalExpiry(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
          />
        </div>

        <div>
          <label
            htmlFor="inductionExpiry"
            className="block text-sm font-medium text-[var(--text-body)] mb-2"
          >
            Induction Expiry
          </label>
          <input
            id="inductionExpiry"
            type="date"
            value={inductionExpiry}
            onChange={(e) => setInductionExpiry(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="qrCode" className="block text-sm font-medium text-[var(--text-body)] mb-2">
          QR Code
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              id="qrCode"
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)] font-mono"
              placeholder="QR-EMP-..."
            />
          </div>
          <Button type="button" variant="outline" onClick={handleGenerateQR} className="shrink-0">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Generate
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor="photo" className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Photo
        </label>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden shrink-0 relative flex items-center justify-center">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt="Employee photo preview"
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <Camera className="w-5 h-5 text-[var(--text-muted)]" />
            )}
          </div>
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded text-[var(--text-heading)] transition-colors shrink-0">
            <Upload className="w-4 h-4 text-[var(--accent-blue)]" />
            <span>Upload Photo</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
          <input
            id="photo"
            type="text"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)] text-sm"
            placeholder="Or paste photo URL..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-[var(--text-body)] mb-2">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
          >
            <option value="operator">Operator</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
            <option value="control_room_operator">Control Room Operator</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="department"
            className="block text-sm font-medium text-[var(--text-body)] mb-2"
          >
            Primary Department
          </label>
          <select
            id="department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-[var(--text-heading)]"
          >
            <option value="">Select department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Accessible Departments
        </label>
        <div className="grid grid-cols-2 gap-2">
          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => toggleAccessibleDept(dept.id)}
              className={`text-left px-3 py-2 rounded border text-sm ${
                accessibleDepts.includes(dept.id)
                  ? 'bg-[var(--accent-emerald)] border-[var(--accent-emerald)] text-[var(--bg-void)]'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-default)] text-[var(--text-body)]'
              }`}
            >
              {dept.display_name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
        >
          {employee ? 'Save Changes' : 'Add Employee'}
        </Button>
      </div>
    </form>
  );
}
