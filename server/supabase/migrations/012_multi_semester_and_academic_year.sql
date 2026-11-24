-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- Migration: 012_multi_semester_and_academic_year.sql
-- Module: Multi-Semester (Sem 1 to 6) & Academic Year Management
-- =====================================================================

-- 1. divisions: Add active semester tracking (default 1)
ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS current_semester INT NOT NULL DEFAULT 1;

-- 2. subjects: Tag each subject with its semester (default 1)
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS semester INT NOT NULL DEFAULT 1;

-- 3. division_timetables: Tag slots with semester & academic year
ALTER TABLE division_timetables
  ADD COLUMN IF NOT EXISTS semester INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '2026-27';

-- 4. lectures: Tag lecture sessions with semester & academic year
ALTER TABLE lectures
  ADD COLUMN IF NOT EXISTS semester INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '2026-27';

-- 5. Integrity Constraints: Semesters must be strictly between 1 and 6
ALTER TABLE divisions DROP CONSTRAINT IF EXISTS chk_div_semester;
ALTER TABLE divisions ADD CONSTRAINT chk_div_semester CHECK (current_semester BETWEEN 1 AND 6);

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS chk_sub_semester;
ALTER TABLE subjects ADD CONSTRAINT chk_sub_semester CHECK (semester BETWEEN 1 AND 6);

ALTER TABLE division_timetables DROP CONSTRAINT IF EXISTS chk_tt_semester;
ALTER TABLE division_timetables ADD CONSTRAINT chk_tt_semester CHECK (semester BETWEEN 1 AND 6);

ALTER TABLE lectures DROP CONSTRAINT IF EXISTS chk_lec_semester;
ALTER TABLE lectures ADD CONSTRAINT chk_lec_semester CHECK (semester BETWEEN 1 AND 6);

-- 6. Dynamically remove old unique constraint on (division_id, day_of_week, start_time)
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'division_timetables'::regclass
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attname)
        FROM unnest(con.conkey) k
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k
      ) = ARRAY['day_of_week','division_id','start_time']
  LOOP
    EXECUTE format('ALTER TABLE division_timetables DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 7. Add composite unique constraint incorporating semester and academic year
ALTER TABLE division_timetables DROP CONSTRAINT IF EXISTS division_timetables_unique_slot;
ALTER TABLE division_timetables
  ADD CONSTRAINT division_timetables_unique_slot
  UNIQUE (division_id, semester, academic_year, day_of_week, start_time);

-- 8. Performance index for daily scheduler queries
CREATE INDEX IF NOT EXISTS idx_division_tt_active_slot
  ON division_timetables (division_id, semester, day_of_week);

-- 9. Audit Trail: Track semester switches and academic year promotions
CREATE TABLE IF NOT EXISTS semester_switch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
  from_semester INT NOT NULL CHECK (from_semester BETWEEN 1 AND 6),
  to_semester INT NOT NULL CHECK (to_semester BETWEEN 1 AND 6),
  academic_year TEXT NOT NULL DEFAULT '2026-27',
  switched_by UUID REFERENCES users(id) ON DELETE SET NULL,
  switched_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT 'Regular semester promotion'
);

CREATE INDEX IF NOT EXISTS idx_semester_switch_division 
  ON semester_switch_logs (division_id, switched_at DESC);
