import type { SupabaseClient } from '@supabase/supabase-js';

interface OperatorSeedSpec {
  name: string;
  firstName: string;
  surname: string;
  email: string;
  pass: string;
  empCode: string;
  idNumber: string;
  jobTitle: string;
  role: 'operator' | 'supervisor';
  departmentName: 'production' | 'control-room' | 'drilling';
  accessibleDepartmentNames?: Array<'production' | 'control-room' | 'drilling'>;
}

export async function seedOperators(supabase: SupabaseClient): Promise<void> {
  console.log('--> Seeding Operator Users, Employees, Personnel & Badges for all Machine Types...');

  const { data: departments } = await supabase.from('departments').select('id, name');
  const deptByName = new Map((departments ?? []).map((d) => [d.name, d.id]));
  const operationalDeptIds = ['control-room', 'production', 'drilling']
    .map((name) => deptByName.get(name))
    .filter((id): id is string => Boolean(id));

  // Ensure all active machines have a default site_id assigned
  const { data: activeSites } = await supabase
    .from('sites')
    .select('id, site_code')
    .eq('active', true)
    .is('deleted_at', null);
  const { data: unassignedMachines } = await supabase
    .from('machines')
    .select('id, name')
    .eq('active', true)
    .is('site_id', null);

  if (activeSites?.length && unassignedMachines?.length) {
    for (let i = 0; i < unassignedMachines.length; i++) {
      const targetSite = activeSites[i % activeSites.length];
      if (!targetSite) continue;
      await supabase
        .from('machines')
        .update({ site_id: targetSite.id })
        .eq('id', unassignedMachines[i].id);
    }
    console.log(
      `   [Machines] Assigned active site_id to ${unassignedMachines.length} unassigned machines.`
    );
  }

  const operators: OperatorSeedSpec[] = [
    // Dump Truck / ADT Operators (DT-101, DT-102)
    {
      name: 'Alice ADT',
      firstName: 'Alice',
      surname: 'ADT',
      email: 'alice.adt@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-ALICE',
      idNumber: '9001015009081',
      jobTitle: 'ADT Operator',
      role: 'operator',
      departmentName: 'production',
    },
    {
      name: 'John Doe',
      firstName: 'John',
      surname: 'Doe',
      email: 'john.doe@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-001',
      idNumber: '8501015009081',
      jobTitle: 'ADT Operator',
      role: 'operator',
      departmentName: 'production',
    },
    {
      name: 'Jane Smith',
      firstName: 'Jane',
      surname: 'Smith',
      email: 'jane.smith@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-002',
      idNumber: '8802020009082',
      jobTitle: 'Articulated Dump Truck Operator',
      role: 'operator',
      departmentName: 'production',
    },
    {
      name: 'John Operator',
      firstName: 'John',
      surname: 'Operator',
      email: 'john.operator@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'OP-001',
      idNumber: '9003035009083',
      jobTitle: 'Dump Truck Operator',
      role: 'operator',
      departmentName: 'production',
    },
    // Dozer Operators (BD-19)
    {
      name: 'Bob Dozer',
      firstName: 'Bob',
      surname: 'Dozer',
      email: 'bob.dozer@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-BOB',
      idNumber: '8904045009084',
      jobTitle: 'Dozer Operator',
      role: 'operator',
      departmentName: 'control-room',
    },
    {
      name: 'Daniel Dozer',
      firstName: 'Daniel',
      surname: 'Dozer',
      email: 'daniel.dozer@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-DANIEL',
      idNumber: '9206065009086',
      jobTitle: 'Dozer Operator',
      role: 'operator',
      departmentName: 'control-room',
    },
    // Excavator Operators (EX-501)
    {
      name: 'Charlie Excavator',
      firstName: 'Charlie',
      surname: 'Excavator',
      email: 'charlie.excavator@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-CHARLIE',
      idNumber: '8707075009087',
      jobTitle: 'Excavator Operator',
      role: 'operator',
      departmentName: 'production',
    },
    {
      name: 'Elena Excavator',
      firstName: 'Elena',
      surname: 'Excavator',
      email: 'elena.excavator@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-ELENA',
      idNumber: '9308080009088',
      jobTitle: 'Excavator Operator',
      role: 'operator',
      departmentName: 'production',
    },
    // Drill Rig Operators (DR-001, DR-002)
    {
      name: 'Jane Driller',
      firstName: 'Jane',
      surname: 'Driller',
      email: 'jane.driller@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'OP-002',
      idNumber: '9104040009084',
      jobTitle: 'Drill Rig Operator',
      role: 'operator',
      departmentName: 'drilling',
    },
    {
      name: 'David Drill',
      firstName: 'David',
      surname: 'Drill',
      email: 'david.drill@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-DAVID',
      idNumber: '8609095009089',
      jobTitle: 'Drill Rig Operator',
      role: 'operator',
      departmentName: 'drilling',
    },
    // Generator Operators (GEN-A, GEN-B)
    {
      name: 'Mike Johnson',
      firstName: 'Mike',
      surname: 'Johnson',
      email: 'mike.johnson@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-003',
      idNumber: '8705055009085',
      jobTitle: 'Generator Operator',
      role: 'operator',
      departmentName: 'control-room',
    },
    {
      name: 'Grace Generator',
      firstName: 'Grace',
      surname: 'Generator',
      email: 'grace.generator@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-GRACE',
      idNumber: '9410100009090',
      jobTitle: 'Generator Operator',
      role: 'operator',
      departmentName: 'control-room',
    },
    // Control Room Dedicated Operator (strictly scoped to Control Room only)
    {
      name: 'Control Room',
      firstName: 'Control',
      surname: 'Room',
      email: 'ControlRoom@plantcormining.co.za',
      pass: 'Yugioh@123#',
      empCode: 'EMP-CR-ONLY',
      idNumber: '9501015009081',
      jobTitle: 'Control Room Operator',
      role: 'operator',
      departmentName: 'control-room',
      accessibleDepartmentNames: ['control-room'],
    },
  ];

  const { data: existingUsersList } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const existingUsersByEmail = new Map(
    (existingUsersList?.users ?? []).flatMap((u) => (u.email ? [[u.email.toLowerCase(), u]] : []))
  );

  const twoYearsFromNow = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();

  for (const op of operators) {
    let userId: string | undefined;
    const existing = existingUsersByEmail.get(op.email.toLowerCase());

    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password: op.pass,
        email_confirm: true,
      });
      userId = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: op.email,
        password: op.pass,
        email_confirm: true,
      });
      if (error) {
        console.error(`   [Operators] Error creating auth user ${op.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
    }

    const departmentId = deptByName.get(op.departmentName) ?? operationalDeptIds[0] ?? null;
    const operatorAccessibleDepts = op.accessibleDepartmentNames
      ? op.accessibleDepartmentNames
          .map((name) => deptByName.get(name))
          .filter((id): id is string => Boolean(id))
      : operationalDeptIds;

    // 1. Upsert into employees
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_id', userId)
      .maybeSingle();

    if (existingEmp) {
      const { error: empUpdateError } = await supabase
        .from('employees')
        .update({
          full_name: op.name,
          role: op.role,
          employee_code: op.empCode,
          department_id: departmentId,
          accessible_departments: operatorAccessibleDepts,
        })
        .eq('id', existingEmp.id);
      if (empUpdateError) {
        console.error(`   [Operators] Error updating employee ${op.name}:`, empUpdateError.message);
      }
    } else {
      const { error: empError } = await supabase.from('employees').insert({
        auth_id: userId,
        full_name: op.name,
        role: op.role,
        employee_code: op.empCode,
        department_id: departmentId,
        accessible_departments: operatorAccessibleDepts,
      });
      if (empError) {
        console.error(`   [Operators] Error creating employee ${op.name}:`, empError.message);
      }
    }

    // 2. Upsert into operators
    const { error: opError } = await supabase.from('operators').upsert(
      {
        full_name: op.name,
        employee_code: op.empCode,
        role: op.role,
        active: true,
      },
      { onConflict: 'employee_code' }
    );
    if (opError) {
      console.error(`   [Operators] Error upserting operator ${op.name}:`, opError.message);
    }

    // 3. Upsert into personnel
    const { data: personRow, error: persError } = await supabase
      .from('personnel')
      .upsert(
        {
          emp_code: op.empCode,
          first_name: op.firstName,
          surname: op.surname,
          id_number: op.idNumber,
          job_title: op.jobTitle,
          department_id: departmentId,
          status: 'Active',
          medical_expiry: twoYearsFromNow,
          induction_expiry: twoYearsFromNow,
        },
        { onConflict: 'emp_code' }
      )
      .select('id')
      .single();

    if (persError) {
      console.error(`   [Operators] Error upserting personnel ${op.name}:`, persError.message);
      continue;
    }

    // 4. Upsert active badge for QR / badge scanning
    if (personRow?.id) {
      const qrCode = `BADGE-${op.empCode}`;
      const { error: badgeError } = await supabase.from('badges').upsert(
        {
          qr_code: qrCode,
          entity_type: 'personnel',
          personnel_id: personRow.id,
          is_active: true,
          revoked_at: null,
        },
        { onConflict: 'qr_code' }
      );
      if (badgeError) {
        console.warn(`   [Operators] Badge upsert note for ${op.name}:`, badgeError.message);
      }
    }

    console.log(
      `   ✓ [Operators] Setup ${op.name} (${op.empCode} · ${op.jobTitle} · dept=${op.departmentName})`
    );
  }
}
