-- =====================================================================
-- SMDL College Smart Attendance & Communication System
-- Migration: 011_add_lectures_status.sql
-- Purpose: Add canonical lectures.status column, backfill legacy
--          [CANCELLED] / [RESCHEDULED] topic markers, enforce allowed
--          lifecycle CHECK constraint (with provisional 'ACTIVE'
--          compatibility for zero-downtime deployment), and add
--          indexes for reminders and analytics.
--
-- SAFETY NOTICE:
--   - Preserves all existing lecture IDs, topics, attendance rows,
--     and foreign-key relationships.
--   - Production execution requires explicit manual approval + backup.
-- =====================================================================

BEGIN;

-- 1. Add NOT NULL status column defaulting to canonical 'SCHEDULED'
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED';

-- 2. Backfill legacy topic-tagged rows (preserves original topic text for rollback safety)
UPDATE public.lectures
SET status = 'CANCELLED'
WHERE topic ILIKE '%[CANCELLED]%'
  AND status <> 'CANCELLED';

UPDATE public.lectures
SET status = 'RESCHEDULED'
WHERE topic ILIKE '%[RESCHEDULED]%'
  AND status <> 'RESCHEDULED'
  AND status <> 'CANCELLED';

-- 3. Defensive normalization prior to CHECK constraint creation
UPDATE public.lectures
SET status = 'SCHEDULED'
WHERE status IS NULL
   OR status NOT IN ('SCHEDULED', 'ACTIVE', 'ONGOING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- 4. CHECK constraint: provisionally permits 'ACTIVE' alongside the 5 canonical
--    lifecycle states so legacy backend instances writing status='ACTIVE' do not fail
--    during zero-downtime migration-before-code rollout.
ALTER TABLE public.lectures
  DROP CONSTRAINT IF EXISTS chk_lectures_status;

ALTER TABLE public.lectures
  ADD CONSTRAINT chk_lectures_status
  CHECK (status IN ('SCHEDULED', 'ACTIVE', 'ONGOING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'));

-- 5. Indexes for per-minute reminder scheduler and low-attendance / dashboard queries
CREATE INDEX IF NOT EXISTS idx_lectures_date_status
  ON public.lectures (lecture_date, status);

CREATE INDEX IF NOT EXISTS idx_lectures_div_subj_status
  ON public.lectures (division_id, subject_id, status);

COMMIT;

-- =====================================================================
-- OPTIONAL POST-DEPLOY CLEANUP (RUN ONLY AFTER NEW BACKEND IS LIVE):
--
-- BEGIN;
-- UPDATE public.lectures SET status = 'SCHEDULED' WHERE status = 'ACTIVE';
-- ALTER TABLE public.lectures DROP CONSTRAINT IF EXISTS chk_lectures_status;
-- ALTER TABLE public.lectures ADD CONSTRAINT chk_lectures_status
--   CHECK (status IN ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'));
-- COMMIT;
-- =====================================================================

