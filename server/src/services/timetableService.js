const { supabaseAdmin } = require('../config/db');

// Official SMDL College Timetable Definition for F.Y.BSc (Computer Science) - NEP SEM-I
const SMDL_TIMETABLE_MATRIX = {
  college: "SES's Shikshan Maharshi Dadasaheb Limaye Arts, Commerce & Science College, Kalamboli",
  department: 'Department of Computer Science',
  academic_year: '2026-27',
  class_name: 'F.Y.BSc (Computer Science) - NEP SEM-I',
  division_name: 'FYBSc CS',
  time_slots: [
    { slot_id: 1, label: '08:00 AM - 09:00 AM', start_time: '08:00:00', end_time: '09:00:00' },
    { slot_id: 2, label: '09:00 AM - 10:00 AM', start_time: '09:00:00', end_time: '10:00:00' },
    { slot_id: 3, label: '10:00 AM - 11:00 AM', start_time: '10:00:00', end_time: '11:00:00' },
    { slot_id: 4, label: '11:00 AM - 11:30 AM', start_time: '11:00:00', end_time: '11:30:00', is_recess: true },
    { slot_id: 5, label: '11:30 AM - 12:30 PM', start_time: '11:30:00', end_time: '12:30:00' },
    { slot_id: 6, label: '12:30 PM - 01:30 PM', start_time: '12:30:00', end_time: '13:30:00' },
  ],
  weekly_schedule: {
    Monday: [
      { slot_id: 1, code: 'IKS', name: 'Indian Knowledge Systems', teacher: 'Girish Kumbhar', type: 'Theory' },
      { slot_id: 2, code: 'PYN(P)', name: 'Python Programming (Lab)', teacher: 'Joshila Chanu Soraisam', type: 'Practical' },
      { slot_id: 3, code: 'PYN', name: 'Python Programming', teacher: 'Joshila Chanu Soraisam', type: 'Theory' },
      { slot_id: 5, code: 'LINUX', name: 'Linux Operating System', teacher: 'Pooja Sawant', type: 'Theory' },
      { slot_id: 6, code: 'EVS', name: 'Environmental Studies', teacher: 'Girish Kumbhar', type: 'Theory' },
    ],
    Tuesday: [
      { slot_id: 1, code: 'IKS', name: 'Indian Knowledge Systems', teacher: 'Girish Kumbhar', type: 'Theory' },
      { slot_id: 2, code: 'DSA', name: 'Data Structures & Algorithms', teacher: 'Arati Sawant', type: 'Theory' },
      { slot_id: 3, code: 'LINUX', name: 'Linux Operating System', teacher: 'Pooja Sawant', type: 'Theory' },
      { slot_id: 5, code: 'DBS', name: 'Database Management Systems', teacher: 'Pooja Chande', type: 'Theory' },
      { slot_id: 6, code: 'OE-2', name: 'Open Elective 2', teacher: 'Sabina Shaikh', type: 'Elective' },
    ],
    Wednesday: [
      { slot_id: 1, code: 'DSA(P)', name: 'Data Structures & Algorithms (Lab)', teacher: 'Arati Sawant', co_teacher: 'Pooja Chande', type: 'Practical' },
      { slot_id: 2, code: 'DBS(P)', name: 'Database Management Systems (Lab)', teacher: 'Pooja Chande', co_teacher: 'Arati Sawant', type: 'Practical' },
      { slot_id: 3, code: 'AEC', name: 'Ability Enhancement Course', teacher: 'Maithili Sawant', type: 'Theory' },
      { slot_id: 5, code: 'OE-2', name: 'Open Elective 2', teacher: 'Sabina Shaikh', type: 'Elective' },
      { slot_id: 6, code: 'CC', name: 'Co-Curricular / Value Education', teacher: 'Girish Kumbhar', type: 'Activity' },
    ],
    Thursday: [
      { slot_id: 1, code: 'DSA(P)', name: 'Data Structures & Algorithms (Lab)', teacher: 'Arati Sawant', co_teacher: 'Pooja Chande', type: 'Practical' },
      { slot_id: 2, code: 'DBS', name: 'Database Management Systems', teacher: 'Pooja Chande', type: 'Theory' },
      { slot_id: 3, code: 'PYN', name: 'Python Programming', teacher: 'Joshila Chanu Soraisam', type: 'Theory' },
      { slot_id: 5, code: 'DBS(P)', name: 'Database Management Systems (Lab)', teacher: 'Pooja Chande', co_teacher: 'Arati Sawant', type: 'Practical' },
      { slot_id: 6, code: 'DSA', name: 'Data Structures & Algorithms', teacher: 'Arati Sawant', type: 'Theory' },
    ],
    Friday: [
      { slot_id: 1, code: 'AEC', name: 'Ability Enhancement Course', teacher: 'Maithili Sawant', type: 'Theory' },
      { slot_id: 2, code: 'LINUX(P)', name: 'Linux Operating System (Lab)', teacher: 'Pooja Sawant', type: 'Practical' },
      { slot_id: 3, code: 'EVS', name: 'Environmental Studies', teacher: 'Girish Kumbhar', type: 'Theory' },
      { slot_id: 5, code: 'OE-1', name: 'Open Elective 1', teacher: 'Nilam Sonawane', type: 'Elective' },
    ],
    Saturday: [
      { slot_id: 1, code: 'PYN(P)', name: 'Python Programming (Lab)', teacher: 'Joshila Chanu Soraisam', type: 'Practical' },
      { slot_id: 2, code: 'LINUX(P)', name: 'Linux Operating System (Lab)', teacher: 'Pooja Sawant', type: 'Practical' },
      { slot_id: 3, code: 'CC', name: 'Co-Curricular / Value Education', teacher: 'Girish Kumbhar', type: 'Activity' },
      { slot_id: 5, code: 'OE-1', name: 'Open Elective 1', teacher: 'Nilam Sonawane', type: 'Elective' },
    ],
    Sunday: [],
  },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let academicCache = null;
let cacheTime = 0;

async function getAcademicEntities() {
  const now = Date.now();
  if (academicCache && now - cacheTime < 60000) {
    return academicCache;
  }

  // Get FYBSc CS division
  const { data: divisions } = await supabaseAdmin
    .from('divisions')
    .select('id, name, division_name')
    .eq('name', 'FYBSc CS');
  const division = divisions?.[0] || null;

  // Get FYBSc CS subjects
  const { data: subjects } = await supabaseAdmin
    .from('subjects')
    .select('id, name, code, division_id')
    .eq('division_id', division?.id);

  // Get teachers
  const { data: teachers } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, user_id, department, designation, user:users!teachers_user_id_fkey(id, full_name, email)');

  const subjectMap = {};
  (subjects || []).forEach((s) => {
    subjectMap[s.code] = s;
  });

  const teacherMap = {};
  (teachers || []).forEach((t) => {
    const fullName = t.user?.full_name;
    if (fullName) {
      teacherMap[fullName] = t;
    }
  });

  academicCache = { division, subjects: subjectMap, teachers: teacherMap, allTeachers: teachers || [] };
  cacheTime = now;
  return academicCache;
}

// Calculate dynamic status based on start and end time
function getSlotStatus(startTime, endTime, targetDateStr) {
  const todayStr = new Date().toISOString().split('T')[0];
  if (targetDateStr < todayStr) return 'COMPLETED';
  if (targetDateStr > todayStr) return 'SCHEDULED';

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = (startTime || '00:00').split(':').map(Number);
  const [eh, em] = (endTime || '23:59').split(':').map(Number);

  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 23) * 60 + (em || 59);

  if (currentMinutes < startMin) return 'UPCOMING';
  if (currentMinutes > endMin) return 'COMPLETED';
  return 'ONGOING';
}

// Ensure today's lectures from the timetable are generated in the database
async function syncTodayLectures(targetDateStr) {
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  const dayName = DAY_NAMES[targetDate.getDay()];

  const daySchedule = SMDL_TIMETABLE_MATRIX.weekly_schedule[dayName] || [];
  if (daySchedule.length === 0) {
    return { date: dateStr, day: dayName, is_holiday: true, count: 0 };
  }

  const { division, subjects, teachers } = await getAcademicEntities();
  if (!division) return { error: 'Division not found' };

  // Check which lectures already exist for target date
  const { data: existingLectures } = await supabaseAdmin
    .from('lectures')
    .select('id, subject_id, teacher_id, division_id, start_time, end_time, topic, lecture_date')
    .eq('division_id', division.id)
    .eq('lecture_date', dateStr);

  const existingBySlot = new Set((existingLectures || []).map((l) => `${l.start_time}-${l.subject_id}`));

  const toInsert = [];
  for (const item of daySchedule) {
    const slot = SMDL_TIMETABLE_MATRIX.time_slots.find((s) => s.slot_id === item.slot_id);
    if (!slot) continue;

    const subj = subjects[item.code];
    const teacher = teachers[item.teacher];
    if (!subj) continue;

    const key = `${slot.start_time}-${subj.id}`;
    if (!existingBySlot.has(key)) {
      toInsert.push({
        subject_id: subj.id,
        teacher_id: teacher?.id || null,
        division_id: division.id,
        lecture_date: dateStr,
        start_time: slot.start_time,
        end_time: slot.end_time,
        topic: `${item.name} (${item.type})`,
        created_by: teacher?.user_id || division.id,
      });
    }
  }

  if (toInsert.length > 0) {
    await supabaseAdmin.from('lectures').insert(toInsert);
  }

  return { date: dateStr, day: dayName, inserted: toInsert.length };
}

module.exports = {
  SMDL_TIMETABLE_MATRIX,
  DAY_NAMES,
  getAcademicEntities,
  getSlotStatus,
  syncTodayLectures,
};
