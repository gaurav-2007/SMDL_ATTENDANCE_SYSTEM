const { supabaseAdmin } = require('../config/db');
const {
  getKolkataDateString,
  getKolkataDayName,
  getKolkataMinutes,
} = require('../utils/dateUtils');

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
  const { data: divisions, error: divErr } = await supabaseAdmin
    .from('divisions')
    .select('id, name, division_name')
    .eq('name', 'FYBSc CS');
  if (divErr) {
    console.error('[TimetableSync] Failed to query FYBSc CS division:', divErr.message);
    return { division: null, subjects: {}, teachers: {}, allTeachers: [], error: divErr.message };
  }
  const division = divisions?.[0] || null;

  // Get FYBSc CS subjects
  let subjects = [];
  if (division?.id) {
    const { data: subData, error: subErr } = await supabaseAdmin
      .from('subjects')
      .select('id, name, code, division_id')
      .eq('division_id', division.id);
    if (subErr) {
      console.error('[TimetableSync] Failed to query subjects:', subErr.message);
      return { division, subjects: {}, teachers: {}, allTeachers: [], error: subErr.message };
    }
    subjects = subData || [];
  }

  // Get teachers
  const { data: teachers, error: tchErr } = await supabaseAdmin
    .from('teachers')
    .select('id, teacher_id, user_id, department, designation, user:users!teachers_user_id_fkey(id, full_name, email)');
  if (tchErr) {
    console.warn('[TimetableSync] Failed to query teachers:', tchErr.message);
  }

  const subjectMap = {};
  (subjects || []).forEach((s) => {
    subjectMap[s.code] = s;
    // Map by tag in parenthesis e.g. "Data Structures & Algorithms (DSA)" -> "DSA"
    const match = s.name.match(/\(([^)]+)\)/);
    if (match) {
      subjectMap[match[1]] = s;
      subjectMap[match[1].toUpperCase()] = s;
    }
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
  const todayStr = getKolkataDateString();
  if (targetDateStr < todayStr) return 'COMPLETED';
  if (targetDateStr > todayStr) return 'SCHEDULED';

  const now = new Date();
  const currentMinutes = getKolkataMinutes();

  const [sh, sm] = (startTime || '00:00').split(':').map(Number);
  const [eh, em] = (endTime || '23:59').split(':').map(Number);

  const startMin = (Number.isFinite(sh) ? sh : 0) * 60 + (Number.isFinite(sm) ? sm : 0);
  const endMin = (Number.isFinite(eh) ? eh : 23) * 60 + (Number.isFinite(em) ? em : 59);

  if (currentMinutes < startMin) return 'UPCOMING';
  if (currentMinutes > endMin) return 'COMPLETED';
  return 'ONGOING';
}

// Prevent duplicate inserts from concurrent requests for the same date
const activeSyncLocks = new Map();

function normalizeTimeHHMM(t) {
  const parts = String(t || '').trim().split(':');
  if (parts.length < 2) return '';
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

async function performSyncTodayLectures(targetDateStr) {
  const dateStr = targetDateStr ? getKolkataDateString(targetDateStr) : getKolkataDateString();
  const dayName = getKolkataDayName(dateStr);

  // 1. Fetch active divisions with their current_semester
  const { data: divisionsList, error: divListErr } = await supabaseAdmin
    .from('divisions')
    .select('id, name, division_name, current_semester');

  const divisionSemesterMap = new Map();
  if (!divListErr && divisionsList) {
    divisionsList.forEach((d) => {
      divisionSemesterMap.set(d.id, d.current_semester || 1);
    });
  }

  // 2. Load live multi-division timetable slots for today's weekday
  const { data: dayTimetableSlots, error: ttErr } = await supabaseAdmin
    .from('division_timetables')
    .select('id, division_id, semester, academic_year, day_of_week, start_time, end_time, subject_id, teacher_id, is_lab, subject:subjects(id, name, code), teacher:teachers(id, user_id)')
    .ilike('day_of_week', dayName)
    .order('start_time', { ascending: true });

  if (ttErr) {
    if (ttErr.code !== '42P01') {
      console.error('[TimetableSync] Failed to query division_timetables:', ttErr.message);
      return { date: dateStr, day: dayName, inserted: 0, error: ttErr.message };
    }
    console.warn('[TimetableSync] division_timetables table unavailable; checking legacy fallback:', ttErr.message);
  }

  // 3. Check which lectures already exist across all divisions for target date
  let { data: existingLectures, error: existErr } = await supabaseAdmin
    .from('lectures')
    .select('id, subject_id, teacher_id, division_id, semester, academic_year, start_time, end_time, topic, lecture_date')
    .eq('lecture_date', dateStr);

  if (existErr && existErr.code === '42703') {
    // Graceful fallback if lectures columns not yet populated
    const retry = await supabaseAdmin
      .from('lectures')
      .select('id, subject_id, teacher_id, division_id, semester, academic_year, start_time, end_time, topic, lecture_date')
      .eq('lecture_date', dateStr);
    existingLectures = retry.data;
    existErr = retry.error;
  }

  if (existErr) {
    console.error('[TimetableSync] Failed to query existing lectures:', existErr.message);
    return { date: dateStr, day: dayName, inserted: 0, error: existErr.message };
  }

  const existingBySlot = new Set();
  const occupiedTimeSlots = new Set();

  for (const l of existingLectures || []) {
    const isCancelled = Boolean(l.topic && l.topic.includes('[CANCELLED]'));
    if (isCancelled) continue;

    const normTime = normalizeTimeHHMM(l.start_time);
    const activeSem = divisionSemesterMap.get(l.division_id) || 1;
    const lSem = l.semester !== undefined && l.semester !== null ? Number(l.semester) : null;

    // 1. Any lecture on this date with matching (division, start_time, subject) is marked existing
    existingBySlot.add(`${l.division_id}-${normTime}-${l.subject_id}`);

    // 2. Any active lecture in this division at this start_time occupies the slot so duplicates are never inserted
    occupiedTimeSlots.add(`${l.division_id}-${normTime}`);
  }

  // Build unified candidate list strictly matching each division's active current_semester
  const candidateSlots = [];
  for (const slot of dayTimetableSlots || []) {
    if (!slot.division_id || !slot.subject_id) continue;

    const activeSemester = divisionSemesterMap.get(slot.division_id) || 1;
    const slotSemester = slot.semester !== undefined && slot.semester !== null ? Number(slot.semester) : 1;
    if (slotSemester !== activeSemester) {
      continue; // Skip slots from non-active semesters
    }

    candidateSlots.push({
      division_id: slot.division_id,
      subject_id: slot.subject_id,
      teacher_id: slot.teacher_id || null,
      semester: slotSemester,
      academic_year: slot.academic_year || '2026-27',
      start_time: slot.start_time,
      end_time: slot.end_time,
      topic: slot.subject?.name
        ? `${slot.subject.name} (${slot.is_lab ? 'Practical' : 'Lecture'})`
        : 'Scheduled Lecture',
      created_by: slot.teacher?.user_id || null,
    });
  }

  // 3. Legacy matrix fallback ONLY for FYBSc CS when absent in division_timetables
  const legacyDaySchedule = SMDL_TIMETABLE_MATRIX.weekly_schedule[dayName] || [];
  if (legacyDaySchedule.length > 0) {
    const { division, subjects, teachers, error: entErr } = await getAcademicEntities();
    if (!entErr && division) {
      const { data: divConfiguredRows, error: divCheckErr } = await supabaseAdmin
        .from('division_timetables')
        .select('id')
        .eq('division_id', division.id)
        .limit(1);

      if (divCheckErr && divCheckErr.code !== '42P01') {
        console.warn('[TimetableSync] Skipping legacy fallback check due to division_timetables error:', divCheckErr.message);
      } else {
        const hasDivisionTimetable = !divCheckErr && divConfiguredRows && divConfiguredRows.length > 0;
        if (!hasDivisionTimetable) {
          for (const item of legacyDaySchedule) {
            const slot = SMDL_TIMETABLE_MATRIX.time_slots.find((s) => s.slot_id === item.slot_id);
            if (!slot) continue;

            const subj = subjects[item.code];
            const teacher = teachers[item.teacher];
            if (!subj) continue;

            candidateSlots.push({
              division_id: division.id,
              subject_id: subj.id,
              teacher_id: teacher?.id || null,
              semester: division.current_semester || 1,
              academic_year: '2026-27',
              start_time: slot.start_time,
              end_time: slot.end_time,
              topic: `${item.name} (${item.type})`,
              created_by: teacher?.user_id || null,
            });
          }
        }
      }
    }
  }

  // Track exact timetable slot keys so off-slot moved lectures (RESCHEDULED / ONGOING / COMPLETED) can be identified
  const timetableExactKeys = new Set(
    candidateSlots.map((c) => `${c.division_id}-${normalizeTimeHHMM(c.start_time)}-${c.subject_id}`)
  );

  // Collect unmatched slots in Pass 1
  const unmatchedByDivSubj = new Map();
  for (const c of candidateSlots) {
    const normTime = normalizeTimeHHMM(c.start_time);
    const exactKey = `${c.division_id}-${normTime}-${c.subject_id}`;
    const timeKey = `${c.division_id}-${normTime}`;
    if (existingBySlot.has(exactKey) || occupiedTimeSlots.has(timeKey)) {
      continue;
    }
    const divSubjKey = `${c.division_id}-${c.subject_id}`;
    if (!unmatchedByDivSubj.has(divSubjKey)) unmatchedByDivSubj.set(divSubjKey, []);
    unmatchedByDivSubj.get(divSubjKey).push(c);
  }

  // Collect off-slot lectures ONLY when they carry explicit reschedule provenance
  // (RESCHEDULED status or [RESCHEDULED] topic tag). Normal manual ONGOING/COMPLETED
  // extra lectures must NEVER suppress or replace regular timetable slots.
  // Limitation: without timetable_slot_id & original_lecture_date columns, cross-date
  // reschedules and multi-slot same-subject moves cannot be disambiguated automatically.
  const offSlotReschedByDivSubj = new Map();
  for (const l of existingLectures || []) {
    if (!l.division_id || !l.subject_id) continue;
    const stUpper = String(l.status || 'SCHEDULED').toUpperCase();
    const isCancelled =
      stUpper === 'CANCELLED' ||
      (['SCHEDULED', 'ACTIVE'].includes(stUpper) && Boolean(l.topic && l.topic.includes('[CANCELLED]')));
    if (isCancelled) continue;

    const normTime = normalizeTimeHHMM(l.start_time);
    const exactKey = `${l.division_id}-${normTime}-${l.subject_id}`;
    if (timetableExactKeys.has(exactKey)) continue;

    const hasExplicitResched =
      stUpper === 'RESCHEDULED' || Boolean(l.topic && l.topic.includes('[RESCHEDULED]'));
    if (hasExplicitResched) {
      const divSubjKey = `${l.division_id}-${l.subject_id}`;
      if (!offSlotReschedByDivSubj.has(divSubjKey)) offSlotReschedByDivSubj.set(divSubjKey, []);
      offSlotReschedByDivSubj.get(divSubjKey).push(l);
    }
  }

  const toInsert = [];
  for (const [divSubjKey, groupSlots] of unmatchedByDivSubj.entries()) {
    const reschedCandidates = offSlotReschedByDivSubj.get(divSubjKey) || [];
    if (groupSlots.length === 1 && reschedCandidates.length === 1) {
      // Unambiguous 1-to-1 association: single unmatched slot covered by explicit rescheduled lecture
      continue;
    }
    if (reschedCandidates.length > 0 && (groupSlots.length > 1 || reschedCandidates.length > 1)) {
      console.warn(
        '[TimetableSync] Ambiguous rescheduled slot mapping without timetable_slot_id; refusing to guess:',
        { divSubjKey, unmatchedSlots: groupSlots.length, reschedCandidates: reschedCandidates.length }
      );
    }

    for (const slot of groupSlots) {
      const normTime = normalizeTimeHHMM(slot.start_time);
      const exactKey = `${slot.division_id}-${normTime}-${slot.subject_id}`;
      const timeKey = `${slot.division_id}-${normTime}`;
      if (!existingBySlot.has(exactKey) && !occupiedTimeSlots.has(timeKey)) {
        existingBySlot.add(exactKey);
        occupiedTimeSlots.add(timeKey);
        toInsert.push({
          subject_id: slot.subject_id,
          teacher_id: slot.teacher_id,
          division_id: slot.division_id,
          semester: slot.semester || 1,
          academic_year: slot.academic_year || '2026-27',
          lecture_date: dateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
          topic: slot.topic,
          status: 'SCHEDULED',
          created_by: slot.created_by,
        });
      }
    }
  }

  if (toInsert.length > 0) {
    // lectures table in Supabase does not have a status column; strip status while strictly preserving semester and academic_year
    const toInsertClean = toInsert.map(({ status: _st, ...rest }) => rest);
    let { error: insertErr } = await supabaseAdmin.from('lectures').insert(toInsertClean);
    if (insertErr && (insertErr.code === '42703' || String(insertErr.message).includes('semester'))) {
      // Fallback: strip semester/academic_year only if DB schema truly lacks those columns
      const withoutSemester = toInsertClean.map(({ semester: _sem, academic_year: _ay, ...rest }) => rest);
      const retryInsert = await supabaseAdmin.from('lectures').insert(withoutSemester);
      insertErr = retryInsert.error;
    }
    if (insertErr) {
      console.error('[TimetableSync] Failed to insert lectures:', insertErr.message);
      return { date: dateStr, day: dayName, inserted: 0, error: insertErr.message };
    }
  }

  if ((dayTimetableSlots || []).length === 0 && toInsert.length === 0 && (existingLectures || []).length === 0) {
    return { date: dateStr, day: dayName, is_holiday: true, count: 0, inserted: 0 };
  }

  return { date: dateStr, day: dayName, inserted: toInsert.length };
}

// Ensure today's lectures from the timetable are generated in the database
async function syncTodayLectures(targetDateStr) {
  const lockKey = targetDateStr ? getKolkataDateString(targetDateStr) : getKolkataDateString();
  if (activeSyncLocks.has(lockKey)) {
    return activeSyncLocks.get(lockKey);
  }

  const promise = performSyncTodayLectures(targetDateStr).finally(() => {
    activeSyncLocks.delete(lockKey);
  });
  activeSyncLocks.set(lockKey, promise);
  return promise;
}

// Safely reconciles today's lectures when a division's active semester is switched:
// Preserves historical attended lectures; purges/cancels uncommenced empty lectures
// of the old semester; regenerates today's schedule from the new semester's timetable.
async function reconcileTodayLecturesOnSemesterSwitch(divisionId, oldSemester, newSemester, targetDateStr) {
  const dateStr = targetDateStr ? getKolkataDateString(targetDateStr) : getKolkataDateString();

  try {
    // 1. Fetch all lectures for this division on target date
    const { data: divLectures, error: lecErr } = await supabaseAdmin
      .from('lectures')
      .select('id, semester, start_time, end_time, topic')
      .eq('division_id', divisionId)
      .eq('lecture_date', dateStr);

    if (lecErr) {
      console.error('[reconcileTodayLecturesOnSemesterSwitch] Error loading lectures:', lecErr.message);
      return await syncTodayLectures(dateStr);
    }

    if (divLectures && divLectures.length > 0) {
      // 2. Identify candidate lectures of the old semester (or non-newSemester)
      const oldLectures = divLectures.filter((l) => {
        const sem = l.semester !== undefined && l.semester !== null ? Number(l.semester) : 1;
        return sem !== Number(newSemester);
      });

      if (oldLectures.length > 0) {
        const oldLectureIds = oldLectures.map((l) => l.id);

        // 3. Check which lectures already have attendance marked
        const { data: attendanceRows, error: attErr } = await supabaseAdmin
          .from('attendance')
          .select('lecture_id')
          .in('lecture_id', oldLectureIds);

        const attendedLectureIds = new Set((attendanceRows || []).map((a) => a.lecture_id));

        // 4. Safely filter for lectures with 0 attendance that have NOT completed
        const toPurgeIds = [];
        for (const l of oldLectures) {
          if (attendedLectureIds.has(l.id)) {
            // Has attendance records -> MUST PRESERVE as historical record!
            continue;
          }
          const slotStatus = getSlotStatus(l.start_time, l.end_time, dateStr);
          if (slotStatus === 'COMPLETED' || l.topic?.includes('[COMPLETED]')) {
            continue;
          }
          toPurgeIds.push(l.id);
        }

        if (toPurgeIds.length > 0) {
          console.log(`[reconcileTodayLecturesOnSemesterSwitch] Purging ${toPurgeIds.length} uncommenced old-semester lectures for division ${divisionId}:`, toPurgeIds);

          // Clean up any claimed notification logs for these purged lectures
          await supabaseAdmin
            .from('lecture_notification_logs')
            .delete()
            .in('lecture_id', toPurgeIds);

          // Delete the uncommenced lecture rows
          const { error: delErr } = await supabaseAdmin
            .from('lectures')
            .delete()
            .in('id', toPurgeIds);

          if (delErr) {
            console.warn('[reconcileTodayLecturesOnSemesterSwitch] Direct delete failed, marking CANCELLED:', delErr.message);
            await supabaseAdmin
              .from('lectures')
              .update({
                topic: '[CANCELLED - SEMESTER SWITCH]',
              })
              .in('id', toPurgeIds);
          }
        }
      }
    }
  } catch (err) {
    console.error('[reconcileTodayLecturesOnSemesterSwitch] Unexpected error:', err.message);
  }

  // 5. Force fresh synchronization of today's timetable for the new active semester
  return await syncTodayLectures(dateStr);
}

module.exports = {
  SMDL_TIMETABLE_MATRIX,
  DAY_NAMES,
  getAcademicEntities,
  getSlotStatus,
  syncTodayLectures,
  reconcileTodayLecturesOnSemesterSwitch,
};
