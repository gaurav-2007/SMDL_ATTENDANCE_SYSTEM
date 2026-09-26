const { supabaseAdmin } = require('../config/db');
const { hashPassword } = require('../utils/password');

const DEMO_TEACHERS = [
  {
    name: 'Arati Sawant',
    employee_id: 'TCH-1001',
    department: 'Computer Science',
    designation: 'Head of Department',
    email: 'arati.sawant@smdl.ac.in',
    phone: '9000000101',
    subjectCodes: ['DSA', 'DSA(P)', 'DBS(P)'],
  },
  {
    name: 'Pooja Chande',
    employee_id: 'TCH-1002',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'pooja.chande@smdl.ac.in',
    phone: '9000000102',
    subjectCodes: ['DBS', 'DBS(P)'],
  },
  {
    name: 'Joshila Chanu Soraisam',
    employee_id: 'TCH-1003',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'joshila.chanu@smdl.ac.in',
    phone: '9000000103',
    subjectCodes: ['PYN', 'PYN(P)'],
  },
  {
    name: 'Pooja Sawant',
    employee_id: 'TCH-1004',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'pooja.sawant@smdl.ac.in',
    phone: '9000000104',
    subjectCodes: ['LINUX', 'LINUX(P)'],
  },
  {
    name: 'Girish Kumbhar',
    employee_id: 'TCH-1005',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'girish.kumbhar@smdl.ac.in',
    phone: '9000000105',
    subjectCodes: ['IKS', 'CC', 'EVS'],
  },
  {
    name: 'Nilam Sonawane',
    employee_id: 'TCH-1006',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'nilam.sonawane@smdl.ac.in',
    phone: '9000000106',
    subjectCodes: ['OE-1'],
  },
  {
    name: 'Sabina Shaikh',
    employee_id: 'TCH-1007',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'sabina.shaikh@smdl.ac.in',
    phone: '9000000107',
    subjectCodes: ['OE-2'],
  },
  {
    name: 'Maithili Sawant',
    employee_id: 'TCH-1008',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'maithili.sawant@smdl.ac.in',
    phone: '9000000108',
    subjectCodes: ['AEC'],
  },
];

const FY_CS_SUBJECTS = [
  { code: 'DSA', name: 'Data Structures & Algorithms' },
  { code: 'DSA(P)', name: 'Data Structures & Algorithms (Lab)' },
  { code: 'DBS', name: 'Database Management Systems' },
  { code: 'DBS(P)', name: 'Database Management Systems (Lab)' },
  { code: 'PYN', name: 'Python Programming' },
  { code: 'PYN(P)', name: 'Python Programming (Lab)' },
  { code: 'LINUX', name: 'Linux Operating System' },
  { code: 'LINUX(P)', name: 'Linux Operating System (Lab)' },
  { code: 'IKS', name: 'Indian Knowledge Systems' },
  { code: 'CC', name: 'Co-Curricular / Value Education' },
  { code: 'EVS', name: 'Environmental Studies' },
  { code: 'OE-1', name: 'Open Elective 1 (OE-1)' },
  { code: 'OE-2', name: 'Open Elective 2 (OE-2)' },
  { code: 'AEC', name: 'Ability Enhancement Course (AEC)' },
];

async function seedTeachers() {
  const makeActive = process.argv.includes('--active') || process.argv.includes('--approve');
  const initialStatus = makeActive ? 'ACTIVE' : 'PENDING';

  console.log(`👨‍🏫 Seeding 8 Demo Teachers for SMDL College (Status: ${initialStatus})...\n`);

  try {
    // 1. Get FYBSc CS Division
    const { data: div } = await supabaseAdmin
      .from('divisions')
      .select('id, name')
      .eq('name', 'FYBSc CS')
      .maybeSingle();

    if (!div) {
      throw new Error('FYBSc CS division not found. Please run seed_academic.js first.');
    }
    console.log(`✅ FYBSc CS Division ID: ${div.id}`);

    // 2. Ensure FYBSc CS Subjects exist in DB
    const subjectMap = {};
    for (const s of FY_CS_SUBJECTS) {
      let { data: existing } = await supabaseAdmin
        .from('subjects')
        .select('id, code, name')
        .eq('division_id', div.id)
        .eq('code', s.code)
        .maybeSingle();

      if (!existing) {
        const { data: created, error } = await supabaseAdmin
          .from('subjects')
          .insert({
            name: s.name,
            code: s.code,
            division_id: div.id,
          })
          .select('id, code, name')
          .single();

        if (error) {
          console.error(`❌ Error creating subject ${s.code}:`, error.message);
          continue;
        }
        existing = created;
      }
      subjectMap[s.code] = existing;
    }
    console.log(`✅ Ensured ${Object.keys(subjectMap).length} subjects exist for FYBSc CS.`);

    // 3. Hash common demo password
    const passwordHash = await hashPassword('Teacher@123');

    // 4. Create/Upsert exactly 8 unique teachers
    const teacherRecords = [];

    for (const t of DEMO_TEACHERS) {
      // Find existing user by email
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, email, status')
        .eq('email', t.email.toLowerCase())
        .maybeSingle();

      let userId;

      if (existingUser) {
        userId = existingUser.id;
        await supabaseAdmin
          .from('users')
          .update({
            full_name: t.name,
            phone: t.phone,
            password_hash: passwordHash,
            role: 'teacher',
            status: initialStatus,
          })
          .eq('id', userId);
      } else {
        const { data: newUser, error: uErr } = await supabaseAdmin
          .from('users')
          .insert({
            email: t.email.toLowerCase(),
            full_name: t.name,
            phone: t.phone,
            password_hash: passwordHash,
            role: 'teacher',
            status: initialStatus,
          })
          .select('id')
          .single();

        if (uErr) {
          console.error(`❌ User error for ${t.name}:`, uErr.message);
          continue;
        }
        userId = newUser.id;
      }

      // Check existing teacher profile by teacher_id or user_id
      const { data: existingTeacher } = await supabaseAdmin
        .from('teachers')
        .select('id, teacher_id')
        .or(`user_id.eq.${userId},teacher_id.eq.${t.employee_id}`)
        .maybeSingle();

      let teacherId;

      if (existingTeacher) {
        teacherId = existingTeacher.id;
        await supabaseAdmin
          .from('teachers')
          .update({
            user_id: userId,
            teacher_id: t.employee_id,
            department: t.department,
            designation: t.designation,
            approved_at: makeActive ? new Date().toISOString() : null,
          })
          .eq('id', teacherId);
      } else {
        const { data: newTeacher, error: tErr } = await supabaseAdmin
          .from('teachers')
          .insert({
            user_id: userId,
            teacher_id: t.employee_id,
            department: t.department,
            designation: t.designation,
            approved_at: makeActive ? new Date().toISOString() : null,
            registration_submitted_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (tErr) {
          console.error(`❌ Teacher profile error for ${t.name}:`, tErr.message);
          continue;
        }
        teacherId = newTeacher.id;
      }

      teacherRecords.push({ teacherId, info: t });
      console.log(`✅ Teacher: ${t.name} (${t.employee_id} | ${t.department} | ${t.designation})`);
    }

    // 5. Relational Subject Assignments in teacher_subjects
    let assignmentCount = 0;
    for (const item of teacherRecords) {
      const { teacherId, info } = item;

      for (const code of info.subjectCodes) {
        const subject = subjectMap[code];
        if (!subject) continue;

        // Check if assignment exists
        const { data: existingMapping } = await supabaseAdmin
          .from('teacher_subjects')
          .select('id')
          .eq('teacher_id', teacherId)
          .eq('subject_id', subject.id)
          .maybeSingle();

        if (!existingMapping) {
          const { error } = await supabaseAdmin
            .from('teacher_subjects')
            .insert({
              teacher_id: teacherId,
              subject_id: subject.id,
            });

          if (!error) assignmentCount++;
        } else {
          assignmentCount++;
        }
      }
    }

    console.log(`\n🎉 Successfully configured 8 unique teachers with ${assignmentCount} timetable subject assignments!`);
    console.log(`Status of demo accounts: ${initialStatus}`);
    console.log('🔑 Common Demo Password: Teacher@123\n');

    // 6. Verification Summary
    const { data: allTeachers } = await supabaseAdmin
      .from('teachers')
      .select('teacher_id, department, designation, user_id');

    const { data: allUsers } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, status, phone');

    const userMap = new Map((allUsers || []).map((u) => [u.id, u]));

    console.table(
      (allTeachers || []).map((t) => {
        const u = userMap.get(t.user_id);
        return {
          'Emp ID': t.teacher_id,
          'Name': u?.full_name,
          'Department': t.department,
          'Designation': t.designation,
          'Email': u?.email,
          'Status': u?.status,
        };
      })
    );
  } catch (err) {
    console.error('❌ Error seeding demo teachers:', err.message);
    process.exitCode = 1;
  }
}

seedTeachers();
