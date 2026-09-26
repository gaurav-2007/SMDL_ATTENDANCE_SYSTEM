const { supabaseAdmin } = require('../config/db');

async function verifyAll() {
  console.log('🧪 Verifying Teacher Implementation Against Checklist...\n');
  const checks = [];

  // Check 1: Exactly 8 unique demo teachers exist
  const { data: teachers, error: tErr } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, department, designation, user_id');

  const countOk = teachers?.length === 8;
  checks.push({
    title: '1. Exactly 8 unique demo teachers exist',
    passed: countOk,
    detail: `Found ${teachers?.length || 0} teachers`,
  });

  // Check 2: All have Computer Science department
  const allCs = teachers?.every((t) => t.department === 'Computer Science');
  checks.push({
    title: '2. All have Computer Science department',
    passed: allCs,
    detail: allCs ? 'All 8 are Computer Science' : 'Some teachers have different department',
  });

  // Check 3: Employee IDs TCH-1001 through TCH-1008 exist
  const empIds = (teachers || []).map((t) => t.teacher_id).sort();
  const expectedEmpIds = [
    'TCH-1001', 'TCH-1002', 'TCH-1003', 'TCH-1004',
    'TCH-1005', 'TCH-1006', 'TCH-1007', 'TCH-1008',
  ];
  const empIdsOk = JSON.stringify(empIds) === JSON.stringify(expectedEmpIds);
  checks.push({
    title: '3. Employee IDs TCH-1001 through TCH-1008 exist',
    passed: empIdsOk,
    detail: empIds.join(', '),
  });

  // Check 4: Subject assignments match the timetable
  const { data: ts } = await supabaseAdmin
    .from('teacher_subjects')
    .select('teacher_id, subject:subjects(code, name)');

  const teacherMap = new Map();
  teachers?.forEach((t) => teacherMap.set(t.id, t.teacher_id));

  const empToSubjects = {};
  (ts || []).forEach((row) => {
    const emp = teacherMap.get(row.teacher_id);
    if (!emp) return;
    if (!empToSubjects[emp]) empToSubjects[emp] = [];
    empToSubjects[emp].push(row.subject?.code);
  });

  const expectedMappings = {
    'TCH-1001': ['DSA', 'DSA(P)', 'DBS(P)'],
    'TCH-1002': ['DBS', 'DBS(P)'],
    'TCH-1003': ['PYN', 'PYN(P)'],
    'TCH-1004': ['LINUX', 'LINUX(P)'],
    'TCH-1005': ['IKS', 'CC', 'EVS'],
    'TCH-1006': ['OE-1'],
    'TCH-1007': ['OE-2'],
    'TCH-1008': ['AEC'],
  };

  let subjectsOk = true;
  for (const [emp, subs] of Object.entries(expectedMappings)) {
    const assigned = empToSubjects[emp] || [];
    const missing = subs.filter((s) => !assigned.includes(s));
    if (missing.length > 0) {
      subjectsOk = false;
      console.warn(`  ⚠️ Missing mapping for ${emp}: ${missing.join(', ')}`);
    }
  }

  checks.push({
    title: '4. Subject assignments match timetable',
    passed: subjectsOk,
    detail: Object.entries(empToSubjects)
      .map(([k, v]) => `${k} -> [${v.join(', ')}]`)
      .join(' | '),
  });

  // Check 5: No duplicate teachers
  const idSet = new Set((teachers || []).map((t) => t.teacher_id));
  const noDuplicates = idSet.size === teachers?.length;
  checks.push({
    title: '5. No duplicate teachers created',
    passed: noDuplicates,
    detail: `${idSet.size} unique IDs across ${teachers?.length} rows`,
  });

  // Check 6: All demo teacher accounts are initially PENDING
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, status')
    .eq('role', 'teacher');

  const allPending = users?.every((u) => u.status === 'PENDING');
  checks.push({
    title: '6. All demo teacher accounts are initially PENDING',
    passed: allPending,
    detail: `Users pending: ${users?.filter((u) => u.status === 'PENDING').length}/${users?.length}`,
  });

  // Check 7: Backend authorization prevents PENDING teachers from using teacher functionality
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'TCH-1001', password: 'Teacher@123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.token;

  let authBlocked = false;
  if (token) {
    const testRes = await fetch('http://localhost:5000/api/lectures', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ topic: 'Test Unauthorized' }),
    });
    authBlocked = testRes.status === 403;
  }

  checks.push({
    title: '7. Backend authorization blocks PENDING teachers from teacher actions',
    passed: authBlocked,
    detail: authBlocked ? 'Returned 403 Forbidden as expected' : 'Failed to block',
  });

  console.log('\n================ VERIFICATION REPORT ================');
  checks.forEach((c) => {
    console.log(`${c.passed ? '✅' : '❌'} ${c.title}`);
    console.log(`   └─ ${c.detail}`);
  });
  console.log('=====================================================\n');

  const allPassed = checks.every((c) => c.passed);
  if (allPassed) {
    console.log('🎉 ALL 7 VERIFICATION CRITERIA PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME CHECKS FAILED');
    process.exitCode = 1;
  }
}

verifyAll();
