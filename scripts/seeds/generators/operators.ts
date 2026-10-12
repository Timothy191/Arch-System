import type { SupabaseClient } from '@supabase/supabase-js';

export async function seedOperators(supabase: SupabaseClient): Promise<void> {
  console.log('--> Seeding Operator Users...');

  const operators = [
    { name: 'Alice ADT', email: 'alice.adt@plantcormining.co.za', pass: 'Yugioh@123#', role: 'operator' },
    { name: 'Bob Dozer', email: 'bob.dozer@plantcormining.co.za', pass: 'Yugioh@123#', role: 'operator' },
    { name: 'Charlie Excavator', email: 'charlie.excavator@plantcormining.co.za', pass: 'Yugioh@123#', role: 'operator' },
  ];

  for (const op of operators) {
    let userId;
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const existing = existingUser?.users.find(u => u.email === op.email);

    if (existing) {
      console.log(`   [Operators] User ${op.email} exists, updating password...`);
      await supabase.auth.admin.updateUserById(existing.id, { password: op.pass, email_confirm: true });
      userId = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: op.email,
        password: op.pass,
        email_confirm: true,
      });
      if (error) {
        console.error(`   [Operators] Error creating user ${op.email}:`, error);
        continue;
      }
      userId = data.user.id;
    }

    // Now insert or update employee
    const { data: existingEmp } = await supabase.from('employees').select('id').eq('auth_id', userId).single();
    
    if (existingEmp) {
       console.log(`   [Operators] Employee ${op.name} already exists.`);
    } else {
       const { error: empError } = await supabase.from('employees').insert({
         auth_id: userId,
         full_name: op.name,
         role: op.role,
         accessible_departments: [],
       });
       if (empError) console.error(`   [Operators] Error creating employee ${op.name}:`, empError.message);
    }

    // Insert into operators
    const empCode = `EMP-${op.name.split(' ')[0].toUpperCase()}`;
    const { error: opError } = await supabase.from('operators').upsert({
       full_name: op.name,
       employee_code: empCode,
       role: op.role,
       active: true
    }, { onConflict: 'employee_code' });
    if (opError) console.error(`   [Operators] Error creating operator ${op.name}:`, opError.message);

    // Insert into personnel
    const { error: persError } = await supabase.from('personnel').upsert({
       emp_code: empCode,
       first_name: op.name.split(' ')[0],
       surname: op.name.split(' ')[1] || '',
       id_number: `ID-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
       job_title: `${op.name.split(' ')[1]} Operator`,
       status: 'Active',
       medical_expiry: new Date(Date.now() + 31536000000).toISOString().split('T')[0], // +1 year
       induction_expiry: new Date(Date.now() + 31536000000).toISOString().split('T')[0] // +1 year
    }, { onConflict: 'emp_code' });
    
    if (persError) {
       console.error(`   [Operators] Error creating personnel ${op.name}:`, persError.message);
    } else {
       console.log(`   [Operators] Successfully setup operator ${op.name} (${empCode})`);
    }
  }
}
