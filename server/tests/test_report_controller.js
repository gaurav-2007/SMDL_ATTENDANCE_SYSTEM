const { supabaseAdmin } = require('../src/config/db');
const { getSubjectStudentAttendanceReport } = require('../src/controllers/attendanceController');

async function testWithPooja() {
  const poojaUserId = '6ce48acb-b1ef-4eb2-a0bf-5447f88baa41';

  const mockRes = () => ({
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(payload) {
      console.log('Returned status:', this.statusCode, 'success:', payload.success);
      if (!payload.success) console.log('Payload:', payload);
    }
  });

  console.log('\n--- Test 1: No params (default) ---');
  try {
    const req = { user: { id: poojaUserId, role: 'teacher', status: 'ACTIVE' }, query: {} };
    await getSubjectStudentAttendanceReport(req, mockRes());
  } catch (e) {
    console.error('Test 1 threw error:', e);
  }

  // Let's get all subjects and test with each subject_id
  const { data: subs } = await supabaseAdmin.from('subjects').select('id, name');
  for (const s of subs || []) {
    console.log(`\n--- Test subject ${s.name} (${s.id}) ---`);
    try {
      const req = { user: { id: poojaUserId, role: 'teacher', status: 'ACTIVE' }, query: { subject_id: s.id } };
      await getSubjectStudentAttendanceReport(req, mockRes());
    } catch (e) {
      console.error(`Error for subject ${s.name}:`, e.message);
    }
  }
}

testWithPooja().catch(console.error);
