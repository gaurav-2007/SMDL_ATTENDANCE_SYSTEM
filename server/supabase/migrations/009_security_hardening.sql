-- ====================================================================
-- SMDL College Smart Attendance System - Migration 009
-- Purpose: Comprehensive Database Hardening & Row-Level Security (RLS)
-- Protects against direct PostgREST anon scraping and unauthorized mutations
-- ====================================================================

-- 1. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- (Even if already enabled, PostgreSQL handles this idempotently)

DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'users',
    'students',
    'teachers',
    'teacher_subjects',
    'attendance',
    'attendance_audit_logs',
    'lectures',
    'subjects',
    'courses',
    'departments',
    'divisions',
    'announcements',
    'announcement_attachments',
    'notifications',
    'system_config',
    'division_timetables',
    'email_verifications',
    'password_reset_tokens',
    'user_devices',
    'lecture_notification_logs',
    'low_attendance_warnings',
    'notification_preferences'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END $$;

-- 2. REVOKE ALL DIRECT PERMISSIONS FROM 'anon' ROLE ON PRIVATE SENSITIVE TABLES
-- Node.js API connects via 'service_role' (which bypasses RLS safely on the backend)
-- The browser anon key MUST NOT have direct SELECT, INSERT, UPDATE, or DELETE access to sensitive tables:

DO $$
DECLARE
  t text;
  sensitive_tables text[] := ARRAY[
    'users',
    'email_verifications',
    'password_reset_tokens',
    'attendance_audit_logs',
    'system_config',
    'lecture_notification_logs',
    'low_attendance_warnings'
  ];
BEGIN
  FOREACH t IN ARRAY sensitive_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon;', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated;', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', t);
    END IF;
  END LOOP;
END $$;

-- 3. ENSURE STRICT POLICIES FOR REALTIME NOTIFICATIONS
-- Only allow authenticated users to listen to their own notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    DROP POLICY IF EXISTS "Users can only read own notifications" ON public.notifications;
    CREATE POLICY "Users can only read own notifications"
      ON public.notifications
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. SERVICE ROLE PERMISSIONS ASSURANCE
-- Ensure service_role has unconditional grants across all tables in schema public
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 5. AUDIT LOGGING FOR DATABASE HARDENING
COMMENT ON SCHEMA public IS 'SMDL Smart Attendance Schema - Hardened with RLS and Anon Restrictions';
