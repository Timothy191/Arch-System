import {
  adminAddMachineSchema,
  adminArchiveMachineSchema,
  adminDeleteEmployeeSchema,
  adminPortalSettingsSchema,
  adminUpdateDepartmentSchema,
  adminUpdateMachineSchema,
  upsertAdminEmployeeSchema,
} from './admin.schema';

describe('admin.schema', () => {
  it('accepts optional email or empty string on upsertAdminEmployeeSchema and rejects malformed emails', () => {
    const base = {
      record_type: 'user' as const,
      names: 'Lerato',
      surname: 'Khumalo',
      full_name: 'Lerato Khumalo',
      id_number: '9409180000081',
      job_title: 'Operator',
      area: 'Production',
      medical_expiry: '2027-06-01',
      induction_expiry: '2027-07-01',
      coy_number: 'COY-1042',
      qr_code: 'QR-COY-1042',
      photo_url: '',
      role: 'operator',
      department_id: null,
      accessible_departments: [],
    };

    expect(
      upsertAdminEmployeeSchema.safeParse({ ...base, email: 'lerato@plantcor.co.za' }).success
    ).toBe(true);
    expect(upsertAdminEmployeeSchema.safeParse({ ...base, email: '' }).success).toBe(true);
    expect(upsertAdminEmployeeSchema.safeParse(base).success).toBe(true);
    expect(upsertAdminEmployeeSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(
      false
    );
  });

  it('validates adminDeleteEmployeeSchema and adminUpdateDepartmentSchema', () => {
    expect(adminDeleteEmployeeSchema.safeParse({ id: 'emp-1' }).success).toBe(true);
    expect(adminDeleteEmployeeSchema.safeParse({ id: '   ' }).success).toBe(false);

    expect(
      adminUpdateDepartmentSchema.safeParse({
        id: 'dept-1',
        display_name: 'Plant Operations',
        description: 'Crushing and wash plant',
        color: 'emerald',
        icon: 'Factory',
      }).success
    ).toBe(true);
    expect(adminUpdateDepartmentSchema.safeParse({ id: 'dept-1', display_name: '' }).success).toBe(
      false
    );
  });

  it('validates adminAddMachineSchema, adminUpdateMachineSchema, and adminArchiveMachineSchema', () => {
    expect(
      adminAddMachineSchema.safeParse({
        name: 'DT-205',
        serial_number: 'Volvo A45G',
        machine_type: 'Articulated Dumper',
        manufacturer: 'Volvo',
        starting_smr: 9500,
        department_id: 'dept-prod',
      }).success
    ).toBe(true);

    expect(
      adminAddMachineSchema.safeParse({
        name: '',
        serial_number: '',
        machine_type: 'Dozer',
        manufacturer: 'Caterpillar',
        starting_smr: 1000,
        department_id: 'dept-prod',
      }).success
    ).toBe(false);

    expect(
      adminUpdateMachineSchema.safeParse({
        id: 'm-1',
        name: 'BD-22',
        active: false,
      }).success
    ).toBe(true);
    expect(adminUpdateMachineSchema.safeParse({ id: 'm-1', name: '  ' }).success).toBe(false);

    expect(adminArchiveMachineSchema.safeParse({ id: 'm-1' }).success).toBe(true);
    expect(adminArchiveMachineSchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('validates adminPortalSettingsSchema defaults and HH:MM shift boundaries', () => {
    const parsed = adminPortalSettingsSchema.parse({});
    expect(parsed).toEqual({
      dayShiftStart: '06:00',
      nightShiftStart: '18:00',
      shiftDurationHours: 12,
      siteTimezone: 'Africa/Johannesburg',
      sessionIdleWarningMinutes: 30,
      operationalNoticeBanner: '',
      operationalNoticeActive: false,
    });

    expect(
      adminPortalSettingsSchema.safeParse({
        dayShiftStart: '25:99',
      }).success
    ).toBe(false);
  });
});
