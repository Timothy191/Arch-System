'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
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
import { DEFAULT_ADMIN_AREAS, getSavedAdminAreas } from './DepartmentsTab';

interface Employee {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  national_id?: string | null;
  job_title?: string | null;
  areas?: string[] | null;
  medical_expiry_date?: string | null;
  induction_expiry_date?: string | null;
  employee_code?: string | null;
  qr_code_data?: string | null;
  photo_url?: string | null;
  role: string;
  department_id: string | null;
  accessible_departments: string[] | null;
  created_at: string;
  departments?: {
    display_name: string;
  };
}

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

export function UsersTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const supabase = createBrowserSupabaseClient();

  const loadData = useCallback(async () => {
    const [empData, deptData, persData] = await Promise.all([
      supabase
        .from('employees')
        .select('*, departments(display_name)')
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, display_name'),
      supabase
        .from('personnel')
        .select(
          'emp_code, first_name, surname, id_number, job_title, area, medical_expiry, induction_expiry, photo_url, badges(qr_code)'
        ),
    ]);

    const persByCode = new Map<
      string,
      {
        emp_code: string;
        first_name: string;
        surname: string;
        id_number: string;
        job_title: string | null;
        area: string | null;
        medical_expiry: string | null;
        induction_expiry: string | null;
        photo_url: string | null;
        qr_code: string | null;
      }
    >();

    if (persData.data) {
      for (const p of persData.data as Array<{
        emp_code: string;
        first_name: string;
        surname: string;
        id_number: string;
        job_title: string | null;
        area: string | null;
        medical_expiry: string | null;
        induction_expiry: string | null;
        photo_url: string | null;
        badges?: Array<{ qr_code: string }> | { qr_code: string } | null;
      }>) {
        const badgeObj = Array.isArray(p.badges) ? p.badges[0] : p.badges;
        persByCode.set(p.emp_code, {
          emp_code: p.emp_code,
          first_name: p.first_name,
          surname: p.surname,
          id_number: p.id_number,
          job_title: p.job_title,
          area: p.area,
          medical_expiry: p.medical_expiry,
          induction_expiry: p.induction_expiry,
          photo_url: p.photo_url,
          qr_code: badgeObj?.qr_code ?? null,
        });
      }
    }

    if (empData.data) {
      const enriched = (empData.data as Employee[]).map((emp) => {
        const linked = emp.employee_code ? persByCode.get(emp.employee_code) : undefined;
        return {
          ...emp,
          first_name: emp.first_name ?? linked?.first_name ?? null,
          last_name: emp.last_name ?? linked?.surname ?? null,
          national_id: emp.national_id ?? linked?.id_number ?? null,
          job_title: emp.job_title ?? linked?.job_title ?? null,
          areas: emp.areas?.length ? emp.areas : linked?.area ? [linked.area] : null,
          medical_expiry_date: emp.medical_expiry_date ?? linked?.medical_expiry ?? null,
          induction_expiry_date: emp.induction_expiry_date ?? linked?.induction_expiry ?? null,
          qr_code_data: emp.qr_code_data ?? linked?.qr_code ?? null,
          photo_url: emp.photo_url ?? linked?.photo_url ?? null,
        };
      });
      setEmployees(enriched);
    }
    if (deptData.data) setDepartments(deptData.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowEditDialog(true);
  };

  const syncPersonnelAndBadge = async (formData: EmployeeFormPayload, empCode: string) => {
    const firstName =
      formData.names.trim() || formData.full_name.trim().split(/\s+/)[0] || 'Employee';
    const surname =
      formData.surname.trim() ||
      formData.full_name.trim().split(/\s+/).slice(1).join(' ') ||
      'Record';
    const idNumber = formData.id_number.trim() || empCode;
    const qrCode = formData.qr_code.trim() || `QR-${empCode}`;

    const { data: existingPers } = await supabase
      .from('personnel')
      .select('id')
      .eq('emp_code', empCode)
      .maybeSingle();

    let personnelId = existingPers?.id ?? null;

    if (personnelId) {
      await supabase
        .from('personnel')
        .update({
          first_name: firstName,
          surname,
          id_number: idNumber,
          job_title: formData.job_title.trim() || null,
          area: formData.area.trim() || null,
          department_id: formData.department_id,
          medical_expiry: formData.medical_expiry || null,
          induction_expiry: formData.induction_expiry || null,
          photo_url: formData.photo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', personnelId);
    } else if (formData.id_number.trim() || formData.coy_number.trim() || formData.qr_code.trim()) {
      const { data: insertedPers } = await supabase
        .from('personnel')
        .insert({
          emp_code: empCode,
          first_name: firstName,
          surname,
          id_number: idNumber,
          job_title: formData.job_title.trim() || null,
          area: formData.area.trim() || null,
          department_id: formData.department_id,
          medical_expiry: formData.medical_expiry || null,
          induction_expiry: formData.induction_expiry || null,
          photo_url: formData.photo_url || null,
          status: 'Active',
        })
        .select('id')
        .maybeSingle();

      personnelId = insertedPers?.id ?? null;
    }

    if (personnelId && qrCode) {
      const { data: existingBadge } = await supabase
        .from('badges')
        .select('id')
        .eq('personnel_id', personnelId)
        .maybeSingle();

      if (existingBadge?.id) {
        await supabase
          .from('badges')
          .update({
            qr_code: qrCode,
            department_id: formData.department_id,
            expires_at: formData.induction_expiry || formData.medical_expiry || null,
          })
          .eq('id', existingBadge.id);
      } else {
        await supabase.from('badges').insert({
          qr_code: qrCode,
          entity_type: 'personnel',
          personnel_id: personnelId,
          department_id: formData.department_id,
          is_active: true,
          issued_at: new Date().toISOString(),
          expires_at: formData.induction_expiry || formData.medical_expiry || null,
        });
      }
    }
  };

  const handleUpdate = async (formData: EmployeeFormPayload) => {
    const resolvedFullName =
      formData.full_name.trim() || `${formData.names.trim()} ${formData.surname.trim()}`.trim();
    const resolvedCoyNumber =
      formData.coy_number.trim() ||
      editingEmployee?.employee_code ||
      `EMP-${Math.floor(10000 + Math.random() * 90000)}`;

    const extendedColumns = {
      full_name: resolvedFullName,
      first_name: formData.names.trim() || null,
      last_name: formData.surname.trim() || null,
      national_id: formData.id_number.trim() || null,
      job_title: formData.job_title.trim() || null,
      areas: formData.area.trim() ? [formData.area.trim()] : [],
      medical_expiry_date: formData.medical_expiry || null,
      induction_expiry_date: formData.induction_expiry || null,
      employee_code: resolvedCoyNumber,
      qr_code_data: formData.qr_code.trim() || null,
      photo_url: formData.photo_url || null,
      role: formData.role,
      department_id: formData.department_id,
      accessible_departments: formData.accessible_departments,
    };

    if (editingEmployee) {
      // Update existing employee
      let { error } = await supabase
        .from('employees')
        .update(extendedColumns)
        .eq('id', editingEmployee.id);

      if (error) {
        // Fallback to core columns if any extended migration column is missing
        const fallback = await supabase
          .from('employees')
          .update({
            full_name: resolvedFullName,
            role: formData.role,
            department_id: formData.department_id,
            accessible_departments: formData.accessible_departments,
          })
          .eq('id', editingEmployee.id);
        error = fallback.error;
      }

      if (error) {
        logError(new Error(error.message), {
          context: 'users_tab_update_employee',
        });
        toast.error(error.message);
        return;
      }

      await syncPersonnelAndBadge(formData, resolvedCoyNumber);
    } else {
      // Add new employee
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        logError(new Error('Unauthenticated'), {
          context: 'users_tab_add_employee',
        });
        return;
      }

      let { error } = await supabase.from('employees').insert({
        ...extendedColumns,
        auth_id: user.id,
      });

      if (error) {
        const fallback = await supabase.from('employees').insert({
          full_name: resolvedFullName,
          role: formData.role,
          department_id: formData.department_id,
          accessible_departments: formData.accessible_departments,
          auth_id: user.id,
        });
        error = fallback.error;
      }

      if (error) {
        logError(new Error(error.message), {
          context: 'users_tab_add_employee',
        });
        toast.error(error.message);
        return;
      }

      await syncPersonnelAndBadge(formData, resolvedCoyNumber);
    }

    setShowEditDialog(false);
    setEditingEmployee(null);
    loadData();
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deptMap = new Map(departments.map((d) => [d.id, d.display_name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] z-10 pointer-events-none" />
          <Input
            placeholder="Search employees..."
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
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Department
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Accessible Depts
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    Loading...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-6 py-4 text-[var(--text-heading)] text-sm font-medium">
                      {emp.full_name}
                    </td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                      {emp.department_id ? deptMap.get(emp.department_id) : 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                      {emp.accessible_departments?.length || 0} departments
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                      {new Date(emp.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[var(--bg-primary)] border-[var(--border-default)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
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
    const random = Math.floor(100000 + Math.random() * 900000);
    const prefix = (coyNumber || names || 'EMP')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 6)
      .toUpperCase();
    setQrCode(`QR-${prefix}-${random}`);
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
