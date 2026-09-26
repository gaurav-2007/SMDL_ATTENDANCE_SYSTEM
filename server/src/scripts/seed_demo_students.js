const { supabaseAdmin } = require('../config/db');
const { hashPassword } = require('../utils/password');

const DEMO_STUDENTS = [
  // BSC-CS (6 students)
  { name: 'Aarav Sharma', dept: 'BSC-CS', roll: 'CS-2026-001', divName: 'FYBSc CS', email: 'aarav.sharma@smdl.ac.in', mobile: '9000000001' },
  { name: 'Rohan Patil',  dept: 'BSC-CS', roll: 'CS-2026-002', divName: 'FYBSc CS', email: 'rohan.patil@smdl.ac.in',  mobile: '9000000002' },
  { name: 'Aditya More',  dept: 'BSC-CS', roll: 'CS-2026-003', divName: 'FYBSc CS', email: 'aditya.more@smdl.ac.in',  mobile: '9000000003' },
  { name: 'Rahul Yadav',  dept: 'BSC-CS', roll: 'CS-2026-004', divName: 'FYBSc CS', email: 'rahul.yadav@smdl.ac.in',  mobile: '9000000004' },
  { name: 'Akash Gupta',  dept: 'BSC-CS', roll: 'CS-2026-005', divName: 'FYBSc CS', email: 'akash.gupta@smdl.ac.in',  mobile: '9000000005' },
  { name: 'Kunal Jadhav', dept: 'BSC-CS', roll: 'CS-2026-006', divName: 'FYBSc CS', email: 'kunal.jadhav@smdl.ac.in', mobile: '9000000006' },

  // BSC-IT (6 students)
  { name: 'Atharva Joshi', dept: 'BSC-IT', roll: 'IT-2026-001', divName: 'FYBSc IT', email: 'atharva.joshi@smdl.ac.in', mobile: '9000000007' },
  { name: 'Omkar Shinde',  dept: 'BSC-IT', roll: 'IT-2026-002', divName: 'FYBSc IT', email: 'omkar.shinde@smdl.ac.in',  mobile: '9000000008' },
  { name: 'Yash Kulkarni', dept: 'BSC-IT', roll: 'IT-2026-003', divName: 'FYBSc IT', email: 'yash.kulkarni@smdl.ac.in', mobile: '9000000009' },
  { name: 'Harsh Verma',   dept: 'BSC-IT', roll: 'IT-2026-004', divName: 'FYBSc IT', email: 'harsh.verma@smdl.ac.in',   mobile: '9000000010' },
  { name: 'Vedant Pawar',  dept: 'BSC-IT', roll: 'IT-2026-005', divName: 'FYBSc IT', email: 'vedant.pawar@smdl.ac.in',  mobile: '9000000011' },
  { name: 'Sagar Chavan',  dept: 'BSC-IT', roll: 'IT-2026-006', divName: 'FYBSc IT', email: 'sagar.chavan@smdl.ac.in',  mobile: '9000000012' },

  // BCOM (6 students)
  { name: 'Neha Patil',    dept: 'BCOM', roll: 'BCOM-2026-001', divName: 'FYBCom', email: 'neha.patil@smdl.ac.in',    mobile: '9000000013' },
  { name: 'Priya Sharma',  dept: 'BCOM', roll: 'BCOM-2026-002', divName: 'FYBCom', email: 'priya.sharma@smdl.ac.in',  mobile: '9000000014' },
  { name: 'Sneha More',    dept: 'BCOM', roll: 'BCOM-2026-003', divName: 'FYBCom', email: 'sneha.more@smdl.ac.in',    mobile: '9000000015' },
  { name: 'Pooja Yadav',   dept: 'BCOM', roll: 'BCOM-2026-004', divName: 'FYBCom', email: 'pooja.yadav@smdl.ac.in',   mobile: '9000000016' },
  { name: 'Anjali Gupta',  dept: 'BCOM', roll: 'BCOM-2026-005', divName: 'FYBCom', email: 'anjali.gupta@smdl.ac.in',  mobile: '9000000017' },
  { name: 'Sakshi Jadhav', dept: 'BCOM', roll: 'BCOM-2026-006', divName: 'FYBCom', email: 'sakshi.jadhav@smdl.ac.in', mobile: '9000000018' },
];

async function seedStudents() {
  console.log('🌱 Starting upload of 18 Demo Students for SMDL College...\n');

  try {
    // 1. Fetch all courses
    const { data: courses, error: cErr } = await supabaseAdmin.from('courses').select('id, code, name');
    if (cErr || !courses?.length) throw new Error(`Could not fetch courses: ${cErr?.message || 'Empty'}`);

    const courseMap = {};
    courses.forEach(c => { courseMap[c.code] = c; });

    // 2. Fetch all divisions
    const { data: divisions, error: dErr } = await supabaseAdmin.from('divisions').select('id, name, division_name, course_id');
    if (dErr || !divisions?.length) throw new Error(`Could not fetch divisions: ${dErr?.message || 'Empty'}`);

    const divMap = {};
    divisions.forEach(d => { divMap[d.name] = d; });

    // 3. Hash common demo password
    const passwordHash = await hashPassword('Student@123');

    let insertedCount = 0;

    for (const item of DEMO_STUDENTS) {
      const course = courseMap[item.dept];
      const division = divMap[item.divName];

      if (!course) {
        console.error(`❌ Course not found for code: ${item.dept}`);
        continue;
      }
      if (!division) {
        console.error(`❌ Division not found for name: ${item.divName}`);
        continue;
      }

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', item.email.toLowerCase())
        .maybeSingle();

      let userId;

      if (existingUser) {
        userId = existingUser.id;
        await supabaseAdmin
          .from('users')
          .update({
            full_name: item.name,
            phone: item.mobile,
            password_hash: passwordHash,
            status: 'ACTIVE',
            role: 'student',
          })
          .eq('id', userId);
      } else {
        const { data: newUser, error: uErr } = await supabaseAdmin
          .from('users')
          .insert({
            email: item.email.toLowerCase(),
            full_name: item.name,
            phone: item.mobile,
            password_hash: passwordHash,
            status: 'ACTIVE',
            role: 'student',
          })
          .select('id')
          .single();

        if (uErr) {
          console.error(`❌ Failed to create user for ${item.name}:`, uErr.message);
          continue;
        }
        userId = newUser.id;
      }

      // Upsert into students table
      const { data: existingStudent } = await supabaseAdmin
        .from('students')
        .select('id')
        .or(`user_id.eq.${userId},student_id.eq.${item.roll}`)
        .maybeSingle();

      if (existingStudent) {
        const { error: sUpdateErr } = await supabaseAdmin
          .from('students')
          .update({
            user_id: userId,
            student_id: item.roll,
            course_id: course.id,
            division_id: division.id,
          })
          .eq('id', existingStudent.id);

        if (sUpdateErr) {
          console.error(`❌ Failed to update student record for ${item.name}:`, sUpdateErr.message);
        } else {
          insertedCount++;
          console.log(`✅ [${insertedCount}/18] Updated: ${item.name} (${item.roll} | ${item.dept} | Div ${division.division_name})`);
        }
      } else {
        const { error: sInsertErr } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: userId,
            student_id: item.roll,
            course_id: course.id,
            division_id: division.id,
          });

        if (sInsertErr) {
          console.error(`❌ Failed to insert student record for ${item.name}:`, sInsertErr.message);
        } else {
          insertedCount++;
          console.log(`✅ [${insertedCount}/18] Inserted: ${item.name} (${item.roll} | ${item.dept} | Div ${division.division_name})`);
        }
      }
    }

    console.log(`\n🎉 Successfully uploaded ${insertedCount}/${DEMO_STUDENTS.length} students into the database!`);
    console.log('🔑 Common Demo Password: Student@123\n');

    // Display summary table
    const { data: studentsList } = await supabaseAdmin
      .from('students')
      .select('student_id, course_id, division_id, users(full_name, email, phone)');

    console.table(studentsList.map(s => ({
      'Roll No': s.student_id,
      'Name': s.users?.full_name,
      'Email': s.users?.email,
      'Phone': s.users?.phone,
    })));

  } catch (err) {
    console.error('❌ Error uploading demo students:', err.message);
    process.exitCode = 1;
  }
}

seedStudents();
