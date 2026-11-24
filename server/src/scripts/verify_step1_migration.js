const { supabaseAdmin } = require('../config/db');

async function verifyStep1() {
  console.log('\n======================================================');
  console.log('   STEP 1: DATABASE MIGRATION VERIFICATION AUDIT');
  console.log('======================================================\n');

  let allPassed = true;

  // 1. Check divisions.current_semester
  try {
    const { data: div, error: divErr } = await supabaseAdmin
      .from('divisions')
      .select('id, name, current_semester')
      .limit(3);

    if (divErr) {
      console.log('❌ [divisions] current_semester column NOT FOUND:', divErr.message);
      allPassed = false;
    } else {
      console.log('✅ [divisions] current_semester column is ACTIVE. Sample:', div);
    }
  } catch (err) {
    console.log('❌ [divisions] Query failed:', err.message);
    allPassed = false;
  }

  // 2. Check subjects.semester
  try {
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subjects')
      .select('id, name, code, semester')
      .limit(3);

    if (subErr) {
      console.log('❌ [subjects] semester column NOT FOUND:', subErr.message);
      allPassed = false;
    } else {
      console.log('✅ [subjects] semester column is ACTIVE. Sample:', sub);
    }
  } catch (err) {
    console.log('❌ [subjects] Query failed:', err.message);
    allPassed = false;
  }

  // 3. Check division_timetables.semester and academic_year
  try {
    const { data: tt, error: ttErr } = await supabaseAdmin
      .from('division_timetables')
      .select('id, division_id, semester, academic_year, day_of_week, start_time')
      .limit(3);

    if (ttErr) {
      console.log('❌ [division_timetables] semester/academic_year NOT FOUND:', ttErr.message);
      allPassed = false;
    } else {
      console.log('✅ [division_timetables] semester & academic_year ACTIVE. Sample:', tt);
    }
  } catch (err) {
    console.log('❌ [division_timetables] Query failed:', err.message);
    allPassed = false;
  }

  // 4. Check lectures.semester and academic_year
  try {
    const { data: lec, error: lecErr } = await supabaseAdmin
      .from('lectures')
      .select('id, semester, academic_year, lecture_date, start_time')
      .limit(3);

    if (lecErr) {
      console.log('❌ [lectures] semester/academic_year NOT FOUND:', lecErr.message);
      allPassed = false;
    } else {
      console.log('✅ [lectures] semester & academic_year ACTIVE. Sample:', lec);
    }
  } catch (err) {
    console.log('❌ [lectures] Query failed:', err.message);
    allPassed = false;
  }

  // 5. Check semester_switch_logs table
  try {
    const { data: logs, error: logErr } = await supabaseAdmin
      .from('semester_switch_logs')
      .select('id, from_semester, to_semester, academic_year')
      .limit(1);

    if (logErr) {
      console.log('❌ [semester_switch_logs] Table NOT FOUND or inaccessible:', logErr.message);
      allPassed = false;
    } else {
      console.log('✅ [semester_switch_logs] Table is READY.');
    }
  } catch (err) {
    console.log('❌ [semester_switch_logs] Query failed:', err.message);
    allPassed = false;
  }

  // Summary Count of lectures
  try {
    const { data: countData, error: countErr } = await supabaseAdmin
      .from('lectures')
      .select('semester, academic_year', { count: 'exact' });

    if (!countErr && countData) {
      console.log(`\n📊 Total Existing Lectures Count: ${countData.length}`);
      const nonSem1 = countData.filter(l => l.semester !== 1);
      if (nonSem1.length === 0) {
        console.log('✅ 100% of historical lectures are safely tagged with semester = 1');
      } else {
        console.log(`⚠️ Notice: Found ${nonSem1.length} lectures with semester != 1`);
      }
    }
  } catch (_e) {}

  console.log('\n======================================================');
  if (allPassed) {
    console.log('🎉 STEP 1 MIGRATION STATUS: 100% VERIFIED AND READY!');
  } else {
    console.log('⚠️ STEP 1 MIGRATION STATUS: PENDING EXECUTION IN SUPABASE');
    console.log('Please execute 012_multi_semester_and_academic_year.sql in Supabase SQL Editor.');
  }
  console.log('======================================================\n');
}

verifyStep1();
