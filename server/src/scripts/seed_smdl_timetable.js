const { supabaseAdmin } = require('../config/db');
const { hashPassword } = require('../utils/password');

const FACULTY_LIST = [
  {
    name: 'Arati Sawant',
    email: 'arati.sawant@smdl.ac.in',
    teacher_id: 'TCH-CS-001',
    department: 'Computer Science',
    designation: 'Head of Department',
  },
  {
    name: 'Pooja Chande',
    email: 'pooja.chande@smdl.ac.in',
    teacher_id: 'TCH-CS-002',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  },
  {
    name: 'Joshila Chanu Soraisam',
    email: 'joshila.chanu@smdl.ac.in',
    teacher_id: 'TCH-CS-003',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  },
  {
    name: 'Pooja Sawant',
    email: 'pooja.sawant@smdl.ac.in',
    teacher_id: 'TCH-CS-004',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  },
  {
    name: 'Girish Kumbhar',
    email: 'girish.kumbhar@smdl.ac.in',
    teacher_id: 'TCH-CS-005',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  },
  {
    name: 'Nilam Sonawane',
    email: 'nilam.sonawane@smdl.ac.in',
    teacher_id: 'TCH-CS-006',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  },
  {
    name: 'Sabina Shaikh',
    email: 'sabina.shaikh@smdl.ac.in',
    teacher_id: 'TCH-CS-007',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  },
  {
    name: 'Maithili Sawant',
    email: 'maithili.sawant@smdl.ac.in',
    teacher_id: 'TCH-CS-008',
    department: 'Computer Science',
    designation: 'Assistant Professor',
  },
];

const NEP_SUBJECTS = [
  { code: 'IKS', name: 'Indian Knowledge Systems', type: 'Theory', teachers: ['Girish Kumbhar'] },
  { code: 'DSA', name: 'Data Structures & Algorithms', type: 'Theory', teachers: ['Arati Sawant'] },
  { code: 'DSA(P)', name: 'Data Structures & Algorithms (Lab)', type: 'Practical', teachers: ['Arati Sawant', 'Pooja Chande'] },
  { code: 'DBS', name: 'Database Management Systems', type: 'Theory', teachers: ['Pooja Chande'] },
  { code: 'DBS(P)', name: 'Database Management Systems (Lab)', type: 'Practical', teachers: ['Arati Sawant', 'Pooja Chande'] },
  { code: 'PYN', name: 'Python Programming', type: 'Theory', teachers: ['Joshila Chanu Soraisam'] },
  { code: 'PYN(P)', name: 'Python Programming (Lab)', type: 'Practical', teachers: ['Joshila Chanu Soraisam'] },
  { code: 'LINUX', name: 'Linux Operating System', type: 'Theory', teachers: ['Pooja Sawant'] },
  { code: 'LINUX(P)', name: 'Linux Operating System (Lab)', type: 'Practical', teachers: ['Pooja Sawant'] },
  { code: 'OE-1', name: 'Open Elective 1 (OE-1)', type: 'Elective', teachers: ['Nilam Sonawane'] },
  { code: 'OE-2', name: 'Open Elective 2 (OE-2)', type: 'Elective', teachers: ['Sabina Shaikh'] },
  { code: 'AEC', name: 'Ability Enhancement Course (AEC)', type: 'Theory', teachers: ['Maithili Sawant'] },
  { code: 'EVS', name: 'Environmental Studies', type: 'Theory', teachers: ['Girish Kumbhar'] },
  { code: 'CC', name: 'Co-Curricular / Value Education', type: 'Activity', teachers: ['Girish Kumbhar'] },
];

async function seedSMDLTimetable() {
  console.log('🚀 Seeding SMDL College Timetable Data...');

  // 1. Find FYBSc CS division
  const { data: divisions } = await supabaseAdmin
    .from('divisions')
    .select('id, name, division_name, courses(name, code)')
    .eq('name', 'FYBSc CS');

  let fyCsDiv = divisions?.[0];
  if (!fyCsDiv) {
    console.error('❌ Could not find FYBSc CS division. Aborting.');
    return;
  }
  console.log(`✅ FYBSc CS Division ID: ${fyCsDiv.id}`);

  // 2. Upsert Teachers & Users
  const defaultPasswordHash = await hashPassword('Password@123');
  const teacherNameToRecord = {};

  for (const f of FACULTY_LIST) {
    // Check if user exists
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('email', f.email)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error: uErr } = await supabaseAdmin
        .from('users')
        .insert({
          email: f.email,
          full_name: f.name,
          role: 'teacher',
          status: 'ACTIVE',
          password_hash: defaultPasswordHash,
        })
        .select()
        .single();

      if (uErr) {
        console.error(`❌ Error creating user for ${f.name}:`, uErr.message);
        continue;
      }
      user = newUser;
      console.log(` Created user: ${f.name} (${f.email})`);
    } else {
      // Ensure active
      await supabaseAdmin.from('users').update({ status: 'ACTIVE' }).eq('id', user.id);
    }

    // Check teacher profile
    let { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('id, teacher_id, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!teacher) {
      const { data: newTeacher, error: tErr } = await supabaseAdmin
        .from('teachers')
        .insert({
          user_id: user.id,
          teacher_id: f.teacher_id,
          department: f.department,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (tErr) {
        console.error(`❌ Error creating teacher profile for ${f.name}:`, tErr.message);
        continue;
      }
      teacher = newTeacher;
      console.log(` Created teacher profile: ${f.name} (ID: ${f.teacher_id})`);
    }

    teacherNameToRecord[f.name] = { user, teacher };
  }

  // Also include currently active existing teachers (e.g. gaurav, maurya, tripati)
  const { data: existingActiveTeachers } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, user_id, users(id, full_name, email, status)')
    .eq('users.status', 'ACTIVE');

  console.log(`✅ Loaded ${Object.keys(teacherNameToRecord).length} SMDL faculty members.`);

  // 3. Upsert NEP Subjects for FYBSc CS
  const subjectMap = {};
  for (const s of NEP_SUBJECTS) {
    let { data: subj } = await supabaseAdmin
      .from('subjects')
      .select('id, name, code, division_id')
      .eq('division_id', fyCsDiv.id)
      .eq('code', s.code)
      .maybeSingle();

    if (!subj) {
      const { data: newSubj, error: sErr } = await supabaseAdmin
        .from('subjects')
        .insert({
          name: s.name,
          code: s.code,
          division_id: fyCsDiv.id,
        })
        .select()
        .single();

      if (sErr) {
        console.error(`❌ Error inserting subject ${s.code}:`, sErr.message);
        continue;
      }
      subj = newSubj;
      console.log(` Created subject: ${s.code} - ${s.name}`);
    } else {
      // update name if needed
      await supabaseAdmin.from('subjects').update({ name: s.name }).eq('id', subj.id);
    }
    subjectMap[s.code] = subj;
  }

  // 4. Link teachers in teacher_subjects
  let linksCount = 0;
  for (const s of NEP_SUBJECTS) {
    const subj = subjectMap[s.code];
    if (!subj) continue;

    for (const tName of s.teachers) {
      const tRec = teacherNameToRecord[tName];
      if (tRec?.teacher?.id) {
        await supabaseAdmin
          .from('teacher_subjects')
          .upsert(
            { teacher_id: tRec.teacher.id, subject_id: subj.id },
            { onConflict: 'teacher_id,subject_id' }
          );
        linksCount++;
      }
    }
  }

  // Link existing demo teachers to key subjects so they also have classes assigned
  if (existingActiveTeachers && existingActiveTeachers.length > 0) {
    const dsaSubj = subjectMap['DSA'];
    const pynSubj = subjectMap['PYN'];
    const linuxSubj = subjectMap['LINUX'];
    for (const eat of existingActiveTeachers) {
      if (eat.users?.email?.includes('gmail.com')) {
        if (dsaSubj) {
          await supabaseAdmin.from('teacher_subjects').upsert(
            { teacher_id: eat.id, subject_id: dsaSubj.id },
            { onConflict: 'teacher_id,subject_id' }
          );
        }
        if (pynSubj) {
          await supabaseAdmin.from('teacher_subjects').upsert(
            { teacher_id: eat.id, subject_id: pynSubj.id },
            { onConflict: 'teacher_id,subject_id' }
          );
        }
        if (linuxSubj) {
          await supabaseAdmin.from('teacher_subjects').upsert(
            { teacher_id: eat.id, subject_id: linuxSubj.id },
            { onConflict: 'teacher_id,subject_id' }
          );
        }
        console.log(` Attached subjects to demo teacher: ${eat.users?.full_name} (${eat.users?.email})`);
      }
    }
  }

  console.log(`✅ Linked ${linksCount} subject-teacher allocations.`);
  console.log('🎉 SMDL Timetable Seeding Finished Successfully!\n');
}

seedSMDLTimetable().catch(console.error);
