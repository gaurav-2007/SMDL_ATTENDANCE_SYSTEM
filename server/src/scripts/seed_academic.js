const { supabaseAdmin } = require('../config/db');

const YEAR_LABELS = {
  'BSC-IT': ['FYBSc IT', 'SYBSc IT', 'TYBSc IT'],
  'BSC-CS': ['FYBSc CS', 'SYBSc CS', 'TYBSc CS'],
  'BCOM':   ['FYBCom',   'SYBCom',   'TYBCom'],
};

const SUBJECTS_BY_YEAR = {
  'FYBSc IT': [
    { name: 'Programming Principles & Python',  code: 'USIT101' },
    { name: 'Digital Electronics & Architecture', code: 'USIT102' },
    { name: 'Discrete Mathematics',             code: 'USIT103' },
    { name: 'Technical Communication Skills',   code: 'USIT104' },
  ],
  'SYBSc IT': [
    { name: 'Object Oriented Programming (C++)', code: 'USIT201' },
    { name: 'Data Structures & Algorithms',      code: 'USIT202' },
    { name: 'Database Management Systems',       code: 'USIT203' },
    { name: 'Operating Systems Concepts',        code: 'USIT204' },
  ],
  'TYBSc IT': [
    { name: 'Machine Learning & AI',            code: 'USIT301' },
    { name: 'Cloud Computing & DevOps',         code: 'USIT302' },
    { name: 'Cyber Security Fundamentals',      code: 'USIT303' },
    { name: 'Software Engineering Project',     code: 'USIT304' },
  ],
  'FYBSc CS': [
    { name: 'Fundamentals of Computer Science', code: 'USCS101' },
    { name: 'C Programming Basics',             code: 'USCS102' },
    { name: 'Mathematics for CS',               code: 'USCS103' },
    { name: 'Communication Skills',             code: 'USCS104' },
  ],
  'SYBSc CS': [
    { name: 'Data Structures Using C',         code: 'USCS201' },
    { name: 'Computer Organization & Architecture', code: 'USCS202' },
    { name: 'Discrete Structures',             code: 'USCS203' },
    { name: 'Object Oriented Programming Java', code: 'USCS204' },
  ],
  'TYBSc CS': [
    { name: 'Theory of Computation',           code: 'USCS301' },
    { name: 'Compiler Design',                 code: 'USCS302' },
    { name: 'Computer Networks',               code: 'USCS303' },
    { name: 'Artificial Intelligence',         code: 'USCS304' },
  ],
  'FYBCom': [
    { name: 'Financial Accounting',            code: 'UCOM101' },
    { name: 'Business Economics',              code: 'UCOM102' },
    { name: 'Business Communication',          code: 'UCOM103' },
    { name: 'Mathematical & Statistical Techniques', code: 'UCOM104' },
  ],
  'SYBCom': [
    { name: 'Corporate Accounting',            code: 'UCOM201' },
    { name: 'Business Law',                    code: 'UCOM202' },
    { name: 'Cost Accounting',                 code: 'UCOM203' },
    { name: 'Auditing Principles',             code: 'UCOM204' },
  ],
  'TYBCom': [
    { name: 'Management Accounting',           code: 'UCOM301' },
    { name: 'Direct & Indirect Taxation',      code: 'UCOM302' },
    { name: 'Financial Management',            code: 'UCOM303' },
    { name: 'Marketing Management',            code: 'UCOM304' },
  ],
};

async function seed() {
  console.log('🌱 Starting Academic Data Seeding for SMDL College...\n');
  const errors = [];

  try {
    // ──────────────────────────────────────────────────────────
    // 1. Courses
    // ──────────────────────────────────────────────────────────
    const coursesData = [
      { name: 'B.Sc. Information Technology', code: 'BSC-IT', duration_years: 3 },
      { name: 'B.Sc. Computer Science',       code: 'BSC-CS', duration_years: 3 },
      { name: 'Bachelor of Commerce',          code: 'BCOM',   duration_years: 3 },
    ];
    const courses = [];
    for (const c of coursesData) {
      const { data, error } = await supabaseAdmin
        .from('courses')
        .upsert(c, { onConflict: 'code' })
        .select()
        .single();
      if (error) { console.error('  ❌ Course error:', error.message); errors.push(error); }
      else courses.push(data);
    }
    console.log(`✅ Step 1: Upserted ${courses.length} courses.`);

    // ──────────────────────────────────────────────────────────
    // 2. Divisions — 3 years × Div A — for EACH of the 3 courses
    // ──────────────────────────────────────────────────────────
    const divisionsData = [];
    courses.forEach(course => {
      const labels = YEAR_LABELS[course.code] || [];
      labels.forEach(yearName => {
        divisionsData.push({ course_id: course.id, name: yearName, division_name: 'A' });
      });
    });
    const divisions = [];
    for (const d of divisionsData) {
      const { data, error } = await supabaseAdmin
        .from('divisions')
        .upsert(d, { onConflict: 'course_id,name,division_name' })
        .select()
        .single();
      if (error) { console.error('  ❌ Division error:', error.message); errors.push(error); }
      else divisions.push(data);
    }
    console.log(`✅ Step 2: Upserted ${divisions.length} divisions (${courses.length} courses × 3 years × Div A).`);

    // ──────────────────────────────────────────────────────────
    // 3. Subjects — per division/year
    // ──────────────────────────────────────────────────────────
    const subjects = [];
    for (const div of divisions) {
      const subjectList = SUBJECTS_BY_YEAR[div.name] || [];
      for (const s of subjectList) {
        const { data, error } = await supabaseAdmin
          .from('subjects')
          .upsert(
            { name: s.name, code: s.code, division_id: div.id },
            { onConflict: 'code' }
          )
          .select()
          .single();
        if (error) { /* ignore code conflicts (same code shared rare) */ }
        else subjects.push(data);
      }
    }
    console.log(`✅ Step 3: Upserted ${subjects.length} subjects across ${divisions.length} divisions.`);

    // ──────────────────────────────────────────────────────────
    // 4. Link subjects to an active teacher
    // ──────────────────────────────────────────────────────────
    const { data: teachers } = await supabaseAdmin
      .from('teachers')
      .select('id, teacher_id, user_id, department, users(full_name, status)')
      .limit(5);

    let activeTeacher = teachers?.find(t => t.users?.status === 'ACTIVE') || teachers?.[0];
    let teacherAssignedCount = 0;
    if (activeTeacher && subjects.length > 0) {
      const fyItDiv = divisions.find(d => d.name === 'FYBSc IT');
      const targetSubjects = fyItDiv
        ? subjects.filter(s => {
            const fyCodes = SUBJECTS_BY_YEAR['FYBSc IT'].map(x => x.code);
            return fyCodes.includes(subjects.find(s2 => s2.id === s.id)?.code);
          })
        : subjects.slice(0, 4);
      const subsToAssign = fyItDiv
        ? subjects.filter(s => s.division_id === fyItDiv.id)
        : subjects.slice(0, 4);
      for (const subj of subsToAssign) {
        const { error } = await supabaseAdmin
          .from('teacher_subjects')
          .upsert(
            { teacher_id: activeTeacher.id, subject_id: subj.id },
            { onConflict: 'teacher_id,subject_id' }
          );
        if (!error) teacherAssignedCount++;
      }
      console.log(`✅ Step 4: Assigned ${teacherAssignedCount} FYBSc IT subjects to Teacher ${activeTeacher.teacher_id || '(new)'}.`);
    } else {
      console.log(`ℹ️  Step 4: No active teacher found — skipping subject assignment.`);
    }

    // ──────────────────────────────────────────────────────────
    // 5. Link students to FYBSc IT Division (default class)
    // ──────────────────────────────────────────────────────────
    const itCourse = courses.find(c => c.code === 'BSC-IT');
    const fyDivision = divisions.find(d => d.name === 'FYBSc IT');

    const { data: students } = await supabaseAdmin.from('students').select('id, user_id');
    let linkedCount = 0;
    if (students && students.length > 0 && itCourse && fyDivision) {
      for (const st of students) {
        const { error } = await supabaseAdmin
          .from('students')
          .update({ course_id: itCourse.id, division_id: fyDivision.id })
          .eq('id', st.id);
        if (!error) linkedCount++;
      }
      console.log(`✅ Step 5: Linked ${linkedCount}/${students.length} students to FYBSc IT Division.`);
    } else {
      console.log(`ℹ️  Step 5: No students OR FYBSc IT division — skipping linking.`);
    }

    // ──────────────────────────────────────────────────────────
    // 6. Ensure at least 1 lecture exists for TODAY (FYBSc IT)
    // ──────────────────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: existingLecture } = await supabaseAdmin
      .from('lectures')
      .select('id')
      .eq('lecture_date', todayStr)
      .limit(1);

    if (!existingLecture || existingLecture.length === 0) {
      const firstFyItSubject = subjects.find(s => s.division_id === fyDivision?.id);
      if (activeTeacher && firstFyItSubject && fyDivision) {
        const { data: newLecture, error: lecErr } = await supabaseAdmin
          .from('lectures')
          .insert({
            subject_id: firstFyItSubject.id,
            teacher_id: activeTeacher.id,
            division_id: fyDivision.id,
            lecture_date: todayStr,
            start_time: '08:00:00',
            end_time: '23:59:59',
            topic: 'Introduction to Python & Variables — Demo Lecture',
            created_by: activeTeacher.user_id,
          })
          .select()
          .single();
        if (lecErr) { console.error('  ❌ Lecture error:', lecErr.message); errors.push(lecErr); }
        else console.log(`✅ Step 6: Created today's active lecture (ID: ${newLecture.id}) on ${todayStr}.`);
      } else {
        console.log(`ℹ️  Step 6: Missing teacher/subject — no demo lecture created.`);
      }
    } else {
      console.log(`ℹ️  Step 6: Today's lecture already exists (${existingLecture.length} found).`);
    }

    // ──────────────────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────────────────
    console.log('\n────────── Seed Summary ──────────');
    console.log(`  Courses    : ${courses.length}`);
    console.log(`  Divisions  : ${divisions.length}`);
    console.log(`  Subjects   : ${subjects.length}`);
    console.log(`  Students   : ${students?.length || 0} (linked ${linkedCount})`);
    console.log(`  Teachers   : ${teachers?.length || 0} (assigned ${teacherAssignedCount} subjects)`);
    if (errors.length) console.log(`  ⚠️  Errors  : ${errors.length}`);
    console.log('───────────────────────────────────');

    if (errors.length === 0) {
      console.log('\n🎉 Academic Seeding completed successfully!');
    } else {
      console.log(`\n✅ Seeding finished with ${errors.length} non-fatal issue(s).`);
    }
  } catch (err) {
    console.error('\n❌ Fatal Seeding Error:', err.message);
    process.exitCode = 1;
  }
}

seed();
